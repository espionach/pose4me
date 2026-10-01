"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightIcon, CloseIcon } from "@/components/icons";
import { Sticker } from "@/components/Scribble";
import { BottomBar, IconButton, Screen } from "@/components/ui";
import { useNav } from "@/lib/nav";
import { DRAFT_ID, useStore } from "@/lib/store";

const pad = (n: number) => String(n).padStart(2, "0");

/** Today's date and the next full hour (rolls over to tomorrow after 11pm). */
function defaultWhen() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:00` };
}

const field = "box-border h-[52px] w-full min-w-0 rounded-[18px] border-[1.5px] border-line bg-surface px-3.5 text-[15px] font-semibold text-ink outline-none";

export default function NewShoot() {
  const router = useRouter();
  const nav = useNav();
  const { state, startDraft, discardInProgress } = useStore();
  // Coming back from the camera roll keeps what was typed; otherwise start fresh.
  const [form, setForm] = useState(() => state.draft ?? { title: "", ...defaultWhen() });
  const name = form.title.trim();
  const ready = name.length > 0;

  const next = () => {
    if (!ready) return;
    startDraft({ ...form, title: name });
    router.push(`/shoot/${DRAFT_ID}/import`);
  };

  return (
    <Screen gap={26}>
      <div className="flex items-center justify-between">
        <IconButton
          label="Cancel new shoot"
          onClick={() => {
            discardInProgress();
            nav.back("/");
          }}
        >
          <CloseIcon />
        </IconButton>
      </div>

      <div className="relative flex flex-col gap-1.5 px-1">
        <h1 className="m-0 font-serif text-[34px] leading-[1.1] font-normal">new shoot</h1>
        <Sticker name="05-flower" size={[46, 46]} style={{ right: 10, top: -6, transform: "rotate(14deg)" }} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="shoot-name" className="section-label">
          shoot name
        </label>
        <input
          id="shoot-name"
          autoFocus
          enterKeyHint="next"
          placeholder="e.g. golden hour picnic"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              next();
            }
          }}
          className="box-border h-[60px] rounded-[18px] border-[1.5px] bg-surface px-4 font-serif text-[22px] text-ink shadow-paper outline-none"
          style={{ borderColor: ready ? "#26211E" : "#E6DED3" }}
        />
      </div>

      <div className="flex gap-2.5">
        <div className="flex min-w-0 grow flex-col gap-2">
          <label htmlFor="shoot-date" className="section-label">
            date
          </label>
          <input id="shoot-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={field} />
        </div>
        <div className="flex w-[136px] shrink-0 flex-col gap-2">
          <label htmlFor="shoot-time" className="section-label">
            time
          </label>
          <input id="shoot-time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className={field} />
        </div>
      </div>

      {/* Pinned to the bottom like the button, and below it in z-order. */}
      <div aria-hidden className="bottom-bar z-10! h-0">
        <Sticker name="01-star" size={[40, 40]} style={{ left: 34, bottom: "calc(var(--pad-bottom) + 100px)", transform: "rotate(-10deg)" }} />
        <Sticker name="12-loop-de-loop" size={[46, 26]} style={{ right: 40, bottom: "calc(var(--pad-bottom) + 118px)", transform: "rotate(8deg)" }} />
      </div>

      <BottomBar>
        {ready ? (
          <button
            type="button"
            onClick={next}
            className="flex h-[58px] grow items-center justify-center gap-2.5 rounded-full bg-ink text-[16px] font-semibold text-white shadow-[0_10px_24px_rgba(38,33,30,.22)]"
          >
            next · pick photos
            <ArrowRightIcon />
          </button>
        ) : (
          <button type="button" disabled className="h-[58px] grow rounded-full bg-line text-[16px] font-semibold text-muted">
            name your shoot to continue
          </button>
        )}
      </BottomBar>
    </Screen>
  );
}
