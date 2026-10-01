import { expect, test, type Page } from "@playwright/test";
import { fillRoll, seed } from "./fixtures";

/*
 * Walks the navigation map (row numbers in test names). Every test starts with an empty
 * database, then seeds a profile and "golden hour picnic" (8 poses). Camera-roll photos are
 * added through the "from device" input (fillRoll), 12 of them.
 */

/** The seeded shoot's plan URL (set before each test). */
let PLAN = "";
const ORIGIN = "http://localhost:3100";
const url = (path: string) => new RegExp(`^${ORIGIN}${path.replace(/[?]/g, "\\?")}$`);

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("main")).toBeVisible();
}

// These tests start past onboarding (Welcome is covered in welcome-settings.spec.ts).
test.beforeEach(async ({ page }) => {
  PLAN = `/shoot/${await seed(page)}`;
});

// --- helpers --------------------------------------------------------------------------

const tile = (page: Page, n: number) => page.getByRole("button", { name: new RegExp(`^Photo ${n}(,|$)`) });

/** Camera-roll photos currently selected, as tile numbers in selection order. */
async function selection(page: Page) {
  const labels = await page.locator("button[aria-pressed=true][aria-label^='Photo ']").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!));
  return labels
    .map((l) => l.match(/^Photo (\d+), selected (\d+)$/)!)
    .sort((a, b) => Number(a[2]) - Number(b[2]))
    .map((m) => Number(m[1]));
}

async function pick(page: Page, ...tiles: number[]) {
  await fillRoll(page);
  for (const n of tiles) await tile(page, n).click();
}

// Which photo is shown: a saved image id, or the camera-roll pick it came from.
const tileUri = (page: Page, n: number) => tile(page, n).locator("[data-photo]").getAttribute("data-photo");
const polaroidUri = (page: Page) => page.locator("main [data-photo]").first().getAttribute("data-photo");
const counter = (page: Page) => page.getByText(/^photo \d+ of \d+$/);
const posesMeta = (page: Page) => page.locator("main").getByText(/^\d+ poses?$/);

async function startNewShoot(page: Page, name = "beach day") {
  await open(page, "/");
  await page.getByRole("button", { name: "new shoot" }).click();
  await expect(page).toHaveURL(url("/new"));
  await page.locator("#shoot-name").fill(name);
  await page.locator("#shoot-date").fill("2026-11-20");
  await page.locator("#shoot-time").fill("09:30");
  await page.getByRole("button", { name: "next · pick photos" }).click();
  await expect(page).toHaveURL(url("/shoot/new/import"));
}

async function toPoseDetails(page: Page, ...tiles: number[]) {
  await pick(page, ...tiles);
  await page.getByRole("button", { name: /^next · \d+ selected$/ }).click();
  await expect(page).toHaveURL(/\/pose$/);
}

async function openPoseCard(page: Page, n: number) {
  await open(page, PLAN);
  await expect(page.locator(`[role=button][aria-label^='Pose ${n}:']`)).toBeVisible();
  await page.locator(`[role=button][aria-label^='Pose ${n}:']`).click();
  await expect(page).toHaveURL(url(`${PLAN}/pose`));
}

async function shootCount(page: Page) {
  return page.locator("main a[href^='/shoot/']").count();
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
    await expect(page).toHaveURL(url(PLAN));
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
    // No leftover history entry: back must not reopen New shoot.
    await page.goBack();
    await expect(page).not.toHaveURL(url("/new"));
    // And a fresh New shoot starts empty.
    await open(page, "/");
    await page.getByRole("button", { name: "new shoot" }).click();
    await expect(page.locator("#shoot-name")).toHaveValue("");
  });

  test("row 4 · next opens the camera roll in new-shoot mode", async ({ page }) => {
    await startNewShoot(page, "beach day");
    await expect(page.getByText("pick poses for beach day")).toBeVisible();
  });
});

