import { defineConfig, devices } from "@playwright/test";

// La suite tourne contre la base SEMÉE (seed_e2e) — jamais le corpus
// complet : test-lens et les comptes exacts n'existent que dans la
// graine. En local : `./scripts/e2e-local.sh` (la recette CI, à
// l'identique). CI fournit E2E_BASE_URL.
export default defineConfig({
  testDir: "./e2e",
  // Pivot 2026-08-22 : Orion est privé — la suite entière navigue
  // CONNECTÉE via la session fabriquée par auth.setup ; les specs qui
  // testent la frontière elle-même repartent anonymes (test.use).
  globalSetup: "./e2e/auth.setup.ts",
  timeout: 30_000,
  // One worker on purpose: the journeys share one single-process stack whose
  // aggregate caches warm on first hit — parallel browsers just contend.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  use: {
    storageState: "e2e/.auth/session.json",
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
