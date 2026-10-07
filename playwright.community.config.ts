import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Two at a time: with one browser per CPU the runner ran out of memory
  // halfway through the editor's tests and took the rest down with it.
  workers: Number(process.env.E2E_WORKERS ?? 2),
  reporter: [["list"]],
  use: {
    // A dev server already running elsewhere: E2E_BASE_URL=http://localhost:8080
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:4300",
    headless: true,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-android", use: { ...devices["Galaxy S9+"] } },
  ],
});
