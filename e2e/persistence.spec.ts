import { expect, test, type Page } from "@playwright/test";
import { photoFiles, seed, stats } from "./fixtures";

/*
 * Data persists on the device (IndexedDB) across reloads, images included, and deleting
 * removes images too. Every test starts with an empty database.
 */

const ORIGIN = "http://localhost:3100";
const url = (path: string) => new RegExp(`^${ORIGIN}${path}$`);

const poseCards = (page: Page) => page.locator("[role=button][aria-label^='Pose ']");
const poseTitles = (page: Page) => poseCards(page).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!.replace(/^Pose \d+: /, "")));

/** Every photo on screen has loaded from an object URL (i.e. from the stored blob). */
async function expectPhotosLoaded(page: Page, count: number) {
  const imgs = page.locator("main [data-photo] img");
  await expect(imgs).toHaveCount(count);
  await expect
    .poll(() => imgs.evaluateAll((els) => els.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0 && (img as HTMLImageElement).src.startsWith("blob:"))))
    .toBe(true);
}

/**
 * Drags pose card `from` (1-based) past `steps` neighbours using its grip: down for positive
 * steps, up for negative. Keep drags on screen — the page doesn't auto-scroll while dragging.
 */
async function drag(page: Page, from: number, steps: number) {
  const grip = page.getByLabel(`Reorder pose ${from} (arrow keys)`);
  // Bring the handle to mid-screen so it isn't under the fixed bottom buttons.
  await grip.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = (await grip.boundingBox())!;
  // A card swaps once the dragged card passes half of its neighbour (height + 14px gap),
  // so move past exactly `steps` neighbours — measured, since card heights vary.
  const dir = Math.sign(steps);
  const heights: number[] = [];
  for (let k = 1; k <= Math.abs(steps); k++) heights.push((await poseCards(page).nth(from - 1 + dir * k).boundingBox())!.height + 14);
  const total = dir * (heights.reduce((a, h) => a + h, 0) - heights[heights.length - 1] / 2 + 12);
  const [x, y0] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y0);
  await page.mouse.down();
  for (let d = 0; Math.abs(d) < Math.abs(total); d += dir * 10) await page.mouse.move(x, y0 + d);
  await page.mouse.move(x, y0 + total);
  await page.mouse.up();
}

test("a fresh install starts empty", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(url("/welcome"));
  await page.locator("#welcome-name").fill("sam");
  await page.getByRole("button", { name: "let's go" }).click();
  await expect(page.getByText("no shoots yet — start one below")).toBeVisible();
  await expect(page.getByRole("button", { name: "new shoot" })).toBeVisible();
  expect(await stats(page)).toEqual({ profile: 1, photoshoots: 0, poses: 0, images: 0 });
});

test("a shoot created with photos survives a reload: details, poses, order and images", async ({ page }) => {
  await seed(page, { shoot: false });
  await page.goto("/");
  await page.getByRole("button", { name: "new shoot" }).click();
  await page.locator("#shoot-name").fill("persist test");
  await page.locator("#shoot-date").fill("2026-12-05");
  await page.locator("#shoot-time").fill("16:45");
  await page.getByRole("button", { name: "next · pick photos" }).click();

  // Photos added "from device" come in selected, in the order picked.
  await page.locator("input[type=file]").setInputFiles(photoFiles(3));
  await page.getByRole("button", { name: "next · 3 selected" }).click();
  for (const [name, who] of [["one", "Maya"], ["two", "me"], ["three", "Zoe"]]) {
    await page.locator("#pose-name").fill(name);
    await page.locator("#pose-who").fill(who);
    if (name === "two") await page.getByRole("button", { name: "More time" }).click();
    if (name !== "three") await page.getByLabel("Next photo").click();
  }
  await page.locator("#pose-notes").fill("last one");
  await page.getByRole("button", { name: "save 3 poses" }).click();
  await expect(page.getByRole("heading", { name: "persist test" })).toBeVisible();
  await expect.poll(() => poseTitles(page)).toEqual(["one", "two", "three"]);

  // Drag-reorder: "one" to the end, saved in one write.
  await drag(page, 1, 2);
  await expect.poll(() => poseTitles(page)).toEqual(["two", "three", "one"]);

  // Pencil edit of the shoot details.
  await page.getByLabel("Edit shoot details").click();
  await page.getByLabel("Shoot title").fill("persist test, renamed");
  await page.getByRole("button", { name: "done" }).click();

  expect(await stats(page)).toEqual({ profile: 1, photoshoots: 1, poses: 3, images: 3 });

  await page.reload();
  await expect(page.getByRole("heading", { name: "persist test, renamed" })).toBeVisible();
  await expect(page.getByText("Sat, Dec 5 · 4:45pm")).toBeVisible();
  await expect(page.getByText("10 min total")).toBeVisible(); // 3 + 4 + 3, derived
  await expect.poll(() => poseTitles(page)).toEqual(["two", "three", "one"]);
  await expect(page.getByText("last one")).toBeVisible();
  await expectPhotosLoaded(page, 3);

  // My shoots shows the derived count and a loaded cover photo.
  await page.goto("/");
  await expect(page.getByRole("link", { name: /persist test, renamed/ })).toContainText("Dec 5 · 3 poses");
  await expectPhotosLoaded(page, 1);
});

