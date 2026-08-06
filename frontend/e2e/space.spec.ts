import { expect, test } from "@playwright/test";

/** La lentille spatiale V1 (plan validé, 2026-08-05) : la home dit des
 *  chiffres VRAIS (la graine porte UN projet cœur, ORBITGUARD), la porte
 *  mène à l'Explorateur cadré ?sector=space, et la recherche parle la
 *  même lentille. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("la home Orion Space Intelligence : la bande espace dit le vrai et sa porte cadre l'Explorateur", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Orion Space Intelligence").first()).toBeVisible();

  const band = page.getByRole("region", { name: "Le secteur spatial, identifié dans le corpus" });
  await expect(band).toBeVisible({ timeout: 10_000 });
  // ORBITGUARD est le seul projet cœur de la graine — la forme
  // SINGULIÈRE du libellé prouve le compte (pluriels i18n).
  await expect(band.getByText("projet spatial au cœur", { exact: true })).toBeVisible();
  await expect(band.getByText("€2M")).toBeVisible();

  await band.getByRole("link", { name: /Explorer l’espace/ }).click();
  await expect(page).toHaveURL(/\/explore\?.*sector=space/);
  // La vue cadrée rend en CARTE (pays × financements : la carte mène,
  // règle doctrine) — le paysage industriel spatial, pays vivants.
  const map = page.getByRole("group", { name: /Carte du monde/ });
  await expect(map).toBeVisible({ timeout: 15_000 });
  await expect(map.locator("path[data-code='NL']")).toHaveCount(1, { timeout: 10_000 });
});

test("la recherche projets parle la lentille : ?sector=space cadre au projet tagué", async ({
  page,
}) => {
  await page.goto("/projects?sector=space");
  await expect(page.getByText("1 résultat", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("ORBITGUARD")).toBeVisible();
});
