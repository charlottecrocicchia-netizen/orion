import { expect, test } from "@playwright/test";

/** A2 (2026-08-19) — les decks aéronautiques : trois decks sur le
 *  modèle spatial, la section « Aéronautique » par le mécanisme
 *  existant, la porte « Analyser » qui suit la lentille active, et
 *  l'entrée unique respectée jusque dans les decks. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lens.entry", "all");
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("la bibliothèque gagne sa section Aéronautique, le deck 3 s'ouvre cadré", async ({
  page,
}) => {
  await page.goto("/analyses");
  const aviation = page.getByRole("region", { name: "Aéronautique" });
  await expect(aviation).toBeVisible({ timeout: 10_000 });
  await expect(aviation.getByText("Où va l’argent aéronautique ?")).toBeVisible();
  await expect(aviation.getByText("Qui monte en aéronautique ?")).toBeVisible();
  await expect(aviation.getByText("Clean Aviation : le pari du vol propre")).toBeVisible();
  // L'Espace reste en tête (rang 1), jamais retiré.
  await expect(page.getByRole("region", { name: "Espace" })).toBeVisible();

  // Le pari du vol propre s'ouvre : chaque angle porte son périmètre
  // dans l'adresse, et le chip dit l'ENTRÉE UNIQUE — le nom nu,
  // jamais « + habilitant » tant qu'aucun habilitant n'existe.
  await aviation.getByText("Clean Aviation : le pari du vol propre").click();
  await expect(page).toHaveURL(/angles=aviationClean/);
  const chip = page.getByRole("button", { name: /Périmètre aéronautique de cette vue/ });
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await expect(chip).toContainText("Aéronautique");
  await expect(chip).not.toContainText("habilitant");
  // Les angles sont là, en onglets.
  await expect(page.getByRole("tab", { name: /L’hydrogène en aéronautique/ })).toBeVisible();
});

test("la porte « Analyser » suit la lentille active", async ({ page }) => {
  // Home cadrée Aviation : la porte mène au deck 1 aéronautique, et sa
  // description dit CE deck — jamais un titre spatial en dur.
  await page.goto("/?sector=aviation");
  const door = page.getByRole("link", { name: /Analyser/ });
  await expect(door).toBeVisible({ timeout: 15_000 });
  await expect(door).toContainText("Où va l’argent aéronautique ?");
  await door.click();
  await expect(page).toHaveURL(/angles=aviationMoney/);

  // Home nue : la porte reste celle du rang 1 — le deck spatial.
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Analyser/ })).toContainText(
    "Où va l’argent spatial ?",
    { timeout: 15_000 },
  );
});