test("images keep their pose after reordering and reloading", async ({ page }) => {
  const shootId = await seed(page);
  await page.goto(`/shoot/${shootId}`);
  const idsBefore = await page.locator("main [data-photo]").evaluateAll((els) => els.map((e) => e.getAttribute("data-photo")));
  await drag(page, 3, -2); // "jumping together" to the top
  await expect.poll(() => poseTitles(page)).toEqual([
    "jumping together, arms up",
    "sitting on the blanket, looking away",
    "hand in hair, mid-laugh",
    "flatlay with snacks + film camera",
    "twirling in the dress",
    "over-the-shoulder look back",
    "lying on the blanket, top-down",
    "walking away, holding hands",
  ]);
  await page.reload();
  const idsAfter = await page.locator("main [data-photo]").evaluateAll((els) => els.map((e) => e.getAttribute("data-photo")));
  expect(idsAfter).toEqual([idsBefore[2], idsBefore[0], idsBefore[1], ...idsBefore.slice(3)]);
  await expectPhotosLoaded(page, 8);
});

test("deleting poses deletes their images", async ({ page }) => {
  const shootId = await seed(page);
  await page.goto(`/shoot/${shootId}`);
  const first = poseCards(page).first();
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + 150, box.y + 60);
  await page.mouse.down();
  await page.waitForTimeout(700); // press and hold
  await page.mouse.up();
  await page.getByRole("button", { name: /^Select hand in hair/ }).click();
  await page.getByRole("button", { name: "delete poses" }).click();
  await expect(page.getByText("6 poses")).toBeVisible();
  expect(await stats(page)).toEqual({ profile: 1, photoshoots: 1, poses: 6, images: 6 });
  await page.reload();
  await expect(poseCards(page)).toHaveCount(6);
  await expect.poll(() => poseTitles(page)).toEqual([
    "jumping together, arms up",
    "flatlay with snacks + film camera",
    "twirling in the dress",
    "over-the-shoulder look back",
    "lying on the blanket, top-down",
    "walking away, holding hands",
  ]);
});

test("deleting a shoot deletes its poses and images", async ({ page }) => {
  await seed(page);
  await seed(page, { profile: null }); // a second shoot that should be untouched
  await page.goto("/");
  const card = page.getByRole("link", { name: /golden hour picnic/ }).first();
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + 50, box.y + 50);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.getByRole("button", { name: "delete shoot" }).click();
  await expect(page.getByRole("link", { name: /golden hour picnic/ })).toHaveCount(1);
  expect(await stats(page)).toEqual({ profile: 1, photoshoots: 1, poses: 8, images: 8 });
});

test("replacing a saved pose's photo stores the new image and deletes the old one", async ({ page }) => {
  const shootId = await seed(page);
  await page.goto(`/shoot/${shootId}`);
  await poseCards(page).nth(1).click();
  const before = await page.locator("main [data-photo]").first().getAttribute("data-photo");
  await page.getByLabel("Change photo").click();
  await page.locator("input[type=file]").setInputFiles(photoFiles(1, 5));
  await page.getByRole("button", { name: "use photo" }).click();
  await expect(page).toHaveURL(url(`/shoot/${shootId}/pose`));
  const after = await page.locator("main [data-photo]").first().getAttribute("data-photo");
  expect(after).not.toBe(before);
  expect(await stats(page)).toEqual({ profile: 1, photoshoots: 1, poses: 8, images: 8 });
  await page.reload(); // falls back to the plan; the new photo is saved
  await expect(page).toHaveURL(url(`/shoot/${shootId}`));
  expect(await page.locator("main [data-photo]").nth(1).getAttribute("data-photo")).toBe(after);
});

test("an abandoned new-shoot draft writes nothing", async ({ page }) => {
  await seed(page, { shoot: false });
  await page.goto("/");
  await page.getByRole("button", { name: "new shoot" }).click();
  await page.locator("#shoot-name").fill("never saved");
  await page.getByRole("button", { name: "next · pick photos" }).click();
  await page.locator("input[type=file]").setInputFiles(photoFiles(2));
  await page.getByRole("button", { name: "next · 2 selected" }).click();
  await page.locator("#pose-name").fill("draft pose");
  await page.getByLabel("Back to camera roll").click();
  await page.getByLabel("Close").click();
  await page.getByLabel("Cancel new shoot").click();
  await expect(page).toHaveURL(url("/"));
  expect(await stats(page)).toEqual({ profile: 1, photoshoots: 0, poses: 0, images: 0 });
});

test("a full device shows a friendly message instead of crashing", async ({ page }) => {
  await seed(page, { shoot: false });
  await page.goto("/settings");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Simulate storage being full: every IndexedDB write now fails with QuotaExceededError.
  await page.evaluate(() => {
    const fail = () => {
      throw new DOMException("storage full", "QuotaExceededError");
    };
    IDBObjectStore.prototype.put = fail;
    IDBObjectStore.prototype.add = fail;
  });
  await page.locator("#display-name").fill("new name");
  await page.getByRole("button", { name: "save" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "couldn" })).toContainText("your device storage is full");
  await expect(page.getByText("couldn't save — try again.")).toBeVisible();
  expect(errors).toEqual([]);
});
