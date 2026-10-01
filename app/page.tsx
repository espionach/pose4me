"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseIcon, GearIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { Photo } from "@/components/Photo";
import { Scribble, useScribbles, type Sides } from "@/components/Scribble";
import { BottomBar, IconButton, SelectBadge, SelectBar } from "@/components/ui";
import { fmtShortDate, isDone, plural } from "@/lib/format";
import { useShoots } from "@/lib/data";
import { deleteShoots } from "@/lib/db";
import { useProfile } from "@/lib/profile";
import { useStore } from "@/lib/store";
import { useLongPress } from "@/lib/useLongPress";

const FALLBACK_BG = ["#F8E7A6", "#E2D5F2", "#CFE3C4", "#F7C6CF", "#CFE0F2"];
const FILTERS = ["all", "upcoming", "done"] as const;

// Top edge or the photo's left/right sides — clear of the title, date and select badge.
const SIDES: Sides = {
  top: (r) => ({ top: r(-20, -16), left: r(40, 96) }),
  right: (r) => ({ right: r(-14, -10), top: r(4, 78) }),
  left: (r) => ({ left: r(-14, -10), top: r(40, 78) }),
};

export default function MyShoots() {
  const router = useRouter();
  const { discardInProgress } = useStore();
  const cards = useShoots();
  const { profile } = useProfile();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const scribbleFor = useScribbles(SIDES);
  // Landing here means any unfinished flow (new shoot, picked photos) was abandoned.
  useEffect(() => discardInProgress(), [discardInProgress]);
  const lp = useLongPress((id) => {
    setSelecting(true);
    setSelected([id]);
  });

  const q = query.trim().toLowerCase();
  const shoots = (cards ?? []).filter(
    ({ shoot: s }) =>
      (filter === "all" || (filter === "done" ? isDone(s) : !isDone(s))) &&
      (!searchOpen || !q || s.title.toLowerCase().includes(q)),
  );

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const endSelect = () => {
    setSelecting(false);
    setSelected([]);
  };

  const newShoot = () => router.push("/new");

  return (
    <main className="paper flex min-h-dvh flex-col gap-[22px]" style={{ padding: "max(56px, calc(env(safe-area-inset-top) + 16px)) 24px 132px" }}>
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="origin-left -rotate-3 font-hand text-[24px] font-bold text-berry">hey {profile?.displayName}!</div>
          <h1 className="m-0 font-serif text-[38px] leading-[1.05] font-normal tracking-[-0.5px]">my shoots</h1>
          <svg width="120" height="12" viewBox="0 0 120 12" fill="none" stroke="#F2A7B6" strokeWidth="3" strokeLinecap="round" aria-hidden>
            <path d="M2 7c10-6 18 4 28 0s18-6 28 0 18 4 28 0 18-6 32-1" />
          </svg>
        </div>
        <div className="mt-[18px] flex gap-2">
          <button
            type="button"
            aria-label={searchOpen ? "Close search" : "Search shoots"}
            aria-expanded={searchOpen}
            onClick={() => {
              setSearchOpen((o) => !o);
              setQuery("");
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-line bg-surface"
          >
            {searchOpen ? <CloseIcon /> : <SearchIcon />}
          </button>
          <IconButton href="/settings" label="Settings">
            <GearIcon />
          </IconButton>
        </div>
      </header>

      {searchOpen && !selecting && (
        <label className="-mb-2 flex h-12 items-center gap-2.5 rounded-[18px] bg-surface px-4 shadow-paper">
          <SearchIcon size={18} color="#6B625B" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search shoots"
            aria-label="Search shoots"
            className="h-full min-w-0 grow bg-transparent text-[16px] font-semibold outline-none"
          />
        </label>
      )}

      {selecting ? (
        <SelectBar
          count={selected.length}
          noun="shoot"
          onCancel={endSelect}
          onDelete={() => {
            // Deletes the shoots with their poses and photos. Failures show the storage banner.
            deleteShoots(selected).then(endSelect, () => {});
          }}
        />
      ) : (
        <div className="flex gap-2" role="group" aria-label="Filter shoots">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? "h-9 rounded-full bg-ink px-4 text-[14px] font-semibold text-white"
                  : "h-9 rounded-full border-[1.5px] border-line bg-surface px-4 text-[14px] font-medium"
              }
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {cards === undefined ? null : shoots.length === 0 ? (
        <p className="px-1 pt-6 text-center text-[15px] text-muted">
          {q ? `no shoots match “${query.trim()}”` : filter === "all" ? "no shoots yet — start one below" : `no ${filter} shoots`}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {shoots.map(({ shoot: s, poseCount, coverImageId: cover }, i) => {
            const isSel = selected.includes(s.id);
            return (
              <Link
                key={s.id}
                href={`/shoot/${s.id}`}
                draggable={false}
                aria-pressed={selecting ? isSel : undefined}
                aria-label={selecting ? `${isSel ? "Deselect" : "Select"} ${s.title}` : undefined}
                {...lp.bind(s.id)}
                onClick={(e) => {
                  if (lp.consumeClick()) return e.preventDefault();
                  if (selecting) {
                    e.preventDefault();
                    toggle(s.id);
                  }
                }}
                className="no-callout flex flex-col gap-2.5 rounded-card bg-surface p-3 transition-shadow"
                style={{ boxShadow: selecting && isSel ? "var(--shadow-selected)" : "var(--shadow-paper)" }}
              >
                <div className="relative h-[120px]">
                  {cover ? (
                    <Photo photo={cover} className="h-full rounded-photo" />
                  ) : (
                    <div className="h-full rounded-photo" style={{ background: FALLBACK_BG[i % FALLBACK_BG.length] }} />
                  )}
                  <Scribble spec={scribbleFor(s.id)} />
                  {selecting && <SelectBadge selected={isSel} />}
                </div>
                <div className="flex flex-col gap-0.5 px-1 pb-1">
                  <div className="font-serif text-[17px] leading-snug">{s.title}</div>
                  <div className="text-[13px] text-muted">
                    {fmtShortDate(s.date)} · {plural(poseCount, "pose")}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <BottomBar px={24}>
        <button
          type="button"
          onClick={newShoot}
          className="mb-0.5 flex h-[58px] grow items-center justify-center gap-2.5 rounded-full bg-ink text-[17px] font-semibold text-white shadow-float"
        >
          <PlusIcon />
          new shoot
        </button>
      </BottomBar>
    </main>
  );
}
