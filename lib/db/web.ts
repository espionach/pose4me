/*
 * Web storage: IndexedDB via Dexie. Used in the browser (and the Playwright tests).
 * Don't import this from screens — go through lib/db.ts.
 */

import Dexie, { type Table } from "dexie";
import type { NewPose, Pose, PosePatch, Profile, Shoot, ShootFields } from "../types";
import type { Backend } from "./backend";

// --- schema ------------------------------------------------------------------------------

type ProfileRow = { id: "me"; display_name: string; updated_at: string };
type ShootRow = { id: string; title: string; shoot_date: string | null; shoot_time: string | null; created_at: string; updated_at: string };
type PoseRow = {
  id: string;
  photoshoot_id: string;
  position: number;
  title: string;
  who: string;
  duration_minutes: number;
  notes: string;
  image_id: string;
  created_at: string;
  updated_at: string;
};
type ImageRow = { id: string; blob: Blob };

class ShootPlannerDB extends Dexie {
  profile!: Table<ProfileRow, string>;
  photoshoots!: Table<ShootRow, string>;
  poses!: Table<PoseRow, string>;
  images!: Table<ImageRow, string>;

  constructor() {
    super("shoot-planner");
    // Bump the version and add a .upgrade() here for any future schema change.
    this.version(1).stores({
      profile: "id",
      photoshoots: "id, created_at",
      poses: "id, photoshoot_id, [photoshoot_id+position], image_id",
      images: "id",
    });
  }
}

let _db: ShootPlannerDB | null = null;
const db = () => (_db ??= new ShootPlannerDB());

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const minutes = (n: number) => Math.max(1, Math.round(n) || 1);

