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
  // A production build on its own port: fast, and doesn't disturb `npm run dev` on 3000.
  webServer: {
    command: "npm run build && npx next start -p 3100",
    // Exposes window.shootPlanner.seed()/stats() so tests can create data and count rows.
    env: { NEXT_PUBLIC_DEV_SEED: "1" },
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
