/*
 * The app's data layer — the ONLY module screens use to read or write stored data.
 *
 * Everything is stored on this device:
 *   - web (and Playwright tests): IndexedDB via Dexie        → lib/db/web.ts
 *   - iOS (Capacitor): SQLite + image files in the app's data → lib/db/native.ts
 * Both implement the same Backend; this file adds change notifications, friendly
 * errors and the persistent-storage request. Images are always referenced by imageId.
 */

import { Capacitor } from "@capacitor/core";
import type { Backend } from "./db/backend";
import { nativeBackend } from "./db/native";
import { webBackend } from "./db/web";
import type { NewPose, Pose, PosePatch, Profile, Shoot, ShootFields } from "./types";

const backend: Backend = Capacitor.isNativePlatform() ? nativeBackend : webBackend;

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
  const e = err as { name?: string; message?: string; inner?: { name?: string } };
  const name = e?.inner?.name ?? e?.name;
  const text = String(e?.message ?? "").toLowerCase();
  if (name === "QuotaExceededError" || /disk is full|no space|quota/.test(text))
    return new StorageError("couldn't save — your device storage is full. free up some space and try again.", err);
  return new StorageError("couldn't save that change. please try again.", err);
}

let persistAsked = false;

/** Runs a write: waits for setup, reports failures, notifies listeners, asks for persistent storage once. */
async function write<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await backend.ready();
    const result = await fn();
    notify();
    if (!persistAsked) {
      persistAsked = true;
      // Ask the browser not to evict our data under storage pressure. Best effort (web only).
      if (!Capacitor.isNativePlatform()) navigator.storage?.persist?.().catch(() => {});
    }
    return result;
  } catch (err) {
    const e = err instanceof StorageError ? err : friendly(err);
    errorListeners.forEach((l) => l(e));
    throw e;
  }
}

async function read<T>(fn: () => Promise<T>): Promise<T> {
  await backend.ready();
  return fn();
}

// --- profile -----------------------------------------------------------------------------

export const getProfile = (): Promise<Profile | null> => read(() => backend.getProfile());
export const saveProfile = (profile: Profile): Promise<Profile> => write(() => backend.saveProfile(profile).then(() => profile));

// --- shoots ------------------------------------------------------------------------------

/** All shoots, newest first. */
export const listShoots = (): Promise<Shoot[]> => read(() => backend.listShoots());
export const getShoot = (id: string): Promise<Shoot | null> => read(() => backend.getShoot(id));
/** Creates a shoot, optionally with its first poses, in one transaction. */
export const createShoot = (fields: ShootFields, poses: NewPose[] = []): Promise<Shoot> => write(() => backend.createShoot(fields, poses));
export const updateShoot = (id: string, patch: Partial<ShootFields>): Promise<void> => write(() => backend.updateShoot(id, patch));
/** Deletes shoots with all their poses and images. */
export const deleteShoots = (ids: string[]): Promise<void> => (ids.length ? write(() => backend.deleteShoots(ids)) : Promise.resolve());

// --- poses -------------------------------------------------------------------------------

/** A shoot's poses in plan order. */
export const listPoses = (shootId: string): Promise<Pose[]> => read(() => backend.listPoses(shootId));
/** Appends poses to the end of a shoot, in one transaction. */
export const savePoses = (shootId: string, poses: NewPose[]): Promise<Pose[]> => write(() => backend.savePoses(shootId, poses));
/** Updates a pose. Replacing its image deletes the old image. */
export const updatePose = (id: string, patch: PosePatch): Promise<void> => write(() => backend.updatePose(id, patch));
/** Deletes poses and their images, and closes the gaps in each shoot's order. */
export const deletePoses = (ids: string[]): Promise<void> => (ids.length ? write(() => backend.deletePoses(ids)) : Promise.resolve());
/** Sets a shoot's pose order in one write. `orderedIds` must list every pose in the shoot. */
export const reorderPoses = (shootId: string, orderedIds: string[]): Promise<void> => write(() => backend.reorderPoses(shootId, orderedIds));

// --- images ------------------------------------------------------------------------------

/** Stores an image (callers resize first — see lib/images.ts) and returns its id. */
export const saveImage = (blob: Blob): Promise<string> => write(() => backend.saveImage(blob));
/** A URL for displaying an image, or null if it doesn't exist. Pass it to releaseImageUrl when done. */
export const getImageUrl = (imageId: string): Promise<string | null> => read(() => backend.getImageUrl(imageId));
export const releaseImageUrl = (url: string): void => backend.releaseImageUrl(url);
/** The image as a self-contained data: URL — for rendering exports to PNG. */
export const getImageDataUrl = (imageId: string): Promise<string | null> => read(() => backend.getImageDataUrl(imageId));
export const deleteImage = (imageId: string): Promise<void> => write(() => backend.deleteImage(imageId));

/** Row/file counts, for the dev tools and tests. */
export const stats = () => read(() => backend.stats());
