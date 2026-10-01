"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CameraIcon, CloseIcon, StarDeco } from "@/components/icons";
import { Photo } from "@/components/Photo";
import { BottomBar, IconButton, Screen } from "@/components/ui";
import { prepareImage } from "@/lib/images";
import { useNav } from "@/lib/nav";
import { DRAFT_ID, newEditorPose, useStore, useTargetShoot } from "@/lib/store";
import { MissingShoot } from "../MissingShoot";

export default function Page() {
  return (
    <Suspense>
      <CameraRoll />
    </Suspense>
  );
}

function CameraRoll() {
  const { id } = useParams<{ id: string }>();
  const replace = useSearchParams().get("replace") === "1";
  const router = useRouter();
  const shoot = useTargetShoot(id);
  const nav = useNav();
  const { state, addToRoll, startEditor, replacePhoto } = useStore();
  // Poses picked here earlier (then Pose details → back): restore that exact selection.
  const picked = state.editor?.shootId === id && state.editor.source === "new" ? state.editor : null;
  const [order, setOrder] = useState<string[]>(() => (!replace && picked?.keys) || []);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const noPoseToReplace = replace && state.editor?.shootId !== id;
  const backTo = replace ? `/shoot/${id}/pose` : id === DRAFT_ID ? "/new" : `/shoot/${id}`;

  // Replace mode needs a pose being edited; fall back to Pose details (which falls back further).
  useEffect(() => {
    if (shoot && noPoseToReplace) nav.replace(backTo);
  }, [shoot, noPoseToReplace, nav, backTo]);

  if (shoot === undefined) return <div className="paper min-h-dvh" />;
  if (!shoot) return <MissingShoot to={id === DRAFT_ID ? "/new" : "/"} />;
  if (noPoseToReplace) return <div className="paper min-h-dvh" />;

  // Photos picked from the device this session, newest first. Nothing is saved until "save N poses".
  const roll = state.roll;
  const photoOf = (key: string) => roll.find((r) => r.key === key)!;
  const n = order.length;

  const toggle = (key: string) =>
    setOrder((o) => (replace ? (o[0] === key ? [] : [key]) : o.includes(key) ? o.filter((x) => x !== key) : [...o, key]));

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setImporting(true);
    try {
      // Resized (1600px, JPEG) before it's kept; photos the browser can't read are skipped.
      const blobs = (await Promise.all(Array.from(files).map((f) => prepareImage(f).catch(() => null)))).filter((b): b is Blob => !!b);
      if (!blobs.length) return;
      const keys = addToRoll(blobs).map((p) => p.key);
      setOrder((o) => (replace ? [keys[0]] : [...o, ...keys]));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const next = async () => {
    if (!n || busy) return;
    if (replace) {
      // A saved pose gets its new image stored (and the old one deleted) right away.
      setBusy(true);
      try {
        await replacePhoto(photoOf(order[0]));
        nav.back(backTo);
      } catch {
        // The storage banner explains; stay here so nothing is lost.
      } finally {
        setBusy(false);
      }
      return;
    }
    // Still-selected photos keep their edits; deselected ones are dropped; new ones start empty.
    const poses = order.map((k) => {
      const i = picked?.keys?.indexOf(k) ?? -1;
      return i >= 0 ? picked!.poses[i] : newEditorPose({ picked: photoOf(k) });
    });
    startEditor({ shootId: shoot.id, source: "new", poses, keys: order, index: 0 });
    router.push(`/shoot/${shoot.id}/pose`);
  };

  return (
    <Screen className="relative" bottomSpace={130}>
      <div className="flex items-center justify-between">
        <IconButton label="Close" onClick={() => nav.back(backTo)}>
          <CloseIcon />
        </IconButton>
      </div>
      <StarDeco style={{ position: "absolute", right: 30, top: "calc(var(--pad-top) + 6px)", transform: "rotate(12deg)" }} />

      <div className="flex flex-col gap-1 px-1">
        <h1 className="m-0 font-serif text-[32px] leading-[1.1] font-normal">camera roll</h1>
        <div className="text-[14px] text-muted">{replace ? "pick a new photo for this pose" : `pick poses for ${shoot.title}`}</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex h-[138px] flex-col items-center justify-center gap-2 rounded-photo border-[1.5px] border-dashed border-line bg-surface text-[13px] font-semibold text-muted"
        >
          <CameraIcon size={22} color="#6B625B" />
          {importing ? "adding…" : "from device"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple={!replace} hidden onChange={(e) => onFiles(e.target.files)} />

        {roll.map((ph, i) => {
          const k = order.indexOf(ph.key);
          const sel = k >= 0;
          return (
            <button
              key={ph.key}
              type="button"
              aria-label={`Photo ${i + 1}${sel ? `, selected ${k + 1}` : ""}`}
              aria-pressed={sel}
              onClick={() => toggle(ph.key)}
              className="relative box-border h-[138px] overflow-hidden rounded-photo p-0"
              style={{ border: `3px solid ${sel ? "#26211E" : "transparent"}` }}
            >
              <Photo photo={{ picked: ph }} className="h-full w-full rounded-[11px]" />
              {sel ? (
                <span className="absolute top-1.5 right-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-berry text-[14px] font-bold text-white">
                  {k + 1}
                </span>
              ) : (
                <span className="absolute top-1.5 right-1.5 box-border h-6 w-6 rounded-full border-2 border-white" />
              )}
            </button>
          );
        })}
      </div>

      <BottomBar>
        <div
          aria-hidden
          className="pointer-events-none! absolute inset-x-0 bottom-0 h-[150px]"
          style={{ background: "linear-gradient(rgba(251,248,243,0), #FBF8F3 40%)" }}
        />
        {n > 0 ? (
          <button
            type="button"
            onClick={next}
            disabled={busy}
            className="relative flex h-[58px] grow items-center justify-center gap-2.5 rounded-full bg-ink text-[16px] font-semibold text-white shadow-[0_10px_24px_rgba(38,33,30,.22)]"
          >
            {replace ? "use photo" : `next · ${n} selected`}
            <ArrowRightIcon />
          </button>
        ) : (
          <button type="button" disabled className="relative h-[58px] grow rounded-full bg-line text-[16px] font-semibold text-muted">
            select at least one photo
          </button>
        )}
      </BottomBar>
    </Screen>
  );
}
