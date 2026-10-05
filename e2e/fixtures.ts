import { deflateSync } from "node:zlib";
import type { Page } from "@playwright/test";

/*
 * Test helpers. Every test starts with an empty IndexedDB (fresh browser context).
 * Tests that need data create it through the app's dev seed (NEXT_PUBLIC_DEV_SEED=1 in
 * the test build) or through the real UI; photos are picked through the file chooser.
 */

// --- tiny solid-colour PNGs, so every test photo is a real, distinct image ------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** A 24×32 PNG of one colour. */
export function solidPng([r, g, b]: [number, number, number]): Buffer {
  const [w, h] = [24, 32];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, Buffer.from([r, g, b]))]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(Array(h).fill(row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Photo files to pick through the file chooser (the web stand-in for the native picker). */
export const photoFiles = (count: number, offset = 0) =>
  Array.from({ length: count }, (_, i) => {
    const n = i + offset;
    return { name: `photo-${n + 1}.png`, mimeType: "image/png", buffer: solidPng([(20 * n) % 256, 255 - ((20 * n) % 256), (97 * n) % 256]) };
  });

// --- dev seed ------------------------------------------------------------------------------

type Stats = { profile: number; photoshoots: number; poses: number; images: number };
type DevApi = { seed(o: { profile?: string | null; shoot?: boolean }): Promise<{ shootId: string | null }>; stats(): Promise<Stats> };

async function devApi(page: Page) {
  if (page.url() === "about:blank") await page.goto("/privacy"); // renders without a profile
  await page.waitForFunction(() => "shootPlanner" in window);
}

/** Creates a profile and (by default) the 8-pose sample shoot. Returns the shoot's id. */
export async function seed(page: Page, opts: { profile?: string | null; shoot?: boolean } = {}) {
  await devApi(page);
  const { shootId } = await page.evaluate((o) => (window as unknown as { shootPlanner: DevApi }).shootPlanner.seed(o), opts);
  return shootId;
}

/** Row counts in the on-device database. */
export async function stats(page: Page): Promise<Stats> {
  await devApi(page);
  return page.evaluate(() => (window as unknown as { shootPlanner: DevApi }).shootPlanner.stats());
}

// --- photo picker ------------------------------------------------------------------------

/**
 * Picks photos the way a person would: `open` taps whatever opens the picker (in the web
 * build that's the file chooser), then the given files are chosen, in order.
 */
export async function pickFiles(page: Page, open: () => Promise<unknown>, files: ReturnType<typeof photoFiles>) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), open()]);
  await chooser.setFiles(files);
}

/** Opens the picker and cancels it. */
export async function cancelPicker(page: Page, open: () => Promise<unknown>) {
  await Promise.all([page.waitForEvent("filechooser"), open()]);
  await page.getByTestId("photo-input").dispatchEvent("cancel");
}

/** URLs of a shoot's screens (the id is a query parameter). */
export const routes = {
  plan: (id: string) => `/shoot?id=${id}`,
  pose: (id: string) => `/shoot/pose?id=${id}`,
  export: (id: string) => `/shoot/export?id=${id}`,
};
