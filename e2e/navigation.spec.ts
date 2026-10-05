import { expect, test, type Page } from "@playwright/test";
import { cancelPicker, photoFiles, pickFiles, routes, seed } from "./fixtures";

/*
 * Walks the navigation map in docs/navigation.md (row numbers in test names).
 * Every test starts with an empty database, then seeds a profile and "golden hour picnic"
 * (8 poses). Photos are picked through the file chooser — the web build's stand-in for
 * Apple's native photo picker.
 */

/** The seeded shoot's id (set before each test). */
let SHOOT = "";
const PLAN = () => routes.plan(SHOOT);

const ORIGIN = "http://localhost:3100";
const url = (path: string) => new RegExp(`^${ORIGIN}${path.replace(/[?]/g, "\\?")}$`);

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("main")).toBeVisible();
}

// These tests start past onboarding (Welcome is covered in welcome-settings.spec.ts).
test.beforeEach(async ({ page }) => {
  SHOOT = (await seed(page))!;
});

// --- helpers --------------------------------------------------------------------------

const counter = (page: Page) => page.getByText(/^photo \d+ of \d+$/);
const posesMeta = (page: Page) => page.locator("main").getByText(/^\d+ poses?$/);
/** Which photo the polaroid shows: a saved image id, or `picked:<key>` for one just picked. */
const polaroid = (page: Page) => page.locator("main [data-photo]").first().getAttribute("data-photo");
const shootCount = (page: Page) => page.locator("main a[href^='/shoot']").count();

async function toNewShoot(page: Page, name = "beach day") {
  await open(page, "/");
  await page.getByRole("button", { name: "new shoot" }).click();
  await expect(page).toHaveURL(url("/new"));
  await page.locator("#shoot-name").fill(name);
  await page.locator("#shoot-date").fill("2026-11-20");
  await page.locator("#shoot-time").fill("09:30");
}

/** New shoot → "next · pick photos" → picks `count` photos → Pose details. */
async function newShootWithPhotos(page: Page, count: number, name = "beach day") {
  await toNewShoot(page, name);
  await pickFiles(page, () => page.getByRole("button", { name: "next · pick photos" }).click(), photoFiles(count));
  await expect(page).toHaveURL(url(routes.pose("new")));
}

/** Shoot plan → "+ add poses" → picks `count` photos → Pose details. */
async function addPhotos(page: Page, count: number) {
  await open(page, PLAN());
  await pickFiles(page, () => page.getByRole("button", { name: "add poses" }).click(), photoFiles(count, 4));
  await expect(page).toHaveURL(url(routes.pose(SHOOT)));
}

async function openPoseCard(page: Page, n: number) {
  await open(page, PLAN());
  await page.locator(`[role=button][aria-label^='Pose ${n}:']`).click();
  await expect(page).toHaveURL(url(routes.pose(SHOOT)));
}

// --- the map ---------------------------------------------------------------------------

test.describe("My shoots", () => {
  test("row 1 · + new shoot opens New shoot", async ({ page }) => {
    await open(page, "/");
    await page.getByRole("button", { name: "new shoot" }).click();
    await expect(page).toHaveURL(url("/new"));
    await expect(page.getByRole("heading", { name: "new shoot" })).toBeVisible();
  });

  test("row 2 · tapping a shoot card opens its plan", async ({ page }) => {
    await open(page, "/");
    await page.getByRole("link", { name: /golden hour picnic/ }).click();
    await expect(page).toHaveURL(url(PLAN()));
    await expect(page.getByRole("heading", { name: "golden hour picnic" })).toBeVisible();
  });
});

test.describe("New shoot", () => {
  test("row 3 · X returns to My shoots and discards the draft", async ({ page }) => {
    await open(page, "/");
    const before = await shootCount(page);
    await page.getByRole("button", { name: "new shoot" }).click();
    await page.locator("#shoot-name").fill("throwaway");
    await page.getByLabel("Cancel new shoot").click();
    await expect(page).toHaveURL(url("/"));
    expect(await shootCount(page)).toBe(before);
    await expect(page.getByText("throwaway")).toHaveCount(0);
    await page.goBack(); // no leftover history entry
    await expect(page).not.toHaveURL(url("/new"));
    await open(page, "/");
    await page.getByRole("button", { name: "new shoot" }).click();
    await expect(page.locator("#shoot-name")).toHaveValue("");
  });

  test("row 4 · picking photos opens Pose details with them, in the order picked", async ({ page }) => {
    await newShootWithPhotos(page, 3);
    await expect(counter(page)).toHaveText("photo 1 of 3");
    const keys = [];
    for (let i = 0; i < 3; i++) {
      keys.push(await polaroid(page));
      if (i < 2) await page.getByLabel("Next photo").click();
    }
    // Picked photos are numbered in the order they came back from the picker.
    const n = keys.map((k) => Number(k!.replace("picked:pick-", "")));
    expect(n).toEqual([n[0], n[0] + 1, n[0] + 2]);
  });

  test("row 5 · cancelling the picker stays on New shoot with everything kept", async ({ page }) => {
    await toNewShoot(page, "kept");
    await cancelPicker(page, () => page.getByRole("button", { name: "next · pick photos" }).click());
    await expect(page).toHaveURL(url("/new"));
    await expect(page.locator("#shoot-name")).toHaveValue("kept");
    await expect(page.locator("#shoot-date")).toHaveValue("2026-11-20");
    await expect(page.locator("#shoot-time")).toHaveValue("09:30");
    await expect(page.getByRole("button", { name: "next · pick photos" })).toBeEnabled();
  });
});

