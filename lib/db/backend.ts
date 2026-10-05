import type { NewPose, Pose, PosePatch, Profile, Shoot, ShootFields } from "../types";

/**
 * What a storage implementation provides. lib/db.ts picks one (IndexedDB on the web,
 * SQLite + files on iOS) and adds change notifications and friendly errors on top.
 * Images are referenced by an opaque imageId string, never by blob or URL in the data.
 */
export interface Backend {
  /** Opens storage (and runs any migrations) once. */
  ready(): Promise<void>;

  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;

  /** Newest first. */
  listShoots(): Promise<Shoot[]>;
  getShoot(id: string): Promise<Shoot | null>;
  /** Creates a shoot with its first poses, atomically. */
  createShoot(fields: ShootFields, poses: NewPose[]): Promise<Shoot>;
  updateShoot(id: string, patch: Partial<ShootFields>): Promise<void>;
  /** Deletes shoots with all their poses and images. */
  deleteShoots(ids: string[]): Promise<void>;

  /** In plan order. */
  listPoses(shootId: string): Promise<Pose[]>;
  /** Appends poses to the end of a shoot, atomically. */
  savePoses(shootId: string, poses: NewPose[]): Promise<Pose[]>;
  /** Replacing the image deletes the old one. */
  updatePose(id: string, patch: PosePatch): Promise<void>;
  /** Deletes poses and their images, and closes gaps in the order. */
  deletePoses(ids: string[]): Promise<void>;
  /** Sets a shoot's whole pose order in one write. */
  reorderPoses(shootId: string, orderedIds: string[]): Promise<void>;

  /** Stores an already-resized image; returns its id. */
  saveImage(blob: Blob): Promise<string>;
  /** A URL the web view can display, or null if missing. Release it with releaseImageUrl. */
  getImageUrl(imageId: string): Promise<string | null>;
  releaseImageUrl(url: string): void;
  /** The image as a self-contained data: URL (for rendering exports), or null if missing. */
  getImageDataUrl(imageId: string): Promise<string | null>;
  deleteImage(imageId: string): Promise<void>;

  stats(): Promise<{ profile: number; photoshoots: number; poses: number; images: number }>;
}
