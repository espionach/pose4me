/*
 * Optional sample data for development and tests. Only exposed when NEXT_PUBLIC_DEV_SEED=1
 * (see components/DevTools.tsx); normal builds start empty. Everything goes through lib/db.ts.
 */

import * as db from "./db";
import type { NewPose } from "./types";

const SAMPLE_POSES: Omit<NewPose, "imageId">[] = [
  { title: "sitting on the blanket, looking away", who: "Maya", minutes: 4, note: "shoot low, 0.5x lens, get the sun behind her" },
  { title: "hand in hair, mid-laugh", who: "me", minutes: 3, note: "burst mode! eye level, close crop" },
  { title: "jumping together, arms up", who: "Maya, Zoe", minutes: 5, note: "from the ground looking up, count to 3" },
  { title: "flatlay with snacks + film camera", who: "Zoe", minutes: 3, note: "straight down, stand on bench" },
  { title: "twirling in the dress", who: "Maya", minutes: 4, note: "slow shutter for motion blur" },
  { title: "over-the-shoulder look back", who: "me", minutes: 3, note: "sun behind, catch the flare" },
  { title: "lying on the blanket, top-down", who: "Maya, Zoe", minutes: 5, note: "stand on the cooler, 0.5x" },
  { title: "walking away, holding hands", who: "Maya, Zoe", minutes: 5, note: "shoot from behind at hip level" },
];

const PASTELS = ["#F7C6CF", "#F8E7A6", "#CFE0F2", "#CFE3C4", "#E2D5F2"];

/** A small solid-colour JPEG, standing in for a real photo. */
function sampleImage(color: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 400;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 300, 400);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85));
}

export type SeedOptions = { profile?: string | null; shoot?: boolean };

/** Adds a profile and/or the sample "golden hour picnic" shoot. Returns the new shoot's id. */
export async function seed({ profile = "priya", shoot = true }: SeedOptions = {}): Promise<{ shootId: string | null }> {
  if (profile) await db.saveProfile({ displayName: profile });
  if (!shoot) return { shootId: null };
  const poses: NewPose[] = [];
  for (const [i, p] of SAMPLE_POSES.entries()) poses.push({ ...p, imageId: await db.saveImage(await sampleImage(PASTELS[i % PASTELS.length])) });
  const created = await db.createShoot({ title: "golden hour picnic", date: "2026-10-04", time: "18:15" }, poses);
  return { shootId: created.id };
}