test.describe("Camera roll · new-shoot mode", () => {
  for (const how of ["X", "browser back"] as const) {
    test(`row 5 · ${how} returns to New shoot with name, date and time kept`, async ({ page }) => {
      await startNewShoot(page, "beach day");
      if (how === "X") await page.getByLabel("Close").click();
      else await page.goBack();
      await expect(page).toHaveURL(url("/new"));
      await expect(page.locator("#shoot-name")).toHaveValue("beach day");
      await expect(page.locator("#shoot-date")).toHaveValue("2026-11-20");
      await expect(page.locator("#shoot-time")).toHaveValue("09:30");
    });
  }

  test("row 6 · next opens Pose details with the selected photos", async ({ page }) => {
    await startNewShoot(page);
    await toPoseDetails(page, 2, 5);
    await expect(counter(page)).toHaveText("photo 1 of 2");
  });
});

test.describe("Camera roll · add-poses mode", () => {
  for (const how of ["X", "browser back"] as const) {
    test(`row 7 · ${how} returns to the plan unchanged`, async ({ page }) => {
      await open(page, PLAN);
      await page.getByRole("link", { name: "add poses" }).click();
      await expect(page).toHaveURL(url(`${PLAN}/import`));
      await pick(page, 2);
      if (how === "X") await page.getByLabel("Close").click();
      else await page.goBack();
      await expect(page).toHaveURL(url(PLAN));
      await expect(posesMeta(page)).toHaveText("8 poses");
    });
  }

  test("row 8 · next opens Pose details with the selected photos", async ({ page }) => {
    await open(page, PLAN);
    await page.getByRole("link", { name: "add poses" }).click();
    await toPoseDetails(page, 3, 4, 7);
    await expect(counter(page)).toHaveText("photo 1 of 3");
  });

  test("row 17 · + add poses always starts with an empty selection", async ({ page }) => {
    await open(page, PLAN);
    await page.getByRole("link", { name: "add poses" }).click();
    await toPoseDetails(page, 3, 4);
    await page.getByLabel("Back to camera roll").click();
    await page.getByLabel("Close").click();
    await expect(page).toHaveURL(url(PLAN));
    await page.getByRole("link", { name: "add poses" }).click();
    await expect.poll(() => selection(page)).toEqual([]);
  });
});

test.describe("Camera roll · replace-photo mode", () => {
  async function toReplace(page: Page) {
    await open(page, PLAN);
    await page.getByRole("link", { name: "add poses" }).click();
    await toPoseDetails(page, 2, 4, 7);
    await page.getByLabel("Next photo").click();
    await page.locator("#pose-name").fill("second");
    await page.locator("#pose-who").fill("Maya");
    await page.locator("#pose-notes").fill("low angle");
    await page.getByRole("button", { name: "More time" }).click();
    const before = await polaroidUri(page);
    await page.getByLabel("Change photo").click();
    await expect(page).toHaveURL(url(`${PLAN}/import?replace=1`));
    return before;
  }

  for (const how of ["X", "browser back"] as const) {
    test(`row 9 · ${how} returns to the same photo, unchanged`, async ({ page }) => {
      const before = await toReplace(page);
      await pick(page, 10);
      if (how === "X") await page.getByLabel("Close").click();
      else await page.goBack();
      await expect(page).toHaveURL(url(`${PLAN}/pose`));
      await expect(counter(page)).toHaveText("photo 2 of 3");
      expect(await polaroidUri(page)).toBe(before);
      await expect(page.locator("#pose-name")).toHaveValue("second");
    });
  }

  test("row 10 · use photo replaces only the image and keeps the other fields", async ({ page }) => {
    await toReplace(page);
    await pick(page, 10, 11); // single-select: 11 replaces 10
    await expect.poll(() => selection(page)).toEqual([11]);
    const chosen = await tileUri(page, 11);
    await page.getByRole("button", { name: "use photo" }).click();
    await expect(page).toHaveURL(url(`${PLAN}/pose`));
    await expect(counter(page)).toHaveText("photo 2 of 3");
    expect(await polaroidUri(page)).toBe(chosen);
    await expect(page.locator("#pose-name")).toHaveValue("second");
    await expect(page.locator("#pose-who")).toHaveValue("Maya");
    await expect(page.locator("#pose-notes")).toHaveValue("low angle");
    await expect(page.getByText(/^4$/)).toBeVisible(); // 3 min default + 1
    // Browser back from Pose details now goes to the camera roll, not the replace picker.
    await page.goBack();
    await expect(page).toHaveURL(url(`${PLAN}/import`));
  });
});

