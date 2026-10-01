"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BackIcon, CalendarIcon, CheckIcon, ClockIcon, DownloadIcon, GripIcon, PencilIcon, PhotoIcon, PlusIcon, TimerIcon } from "@/components/icons";
import { Photo } from "@/components/Photo";
import { Scribble, useScribbles, type Sides } from "@/components/Scribble";
import { BottomBar, IconButton, primaryBtn, Screen, secondaryBtn, SelectBadge, SelectBar } from "@/components/ui";
import { fmtWhen, plural, poseNum, splitWho, totalMinutes, whoColors } from "@/lib/format";
import { usePoses, useShoot } from "@/lib/data";
import { deletePoses, reorderPoses, updateShoot } from "@/lib/db";
import { useNav } from "@/lib/nav";
import { DRAFT_ID, toEditorPose, useStore } from "@/lib/store";
import type { Pose } from "@/lib/types";
import { useLongPress } from "@/lib/useLongPress";
import { MissingShoot } from "./MissingShoot";

// Only the card's left edge, or top/bottom beside the thumbnail — never over the text column.
const SIDES: Sides = {
  top: (r) => ({ top: r(-12, -8), left: r(0, 60) }),
  bottom: (r) => ({ bottom: r(-12, -8), left: r(0, 60) }),
  left: (r) => ({ left: r(-14, -10), top: r(4, 96) }),
};
const GAP = 14;

const label = "flex flex-col gap-1 text-[12px] font-bold uppercase tracking-[0.6px] text-muted";
const field = "box-border h-11 w-full rounded-[14px] border-[1.5px] border-line bg-surface px-2.5 text-[14px] font-semibold normal-case tracking-normal text-ink";

