"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showNotice } from "./notice";
import { PhotoAccessError, pickPhotos } from "./photos";
import { poseUrl } from "./routes";
import { newEditorPose, useStore } from "./store";

export const PHOTO_ACCESS_HELP = "poseforme can't see your photos. allow access in Settings › poseforme › Photos.";

/**
 * "next · pick photos" (New shoot) and "+ add poses" (Shoot plan): opens the photo picker
 * and, once photos are picked, opens Pose details on them in the order they were picked.
 * Cancelling leaves the current screen as it was. Call `pick` straight from a tap handler.
 */
export function usePickPoses() {
  const router = useRouter();
  const { toPicked, startEditor, clearEditor } = useStore();
  const [busy, setBusy] = useState(false);

  const pick = async (shootId: string, beforeOpen?: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      const blobs = await pickPhotos(); // opens synchronously, inside the tap
      if (!blobs) return; // cancelled
      beforeOpen?.();
      clearEditor();
      startEditor({ shootId, source: "new", poses: toPicked(blobs).map((picked) => newEditorPose({ picked })), index: 0 });
      router.push(poseUrl(shootId));
    } catch (err) {
      showNotice(err instanceof PhotoAccessError ? PHOTO_ACCESS_HELP : "couldn't open those photos. please try different ones.");
    } finally {
      setBusy(false);
    }
  };

  return { pick, busy };
}
