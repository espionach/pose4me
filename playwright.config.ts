import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    ...devices["iPhone 13"],
    // Uses the locally installed Google Chrome, so no browser download is needed.
    browserName: "chromium",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  // The real static export (what ships in the iOS app), served on its own port so it
  // doesn't disturb `npm run dev` on 3000.
  webServer: {
    command: "npm run build && npx serve out -l 3100 --no-request-logging",
    // Exposes window.shootPlanner.seed()/stats() so tests can create data and count rows.
    env: { NEXT_PUBLIC_DEV_SEED: "1" },
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
