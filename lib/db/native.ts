/*
 * iOS storage: SQLite (@capacitor-community/sqlite) for profile, shoots and poses, and
 * image files in Directory.Data (@capacitor/filesystem) at images/{photoshoot_id}/{pose_id}.jpg.
 * The database stores only each image's relative path, which is also its imageId.
 * Don't import this from screens — go through lib/db.ts.
 */

import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection, type capSQLiteSet, type SQLiteDBConnection } from "@capacitor-community/sqlite";
import { Directory, Filesystem } from "@capacitor/filesystem";
import type { NewPose, Pose, PosePatch, Shoot } from "../types";
import type { Backend } from "./backend";

const DB_NAME = "poseforme";

// Each entry upgrades the schema by one version (PRAGMA user_version). Append, never edit.
const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS profile (
     id TEXT PRIMARY KEY NOT NULL,
     display_name TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS photoshoots (
     id TEXT PRIMARY KEY NOT NULL,
     title TEXT NOT NULL,
     shoot_date TEXT,
     shoot_time TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS poses (
     id TEXT PRIMARY KEY NOT NULL,
     photoshoot_id TEXT NOT NULL,
     position INTEGER NOT NULL,
     title TEXT NOT NULL DEFAULT '',
     who TEXT NOT NULL DEFAULT '',
     duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 1),
     notes TEXT NOT NULL DEFAULT '',
     image_path TEXT NOT NULL,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS poses_by_shoot ON poses (photoshoot_id, position);`,
];

type ShootRow = { id: string; title: string; shoot_date: string | null; shoot_time: string | null; created_at: string; updated_at: string };
type PoseRow = {
  id: string;
  photoshoot_id: string;
  position: number;
  title: string;
  who: string;
  duration_minutes: number;
  notes: string;
  image_path: string;
  created_at: string;
  updated_at: string;
};

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
  imageId: r.image_path,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// --- database ----------------------------------------------------------------------------

let conn: SQLiteDBConnection | null = null;
let _ready: Promise<void> | null = null;

async function open() {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  await sqlite.checkConnectionsConsistency().catch(() => {});
  const exists = (await sqlite.isConnection(DB_NAME, false)).result;
  conn = exists ? await sqlite.retrieveConnection(DB_NAME, false) : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
  await conn.open();
  const version = Number((await rows<{ user_version: number }>("PRAGMA user_version;"))[0]?.user_version ?? 0);
  for (let v = version; v < MIGRATIONS.length; v++) {
    await conn.execute(MIGRATIONS[v], true);
    await conn.execute(`PRAGMA user_version = ${v + 1};`, false);
  }
}

const db = () => conn!;
async function rows<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  // On iOS the plugin puts a { ios_columns: [...] } descriptor first in non-empty results.
  const out = (await db().query(sql, values)).values ?? [];
  return out.filter((r) => !(r && typeof r === "object" && "ios_columns" in r)) as T[];
}
/** Runs statements in one transaction: all or nothing. */
const atomically = (set: capSQLiteSet[]) => (set.length ? db().executeSet(set, true) : Promise.resolve());

// --- image files -------------------------------------------------------------------------

const PENDING = "images/pending";
const shootDir = (shootId: string) => `images/${shootId}`;
const finalPath = (shootId: string, poseId: string) => `${shootDir(shootId)}/${poseId}.jpg`;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const ignore = () => {};
const removeFile = (path: string) => Filesystem.deleteFile({ path, directory: Directory.Data }).catch(ignore);
const ensureDir = (path: string) => Filesystem.mkdir({ path, directory: Directory.Data, recursive: true }).catch(ignore);
const move = (from: string, to: string) => Filesystem.rename({ from, to, directory: Directory.Data, toDirectory: Directory.Data });

/**
 * New images are first written to images/pending/. When their pose is saved they move to
 * images/{shoot}/{pose}.jpg. Returns the final paths; on failure, moves are undone.
 */
async function placeImages(items: { imageId: string; shootId: string; poseId: string }[]) {
  const moved: { from: string; to: string }[] = [];
  try {
    for (const it of items) {
      const to = finalPath(it.shootId, it.poseId);
      if (it.imageId !== to) {
        await ensureDir(shootDir(it.shootId));
        await move(it.imageId, to);
        moved.push({ from: it.imageId, to });
      }
    }
    return { paths: items.map((it) => finalPath(it.shootId, it.poseId)), undo: () => Promise.all(moved.map((m) => move(m.to, m.from).catch(ignore))) };
  } catch (err) {
    await Promise.all(moved.map((m) => move(m.to, m.from).catch(ignore)));
    throw err;
  }
}

function insertPose(shootId: string, poseId: string, position: number, p: NewPose, path: string, t: string): capSQLiteSet {
  return {
    statement: `INSERT INTO poses (id, photoshoot_id, position, title, who, duration_minutes, notes, image_path, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    values: [poseId, shootId, position, p.title, p.who, minutes(p.minutes), p.note, path, t, t],
  };
}

let dataDirUri: string | null = null;

// --- the backend -------------------------------------------------------------------------

export const nativeBackend: Backend = {
  ready: () => (_ready ??= open()),

  async getProfile() {
    const [row] = await rows<{ display_name: string }>("SELECT display_name FROM profile WHERE id = 'me';");
    return row ? { displayName: row.display_name } : null;
  },
  async saveProfile(profile) {
    await db().run("INSERT OR REPLACE INTO profile (id, display_name, updated_at) VALUES ('me', ?, ?);", [profile.displayName, now()], true);
  },

  async listShoots() {
    return (await rows<ShootRow>("SELECT * FROM photoshoots ORDER BY created_at DESC;")).map(toShoot);
  },
  async getShoot(id) {
    const [row] = await rows<ShootRow>("SELECT * FROM photoshoots WHERE id = ?;", [id]);
    return row ? toShoot(row) : null;
  },
  async createShoot(fields, poses) {
    const t = now();
    const shoot: ShootRow = { id: newId(), title: fields.title, shoot_date: fields.date || null, shoot_time: fields.time || null, created_at: t, updated_at: t };
    const poseIds = poses.map(() => newId());
    const placed = await placeImages(poses.map((p, i) => ({ imageId: p.imageId, shootId: shoot.id, poseId: poseIds[i] })));
    try {
      await atomically([
        {
          statement: "INSERT INTO photoshoots (id, title, shoot_date, shoot_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);",
          values: [shoot.id, shoot.title, shoot.shoot_date, shoot.shoot_time, t, t],
        },
        ...poses.map((p, i) => insertPose(shoot.id, poseIds[i], i, p, placed.paths[i], t)),
      ]);
    } catch (err) {
      await placed.undo();
      throw err;
    }
    return toShoot(shoot);
  },
  async updateShoot(id, patch) {
    const sets: string[] = ["updated_at = ?"];
    const values: unknown[] = [now()];
    if (patch.title !== undefined) sets.push("title = ?"), values.push(patch.title);
    if (patch.date !== undefined) sets.push("shoot_date = ?"), values.push(patch.date || null);
    if (patch.time !== undefined) sets.push("shoot_time = ?"), values.push(patch.time || null);
    await db().run(`UPDATE photoshoots SET ${sets.join(", ")} WHERE id = ?;`, [...values, id], true);
  },
  async deleteShoots(ids) {
    if (!ids.length) return;
    const marks = ids.map(() => "?").join(", ");
    await atomically([
      { statement: `DELETE FROM poses WHERE photoshoot_id IN (${marks});`, values: ids },
      { statement: `DELETE FROM photoshoots WHERE id IN (${marks});`, values: ids },
    ]);
    // Rows are gone; now remove each shoot's image folder.
    await Promise.all(ids.map((id) => Filesystem.rmdir({ path: shootDir(id), directory: Directory.Data, recursive: true }).catch(ignore)));
  },

  async listPoses(shootId) {
    return (await rows<PoseRow>("SELECT * FROM poses WHERE photoshoot_id = ? ORDER BY position;", [shootId])).map(toPose);
  },
  async savePoses(shootId, poses) {
    const t = now();
    const [{ n }] = await rows<{ n: number }>("SELECT COUNT(*) AS n FROM poses WHERE photoshoot_id = ?;", [shootId]);
    const poseIds = poses.map(() => newId());
    const placed = await placeImages(poses.map((p, i) => ({ imageId: p.imageId, shootId, poseId: poseIds[i] })));
    try {
      await atomically([
        ...poses.map((p, i) => insertPose(shootId, poseIds[i], n + i, p, placed.paths[i], t)),
        { statement: "UPDATE photoshoots SET updated_at = ? WHERE id = ?;", values: [t, shootId] },
      ]);
    } catch (err) {
      await placed.undo();
      throw err;
    }
    return nativeBackend.listPoses(shootId).then((all) => all.filter((p) => poseIds.includes(p.id)));
  },
  async updatePose(id, patch: PosePatch) {
    const [row] = await rows<PoseRow>("SELECT * FROM poses WHERE id = ?;", [id]);
    if (!row) return;
    const sets: string[] = ["updated_at = ?"];
    const values: unknown[] = [now()];
    if (patch.title !== undefined) sets.push("title = ?"), values.push(patch.title);
    if (patch.who !== undefined) sets.push("who = ?"), values.push(patch.who);
    if (patch.note !== undefined) sets.push("notes = ?"), values.push(patch.note);
    if (patch.minutes !== undefined) sets.push("duration_minutes = ?"), values.push(minutes(patch.minutes));
    if (patch.imageId !== undefined && patch.imageId !== row.image_path) {
      // The pose keeps its file name ({pose_id}.jpg): replace the old file with the new one.
      const target = finalPath(row.photoshoot_id, row.id);
      await removeFile(row.image_path);
      await ensureDir(shootDir(row.photoshoot_id));
      await move(patch.imageId, target);
      sets.push("image_path = ?"), values.push(target);
    }
    await db().run(`UPDATE poses SET ${sets.join(", ")} WHERE id = ?;`, [...values, id], true);
  },
  async deletePoses(ids) {
    if (!ids.length) return;
    const marks = ids.map(() => "?").join(", ");
    const doomed = await rows<PoseRow>(`SELECT * FROM poses WHERE id IN (${marks});`, ids);
    const set: capSQLiteSet[] = [{ statement: `DELETE FROM poses WHERE id IN (${marks});`, values: ids }];
    // Close the gaps left in each shoot's order.
    for (const shootId of new Set(doomed.map((r) => r.photoshoot_id))) {
      const left = (await rows<{ id: string }>("SELECT id FROM poses WHERE photoshoot_id = ? ORDER BY position;", [shootId])).filter((r) => !ids.includes(r.id));
      left.forEach((r, i) => set.push({ statement: "UPDATE poses SET position = ? WHERE id = ?;", values: [i, r.id] }));
    }
    await atomically(set);
    await Promise.all(doomed.map((r) => removeFile(r.image_path)));
  },
  async reorderPoses(shootId, orderedIds) {
    const t = now();
    await atomically(orderedIds.map((id, position) => ({ statement: "UPDATE poses SET position = ?, updated_at = ? WHERE id = ? AND photoshoot_id = ?;", values: [position, t, id, shootId] })));
  },

  async saveImage(blob) {
    const path = `${PENDING}/${newId()}.jpg`;
    await Filesystem.writeFile({ path, data: await blobToBase64(blob), directory: Directory.Data, recursive: true });
    return path;
  },
  async getImageUrl(imageId) {
    dataDirUri ??= (await Filesystem.getUri({ path: "", directory: Directory.Data })).uri.replace(/\/$/, "");
    try {
      await Filesystem.stat({ path: imageId, directory: Directory.Data });
    } catch {
      return null;
    }
    // A pose keeps its file name when its photo is replaced, so bust the web view's cache.
    return `${Capacitor.convertFileSrc(`${dataDirUri}/${imageId}`)}?v=${Date.now()}`;
  },
  releaseImageUrl() {
    // File URLs need no cleanup.
  },
  async getImageDataUrl(imageId) {
    try {
      const { data } = await Filesystem.readFile({ path: imageId, directory: Directory.Data });
      return typeof data === "string" ? `data:image/jpeg;base64,${data}` : null;
    } catch {
      return null;
    }
  },
  async deleteImage(imageId) {
    await removeFile(imageId);
  },

  async stats() {
    const count = async (table: string) => (await rows<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table};`))[0]?.n ?? 0;
    const files = await Filesystem.readdir({ path: "images", directory: Directory.Data }).catch(() => ({ files: [] }));
    let images = 0;
    for (const dir of files.files) {
      if (dir.type !== "directory") continue;
      images += (await Filesystem.readdir({ path: `images/${dir.name}`, directory: Directory.Data })).files.length;
    }
    return { profile: await count("profile"), photoshoots: await count("photoshoots"), poses: await count("poses"), images };
  },
};
