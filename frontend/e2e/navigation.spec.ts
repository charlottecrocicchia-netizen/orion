import { expect, test } from "@playwright/test";

/** The intent navigation (site architecture, lot A) and the dated
 *  placeholder pages: four verbs, described entries, honest doors. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("the four intents open, describe their pages, and navigate", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("banner");

  // Discover: the entries carry their one-line descriptions.
  await banner.getByRole("button", { name: "Discover" }).click();
  await expect(page.getByText("consolidated files, watch-post included")).toBeVisible();
  // The dated P5 door is inside, badge visible (the footer sitemap
  // repeats the date — scope to the banner).
  await expect(banner.getByText("P5 · autumn 2026")).toBeVisible();
  await banner.getByRole("link", { name: /Projects/ }).click();
  await expect(page).toHaveURL(/\/projects/);

  // Analyse → the library.
  await banner.getByRole("button", { name: "Analyse" }).click();
  await banner.getByRole("link", { name: /Ready-made analyses/ }).click();
  await expect(page).toHaveURL(/\/analyses/);
  await expect(
    page.getByRole("heading", { name: "The ready-made analyses" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Where does hydrogen money go/ })).toBeVisible();

  // Escape closes a panel without navigating.
  await banner.getByRole("button", { name: "Build" }).click();
  await expect(page.getByText("collect views, assemble, take away")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("collect views, assemble, take away")).toHaveCount(0);
});

test("the placeholder pages say the date and bridge to what exists", async ({ page }) => {
  await page.goto("/calls");
  await expect(page.getByRole("heading", { name: /Calls arrive in/ })).toBeVisible();
  await expect(page.getByText("never a single score: every criterion says its share")).toBeVisible();
  await expect(page.getByText("No form, no waiting list — the date is enough.")).toBeVisible();
  await page.getByRole("link", { name: /Theme trends/ }).click();
  await expect(page).toHaveURL(/\/explore\?by=theme&split=1/);

  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: /Your watch will have a home/ })).toBeVisible();
  await page.getByRole("link", { name: /The dossier assembles and travels/ }).click();
  await expect(page).toHaveURL(/\/dossier/);
});

test("programmes list the sources first; a source unfolds and filters", async ({ page }) => {
  // Dataset-agnostic: the root shows AGENCY rows (scale rule); entering
  // one unfolds its programmes with a live filter and an honest empty
  // state — no programme name assumed.
  await page.goto("/explore/programmes");
  const agencies = page.locator("main button", { hasText: /programmes ·/ });
  await expect(agencies.first()).toBeVisible({ timeout: 15_000 });
  await agencies.first().click();
  await expect(page).toHaveURL(/funder=/);
  const rows = page.locator('a[href^="/explore/programmes/"]');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const initial = await rows.count();
  await page.getByRole("searchbox").fill("zzz-aucun-programme");
  await expect(page.getByText(/No programme matches/)).toBeVisible();
  await expect(rows).toHaveCount(0);
  await page.getByRole("searchbox").fill("");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBe(initial);
  // The way back out.
  await page.getByRole("button", { name: /All sources/ }).click();
  await expect(agencies.first()).toBeVisible();
});

test("the themes index ranks the disciplines and opens the Explorer", async ({ page }) => {
  await page.goto("/explore/themes");
  await expect(page.getByRole("heading", { name: "Themes" })).toBeVisible();
  const first = page.getByRole("link", { name: /% of the corpus|€/ }).first();
  await expect(first).toBeVisible({ timeout: 15_000 });
  await first.click();
  await expect(page).toHaveURL(/\/explore\?by=theme&split=1&compare=/);
});

test("maps explore at the keyboard too: Enter selects, the panel CTA leaves", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.geoview", "map");
  });
  await page.goto("/explore/countries");
  const france = page.locator('path[data-code="FR"]');
  await expect(france).toBeVisible({ timeout: 15_000 });
  await france.focus();
  await page.keyboard.press("Enter");
  // First activation: the summary panel opens (and takes focus, as a
  // panel should) — no navigation.
  await expect(page.getByRole("heading", { name: "France" })).toBeVisible();
  expect(page.url()).not.toContain("/countries/FR");
  // The distinct gesture at the keyboard: the panel's CTA.
  await page.getByRole("link", { name: /Open the France file/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/explore\/countries\/FR/);
});

test("the scope pill stays hidden while a single zone exists", async ({ page }) => {
  // The header selector is gone (one zone says nothing); the footer's
  // honest coverage note is a different, legitimate mention.
  await page.goto("/");
  await expect(page.getByRole("banner").getByText(/Europe ·/)).toHaveCount(0);
});
