import { defineConfig, devices } from "@playwright/test";

// The demo journey runs against a full stack (Caddy + API + Postgres with
// data). Locally: `make up` then `pnpm e2e`. CI overrides E2E_BASE_URL.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  // One worker on purpose: the journeys share one single-process stack whose
  // aggregate caches warm on first hit — parallel browsers just contend.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    viewport: { width: 1440, height: 900 },
    locale: "en-GB",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // The founder browses in Firefox and its scroll-time pointer events
    // froze the news carousel while every Chromium run stayed green
    // (recette 2026-08-03) — the ticker suite runs on BOTH engines.
    {
      name: "firefox-ticker",
      use: { ...devices["Desktop Firefox"] },
      testMatch: /ticker\.spec\.ts/,
    },
  ],
});
