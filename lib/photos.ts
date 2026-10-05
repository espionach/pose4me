"use client";

/*
 * Picking photos. On iOS this opens Apple's native photo picker (@capacitor/camera
 * pickImages); in the browser it opens the file chooser through a hidden <input type=file>
 * (components/PhotoInput.tsx). Either way callers get resized JPEG blobs, in the order
 * the user selected them, or null if they cancelled.
 *
 * Call pickPhotos() directly from a tap handler: browsers only open the file chooser in
 * response to a user gesture.
 */

import { Camera } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { prepareImage } from "./images";

type WebChooser = (multiple: boolean) => Promise<File[] | null>;
let webChooser: WebChooser | null = null;

/** Registered by <PhotoInput /> (web only). */
export function setWebChooser(chooser: WebChooser | null) {
  webChooser = chooser;
}

/** Thrown when photos were picked but none could be read. */
export class PhotoReadError extends Error {}

/** Thrown when the person has turned off photo access for the app (iOS Settings). */
export class PhotoAccessError extends Error {}

/**
 * Opens the photo picker. `limit: 1` picks a single photo; otherwise multi-select.
 * Resolves resized JPEGs (max 1600px, ~0.85) in selection order, or null if cancelled.
 */
export async function pickPhotos({ limit }: { limit?: number } = {}): Promise<Blob[] | null> {
  const single = limit === 1;
  let sources: Blob[];

  if (Capacitor.isNativePlatform()) {
    // The camera plugin asks for library access itself but then doesn't open the picker
    // after a first-time "allow" — so ask up front, then open it.
    const perm = await Camera.checkPermissions().catch(() => null);
    if (perm && (perm.photos === "prompt" || perm.photos === "prompt-with-rationale")) {
      const asked = await Camera.requestPermissions({ permissions: ["photos"] }).catch(() => null);
      if (asked?.photos === "denied") throw new PhotoAccessError("photo access is off");
    } else if (perm?.photos === "denied") {
      throw new PhotoAccessError("photo access is off");
    }
    try {
      // HEIC and other formats come back as JPEG files. Order follows the selection
      // (the plugin is patched to request ordered selection — see patches/).
      const result = await Camera.pickImages({ limit: single ? 1 : 0, quality: 90 });
      sources = await Promise.all(result.photos.map((p) => fetch(p.webPath).then((r) => r.blob())));
    } catch (err) {
      if (/cancel/i.test(String((err as Error)?.message ?? err))) return null;
      throw err;
    }
  } else {
    if (!webChooser) throw new Error("photo picker isn't ready");
    const files = await webChooser(!single); // must run before any other await (user gesture)
    if (!files) return null;
    sources = single ? files.slice(0, 1) : files;
  }

  if (!sources.length) return null;
  const blobs = (await Promise.all(sources.map((s) => prepareImage(s).catch(() => null)))).filter((b): b is Blob => !!b);
  if (!blobs.length) throw new PhotoReadError("couldn't read those photos");
  return blobs;
}
