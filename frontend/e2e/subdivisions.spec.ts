import { expect, test } from "@playwright/test";

/** La maille sous le pays (lot D, 2026-08-17) : la fiche des États-Unis
 *  ouvre sa carte d'États dans la MÊME grammaire que l'Europe par pays —
 *  premier clic sélectionne et résume, second clic ouvre la vue filtrée.
 *  La règle gravée vaut à cette échelle : toute maille du référentiel est
 *  dessinée, le gris ne dit que l'absence de donnée. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("la fiche États-Unis ouvre sa carte d'États et la règle du clic tient", async ({ page }) => {
  await page.goto("/explore/countries/US");
  const mesh = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Par État" }),
  });
  await expect(mesh).toBeVisible({ timeout: 10_000 });

  // Les 51 États + DC sont dessinés (le référentiel décide, pas le client),
  // et les cinq territoires portent leur pastille.
  await expect(mesh.locator("path[data-code^='US-']")).toHaveCount(51, { timeout: 10_000 });
  await expect(mesh.locator("[data-code='US-MA']")).toHaveCount(1);
  await expect(mesh.locator("[data-code='US-WY']")).toHaveCount(1);

  // Premier clic : sélection + ligne de résumé, JAMAIS de téléportation.
  await mesh.locator("path[data-code='US-MA']").dispatchEvent("click");
  await expect(mesh.getByText("Massachusetts")).toBeVisible();
  expect(page.url()).toContain("/explore/countries/US");

  // Second clic sur la maille sélectionnée : la vue filtrée s'ouvre.
  await mesh.locator("path[data-code='US-MA']").dispatchEvent("click");
  await expect(page).toHaveURL(/\/explore\?.*subdivision=US-MA/, { timeout: 10_000 });
});

test("un pays sans maille référencée n'affiche pas de carte d'États", async ({ page }) => {
  await page.goto("/explore/countries/FR");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("France", {
    timeout: 10_000,
  });
  await expect(page.getByRole("heading", { name: "Par État" })).toHaveCount(0);
});
