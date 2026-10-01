/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef } from "react";

// The 16 final stickers (public/scribbles). Confetti was removed on purpose.
const SCRIBBLES: { file: string; w: number; h: number }[] = [
  { file: "01-star", w: 38, h: 38 },
  { file: "02-burst", w: 38, h: 38 },
  { file: "03-spiral", w: 38, h: 38 },
  { file: "04-squiggle-line", w: 44, h: 22 },
  { file: "05-flower", w: 38, h: 38 },
  { file: "06-sparkle", w: 36, h: 36 },
  { file: "07-smiley", w: 36, h: 36 },
  { file: "08-lightning-bolt", w: 32, h: 38 },
  { file: "09-moon", w: 34, h: 34 },
  { file: "10-rainbow", w: 44, h: 26 },
  { file: "11-cloud", w: 42, h: 30 },
  { file: "12-loop-de-loop", w: 46, h: 26 },
  { file: "13-crown", w: 40, h: 32 },
  { file: "14-asterisk", w: 32, h: 32 },
  { file: "15-cherries", w: 36, h: 38 },
  { file: "16-bow", w: 42, h: 30 },
];

type Pos = Partial<Record<"top" | "left" | "right" | "bottom", number>>;
type Rand = (a: number, b: number) => number;
export type Sides = Record<string, (r: Rand) => Pos>;
export type ScribbleSpec = { idx: number; pos: Pos; rot: number };

const shuffle = <T,>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const rand: Rand = (a, b) => Math.round(a + Math.random() * (b - a));

/**
 * Randomized once per page load: the design pool is shuffled so cards on a screen
 * don't repeat, rotation is −28°…28°, and each card cycles to a different edge.
 * Specs are memoized by id so they stay put across re-renders and reorders.
 */
export function useScribbles(sides: Sides) {
  const ref = useRef<{ pool: number[]; n: number; bag: string[]; byId: Map<string, ScribbleSpec> } | null>(null);
  if (!ref.current) ref.current = { pool: shuffle(SCRIBBLES.map((_, i) => i)), n: 0, bag: [], byId: new Map() };
  const g = ref.current;
  return (id: string): ScribbleSpec => {
    let spec = g.byId.get(id);
    if (!spec) {
      if (!g.bag.length) g.bag = shuffle(Object.keys(sides));
      spec = { idx: g.pool[g.n++ % g.pool.length], pos: sides[g.bag.pop()!](rand), rot: rand(-28, 28) };
      g.byId.set(id, spec);
    }
    return spec;
  };
}

/** A fixed (non-random) decorative sticker from the same set, e.g. `<Sticker name="05-flower" />`. */
export function Sticker({ name, size, style }: { name: string; size?: [number, number]; style?: React.CSSProperties }) {
  const s = SCRIBBLES.find((x) => x.file === name)!;
  const [w, h] = size ?? [s.w, s.h];
  return (
    <img
      src={`/scribbles/${s.file}.svg`}
      alt=""
      aria-hidden
      width={w}
      height={h}
      draggable={false}
      className="absolute block"
      style={{ pointerEvents: "none", ...style }}
    />
  );
}

export function Scribble({ spec, scale = 1 }: { spec: ScribbleSpec; scale?: number }) {
  const s = SCRIBBLES[spec.idx];
  const style: React.CSSProperties = { transform: `rotate(${spec.rot}deg) scale(${scale})` };
  for (const [k, v] of Object.entries(spec.pos)) style[k as keyof Pos] = v;
  return (
    <span aria-hidden className="pointer-events-none absolute z-[2] block leading-[0]" style={style}>
      <img src={`/scribbles/${s.file}.svg`} alt="" width={s.w} height={s.h} draggable={false} />
    </span>
  );
}
