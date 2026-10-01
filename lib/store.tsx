"use client";

/*
 * In-memory state for flows that aren't saved yet: the New shoot draft, the photos picked
 * in the camera roll, and the Pose details working set. Nothing here is written to the
 * device until "save N poses" (commitEditor). Saved data lives in lib/db.ts.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useShoot } from "./data";
import * as db from "./db";
import type { Editor, EditorPose, NewPose, PhotoRef, PickedPhoto, Pose, PosePatch, ShootDraft } from "./types";

/** Route id for the draft shoot while it moves through Camera roll → Pose details. */
export const DRAFT_ID = "new";

type State = { draft: ShootDraft | null; editor: Editor | null; roll: PickedPhoto[] };
const initial: State = { draft: null, editor: null, roll: [] };

export const newEditorPose = (photo: PhotoRef): EditorPose => ({ id: crypto.randomUUID(), photo, title: "", who: "", minutes: 3, note: "" });
export const toEditorPose = (p: Pose): EditorPose => ({ id: p.id, photo: { imageId: p.imageId }, title: p.title, who: p.who, minutes: p.minutes, note: p.note });

// Object URLs for picked photos are revoked a moment after a flow ends, so the screen
// that's leaving never shows a broken image.
const revokeLater = (photos: PickedPhoto[]) => setTimeout(() => photos.forEach((p) => URL.revokeObjectURL(p.url)), 2000);

function useStoreValue() {
  const [state, setState] = useState<State>(initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const seq = useRef(0);

  const set = useCallback((fn: (s: State) => State) => {
    setState((s) => {
      const next = fn(s);
      stateRef.current = next;
      return next;
    });
  }, []);

  const actions = useMemo(
    () => ({
      startDraft(draft: ShootDraft) {
        set((s) => ({ ...s, draft }));
      },
      /** Abandons everything in progress (draft, picks, unsaved poses). Saved data is untouched. */
      discardInProgress() {
        const { roll } = stateRef.current;
        if (roll.length) revokeLater(roll);
        set(() => initial);
      },
      /** Adds freshly picked photos (already resized) to this session's camera roll. Returns them. */
      addToRoll(blobs: Blob[]): PickedPhoto[] {
        const picked = blobs.map((blob) => ({ key: `pick-${++seq.current}`, blob, url: URL.createObjectURL(blob) }));
        set((s) => ({ ...s, roll: [...picked.slice().reverse(), ...s.roll] }));
        return picked;
      },
      startEditor(editor: Editor) {
        set((s) => ({ ...s, editor }));
      },
      /** Ends the current editor and its picks (e.g. "+ add poses" starts a fresh selection). */
      clearEditor() {
        const { roll } = stateRef.current;
        if (roll.length) revokeLater(roll);
        set((s) => ({ ...s, editor: null, roll: [] }));
      },
      setIndex(index: number) {
        set((s) => (s.editor ? { ...s, editor: { ...s.editor, index: Math.max(0, Math.min(s.editor.poses.length - 1, index)) } } : s));
      },
      /** Edits the current pose. Saved poses (opened from a card) are written through immediately. */
      editPose(patch: Omit<PosePatch, "imageId">) {
        const e = stateRef.current.editor;
        if (!e) return;
        const pose = e.poses[e.index];
        set((s) => (s.editor ? { ...s, editor: { ...s.editor, poses: s.editor.poses.map((p, i) => (i === s.editor!.index ? { ...p, ...patch } : p)) } } : s));
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
        set((s) => {
          if (!s.editor) return s;
          const keys = s.editor.keys && !s.editor.keys.includes(picked.key) ? s.editor.keys.map((k, i) => (i === s.editor!.index ? picked.key : k)) : s.editor.keys;
          return { ...s, editor: { ...s.editor, keys, poses: s.editor.poses.map((p, i) => (i === s.editor!.index ? { ...p, photo } : p)) } };
        });
      },
      /**
       * "save N poses": writes picked photos and new poses (or creates the draft shoot with them).
       * Returns the id of the shoot saved into. On failure nothing is left half-saved.
       */
      async commitEditor(): Promise<string> {
        const { editor: e, draft, roll } = stateRef.current;
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
          if (roll.length) revokeLater(roll);
          set(() => initial);
          return shootId;
        } catch (err) {
          for (const id of savedImages) await db.deleteImage(id).catch(() => {});
          throw err;
        }
      },
    }),
    [set],
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