export default function ShootPlan() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const nav = useNav();
  const isDraft = id === DRAFT_ID; // the draft has no plan until it is saved
  const shoot = useShoot(isDraft ? null : id);
  const saved = usePoses(isDraft ? null : id);
  const { startEditor, clearEditor } = useStore();

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [drag, setDrag] = useState<{ id: string; dy: number } | null>(null);
  /** Pose order while dragging (shown immediately); saved in one write when the drag ends. */
  const [order, setOrder] = useState<string[] | null>(null);

  const scribbleFor = useScribbles(SIDES);
  const cardEls = useRef(new Map<string, HTMLElement>());
  const dragStart = useRef(0);
  const posesRef = useRef<Pose[]>([]);
  const savedKey = saved?.map((p) => p.id).join() ?? "";

  // Once the saved order catches up with the dragged order, show saved data again.
  useEffect(() => {
    if (order && order.join() === savedKey) setOrder(null);
  }, [order, savedKey]);
  const lp = useLongPress((pid) => {
    setDrag(null);
    setSelecting(true);
    setSelected([pid]);
  });

  if (!isDraft && (shoot === undefined || saved === undefined)) return <div className="paper min-h-dvh" />;
  if (!shoot || !saved) return <MissingShoot to={isDraft ? "/new" : "/"} />;
  const byId = new Map(saved.map((p) => [p.id, p]));
  const poses = order ? order.map((pid) => byId.get(pid)).filter((p): p is Pose => !!p) : saved;
  posesRef.current = poses;
  const colorFor = whoColors(poses);

  const endSelect = () => {
    setSelecting(false);
    setSelected([]);
  };
  const toggle = (pid: string) => setSelected((cur) => (cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid]));

  const openPose = (index: number) => {
    clearEditor();
    startEditor({ shootId: shoot.id, source: "existing", poses: poses.map(toEditorPose), index });
    router.push(`/shoot/${shoot.id}/pose`);
  };

  const move = (from: number, to: number) => {
    const list = posesRef.current.slice();
    const [m] = list.splice(from, 1);
    list.splice(to, 0, m);
    posesRef.current = list;
    setOrder(list.map((p) => p.id));
    return list.map((p) => p.id);
  };
  const saveOrder = (ids: string[]) => reorderPoses(shoot.id, ids).catch(() => setOrder(null)); // banner explains

  // --- pointer drag from the grip: live reorder, card follows the finger ---
  const onGripDown = (e: React.PointerEvent, pid: string) => {
    e.stopPropagation();
    if (selecting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = e.clientY;
    setDrag({ id: pid, dy: 0 });
  };
  const onGripMove = (e: React.PointerEvent) => {
    if (!drag) return;
    let dy = e.clientY - dragStart.current;
    const list = posesRef.current;
    const i = list.findIndex((p) => p.id === drag.id);
    const next = list[i + 1] && cardEls.current.get(list[i + 1].id);
    const prev = list[i - 1] && cardEls.current.get(list[i - 1].id);
    if (next && dy > (next.offsetHeight + GAP) / 2) {
      const h = next.offsetHeight + GAP;
      move(i, i + 1);
      dragStart.current += h;
      dy -= h;
    } else if (prev && dy < -(prev.offsetHeight + GAP) / 2) {
      const h = prev.offsetHeight + GAP;
      move(i, i - 1);
      dragStart.current -= h;
      dy += h;
    }
    setDrag({ id: drag.id, dy });
  };
  const onGripUp = () => {
    if (!drag) return;
    setDrag(null);
    const ids = posesRef.current.map((p) => p.id);
    if (ids.join() !== savedKey) saveOrder(ids);
  };
  const onGripKey = (e: React.KeyboardEvent, i: number) => {
    let ids: string[];
    if (e.key === "ArrowUp" && i > 0) ids = move(i, i - 1);
    else if (e.key === "ArrowDown" && i < poses.length - 1) ids = move(i, i + 1);
    else return;
    e.preventDefault();
    saveOrder(ids);
  };

  return (
    <Screen gap={16} bottomSpace={140}>
      {selecting ? (
        <SelectBar
          count={selected.length}
          noun="pose"
          onCancel={endSelect}
          onDelete={() => {
            // Deletes the poses and their photos. Failures show the storage banner.
            deletePoses(selected).then(endSelect, () => {});
          }}
        />
      ) : (
        <div className="flex items-center justify-between">
          <IconButton onClick={() => nav.back("/")} label="Back to my shoots">
            <BackIcon />
          </IconButton>
          {editing ? (
            <button
              type="button"
              onClick={() => {
                updateShoot(shoot.id, { title: draftTitle.trim() || "untitled shoot" }).then(() => setEditing(false), () => {});
              }}
              className="flex h-11 items-center gap-1.5 rounded-full bg-ink px-[18px] text-[15px] font-semibold text-white"
            >
              <CheckIcon />
              done
            </button>
          ) : (
            <IconButton
              label="Edit shoot details"
              onClick={() => {
                setDraftTitle(shoot.title);
                setEditing(true);
              }}
            >
              <PencilIcon />
            </IconButton>
          )}
        </div>
      )}

      {editing ? (
        <div className="flex flex-col gap-2.5 px-1">
          <input
            aria-label="Shoot title"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="untitled shoot"
            className="box-border h-12 w-full rounded-[14px] border-[1.5px] border-ink bg-surface px-3 font-serif text-[26px] outline-none"
          />
          <div className="flex gap-2">
            <label className={`${label} min-w-0 grow`}>
              date
              <input type="date" value={shoot.date ?? ""} onChange={(e) => updateShoot(shoot.id, { date: e.target.value || null }).catch(() => {})} className={field} />
            </label>
            <label className={`${label} w-32 shrink-0`}>
              time
              <input type="time" value={shoot.time ?? ""} onChange={(e) => updateShoot(shoot.id, { time: e.target.value || null }).catch(() => {})} className={field} />
            </label>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-1">
          <h1 className="m-0 font-serif text-[32px] leading-[1.1] font-normal">{shoot.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold whitespace-nowrap">
            <span className="flex items-center gap-1.5">
              <CalendarIcon />
              {fmtWhen(shoot.date, shoot.time)}
            </span>
            <span className="flex items-center gap-1.5">
              <ClockIcon />
              {totalMinutes(poses)} min total
            </span>
            <span className="flex items-center gap-1.5">
              <PhotoIcon />
              {plural(poses.length, "pose")}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col" style={{ gap: GAP }}>
        {poses.length > 0 ? (
          <div className="mb-2 flex items-center gap-1.5 px-1 text-[13px] text-muted">
            <GripIcon size={14} color="#6B625B" r={1.6} />
            drag to reorder · press and hold to select
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 rounded-card border-[1.5px] border-dashed border-line px-6 py-10 text-center">
            <div className="text-[15px] font-semibold">no poses yet</div>
            <div className="text-[13px] text-muted">tap “add poses” to pick inspiration photos</div>
          </div>
        )}

        {poses.map((p, i) => {
          const isSel = selected.includes(p.id);
          const dragging = drag?.id === p.id;
          return (
            <div
              key={p.id}
              ref={(el) => {
                if (el) cardEls.current.set(p.id, el);
                else cardEls.current.delete(p.id);
              }}
              role="button"
              tabIndex={0}
              aria-pressed={selecting ? isSel : undefined}
              aria-label={selecting ? `${isSel ? "Deselect" : "Select"} ${p.title || "untitled pose"}` : `Pose ${i + 1}: ${p.title || "untitled pose"}`}
              {...lp.bind(p.id)}
              onClick={() => {
                if (lp.consumeClick()) return;
                if (selecting) toggle(p.id);
                else openPose(i);
              }}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                e.preventDefault();
                if (selecting) toggle(p.id);
                else openPose(i);
              }}
              className="no-callout relative flex items-stretch gap-3.5 rounded-card bg-surface p-3 text-left outline-offset-2"
              style={{
                boxShadow: selecting && isSel ? "var(--shadow-selected)" : dragging ? "0 12px 28px rgba(38,33,30,.18)" : "var(--shadow-paper)",
                transform: dragging ? `translateY(${drag.dy}px) scale(1.02)` : undefined,
                zIndex: dragging ? 10 : undefined,
                cursor: selecting ? "pointer" : "grab",
              }}
            >
              <Photo photo={p.imageId} className="h-[116px] w-[92px] shrink-0 rounded-photo">
                {selecting && <SelectBadge selected={isSel} />}
              </Photo>
              <div className="flex min-w-0 grow flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[22px] leading-none font-bold">{poseNum(i)}</div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 items-center gap-1 rounded-full border border-line bg-paper px-[9px] text-[12px] font-bold">
                      <TimerIcon />
                      {p.minutes} min
                    </div>
                    <button
                      type="button"
                      aria-label={`Reorder pose ${i + 1} (arrow keys)`}
                      tabIndex={selecting ? -1 : 0}
                      onPointerDown={(e) => onGripDown(e, p.id)}
                      onPointerMove={onGripMove}
                      onPointerUp={onGripUp}
                      onPointerCancel={onGripUp}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => onGripKey(e, i)}
                      className="-my-2.5 -mr-2 flex h-11 w-9 touch-none items-center justify-center"
                      style={{ cursor: dragging ? "grabbing" : "grab" }}
                    >
                      <GripIcon />
                    </button>
                  </div>
                </div>
                <div className={`text-[15px] leading-[1.25] font-semibold ${p.title ? "" : "text-placeholder"}`}>{p.title || "untitled pose"}</div>
                {splitWho(p.who).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {splitWho(p.who).map((w) => (
                      <div key={w} className="flex h-[22px] items-center rounded-full px-[9px] text-[12px] font-semibold" style={{ background: colorFor(w) }}>
                        {w}
                      </div>
                    ))}
                  </div>
                )}
                {p.note && <div className="text-[13px] leading-[1.35] text-muted">{p.note}</div>}
              </div>
              <Scribble spec={scribbleFor(p.id)} scale={0.72} />
            </div>
          );
        })}
      </div>

      <BottomBar fade={132}>
        {/* add-poses always starts with an empty selection */}
        <Link href={`/shoot/${shoot.id}/import`} onClick={clearEditor} className={secondaryBtn}>
          <PlusIcon size={18} color="#26211E" />
          add poses
        </Link>
        <Link href={`/shoot/${shoot.id}/export`} className={primaryBtn}>
          <DownloadIcon />
          save
        </Link>
      </BottomBar>
    </Screen>
  );
}
