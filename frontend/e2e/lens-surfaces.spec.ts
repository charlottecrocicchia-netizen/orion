import { expect, test } from "@playwright/test";

/** M1.3 — les surfaces. La lentille active devient visible et
 *  intelligible sur le produit existant : le hero raconte la lentille
 *  vedette (lue au registre, pas écrite en dur), la fiche projet montre
 *  TOUTES ses appartenances (la surface du chevauchement), l'À-propos
 *  décrit chaque lentille en blocs génériques, et le titre du document
 *  dit le contexte. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("la fiche projet montre ses deux appartenances, et chacune ouvre sa vue", async ({ page }) => {
  await page.goto("/projects?sector=space-direct");
  // Le lien de la liste porte le TITRE ; l'acronyme est un voisin.
  await page.getByRole("link", { name: /In-orbit servicing/ }).first().click();
  await expect(page).toHaveURL(/\/projects\/\d+/);

  // Deux lentilles lisent ce projet — plein dans chacune (D1/D3).
  await expect(page.getByRole("link", { name: /Espace · cœur/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /test-lens · habilitant/ })).toBeVisible();

  // Le badge « cœur » ouvre la vue la plus serrée qui contient ce projet.
  await page.getByRole("link", { name: /Espace · cœur/ }).click();
  await expect(page).toHaveURL(/sector=space-direct/);
  await expect(page.getByRole("button", { name: /Périmètre spatial de cette vue/ })).toContainText(
    "Spatial direct",
  );
});

test("le titre du document dit la lentille, la vue, et suit la navigation", async ({ page }) => {
  await page.goto("/explore?by=country&split=0");
  await expect(page).toHaveTitle("Explorateur — Orion");

  // Cadrée : la lentille passe devant, sans rechargement.
  await page.goto("/explore?sector=space&by=country&split=0");
  await expect(page).toHaveTitle("Espace · Explorateur — Orion");

  // Navigation interne (pas de rechargement) : le titre suit.
  await page.getByRole("link", { name: /Analyses prêtes|bibliothèque/ }).first().click();
  await expect(page).toHaveTitle(/Analyses prêtes — Orion|Analyses — Orion/);
});

test("la langue du document suit la langue active", async ({ page }) => {
  await page.goto("/explore?by=country&split=0");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");

  await page.addInitScript(() => window.localStorage.setItem("orion.lang", "en"));
  await page.goto("/explore?by=country&split=0");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("Explorer — Orion");
});

test("l'À-propos décrit chaque lentille, et ne montre le recouvrement qu'à deux", async ({
  page,
}) => {
  await page.goto("/about-data");
  const spaceBlock = page.getByRole("region", { name: "Espace" });
  await expect(spaceBlock).toBeVisible({ timeout: 15_000 });
  // Les nombres viennent du chargeur, jamais d'un texte en dur.
  await expect(spaceBlock.getByText(/23 règles/)).toBeVisible();
  await expect(spaceBlock.getByText(/Spatial direct/)).toBeVisible();
  await expect(spaceBlock.getByText(/Spatial \+ habilitant/)).toBeVisible();

  // La lentille sans mots curés a quand même son bloc, par les motifs.
  await expect(page.getByRole("region", { name: "test-lens" })).toBeVisible();

  // Deux lentilles publiées en graine : le recouvrement se montre.
  await expect(page.getByRole("region", { name: "Recouvrement" })).toBeVisible();
});

test("l'À-propos ne laisse aucun texte français en mode anglais", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("orion.lang", "en"));
  await page.goto("/about-data");
  const block = page.getByRole("region", { name: "Space" });
  await expect(block).toBeVisible({ timeout: 15_000 });
  const text = (await block.innerText()).toLowerCase();
  // Les mots français de l'ancien bloc en dur : plus aucun.
  for (const french of ["règles", "lentille", "périmètres", "cœur", "dernier passage"]) {
    expect(text, `« ${french} » ne doit pas rester en mode EN`).not.toContain(french);
  }
  await expect(block.getByText(/23 rules/)).toBeVisible();
});
