import { expect, test } from "@playwright/test";

/** M3: the Europe choropleth — the geographic entry to the tool.
 *  Map rule (fondatrice, 2026-08-02): the first activation SELECTS —
 *  highlight, pinned flows, summary panel — and the file opens only on a
 *  distinct gesture: the panel's CTA, or a second activation of the
 *  already-selected country. Mouse and keyboard share the same path. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
    window.localStorage.setItem("orion.geoview", "map");
  });
});

test("first click selects France; the second click zooms into its file", async ({ page }) => {
  await page.goto("/explore/countries");
  const map = page.getByRole("group", { name: /Map of Europe/ });
  await expect(map).toBeVisible({ timeout: 15_000 });

  const france = map.getByRole("button", { name: /^France — €/ });
  await expect(france).toBeVisible();

  await france.click();
  // Selected, not teleported: the summary panel opens beside the map.
  await expect(page.getByRole("heading", { name: "France" })).toBeVisible();
  expect(page.url()).not.toContain("/countries/FR");
  await expect(france).toHaveAttribute("aria-pressed", "true");

  // Second activation of the selected shape: the cinematic zoom, then
  // the file.
  await france.click();
  await expect(page).toHaveURL(/\/explore\/countries\/FR/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("France");
});

test("switching country moves the selection instead of navigating", async ({ page }) => {
  await page.goto("/explore/countries");
  const map = page.getByRole("group", { name: /Map of Europe/ });
  await expect(map).toBeVisible({ timeout: 15_000 });

  await map.getByRole("button", { name: /^France — €/ }).click();
  await expect(page.getByRole("heading", { name: "France" })).toBeVisible();
  await map.getByRole("button", { name: /^Germany — €/ }).click();
  // The panel follows the selection; still no navigation.
  await expect(page.getByRole("heading", { name: "Germany" })).toBeVisible();
  expect(page.url()).not.toContain("/countries/");
});
