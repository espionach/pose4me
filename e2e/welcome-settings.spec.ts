import { expect, test, type Page } from "@playwright/test";
import { seed, stats } from "./fixtures";

/*
 * Welcome, Settings and the legal pages. The profile is stored on the device; each test
 * starts with an empty database.
 */

const ORIGIN = "http://localhost:3100";
const url = (path: string) => new RegExp(`^${ORIGIN}${path}$`);

/** Creates a saved profile (and no shoots) through the dev seed. */
async function withProfile(page: Page, displayName = "priya") {
  await seed(page, { profile: displayName, shoot: false });
}

const greeting = (page: Page) => page.getByText(/^hey .*!$/);
const letsGo = (page: Page) => page.getByRole("button", { name: "let's go" });
const settingsSave = (page: Page) => page.getByRole("button", { name: /^(save|saved)$/ });

test.describe("app load", () => {
  test("no profile → Welcome", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(url("/welcome"));
    await expect(page.getByRole("heading", { name: "what should we call you?" })).toBeVisible();
    await expect(page.getByText("hi there!")).toBeVisible();
    await expect(page.locator("#welcome-name")).toBeFocused();
    expect(await page.locator("#welcome-name").getAttribute("placeholder")).toBeNull();
    await expect(page.getByLabel(/^Back/)).toHaveCount(0); // Welcome has no back button
  });

  test("no profile → any app route goes to Welcome", async ({ page }) => {
    await page.goto("/shoot/any-shoot/export");
    await expect(page).toHaveURL(url("/welcome"));
  });

  test("profile exists → My shoots, Welcome skipped", async ({ page }) => {
    await withProfile(page, "Priya");
    await page.goto("/");
    await expect(page).toHaveURL(url("/"));
    await expect(greeting(page)).toHaveText("hey Priya!");
  });

  test("opening /welcome with a profile redirects to My shoots", async ({ page }) => {
    await withProfile(page);
    await page.goto("/welcome");
    await expect(page).toHaveURL(url("/"));
    await expect(page.getByRole("heading", { name: "my shoots" })).toBeVisible();
  });
});

test.describe("Welcome", () => {
  test("button is disabled until a name is entered (spaces don't count)", async ({ page }) => {
    await page.goto("/welcome");
    const disabled = page.getByRole("button", { name: "enter your name to start" });
    await expect(disabled).toBeDisabled();
    await page.locator("#welcome-name").fill("   ");
    await expect(disabled).toBeDisabled();
    await page.locator("#welcome-name").fill("m");
    await expect(letsGo(page)).toBeEnabled();
  });

  test("let's go creates the profile, trims it, keeps its case, and replaces Welcome in history", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(url("/welcome"));
    await page.locator("#welcome-name").fill("  mIxEd Case Name  ");
    await letsGo(page).click();
    await expect(page).toHaveURL(url("/"));
    await expect(greeting(page)).toHaveText("hey mIxEd Case Name!");
    expect((await stats(page)).profile).toBe(1);
    // Browser back must never return to Welcome.
    await page.goBack();
    await expect(page).not.toHaveURL(/\/welcome/);
    // And the profile survives a reload.
    await page.goto("/");
    await expect(greeting(page)).toHaveText("hey mIxEd Case Name!");
  });

  test("Enter submits when a name is entered", async ({ page }) => {
    await page.goto("/welcome");
    await page.locator("#welcome-name").press("Enter"); // empty: nothing happens
    await expect(page).toHaveURL(url("/welcome"));
    await page.locator("#welcome-name").fill("sam");
    await page.locator("#welcome-name").press("Enter");
    await expect(page).toHaveURL(url("/"));
    await expect(greeting(page)).toHaveText("hey sam!");
  });

  test("names are capped at 40 characters", async ({ page }) => {
    await page.goto("/welcome");
    await page.locator("#welcome-name").fill("x".repeat(60));
    await expect(page.locator("#welcome-name")).toHaveValue("x".repeat(40));
  });
});

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => withProfile(page, "priya"));

  test("gear opens Settings; back and browser back return to My shoots", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(url("/settings"));
    await expect(page.getByRole("heading", { name: "settings" })).toBeVisible();
    await page.getByLabel("Back to my shoots").click();
    await expect(page).toHaveURL(url("/"));
    await page.goForward(); // in-app back popped history, just like the browser's back
    await expect(page).toHaveURL(url("/settings"));
    await page.goBack();
    await expect(page).toHaveURL(url("/"));
  });

  test("display name: save states, saved label, hint and greeting", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Settings" }).click();
    const input = page.locator("#display-name");
    await expect(input).toHaveValue("priya");
    await expect(settingsSave(page)).toBeDisabled(); // unchanged
    await input.fill("   ");
    await expect(settingsSave(page)).toBeDisabled(); // empty after trim
    await input.fill(" priya ");
    await expect(settingsSave(page)).toBeDisabled(); // same as saved after trim
    await input.fill("Priya I.");
    await expect(settingsSave(page)).toBeEnabled();
    await expect(settingsSave(page)).toHaveText("save");
    await settingsSave(page).click();
    await expect(settingsSave(page)).toHaveText("saved");
    await expect(settingsSave(page)).toBeDisabled();
    await expect(page.getByText('shown on your home screen as "hey Priya I.!"')).toBeVisible();
    await input.fill("Priya I");
    await expect(settingsSave(page)).toHaveText("save");
    await input.fill("Priya I.");
    await page.getByLabel("Back to my shoots").click();
    await expect(greeting(page)).toHaveText("hey Priya I.!");
    await page.reload();
    await expect(greeting(page)).toHaveText("hey Priya I.!");
  });

  for (const [row, path, title, placeholder] of [
    ["privacy policy", "/privacy", "privacy policy", "[PRIVACY POLICY TEXT GOES HERE]"],
    ["terms & conditions", "/terms", "terms & conditions", "[TERMS & CONDITIONS TEXT GOES HERE]"],
  ] as const) {
    test(`${row} opens its page; back and browser back return to Settings`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: row }).click();
      await expect(page).toHaveURL(url(path));
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
      await expect(page.getByText("last updated [DATE]")).toBeVisible();
      await expect(page.getByText(placeholder, { exact: true })).toBeVisible();
      await page.getByLabel("Back to settings").click();
      await expect(page).toHaveURL(url("/settings"));
      await page.getByRole("link", { name: row }).click();
      await page.goBack();
      await expect(page).toHaveURL(url("/settings"));
      await page.goBack();
      await expect(page).toHaveURL(url("/"));
    });
  }
});

test.describe("legal pages", () => {
  test("have their own routes and open without a profile", async ({ page }) => {
    for (const [path, title] of [
      ["/privacy", "privacy policy"],
      ["/terms", "terms & conditions"],
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(url(path));
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
  });

  test("back from a directly opened legal page goes to Settings", async ({ page }) => {
    await withProfile(page);
    await page.goto("/privacy");
    await page.getByLabel("Back to settings").click();
    await expect(page).toHaveURL(url("/settings"));
  });
});
