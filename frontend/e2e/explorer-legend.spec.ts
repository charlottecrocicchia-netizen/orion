import { expect, test } from "@playwright/test";

/** Chantier légende (2026-08-22) — composer sa lecture des vues
 *  multi-séries. Le contrat : le clic LÉGENDE masque/réaffiche (jamais
 *  un clic sur la courbe) ; l'échelle se recalcule sur les séries
 *  restantes ; « Tout afficher » revient dès qu'un masquage agit ;
 *  l'URL porte les clés canoniques (`hidden=FR~DE`) et rejoue la même
 *  composition dans les deux langues ; les DONNÉES ne bougent pas — la
 *  table dit toujours tout. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("masquer depuis la légende : échelle recalculée, restauration, Tout afficher", async ({
  page,
}) => {
  await page.goto("/explore");
  const chart = page.getByRole("img", { name: /funding · country/ });
  await expect(chart).toBeVisible({ timeout: 15_000 });
  await expect(chart.locator("polyline")).toHaveCount(5);

  // La légende est LE contrôle : un item par série, activable au
  // clavier, état exposé par aria-pressed.
  const franceChip = page.getByRole("button", { name: "France", exact: true });
  await expect(franceChip).toHaveAttribute("aria-pressed", "true");

  // Point de comparaison d'échelle : la géométrie d'une AUTRE série.
  const before = await chart.locator("polyline").last().getAttribute("points");

  await franceChip.click();
  await expect(page).toHaveURL(/hidden=FR/);
  await expect(chart.locator("polyline")).toHaveCount(4);
  await expect(franceChip).toHaveAttribute("aria-pressed", "false");
  // L'échelle s'est recalculée sans la série dominante : les courbes
  // restantes ne sont plus dessinées aux mêmes coordonnées.
  const after = await chart.locator("polyline").last().getAttribute("points");
  expect(after).not.toBe(before);

  // Recliquer restaure — et l'URL redevient nue (comportement d'origine).
  await franceChip.click();
  await expect(chart.locator("polyline")).toHaveCount(5);
  expect(page.url()).not.toContain("hidden=");

  // Deux masquées → « Show all » réaffiche tout d'un geste.
  await franceChip.click();
  await page.getByRole("button", { name: "Germany", exact: true }).click();
  await expect(page).toHaveURL(/hidden=FR~DE|hidden=FR%7EDE/);
  await expect(chart.locator("polyline")).toHaveCount(3);
  await page.getByRole("button", { name: "Show all" }).click();
  await expect(chart.locator("polyline")).toHaveCount(5);
  expect(page.url()).not.toContain("hidden=");
});

test("l'URL rejoue la composition ; la langue ne touche pas aux identifiants ; la table dit tout", async ({
  page,
}) => {
  // DE est dans le top-5 de la graine (US en est 6e — sur le corpus
  // complet, c'est bien USA qui domine ; ici la graine recette la
  // mécanique, pas la géographie).
  await page.goto("/explore?hidden=DE");
  const chart = page.getByRole("img", { name: /funding · country/ });
  await expect(chart).toBeVisible({ timeout: 15_000 });
  await expect(chart.locator("polyline")).toHaveCount(4);
  const deChip = page.getByRole("button", { name: "Germany", exact: true });
  await expect(deChip).toHaveAttribute("aria-pressed", "false");

  // Rechargement : exactement la même sélection.
  await page.reload();
  await expect(chart.locator("polyline")).toHaveCount(4);

  // FR : mêmes identifiants canoniques dans l'URL, même composition.
  await page.evaluate(() => window.localStorage.setItem("orion.lang", "fr"));
  await page.reload();
  await expect(page).toHaveURL(/hidden=DE/);
  await expect(chart.locator("polyline")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Germany", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");

  // Les données ne bougent JAMAIS : la table montre toutes les séries,
  // série masquée comprise — masquer est un état de présentation.
  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByRole("table")).toContainText("Germany");
});