const toShoot = (r: ShootRow): Shoot => ({ id: r.id, title: r.title, date: r.shoot_date, time: r.shoot_time, createdAt: r.created_at, updatedAt: r.updated_at });
const toPose = (r: PoseRow): Pose => ({
  id: r.id,
  shootId: r.photoshoot_id,
  position: r.position,
  title: r.title,
  who: r.who,
  minutes: r.duration_minutes,
  note: r.notes,
  imageId: r.image_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function poseRow(shootId: string, position: number, p: NewPose, t: string): PoseRow {
  return {
    id: newId(),
    photoshoot_id: shootId,
    position,
    title: p.title,
    who: p.who,
    duration_minutes: minutes(p.minutes),
    notes: p.note,
    image_id: p.imageId,
    created_at: t,
    updated_at: t,
  };
}

const posesOf = (shootId: string) => db().poses.where("[photoshoot_id+position]").between([shootId, Dexie.minKey], [shootId, Dexie.maxKey]);

// --- one-time import of data saved by earlier builds (localStorage) ---------------------

const LEGACY_STATE = "shoot-planner:v1";
const LEGACY_PROFILE = "shoot-planner:profile";
const LEGACY_MOCK_SHOOTS = new Set(["golden-hour", "downtown-film", "bday-dinner"]);

type LegacyPose = { photoUri: string; title: string; who: string; minutes: number; note: string };
type LegacyShoot = { id: string; title: string; date: string; time: string; poses: LegacyPose[] };

async function importLegacy(d: ShootPlannerDB) {
  let rawState: string | null = null;
  let rawProfile: string | null = null;
  try {
    rawState = localStorage.getItem(LEGACY_STATE);
    rawProfile = localStorage.getItem(LEGACY_PROFILE);
  } catch {
    return;
  }
  if (!rawState && !rawProfile) return;
  try {
    const shoots: LegacyShoot[] = (rawState ? JSON.parse(rawState).shoots : null) ?? [];
    const profile: Profile | null = rawProfile ? JSON.parse(rawProfile) : null;
    const images: ImageRow[] = [];
    const shootRows: ShootRow[] = [];
    const poseRows: PoseRow[] = [];
    const t = now();
    for (const s of shoots) {
      if (LEGACY_MOCK_SHOOTS.has(s.id)) continue;
      const row: ShootRow = { id: newId(), title: s.title, shoot_date: s.date || null, shoot_time: s.time || null, created_at: t, updated_at: t };
      shootRows.push(row);
      let position = 0;
      for (const p of s.poses ?? []) {
        if (!p.photoUri?.startsWith("data:")) continue; // old stick-figure demo photos
        const imageId = newId();
        images.push({ id: imageId, blob: await (await fetch(p.photoUri)).blob() });
        poseRows.push(poseRow(row.id, position++, { ...p, imageId }, t));
      }
    }
    await d.transaction("rw", d.profile, d.photoshoots, d.poses, d.images, async () => {
      if (profile?.displayName && !(await d.profile.get("me"))) await d.profile.put({ id: "me", display_name: profile.displayName, updated_at: t });
      await d.images.bulkAdd(images);
      await d.photoshoots.bulkAdd(shootRows);
      await d.poses.bulkAdd(poseRows);
    });
    localStorage.removeItem(LEGACY_STATE);
    localStorage.removeItem(LEGACY_PROFILE);
  } catch {
    // Leave the old data in place and try again next launch.
  }
}

let _ready: Promise<void> | null = null;

// --- the backend -------------------------------------------------------------------------

export const webBackend: Backend = {
  ready: () =>
    (_ready ??= db()
      .open()
      .then((d) => importLegacy(d as ShootPlannerDB))),

  async getProfile() {
    const row = await db().profile.get("me");
    return row ? { displayName: row.display_name } : null;
  },
  async saveProfile(profile) {
    await db().profile.put({ id: "me", display_name: profile.displayName, updated_at: now() });
  },

  async listShoots() {
    return (await db().photoshoots.orderBy("created_at").reverse().toArray()).map(toShoot);
  },
  async getShoot(id) {
    const row = await db().photoshoots.get(id);
    return row ? toShoot(row) : null;
  },
  createShoot(fields, poses) {
    return db().transaction("rw", db().photoshoots, db().poses, async () => {
      const t = now();
      const row: ShootRow = { id: newId(), title: fields.title, shoot_date: fields.date || null, shoot_time: fields.time || null, created_at: t, updated_at: t };
      await db().photoshoots.add(row);
      await db().poses.bulkAdd(poses.map((p, i) => poseRow(row.id, i, p, t)));
      return toShoot(row);
    });
  },
  async updateShoot(id, patch) {
    const changes: Partial<ShootRow> = { updated_at: now() };
    if (patch.title !== undefined) changes.title = patch.title;
    if (patch.date !== undefined) changes.shoot_date = patch.date || null;
    if (patch.time !== undefined) changes.shoot_time = patch.time || null;
    await db().photoshoots.update(id, changes);
  },
  async deleteShoots(ids) {
    if (!ids.length) return;
    await db().transaction("rw", db().photoshoots, db().poses, db().images, async () => {
      const poses = await db().poses.where("photoshoot_id").anyOf(ids).toArray();
      await db().images.bulkDelete(poses.map((p) => p.image_id));
      await db().poses.bulkDelete(poses.map((p) => p.id));
      await db().photoshoots.bulkDelete(ids);
    });
  },

  async listPoses(shootId) {
    return (await posesOf(shootId).toArray()).map(toPose);
  },
  savePoses(shootId, poses) {
    return db().transaction("rw", db().photoshoots, db().poses, async () => {
      const t = now();
      const start = await db().poses.where("photoshoot_id").equals(shootId).count();
      const rows = poses.map((p, i) => poseRow(shootId, start + i, p, t));
      await db().poses.bulkAdd(rows);
      await db().photoshoots.update(shootId, { updated_at: t });
      return rows.map(toPose);
    });
  },
  async updatePose(id, patch: PosePatch) {
    await db().transaction("rw", db().poses, db().images, async () => {
      const row = await db().poses.get(id);
      if (!row) return;
      const changes: Partial<PoseRow> = { updated_at: now() };
      if (patch.title !== undefined) changes.title = patch.title;
      if (patch.who !== undefined) changes.who = patch.who;
      if (patch.note !== undefined) changes.notes = patch.note;
      if (patch.minutes !== undefined) changes.duration_minutes = minutes(patch.minutes);
      if (patch.imageId !== undefined && patch.imageId !== row.image_id) {
        changes.image_id = patch.imageId;
        await db().images.delete(row.image_id);
      }
      await db().poses.update(id, changes);
    });
  },
  async deletePoses(ids) {
    if (!ids.length) return;
    await db().transaction("rw", db().poses, db().images, async () => {
      const rows = (await db().poses.bulkGet(ids)).filter((r): r is PoseRow => !!r);
      await db().images.bulkDelete(rows.map((r) => r.image_id));
      await db().poses.bulkDelete(ids);
      for (const shootId of new Set(rows.map((r) => r.photoshoot_id))) {
        const left = await posesOf(shootId).toArray();
        await db().poses.bulkUpdate(left.map((r, i) => ({ key: r.id, changes: { position: i } })));
      }
    });
  },
  async reorderPoses(_shootId, orderedIds) {
    const t = now();
    await db().transaction("rw", db().poses, () =>
      db().poses.bulkUpdate(orderedIds.map((id, position) => ({ key: id, changes: { position, updated_at: t } }))),
    );
  },

  async saveImage(blob) {
    const id = newId();
    await db().images.add({ id, blob });
    return id;
  },
  async getImageUrl(imageId) {
    const row = await db().images.get(imageId);
    return row ? URL.createObjectURL(row.blob) : null;
  },
  releaseImageUrl(url) {
    URL.revokeObjectURL(url);
  },
  async getImageDataUrl(imageId) {
    const row = await db().images.get(imageId);
    if (!row) return null;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(row.blob);
    });
  },
  async deleteImage(imageId) {
    await db().images.delete(imageId);
  },

  async stats() {
    const d = db();
    return { profile: await d.profile.count(), photoshoots: await d.photoshoots.count(), poses: await d.poses.count(), images: await d.images.count() };
  },
};
