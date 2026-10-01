/*
 * The app's data layer — the ONLY module that reads or writes stored data.
 *
 * Everything lives on this device in IndexedDB (via Dexie). Screens call these async
 * functions with plain types; a native (Capacitor) implementation can replace this file
 * later without screens changing. Images are always referenced by imageId.
 */

import Dexie, { type Table } from "dexie";
import type { NewPose, Pose, PosePatch, Profile, Shoot, ShootFields } from "./types";

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

// --- change notifications + errors -------------------------------------------------------

const listeners = new Set<() => void>();
/** Called after every successful write, so screens can re-read. Returns an unsubscribe. */
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
const notify = () => listeners.forEach((l) => l());

/** A write that failed, with a message that's fine to show people. */
export class StorageError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

const errorListeners = new Set<(e: StorageError) => void>();
/** Hear about failed writes (e.g. to show a banner). Returns an unsubscribe. */
export function onStorageError(listener: (e: StorageError) => void) {
  errorListeners.add(listener);
  return () => void errorListeners.delete(listener);
}

function friendly(err: unknown): StorageError {
  const name = (err as { name?: string; inner?: { name?: string } })?.inner?.name ?? (err as { name?: string })?.name;
  if (name === "QuotaExceededError") return new StorageError("couldn't save — your device storage is full. free up some space and try again.", err);
  return new StorageError("couldn't save that change. please try again.", err);
}

let persistAsked = false;

/** Runs a write: waits for setup, reports failures, notifies listeners, asks for persistent storage once. */
async function write<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await ready();
    const result = await fn();
    notify();
    if (!persistAsked) {
      persistAsked = true;
      // Ask the browser not to evict our data under storage pressure. Best effort.
      navigator.storage?.persist?.().catch(() => {});
    }
    return result;
  } catch (err) {
    const e = err instanceof StorageError ? err : friendly(err);
    errorListeners.forEach((l) => l(e));
    throw e;
  }
}

async function read<T>(fn: () => Promise<T>): Promise<T> {
  await ready();
  return fn();
}

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

// --- mapping -----------------------------------------------------------------------------

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
const minutes = (n: number) => Math.max(1, Math.round(n) || 1);

// --- profile -----------------------------------------------------------------------------

export async function getProfile(): Promise<Profile | null> {
  const row = await read(() => db().profile.get("me"));
  return row ? { displayName: row.display_name } : null;
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  return write(async () => {
    await db().profile.put({ id: "me", display_name: profile.displayName, updated_at: now() });
    return profile;
  });
}

// --- shoots ------------------------------------------------------------------------------

/** All shoots, newest first. */
export async function listShoots(): Promise<Shoot[]> {
  const rows = await read(() => db().photoshoots.orderBy("created_at").reverse().toArray());
  return rows.map(toShoot);
}

export async function getShoot(id: string): Promise<Shoot | null> {
  const row = await read(() => db().photoshoots.get(id));
  return row ? toShoot(row) : null;
}

/** Creates a shoot, optionally with its first poses, in one transaction. */
export async function createShoot(fields: ShootFields, poses: NewPose[] = []): Promise<Shoot> {
  return write(() =>
    db().transaction("rw", db().photoshoots, db().poses, async () => {
      const t = now();
      const row: ShootRow = { id: newId(), title: fields.title, shoot_date: fields.date || null, shoot_time: fields.time || null, created_at: t, updated_at: t };
      await db().photoshoots.add(row);
      await db().poses.bulkAdd(poses.map((p, i) => poseRow(row.id, i, p, t)));
      return toShoot(row);
    }),
  );
}

export async function updateShoot(id: string, patch: Partial<ShootFields>): Promise<void> {
  await write(async () => {
    const changes: Partial<ShootRow> = { updated_at: now() };
    if (patch.title !== undefined) changes.title = patch.title;
    if (patch.date !== undefined) changes.shoot_date = patch.date || null;
    if (patch.time !== undefined) changes.shoot_time = patch.time || null;
    await db().photoshoots.update(id, changes);
  });
}

