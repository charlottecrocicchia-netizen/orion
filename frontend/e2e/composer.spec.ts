import { expect, test } from "@playwright/test";

/** The composable bar's Enter contract — AMENDÉ par la fondatrice le
 *  2026-08-22 (recette E3), révisant la règle du 2026-08-02 : Entrée
 *  NUE exécute la recherche TEXTE, immédiatement, par le même
 *  mécanisme que le clic. Les tags d'entité restent à un coup de
 *  flèche : ↓ + Entrée pose « Allemagne » comme pays. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("Entrée nue = recherche texte ; ↓ + Entrée = le tag pays (amendement 2026-08-22)", async ({ page }) => {
  await page.goto("/projects");
  const input = page.getByRole("combobox", { name: /Composez/ });
  await input.fill("Allemagne");
  await expect(page.getByRole("listbox")).toBeVisible();
  await input.press("Enter");
  // Entrée nue : la recherche s'exécute, l'URL porte le texte.
  await expect(page).toHaveURL(/q=Allemagne/);
  expect(page.url()).not.toContain("country=DE");

  // Le tag d'entité reste à un coup de flèche : choix EXPLICITE.
  await input.fill("Allemagne");
  await expect(page.getByRole("listbox")).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page).toHaveURL(/country=DE/);
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
  // The name "Germany" now appears twice — the country FILTER and the
  // country DESTINATION (« Aller à ») — so target the filter option.
  await expect(page.locator("#sc-c-DE")).toBeVisible();
  await input.press("ArrowDown");
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

test("clavier : saisie → Entrée → URL → résultats, sur Projects ET Organisations", async ({
  page,
}) => {
  // Le geste exact du retour de recette E3 : taper, Entrée, chercher.
  await page.goto("/projects");
  const input = page.getByRole("combobox", { name: /Composez/ });
  await input.fill("orbital");
  await input.press("Enter");
  await expect(page).toHaveURL(/q=orbital/);
  await expect(page.getByText(/résultat/).first()).toBeVisible({ timeout: 15_000 });

  // Modifier la requête puis Entrée : recalcul immédiat, même mécanisme.
  await input.fill("cryogenic");
  await input.press("Enter");
  await expect(page).toHaveURL(/q=cryogenic/);
  expect(page.url()).not.toContain("orbital");

  await page.goto("/organisations");
  const orgInput = page.getByRole("combobox", { name: /Composez/ });
  await orgInput.fill("aerostellar");
  await orgInput.press("Enter");
  await expect(page).toHaveURL(/q=aerostellar/);
  await expect(page.getByText(/AEROSTELLAR/i).first()).toBeVisible({ timeout: 15_000 });
});
