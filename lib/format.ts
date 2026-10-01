import type { Shoot } from "./types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

/** "Sat, Oct 4 · 6:15pm" */
export function fmtWhen(date: string | null, time: string | null) {
  let out = "";
  if (date) {
    const dt = parseDate(date);
    out = `${DAYS[dt.getDay()]}, ${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
  }
  if (time) {
    const [h, m] = time.split(":").map(Number);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    out += `${out ? " · " : ""}${h12}:${m < 10 ? "0" : ""}${m}${h < 12 ? "am" : "pm"}`;
  }
  return out || "add date";
}

/** "Oct 4" */
export function fmtShortDate(date: string | null) {
  if (!date) return "no date";
  const dt = parseDate(date);
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}

/** Total time is always derived from the poses, never stored. */
export const totalMinutes = (poses: { minutes: number }[]) => poses.reduce((n, p) => n + p.minutes, 0);
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
export const poseNum = (i: number) => `${i < 9 ? "0" : ""}${i + 1}`;

export function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const isDone = (s: Shoot) => !!s.date && s.date < todayISO();

export function splitWho(who: string) {
  return who
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
}

const CHIP_COLORS = ["#CFE3C4", "#E2D5F2", "#CFE0F2", "#F8E7A6"];

/** "me" is always pink; everyone else gets a pastel by order of first appearance in the shoot. */
export function whoColors(poses: { who: string }[]) {
  const map: Record<string, string> = {};
  let n = 0;
  for (const p of poses) {
    for (const w of splitWho(p.who)) {
      const key = w.toLowerCase();
      if (map[key]) continue;
      map[key] = key === "me" ? "#F7C6CF" : CHIP_COLORS[n++ % CHIP_COLORS.length];
    }
  }
  return (w: string) => map[w.toLowerCase()] ?? CHIP_COLORS[0];
}

