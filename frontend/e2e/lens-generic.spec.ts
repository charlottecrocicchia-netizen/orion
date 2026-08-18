import { expect, test } from "@playwright/test";

/** M1.1 — le socle générique. La graine publie DEUX lentilles : la
 *  spatiale (curée, avec ses mots) et une lentille SYNTHÉTIQUE de
 *  recette (`test-lens`, graine seulement — jamais dans `curation/`,
 *  jamais en production : un test backend garde cette barrière). Ces
 *  tests prouvent qu'aucune surface ne traite « space » à part :
 *  le chip suit le registre, la recherche cadre sur n'importe quelle
 *  lentille publiée, et un projet des deux mondes compte plein dans
 *  chacune (D3 — jamais additionné). */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("le chip suit le registre : deux lentilles publiées, aucun cas particulier", async ({
  page,
}) => {
  await page.goto("/explore?sector=space&by=country&split=0");
  const chip = page.getByRole("button", { name: /Périmètre spatial de cette vue/ });
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await chip.click();

  // La lentille curée porte ses mots recettés…
  await expect(page.getByRole("menuitemradio", { name: /Spatial direct/ })).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: /Spatial \+ habilitant/ })).toBeVisible();
  // …et celle qui n'a pas encore ses mots reste lisible par les motifs
  // génériques : jamais une clé nue à l'écran.
  await expect(page.getByRole("menuitemradio", { name: "test-lens direct" })).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: /test-lens \+ habilitant/ })).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: /Toute la R&D/ })).toBeVisible();

  // Changer de lentille est le même geste, et l'URL reste la vérité.
  await page.getByRole("menuitemradio", { name: /test-lens \+ habilitant/ }).click();
  await expect(page).toHaveURL(/sector=test-lens/);
  await expect(page.getByRole("button", { name: /Périmètre de cette vue/ })).toContainText(
    "test-lens + habilitant",
  );
});

test("la recherche cadre sur toute lentille publiée, et le chevauchement compte plein", async ({
  page,
}) => {
  // Le cœur seul de la lentille synthétique.
  await page.goto("/projects?sector=test-lens-direct");
  await expect(page.getByText("1 résultat", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("AEROSERV")).toBeVisible();

  // Cœur + habilitant : le projet spatial y entre AUSSI — il porte les
  // deux lentilles, et compte plein dans chacune (jamais une fraction).
  await page.goto("/projects?sector=test-lens");
  await expect(page.getByText("2 résultats", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("ORBITGUARD")).toBeVisible();

  await page.goto("/projects?sector=space");
  await expect(page.getByText("2 résultats", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("ORBITGUARD")).toBeVisible();
});

test("la bibliothèque ne fabrique aucune section vide", async ({ page }) => {
  // Une lentille publiée SANS deck ne crée pas de rayon — la section
  // naît des analyses écrites, jamais du registre seul.
  await page.goto("/analyses");
  await expect(page.getByRole("region", { name: "Espace" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("region", { name: "test-lens" })).toHaveCount(0);
});
