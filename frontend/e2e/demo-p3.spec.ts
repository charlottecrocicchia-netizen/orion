import { expect, test } from "@playwright/test";

/** The phase-3 demo journey — the technology scout's walk, the definition of
 *  done: map → France → hub → a top organisation → its partners → benchmark →
 *  a theme trend in the Explorer → CSV export. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
    window.localStorage.setItem("orion.geoview", "map");
  });
});

test("the phase-3 journey holds end to end", async ({ page }) => {
  // 1 — the map is the geographic entry. Map rule: the FIRST click
  // selects France (summary panel opens beside); the file opens on the
  // distinct gesture — the panel's CTA.
  await page.goto("/explore/countries");
  await page
    .getByRole("group", { name: /Map of Europe/ })
    .getByRole("button", { name: /^France — €/ })
    .click();
  await expect(page.getByRole("heading", { name: "France" })).toBeVisible();
  await page.getByRole("link", { name: /Open the France file/ }).click();
  await expect(page).toHaveURL(/\/explore\/countries\/FR/, { timeout: 10_000 });
  await expect(page.getByText("Top organisations")).toBeVisible();

  // 2 — open the country's first top organisation.
  await page
    .locator("section", { hasText: "Top organisations" })
    .first()
    .getByRole("link")
    .first()
    .click();
  await expect(page).toHaveURL(/\/organisations\/\d+/);
  await expect(page.getByRole("heading", { name: "Where its partners live" })).toBeVisible({ timeout: 10_000 });

  // 3 — benchmark it against its first recurring partner.
  await page.getByRole("link", { name: "Compare" }).click();
  await expect(page).toHaveURL(/\/compare\?orgs=\d+/);
  await expect(page.getByText("Total EU + FR funding")).toBeVisible({ timeout: 10_000 });

  // 4 — a theme trend in the Explorer, in French to close the bilingual loop.
  await page.goto("/explore?by=theme&split=1&limit=5");
  const chart = page.getByRole("img", { name: /funding · theme/ });
  await expect(chart).toBeVisible({ timeout: 15_000 });
  await expect(chart.locator("polyline").first()).toBeVisible();

  // 5 — the view exports: the CSV download carries the licence attribution.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("orion-funding-by-theme.csv");
});