test.describe("Pose details · after selecting photos", () => {
  for (const mode of ["new-shoot", "add-poses"] as const) {
    for (const how of ["back button", "browser back"] as const) {
      test(`row 11 · ${mode}: ${how} restores the exact selection and order`, async ({ page }) => {
        let importUrl = "/shoot/new/import";
        if (mode === "new-shoot") await startNewShoot(page);
        else {
          await open(page, PLAN);
          await page.getByRole("link", { name: "add poses" }).click();
          importUrl = `${PLAN}/import`;
          await expect(page).toHaveURL(url(importUrl));
        }
        await toPoseDetails(page, 7, 2, 10);
        if (how === "back button") await page.getByLabel("Back to camera roll").click();
        else await page.goBack();
        await expect(page).toHaveURL(url(importUrl));
        await expect.poll(() => selection(page)).toEqual([7, 2, 10]);
      });
    }
  }

  test("row 11 · edits are kept for still-selected photos, dropped for deselected, empty for new", async ({ page }) => {
    await startNewShoot(page);
    await toPoseDetails(page, 2, 4, 7);
    await page.locator("#pose-name").fill("first");
    await page.getByLabel("Next photo").click();
    await page.locator("#pose-name").fill("dropped");
    await page.getByLabel("Next photo").click();
    await page.locator("#pose-name").fill("third");
    await page.getByLabel("Back to camera roll").click();

    await pick(page, 4); // deselect the 2nd pick
    await expect.poll(() => selection(page)).toEqual([2, 7]);
    await pick(page, 9); // new pick
    await page.getByRole("button", { name: /^next · 3 selected$/ }).click();

    await expect(counter(page)).toHaveText("photo 1 of 3");
    await expect(page.locator("#pose-name")).toHaveValue("first");
    await page.getByLabel("Next photo").click();
    await expect(page.locator("#pose-name")).toHaveValue("third");
    await page.getByLabel("Next photo").click();
    await expect(page.locator("#pose-name")).toHaveValue("");
    await page.getByLabel("Go to photo 1").click();
    await page.getByLabel("Back to camera roll").click();
    await pick(page, 4); // reselecting a dropped photo starts empty too
    await page.getByRole("button", { name: /^next · 4 selected$/ }).click();
    await page.getByLabel("Go to photo 4").click();
    await expect(page.locator("#pose-name")).toHaveValue("");
  });

  test("row 12 · save (new shoot) opens the new plan; back goes to My shoots; no duplicates", async ({ page }) => {
    await open(page, "/");
    const before = await shootCount(page);
    await startNewShoot(page, "beach day");
    await toPoseDetails(page, 2, 4);
    await page.getByRole("button", { name: "save 2 poses" }).click();
    await expect(page).toHaveURL(/\/shoot\/(?!new)[a-z0-9-]+$/);
    await expect(page.getByRole("heading", { name: "beach day" })).toBeVisible();
    await expect(posesMeta(page)).toHaveText("2 poses");

    await page.goBack();
    await expect(page).toHaveURL(url("/"));
    expect(await shootCount(page)).toBe(before + 1);
    await expect(page.getByRole("link", { name: /beach day/ })).toHaveCount(1);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/shoot\/new/);
  });

  test("row 12 · save (add poses) returns to that plan; back goes to My shoots; no duplicates", async ({ page }) => {
    await open(page, "/");
    await page.getByRole("link", { name: /golden hour picnic/ }).click();
    await expect(page).toHaveURL(url(PLAN));
    await page.getByRole("link", { name: "add poses" }).click();
    await toPoseDetails(page, 2, 4);
    await page.getByRole("button", { name: "save 2 poses" }).click();
    await expect(page).toHaveURL(url(PLAN));
    await expect(posesMeta(page)).toHaveText("10 poses");
    await page.goBack();
    await expect(page).toHaveURL(url("/"));
    await page.goForward();
    await expect(page).toHaveURL(url(PLAN));
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
      await expect(page).toHaveURL(url(PLAN));
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
    await expect(page).toHaveURL(url(PLAN));
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
    await page.goForward(); // the plan is still "forward", as after a browser back
    await expect(page).toHaveURL(url(PLAN));
  });

  test("row 18 + 19 · export opens Export; back returns to the plan, then My shoots", async ({ page }) => {
    await open(page, "/");
    await page.getByRole("link", { name: /golden hour picnic/ }).click();
    await page.getByRole("link", { name: "save", exact: true }).click();
    await expect(page).toHaveURL(url(`${PLAN}/export`));
    await page.getByLabel("Back to plan").click();
    await expect(page).toHaveURL(url(PLAN));
    await page.goBack();
    await expect(page).toHaveURL(url("/"));
  });

  test("row 19 · browser back from Export returns to the plan", async ({ page }) => {
    await open(page, PLAN);
    await page.getByRole("link", { name: "save", exact: true }).click();
    await expect(page).toHaveURL(url(`${PLAN}/export`));
    await page.goBack();
    await expect(page).toHaveURL(url(PLAN));
  });
});

