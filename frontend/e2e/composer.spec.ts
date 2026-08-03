import { expect, test } from "@playwright/test";

/** The composable bar's Enter contract (recette 2026-08-02): a typed
 *  ENTITY poses its tag — "Allemagne" means the country, never a text
 *  search that happens to contain the word. Tested in FRENCH, the exact
 *  path of the founder's bug report. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("« Allemagne » + Entrée pose le tag pays, pas une recherche texte", async ({ page }) => {
  await page.goto("/projects");
  const input = page.getByRole("combobox", { name: /Composez/ });
  await input.fill("Allemagne");
  await expect(page.getByRole("listbox")).toBeVisible();
  await input.press("Enter");
  await expect(page).toHaveURL(/country=DE/);
  expect(page.url()).not.toContain("q=Allemagne");
  // The tag lives in the bar, typed as a country.
  await expect(page.getByText("pays", { exact: true })).toBeVisible();
});

test("interface ANGLAISE + « Allemagne » pose aussi le tag pays (le geste réel)", async ({ page }) => {
  // The founder's exact gesture: English interface, country typed in
  // French — multi-locale matching must still pose the tag.
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
  });
  await page.goto("/projects");
  const input = page.getByRole("combobox", { name: /Compose/ });
  await input.fill("Allemagne");
  await expect(page.getByRole("option", { name: /Germany/ })).toBeVisible();
  await input.press("Enter");
  await expect(page).toHaveURL(/country=DE/);
  expect(page.url()).not.toContain("q=Allemagne");
});

test("un mot qui n'est pas une entité reste du texte libre", async ({ page }) => {
  await page.goto("/projects");
  const input = page.getByRole("combobox", { name: /Composez/ });
  await input.fill("hydrogen storage");
  await input.press("Enter");
  await expect(page).toHaveURL(/q=hydrogen(\+|%20)storage/);
});

test("les puces d'affinage posent des tags et les actives disparaissent", async ({ page }) => {
  await page.goto("/projects?country=DE&q=hydrogen");
  await expect(page.getByText("Affiner")).toBeVisible({ timeout: 15_000 });
  // The active DE facet is gone from the chips — it lives as a tag.
  const refineRow = page.locator("main");
  await expect(refineRow.getByRole("button", { name: /Allemagne · / })).toHaveCount(0);
});
