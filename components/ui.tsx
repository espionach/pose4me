"use client";

import Link from "next/link";
import { useNav } from "@/lib/nav";
import { BackIcon, CheckIcon, ChevronLeft, ChevronRight, TrashIcon } from "./icons";

/** 44px white circle with a 1.5px line border. */
export function IconButton({
  href,
  onClick,
  label,
  children,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const cls = `flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line bg-surface ${className}`;
  return href ? (
    <Link href={href} aria-label={label} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/** A 44px chevron back button that behaves like the browser's back button. Usable from server components. */
export function BackButton({ to, label }: { to: string; label: string }) {
  const nav = useNav();
  return (
    <IconButton label={label} onClick={() => nav.back(to)}>
      <BackIcon />
    </IconButton>
  );
}

/** The screen wrapper: paper background, design padding, room for the fixed bottom bar. */
export function Screen({
  children,
  className = "",
  bg = "paper",
  px = 20,
  gap = 18,
  bottomSpace = 130,
}: {
  children: React.ReactNode;
  className?: string;
  bg?: "paper" | "deep";
  px?: number;
  gap?: number;
  bottomSpace?: number;
}) {
  return (
    <main
      className={`flex min-h-dvh flex-col ${bg === "paper" ? "paper" : "bg-paper-deep"} ${className}`}
      style={{ padding: `var(--pad-top) ${px}px ${bottomSpace}px`, gap }}
    >
      {children}
    </main>
  );
}

/** Fixed bottom bar, optionally with the paper-colored fade behind it. */
export function BottomBar({ children, fade, px = 20 }: { children: React.ReactNode; fade?: number; px?: number }) {
  return (
    <div className="bottom-bar">
      {fade ? (
        <div
          aria-hidden
          className="pointer-events-none! absolute inset-x-0 bottom-0"
          style={{ height: fade, background: "linear-gradient(rgba(251,248,243,0), #FBF8F3 42%)" }}
        />
      ) : null}
      <div className="relative flex gap-2.5" style={{ padding: `0 ${px}px var(--pad-bottom)` }}>
        {children}
      </div>
    </div>
  );
}

export const primaryBtn =
  "flex h-14 grow basis-0 items-center justify-center gap-2 rounded-full bg-ink text-[16px] font-semibold text-white";
export const secondaryBtn =
  "flex h-14 grow basis-0 items-center justify-center gap-2 rounded-full border-[1.5px] border-ink bg-surface text-[16px] font-semibold text-ink";

/** "N selected · cancel · delete" row that replaces the header while selecting. */
export function SelectBar({
  count,
  noun,
  onCancel,
  onDelete,
}: {
  count: number;
  noun: string;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex h-11 items-center justify-between">
      <div className="pl-1 text-[16px] font-bold">{count} selected</div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="h-11 rounded-full border-[1.5px] border-line bg-surface px-[18px] text-[15px] font-semibold">
          cancel
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={count === 0}
          className="flex h-11 items-center gap-1.5 rounded-full bg-berry px-[18px] text-[15px] font-semibold text-white disabled:opacity-40"
        >
          <TrashIcon />
          delete {noun}
          {count === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

/** Check badge (selected) or empty ring (unselected) on a photo's top-left corner. */
export function SelectBadge({ selected }: { selected: boolean }) {
  return selected ? (
    <span className="absolute left-2 top-2 z-[3] flex h-6 w-6 items-center justify-center rounded-full bg-ink">
      <CheckIcon size={14} sw={3} />
    </span>
  ) : (
    <span className="absolute left-2 top-2 z-[3] box-border h-6 w-6 rounded-full border-2 border-white bg-[rgba(38,33,30,.12)]" />
  );
}

/** Prev (white) / next (ink) arrow buttons, dimmed to 35% at the ends. */
export function ArrowButton({ dir, disabled, onClick, label, style }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void; label: string; style?: React.CSSProperties }) {
  const prev = dir === "prev";
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={`absolute z-[5] flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-35 ${
        prev ? "border-[1.5px] border-line bg-surface shadow-[0_4px_10px_rgba(38,33,30,.10)]" : "bg-ink shadow-[0_4px_10px_rgba(38,33,30,.18)]"
      }`}
    >
      {prev ? <ChevronLeft /> : <ChevronRight />}
    </button>
  );
}

export function PagerDots({ count, index, onGo, noun }: { count: number; index: number; onGo: (i: number) => void; noun: string }) {
  return (
    <div className="flex justify-center gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <button key={i} type="button" aria-label={`Go to ${noun} ${i + 1}`} onClick={() => onGo(i)} className="flex h-4 w-[22px] items-center justify-center p-0">
          <span className="block h-2 rounded-full transition-all" style={{ width: i === index ? 20 : 8, background: i === index ? "#26211E" : "#D9D0C5" }} />
        </button>
      ))}
    </div>
  );
}