test.describe("Shoot plan · add poses", () => {
  test("row 6 · picking photos opens Pose details with them", async ({ page }) => {
    await addPhotos(page, 2);
    await expect(counter(page)).toHaveText("photo 1 of 2");
  });

  test("row 7 · cancelling the picker leaves the plan unchanged", async ({ page }) => {
    await open(page, PLAN());
    await cancelPicker(page, () => page.getByRole("button", { name: "add poses" }).click());
    await expect(page).toHaveURL(url(PLAN()));
    await expect(posesMeta(page)).toHaveText("8 poses");
    await expect(page.getByRole("button", { name: "add poses" })).toBeEnabled();
  });
});

test.describe("Pose details · after picking photos", () => {
  for (const how of ["back button", "browser back"] as const) {
    test(`row 8 · new shoot: ${how} with no edits returns to New shoot, fields kept`, async ({ page }) => {
      await newShootWithPhotos(page, 2, "back test");
      if (how === "back button") await page.getByLabel("Back to new shoot").click();
      else await page.goBack();
      await expect(page).toHaveURL(url("/new"));
      await expect(page.locator("#shoot-name")).toHaveValue("back test");
      await expect(page.locator("#shoot-date")).toHaveValue("2026-11-20");
    });

    test(`row 8 · add poses: ${how} with no edits returns to the plan, unchanged`, async ({ page }) => {
      await addPhotos(page, 2);
      if (how === "back button") await page.getByLabel("Back to shoot plan").click();
      else await page.goBack();
      await expect(page).toHaveURL(url(PLAN()));
      await expect(posesMeta(page)).toHaveText("8 poses");
    });
  }

  test("row 9 · back after an edit asks first; keep editing stays, discard leaves", async ({ page }) => {
    await newShootWithPhotos(page, 2, "confirm test");
    await page.locator("#pose-name").fill("edited");
    await page.getByLabel("Back to new shoot").click();
    const sheet = page.getByRole("alertdialog", { name: "discard these poses?" });
    await expect(sheet).toBeVisible();

    await sheet.getByRole("button", { name: "keep editing" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(url(routes.pose("new")));
    await expect(page.locator("#pose-name")).toHaveValue("edited");

    await page.getByLabel("Back to new shoot").click();
    await page.getByRole("button", { name: "discard" }).click();
    await expect(page).toHaveURL(url("/new"));
    await expect(page.locator("#shoot-name")).toHaveValue("confirm test");
    // The discarded poses are gone: picking again starts fresh.
    await pickFiles(page, () => page.getByRole("button", { name: "next · pick photos" }).click(), photoFiles(1));
    await expect(counter(page)).toHaveText("photo 1 of 1");
    await expect(page.locator("#pose-name")).toHaveValue("");
  });

  test("row 9 · add poses: discarding returns to the plan with nothing added", async ({ page }) => {
    await addPhotos(page, 2);
    await page.getByRole("button", { name: "More time" }).click();
    await page.getByLabel("Back to shoot plan").click();
    await page.getByRole("button", { name: "discard" }).click();
    await expect(page).toHaveURL(url(PLAN()));
    await expect(posesMeta(page)).toHaveText("8 poses");
  });

  test("row 10 · camera → pick 1 replaces only the image; row 11 · cancel changes nothing", async ({ page }) => {
    await addPhotos(page, 3);
    await page.getByLabel("Next photo").click();
    await page.locator("#pose-name").fill("second");
    await page.locator("#pose-who").fill("Maya");
    await page.locator("#pose-notes").fill("low angle");
    await page.getByRole("button", { name: "More time" }).click();
    const before = await polaroid(page);

    await cancelPicker(page, () => page.getByLabel("Change photo").click());
    expect(await polaroid(page)).toBe(before);

    await pickFiles(page, () => page.getByLabel("Change photo").click(), photoFiles(1, 9));
    await expect.poll(() => polaroid(page)).not.toBe(before);
    await expect(page).toHaveURL(url(routes.pose(SHOOT)));
    await expect(counter(page)).toHaveText("photo 2 of 3");
    await expect(page.locator("#pose-name")).toHaveValue("second");
    await expect(page.locator("#pose-who")).toHaveValue("Maya");
    await expect(page.locator("#pose-notes")).toHaveValue("low angle");
    await expect(page.getByText(/^4$/)).toBeVisible(); // 3 min default + 1
  });

  test("row 12 · save (new shoot) opens the new plan; back goes to My shoots; no duplicates", async ({ page }) => {
    await open(page, "/");
    const before = await shootCount(page);
    await newShootWithPhotos(page, 2, "beach day");
    await page.getByRole("button", { name: "save 2 poses" }).click();
    await expect(page).toHaveURL(/\/shoot\?id=(?!new)[a-z0-9-]+$/);
    await expect(page.getByRole("heading", { name: "beach day" })).toBeVisible();
    await expect(posesMeta(page)).toHaveText("2 poses");

    await page.goBack();
    await expect(page).toHaveURL(url("/"));
    expect(await shootCount(page)).toBe(before + 1);
    await expect(page.getByRole("link", { name: /beach day/ })).toHaveCount(1);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/shoot\/pose/);
  });

  test("row 12 · save (add poses) returns to that plan; back goes to My shoots; no duplicates", async ({ page }) => {
    await open(page, "/");
    await page.getByRole("link", { name: /golden hour picnic/ }).click();
    await expect(page).toHaveURL(url(PLAN()));
    await pickFiles(page, () => page.getByRole("button", { name: "add poses" }).click(), photoFiles(2));
    await page.getByRole("button", { name: "save 2 poses" }).click();
    await expect(page).toHaveURL(url(PLAN()));
    await expect(posesMeta(page)).toHaveText("10 poses");
    await page.goBack();
    await expect(page).toHaveURL(url("/"));
    await page.goForward();
    await expect(page).toHaveURL(url(PLAN()));
    await expect(posesMeta(page)).toHaveText("10 poses");
  });
});

test.describe("Pose details · from a pose card", () => {
  test("row 13 · opens on the tapped pose within all of the shoot's poses", async ({ page }) => {
    await openPoseCard(page, 3);
    await expect(counter(page)).toHaveText("photo 3 of 8");
    await expect(page.locator("#pose-name")).toHaveValue("jumping together, arms up");
  });

  for (const how of ["back button", "browser back"] as const) {
    test(`row 14 · ${how} returns to the plan with edits kept`, async ({ page }) => {
      await openPoseCard(page, 2);
      await page.locator("#pose-name").fill("renamed pose");
      if (how === "back button") await page.getByLabel("Back to shoot plan").click();
      else await page.goBack();
      await expect(page).toHaveURL(url(PLAN()));
      await expect(page.locator("[role=button][aria-label='Pose 2: renamed pose']")).toBeVisible();
      await expect(posesMeta(page)).toHaveText("8 poses");
    });
  }

  test("row 15 · save returns to the plan; browser back then goes to My shoots", async ({ page }) => {
    await open(page, "/");
    await page.getByRole("link", { name: /golden hour picnic/ }).click();
    await page.locator("[role=button][aria-label^='Pose 1:']").click();
    await page.locator("#pose-who").fill("Zoe");
    await page.getByRole("button", { name: "save 8 poses" }).click();
    await expect(page).toHaveURL(url(PLAN()));
    await expect(posesMeta(page)).toHaveText("8 poses");
    await page.goBack();
    await expect(page).toHaveURL(url("/"));
  });
});

test.describe("Shoot plan and Export", () => {
  test("row 16 · back returns to My shoots, and history isn't padded", async ({ page }) => {
    await open(page, "/");
    await page.getByRole("link", { name: /golden hour picnic/ }).click();
    await page.getByLabel("Back to my shoots").click();
    await expect(page).toHaveURL(url("/"));
    await page.goForward();
    await expect(page).toHaveURL(url(PLAN()));
  });

  test("row 17 + 18 · save opens Export; back returns to the plan, then My shoots", async ({ page }) => {
    await open(page, "/");
    await page.getByRole("link", { name: /golden hour picnic/ }).click();
    await page.getByRole("link", { name: "save", exact: true }).click();
    await expect(page).toHaveURL(url(routes.export(SHOOT)));
    await page.getByLabel("Back to plan").click();
    await expect(page).toHaveURL(url(PLAN()));
    await page.goBack();
    await expect(page).toHaveURL(url("/"));
  });

  test("row 18 · browser back from Export returns to the plan", async ({ page }) => {
    await open(page, PLAN());
    await page.getByRole("link", { name: "save", exact: true }).click();
    await expect(page).toHaveURL(url(routes.export(SHOOT)));
    await page.goBack();
    await expect(page).toHaveURL(url(PLAN()));
  });
});

// --- pose-set stepping -----------------------------------------------------------------

test("arrows and dots step through the picked photos in the order picked", async ({ page }) => {
  await addPhotos(page, 3);
  const prev = page.getByLabel("Previous photo");
  const next = page.getByLabel("Next photo");
  await expect(counter(page)).toHaveText("photo 1 of 3");
  await expect(prev).toBeDisabled();
  const first = await polaroid(page);
  await page.locator("#pose-name").fill("one");
  await next.click();
  await expect(counter(page)).toHaveText("photo 2 of 3");
  await page.locator("#pose-who").fill("Maya");
  await next.click();
  await expect(counter(page)).toHaveText("photo 3 of 3");
  await expect(next).toBeDisabled();
  await page.getByLabel("Go to photo 1").click();
  expect(await polaroid(page)).toBe(first);
  await expect(page.locator("#pose-name")).toHaveValue("one");
  await page.getByLabel("Go to photo 2").click();
  await expect(page.locator("#pose-who")).toHaveValue("Maya");
});

test("arrows step through all of the shoot's poses in plan order from the tapped pose", async ({ page }) => {
  await openPoseCard(page, 7);
  const prev = page.getByLabel("Previous photo");
  const next = page.getByLabel("Next photo");
  await expect(counter(page)).toHaveText("photo 7 of 8");
  await next.click();
  await expect(counter(page)).toHaveText("photo 8 of 8");
  await expect(page.locator("#pose-name")).toHaveValue("walking away, holding hands");
  await expect(next).toBeDisabled();
  for (let i = 0; i < 7; i++) await prev.click();
  await expect(counter(page)).toHaveText("photo 1 of 8");
  await expect(page.locator("#pose-name")).toHaveValue("sitting on the blanket, looking away");
  await expect(prev).toBeDisabled();
});

// --- general rules ---------------------------------------------------------------------

test("an abandoned new-shoot draft never appears in My shoots", async ({ page }) => {
  await open(page, "/");
  const before = await shootCount(page);
  await newShootWithPhotos(page, 2, "abandoned");
  await page.goBack(); // new shoot
  await page.goBack(); // my shoots
  await expect(page).toHaveURL(url("/"));
  expect(await shootCount(page)).toBe(before);
  await expect(page.getByText("abandoned")).toHaveCount(0);
  await page.getByRole("button", { name: "new shoot" }).click();
  await expect(page.locator("#shoot-name")).toHaveValue("");
});

test.describe("refresh", () => {
  // Unsaved work lives in memory only ("nothing is written until save N poses"), so a reload
  // mid-draft falls back to the nearest valid screen. Saved data always survives.
  test("reloading mid-draft falls back to the nearest valid screen, without crashing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await newShootWithPhotos(page, 2, "reload test");
    await page.reload();
    await expect(page).toHaveURL(url("/new"));

    await addPhotos(page, 1);
    await page.reload();
    await expect(page).toHaveURL(url(PLAN()));
    await expect(posesMeta(page)).toHaveText("8 poses"); // nothing half-saved
    expect(errors).toEqual([]);
  });

  test("edits to a saved pose survive a reload", async ({ page }) => {
    await openPoseCard(page, 2);
    await page.locator("#pose-name").fill("renamed, then reloaded");
    await page.reload();
    await expect(page).toHaveURL(url(PLAN()));
    await expect(page.locator("[role=button][aria-label='Pose 2: renamed, then reloaded']")).toBeVisible();
  });

  const fallbacks: [string, string][] = [
    ["/shoot/pose?id=new", "/new"],
    ["/shoot?id=new", "/new"],
    ["/shoot/pose?id={SHOOT}", "/shoot?id={SHOOT}"],
    ["/shoot?id=does-not-exist", "/"],
    ["/shoot/export?id=does-not-exist", "/"],
    ["/shoot", "/"],
  ];
  for (const [fromPattern, toPattern] of fallbacks) {
    test(`missing state on ${fromPattern} falls back to the nearest valid screen`, async ({ page }) => {
      const [from, to] = [fromPattern, toPattern].map((p) => p.replaceAll("{SHOOT}", SHOOT));
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(from);
      await expect(page).toHaveURL(url(to));
      await expect(page.locator("main")).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("plan and export reload in place", async ({ page }) => {
    await open(page, routes.export(SHOOT));
    await page.reload();
    await expect(page.getByRole("heading", { name: "your shoot plan" })).toBeVisible();
    await page.getByLabel("Back to plan").click();
    await expect(page).toHaveURL(url(PLAN()));
    await page.reload();
    await expect(page.getByRole("heading", { name: "golden hour picnic" })).toBeVisible();
  });
});