// --- pose-set stepping -----------------------------------------------------------------

test("arrows and dots step through the selected photos in selection order", async ({ page }) => {
  await open(page, `${PLAN}/import`);
  await fillRoll(page);
  const order = [7, 2, 10];
  const uris = [];
  for (const n of order) uris.push(await tileUri(page, n));
  await toPoseDetails(page, ...order);

  const prev = page.getByLabel("Previous photo");
  const next = page.getByLabel("Next photo");
  await expect(counter(page)).toHaveText("photo 1 of 3");
  await expect(prev).toBeDisabled();
  expect(await polaroidUri(page)).toBe(uris[0]);
  await page.locator("#pose-name").fill("one");
  await next.click();
  await expect(counter(page)).toHaveText("photo 2 of 3");
  expect(await polaroidUri(page)).toBe(uris[1]);
  await page.locator("#pose-who").fill("Maya");
  await next.click();
  await expect(counter(page)).toHaveText("photo 3 of 3");
  expect(await polaroidUri(page)).toBe(uris[2]);
  await expect(next).toBeDisabled();
  await page.getByLabel("Go to photo 1").click();
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
  await startNewShoot(page, "abandoned");
  await toPoseDetails(page, 2);
  await page.goBack(); // camera roll
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
    await startNewShoot(page, "reload test");
    await page.reload();
    await expect(page).toHaveURL(url("/new"));
    await expect(page.locator("#shoot-name")).toHaveValue("");

    await startNewShoot(page, "reload test");
    await toPoseDetails(page, 2, 4);
    await page.reload();
    await expect(page).toHaveURL(url("/new"));

    await open(page, PLAN);
    await page.getByRole("link", { name: "add poses" }).click();
    await toPoseDetails(page, 1);
    await page.getByLabel("Change photo").click();
    await page.reload();
    await expect(page).toHaveURL(url(PLAN));
    await expect(posesMeta(page)).toHaveText("8 poses"); // nothing half-saved
    expect(errors).toEqual([]);
  });

  test("edits to a saved pose survive a reload", async ({ page }) => {
    await openPoseCard(page, 2);
    await page.locator("#pose-name").fill("renamed, then reloaded");
    await page.reload();
    await expect(page).toHaveURL(url(PLAN));
    await expect(page.locator("[role=button][aria-label='Pose 2: renamed, then reloaded']")).toBeVisible();
  });

  const fallbacks: [string, string][] = [
    ["/shoot/new/import", "/new"],
    ["/shoot/new/pose", "/new"],
    ["/shoot/new", "/new"],
    ["{PLAN}/pose", "{PLAN}"],
    ["{PLAN}/import?replace=1", "{PLAN}"],
    ["/shoot/does-not-exist", "/"],
    ["/shoot/does-not-exist/export", "/"],
  ];
  for (const [fromPattern, toPattern] of fallbacks) {
    test(`missing state on ${fromPattern} falls back to the nearest valid screen`, async ({ page }) => {
      const [from, to] = [fromPattern, toPattern].map((p) => p.replace("{PLAN}", PLAN));
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(from);
      await expect(page).toHaveURL(url(to));
      await expect(page.locator("main")).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("plan and export reload in place", async ({ page }) => {
    await open(page, `${PLAN}/export`);
    await page.reload();
    await expect(page.getByRole("heading", { name: "your shoot plan" })).toBeVisible();
    await page.getByLabel("Back to plan").click();
    await expect(page).toHaveURL(url(PLAN));
    await page.reload();
    await expect(page.getByRole("heading", { name: "golden hour picnic" })).toBeVisible();
  });
});
