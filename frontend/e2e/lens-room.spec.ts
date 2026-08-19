import { expect, test } from "@playwright/test";

/** La Lens Room (2026-08-19) : le moment immersif distinct. La home y
 *  mène par un lien sobre, le chip par sa sortie ; le focus vit dans
 *  l'URL ; le premier clic met au point, le second entre dans
 *  l'explorateur cadré — la règle de la carte, réappliquée. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("home → Lens Room → focus → l'explorateur cadré", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Les lentilles →" }).click();
  await expect(page).toHaveURL(/\/lenses$/);

  // Les DEUX objets réels de la graine (Espace, Aéronautique) — et
  // jamais la lentille synthétique sans glyphe (règle d'honnêteté ④).
  await expect(page.getByRole("button", { name: /Espace/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Aéronautique/ })).toBeVisible();
  await expect(page.getByText("test-lens")).toHaveCount(0);

  // Premier clic : le focus entre dans l'URL, l'identité compose.
  await page.getByRole("button", { name: /Espace/ }).click();
  await expect(page).toHaveURL(/focus=space/);
  await expect(page.getByText("ESPACE", { exact: true })).toBeVisible();

  // Second clic : on DESCEND dans l'explorateur, cadré spatial.
  await page.getByRole("button", { name: /Espace/ }).click();
  await expect(page).toHaveURL(/\/explore\?sector=space/);
});

test("l'état focalisé est reproductible par URL, et la salle n'a pas de barre horizontale", async ({
  page,
}) => {
  await page.goto("/lenses?focus=aviation");
  await expect(page.getByText("AÉRONAUTIQUE", { exact: true })).toBeVisible({ timeout: 15_000 });
  // Anti-barres horizontales : le document ne déborde jamais.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("la sortie du chip mène à la salle", async ({ page }) => {
  await page.goto("/explore?sector=space&by=country&split=0");
  const chip = page.getByRole("button", { name: /Périmètre spatial de cette vue/ });
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await chip.click();
  await page.getByRole("menuitem", { name: /Les lentilles/ }).click();
  await expect(page).toHaveURL(/\/lenses$/);
});
