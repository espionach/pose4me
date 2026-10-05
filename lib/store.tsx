"use client";

/*
 * In-memory state for flows that aren't saved yet: the New shoot draft and the Pose
 * details working set (with photos just picked). Nothing here is written to the device
 * until "save N poses" (commitEditor). Saved data lives in lib/db.ts.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useShoot } from "./data";
import * as db from "./db";
import type { Editor, EditorPose, NewPose, PhotoRef, PickedPhoto, Pose, PosePatch, ShootDraft } from "./types";

/** Route id for the draft shoot while it moves through the picker → Pose details. */
export const DRAFT_ID = "new";

type State = { draft: ShootDraft | null; editor: Editor | null };
const initial: State = { draft: null, editor: null };

export const newEditorPose = (photo: PhotoRef): EditorPose => ({ id: crypto.randomUUID(), photo, title: "", who: "", minutes: 3, note: "" });
export const toEditorPose = (p: Pose): EditorPose => ({ id: p.id, photo: { imageId: p.imageId }, title: p.title, who: p.who, minutes: p.minutes, note: p.note });

function useStoreValue() {
  const [state, setState] = useState<State>(initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const seq = useRef(0);
  // Object URLs for picked photos; released a moment after their flow ends so the
  // screen that's leaving never shows a broken image.
  const pickedUrls = useRef<string[]>([]);

  const set = useCallback((fn: (s: State) => State) => {
    setState((s) => {
      const next = fn(s);
      stateRef.current = next;
      return next;
    });
  }, []);

  const releasePicked = useCallback(() => {
    const urls = pickedUrls.current;
    pickedUrls.current = [];
    if (urls.length) setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 2000);
  }, []);

  const actions = useMemo(
    () => ({
      /** Wraps freshly picked (already resized) photos so screens can show them before saving. */
      toPicked(blobs: Blob[]): PickedPhoto[] {
        return blobs.map((blob) => {
          const url = URL.createObjectURL(blob);
          pickedUrls.current.push(url);
          return { key: `pick-${++seq.current}`, blob, url };
        });
      },
      startDraft(draft: ShootDraft) {
        set((s) => ({ ...s, draft }));
      },
      /** Abandons everything in progress (draft, unsaved poses). Saved data is untouched. */
      discardInProgress() {
        releasePicked();
        set(() => initial);
      },
      /** Starts Pose details on a set of poses. */
      startEditor(editor: Omit<Editor, "edited">) {
        set((s) => ({ ...s, editor: { ...editor, edited: false } }));
      },
      /** Ends the current editor (unsaved picks are dropped). The New shoot draft is kept. */
      clearEditor() {
        releasePicked();
        set((s) => ({ ...s, editor: null }));
      },
      setIndex(index: number) {
        set((s) => (s.editor ? { ...s, editor: { ...s.editor, index: Math.max(0, Math.min(s.editor.poses.length - 1, index)) } } : s));
      },
      /** Edits the current pose. Saved poses (opened from a card) are written through immediately. */
      editPose(patch: Omit<PosePatch, "imageId">) {
        const e = stateRef.current.editor;
        if (!e) return;
        const pose = e.poses[e.index];
        set((s) =>
          s.editor ? { ...s, editor: { ...s.editor, edited: true, poses: s.editor.poses.map((p, i) => (i === s.editor!.index ? { ...p, ...patch } : p)) } } : s,
        );
        if (e.source === "existing") db.updatePose(pose.id, patch).catch(() => {}); // failures show the storage banner
      },
      /** Swaps the current pose's photo. For a saved pose, the new image is stored and the old one deleted. */
      async replacePhoto(picked: PickedPhoto) {
        const e = stateRef.current.editor;
        if (!e) return;
        const pose = e.poses[e.index];
        let photo: PhotoRef = { picked };
        if (e.source === "existing") {
          const imageId = await db.saveImage(picked.blob);
          try {
            await db.updatePose(pose.id, { imageId });
          } catch (err) {
            await db.deleteImage(imageId).catch(() => {});
            throw err;
          }
          photo = { imageId };
        }
        set((s) => (s.editor ? { ...s, editor: { ...s.editor, edited: true, poses: s.editor.poses.map((p, i) => (i === s.editor!.index ? { ...p, photo } : p)) } } : s));
      },
      /**
       * "save N poses": writes picked photos and new poses (or creates the draft shoot with them).
       * Returns the id of the shoot saved into. On failure nothing is left half-saved.
       */
      async commitEditor(): Promise<string> {
        const { editor: e, draft } = stateRef.current;
        if (!e) throw new Error("nothing to save");
        if (e.source === "existing") {
          set((s) => ({ ...s, editor: null }));
          return e.shootId;
        }
        const savedImages: string[] = [];
        try {
          const poses: NewPose[] = [];
          for (const p of e.poses) {
            let imageId: string;
            if ("imageId" in p.photo) imageId = p.photo.imageId;
            else {
              imageId = await db.saveImage(p.photo.picked.blob);
              savedImages.push(imageId);
            }
            poses.push({ title: p.title, who: p.who, minutes: p.minutes, note: p.note, imageId });
          }
          let shootId = e.shootId;
          if (shootId === DRAFT_ID) {
            if (!draft) throw new Error("draft missing");
            shootId = (await db.createShoot(draft, poses)).id;
          } else {
            await db.savePoses(shootId, poses);
          }
          releasePicked();
          set(() => initial);
          return shootId;
        } catch (err) {
          for (const id of savedImages) await db.deleteImage(id).catch(() => {});
          throw err;
        }
      },
    }),
    [set, releasePicked],
  );

  return { state, ...actions };
}

type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const store = useStoreValue();
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}

/**
 * The shoot a flow targets: the unsaved draft for DRAFT_ID, otherwise a saved shoot.
 * `null` if missing, `undefined` while loading.
 */
export function useTargetShoot(id: string): { id: string; title: string } | null | undefined {
  const { state } = useStore();
  const saved = useShoot(id === DRAFT_ID ? null : id);
  if (id === DRAFT_ID) return state.draft ? { id: DRAFT_ID, title: state.draft.title } : null;
  return saved;
}