/** Deletes shoots with all their poses and images. */
export async function deleteShoots(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await write(() =>
    db().transaction("rw", db().photoshoots, db().poses, db().images, async () => {
      const poses = await db().poses.where("photoshoot_id").anyOf(ids).toArray();
      await db().images.bulkDelete(poses.map((p) => p.image_id));
      await db().poses.bulkDelete(poses.map((p) => p.id));
      await db().photoshoots.bulkDelete(ids);
    }),
  );
}

// --- poses -------------------------------------------------------------------------------

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

/** A shoot's poses in plan order. */
export async function listPoses(shootId: string): Promise<Pose[]> {
  const rows = await read(() => db().poses.where("[photoshoot_id+position]").between([shootId, Dexie.minKey], [shootId, Dexie.maxKey]).toArray());
  return rows.map(toPose);
}

/** Appends poses to the end of a shoot, in one transaction. */
export async function savePoses(shootId: string, poses: NewPose[]): Promise<Pose[]> {
  return write(() =>
    db().transaction("rw", db().photoshoots, db().poses, async () => {
      const t = now();
      const start = await db().poses.where("photoshoot_id").equals(shootId).count();
      const rows = poses.map((p, i) => poseRow(shootId, start + i, p, t));
      await db().poses.bulkAdd(rows);
      await db().photoshoots.update(shootId, { updated_at: t });
      return rows.map(toPose);
    }),
  );
}

/** Updates a pose. Replacing its image deletes the old image in the same transaction. */
export async function updatePose(id: string, patch: PosePatch): Promise<void> {
  await write(() =>
    db().transaction("rw", db().poses, db().images, async () => {
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
    }),
  );
}

/** Deletes poses and their images, and closes the gaps in each shoot's order. */
export async function deletePoses(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await write(() =>
    db().transaction("rw", db().poses, db().images, async () => {
      const rows = (await db().poses.bulkGet(ids)).filter((r): r is PoseRow => !!r);
      await db().images.bulkDelete(rows.map((r) => r.image_id));
      await db().poses.bulkDelete(ids);
      for (const shootId of new Set(rows.map((r) => r.photoshoot_id))) {
        const left = await db().poses.where("[photoshoot_id+position]").between([shootId, Dexie.minKey], [shootId, Dexie.maxKey]).toArray();
        await db().poses.bulkUpdate(left.map((r, i) => ({ key: r.id, changes: { position: i } })));
      }
    }),
  );
}

/** Sets a shoot's pose order in one write. `orderedIds` must list every pose in the shoot. */
export async function reorderPoses(shootId: string, orderedIds: string[]): Promise<void> {
  await write(() =>
    db().transaction("rw", db().poses, async () => {
      const t = now();
      await db().poses.bulkUpdate(orderedIds.map((id, position) => ({ key: id, changes: { position, updated_at: t } })));
    }),
  );
}

// --- images ------------------------------------------------------------------------------

/** Stores an image (callers resize first — see lib/images.ts) and returns its id. */
export async function saveImage(blob: Blob): Promise<string> {
  return write(async () => {
    const id = newId();
    await db().images.add({ id, blob });
    return id;
  });
}

/** An object URL for an image, or null if it doesn't exist. Callers must URL.revokeObjectURL it. */
export async function getImageUrl(imageId: string): Promise<string | null> {
  const row = await read(() => db().images.get(imageId));
  return row ? URL.createObjectURL(row.blob) : null;
}

export async function deleteImage(imageId: string): Promise<void> {
  await write(() => db().images.delete(imageId));
}

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
/** Opens the database (and imports any legacy data) once. */
function ready() {
  return (_ready ??= db()
    .open()
    .then((d) => importLegacy(d as ShootPlannerDB)));
}

/** Row counts, for the dev tools and tests. */
export async function stats() {
  await ready();
  const d = db();
  return { profile: await d.profile.count(), photoshoots: await d.photoshoots.count(), poses: await d.poses.count(), images: await d.images.count() };
}
