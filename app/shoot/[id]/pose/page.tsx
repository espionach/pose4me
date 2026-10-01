"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BackIcon, BurstDeco, CameraIcon, MinusIcon, PlusIcon, StarDeco } from "@/components/icons";
import { Photo } from "@/components/Photo";
import { ArrowButton, BottomBar, IconButton, PagerDots, primaryBtn, Screen } from "@/components/ui";
import { plural } from "@/lib/format";
import { useNav } from "@/lib/nav";
import { DRAFT_ID, useStore } from "@/lib/store";
import type { PosePatch } from "@/lib/types";

const textInput = "box-border h-12 rounded-[18px] bg-surface px-4 text-[16px] font-semibold shadow-paper outline-none";

export default function PoseDetails() {
  const { id } = useParams<{ id: string }>();
  const nav = useNav();
  const { state, editPose, setIndex, commitEditor } = useStore();
  const [busy, setBusy] = useState(false);
  const editor = state.editor?.shootId === id && state.editor.poses.length ? state.editor : null;
  const saving = useRef(false);
  const hasDraft = !!state.draft;

  // Nothing being edited (refresh after the flow ended, stale link): go to the nearest valid parent.
  useEffect(() => {
    if (editor || saving.current) return;
    nav.replace(id !== DRAFT_ID ? `/shoot/${id}` : hasDraft ? `/shoot/${DRAFT_ID}/import` : "/new");
  }, [editor, id, nav, hasDraft]);

  if (!editor) return <div className="paper min-h-dvh" />;

  const { poses } = editor;
  const idx = Math.min(editor.index, poses.length - 1);
  const p = poses[idx];
  const last = poses.length - 1;

  const upd = (patch: Omit<PosePatch, "imageId">) => editPose(patch);
  const go = (i: number) => setIndex(i);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    saving.current = true;
    try {
      const shootId = await commitEditor();
      // Rewind past the finished flow so browser back can't return into it.
      if (id === DRAFT_ID) nav.unwindTo("/", `/shoot/${shootId}`);
      else nav.unwindTo(`/shoot/${shootId}`);
    } catch {
      // Nothing was saved; the storage banner explains. Stay here with everything intact.
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen gap={10} bottomSpace={108}>
      <div className="flex items-center justify-between">
        <IconButton onClick={() => nav.back(editor.source === "new" ? `/shoot/${id}/import` : `/shoot/${id}`)} label={editor.source === "new" ? "Back to camera roll" : "Back to shoot plan"}>
          <BackIcon />
        </IconButton>
        <div className="text-[22px] font-bold" aria-live="polite">
          photo {idx + 1} of {poses.length}
        </div>
        <div className="h-11 w-11" />
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="relative flex h-[238px] justify-center">
          {/* polaroid */}
          <div
            className="relative box-border h-[228px] w-[188px] bg-white px-2 pt-2 pb-[30px] shadow-soft transition-transform"
            style={{ transform: idx % 2 ? "rotate(2deg)" : "rotate(-2.5deg)" }}
          >
            <Photo photo={p.photo} className="h-full w-full" />
            <div className="absolute -top-2.5 left-16 h-5 w-[60px] rotate-3 bg-[rgba(247,198,207,.95)]" />
            <Link
              href={`/shoot/${id}/import?replace=1`}
              aria-label="Change photo"
              className="absolute -top-4 -right-4 z-[6] flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-line bg-surface shadow-[0_4px_10px_rgba(38,33,30,.14)]"
            >
              <CameraIcon size={18} />
            </Link>
          </div>

          {/* decorations: ≥5px from every button */}
          <StarDeco size={44} sw={1.1} style={{ position: "absolute", left: "calc(50% - 112px)", top: 157 }} />
          <BurstDeco style={{ position: "absolute", left: "calc(50% - 127px)", top: 13 }} />

          <ArrowButton dir="prev" label="Previous photo" disabled={idx === 0} onClick={() => go(idx - 1)} style={{ left: 0, top: 92 }} />
          <ArrowButton dir="next" label="Next photo" disabled={idx === last} onClick={() => go(idx + 1)} style={{ right: 0, top: 92 }} />
        </div>
        {poses.length > 1 && <PagerDots count={poses.length} index={idx} onGo={go} noun="photo" />}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="pose-name" className="section-label">
          pose name
        </label>
        <input id="pose-name" placeholder="name this pose" value={p.title} onChange={(e) => upd({ title: e.target.value })} className={textInput} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="pose-who" className="section-label">
          who&apos;s posing
        </label>
        <input id="pose-who" placeholder="e.g. me, Maya" value={p.who} onChange={(e) => upd({ who: e.target.value })} className={textInput} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="section-label" id="time-label">
          time limit
        </div>
        <div className="flex items-center justify-between rounded-card bg-surface p-1.5 shadow-paper" role="group" aria-labelledby="time-label">
          <button
            type="button"
            aria-label="Less time"
            disabled={p.minutes <= 1}
            onClick={() => upd({ minutes: Math.max(1, p.minutes - 1) })}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-paper disabled:opacity-40"
          >
            <MinusIcon />
          </button>
          <div className="flex items-baseline gap-1.5" aria-live="polite">
            <span className="text-[30px]">{p.minutes}</span>
            <span className="text-[15px] font-semibold text-muted">min</span>
          </div>
          <button type="button" aria-label="More time" onClick={() => upd({ minutes: p.minutes + 1 })} className="flex h-11 w-11 items-center justify-center rounded-full bg-ink">
            <PlusIcon size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="pose-notes" className="section-label">
          notes
        </label>
        <textarea
          id="pose-notes"
          placeholder="angles, lens, pose tips…"
          value={p.note}
          onChange={(e) => upd({ note: e.target.value })}
          className="lined box-border h-20 resize-none rounded-[18px] px-4 py-2.5 text-[19px] leading-[28px] shadow-paper outline-none"
        />
      </div>

      <BottomBar fade={96}>
        <button type="button" onClick={save} disabled={busy} className={primaryBtn}>
          save {plural(poses.length, "pose")}
        </button>
      </BottomBar>
    </Screen>
  );
}
