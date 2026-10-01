// Plain data types shared by screens and the data layer (lib/db.ts).

/** A saved photoshoot. Pose count and total time are derived from its poses, never stored. */
export type Shoot = {
  id: string;
  title: string;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm
  createdAt: string;
  updatedAt: string;
};

/** A saved pose. Images are referenced by id only; resolve them with db.getImageUrl. */
export type Pose = {
  id: string;
  shootId: string;
  /** 0-based order within the shoot. */
  position: number;
  title: string;
  /** Free text, comma separated: "me, Maya". */
  who: string;
  /** Minutes, at least 1. */
  minutes: number;
  note: string;
  imageId: string;
  createdAt: string;
  updatedAt: string;
};

/** The fields needed to add a pose; the data layer fills in the rest. */
export type NewPose = Pick<Pose, "title" | "who" | "minutes" | "note" | "imageId">;
export type PosePatch = Partial<Pick<Pose, "title" | "who" | "minutes" | "note" | "imageId">>;

export type ShootFields = Pick<Shoot, "title" | "date" | "time">;

export type Profile = { displayName: string };

// --- in-memory only (never written until "save N poses") ------------------------------

/** A photo picked in the camera roll this session. `url` is an object URL for `blob`. */
export type PickedPhoto = { key: string; blob: Blob; url: string };

/** A photo on a pose being edited: either already saved, or picked and not yet saved. */
export type PhotoRef = { imageId: string } | { picked: PickedPhoto };

/** A pose in the Pose details editor. `id` is the saved pose's id for "existing" editors. */
export type EditorPose = { id: string; photo: PhotoRef; title: string; who: string; minutes: number; note: string };

/** Working set for Pose details. */
export type Editor = {
  shootId: string;
  /** "new" = poses picked from the camera roll; "existing" = editing a shoot's saved poses. */
  source: "new" | "existing";
  poses: EditorPose[];
  /** For "new": the camera-roll photo each pose came from, so going back restores the selection. */
  keys?: string[];
  index: number;
};

/** A shoot being created from New shoot. Only saved on "save N poses". */
export type ShootDraft = { title: string; date: string; time: string };
