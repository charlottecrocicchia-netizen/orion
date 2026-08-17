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

test("le chip de périmètre : trois états, l'URL comme seule vérité, le cadrage survit", async ({
  page,
}) => {
  // Space natif, lot 1 (validé 2026-08-17) : une vue cadrée DIT son
  // périmètre — l'ancien ?sector=space cadrait sans un mot à l'écran.
  await page.goto("/explore?sector=space&by=country&split=0");
  const chip = page.getByRole("button", { name: /Périmètre spatial de cette vue/ });
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await expect(chip).toContainText("Spatial + habilitant");

  // La correction patch() (lot 0) : retoucher le composeur ne perd plus
  // le cadrage — c'était l'aspérité du mémo produit.
  await page.getByRole("button", { name: "top 5" }).click();
  // Les valeurs du top sont des boutons simples dans ce menu (les
  // radios y sont la liste de comparaison).
  await page.getByRole("button", { name: "top 10", exact: true }).click();
  await expect(page).toHaveURL(/sector=space/);
  await expect(chip).toContainText("Spatial + habilitant");

  // Bascule vers le direct : l'URL change, le libellé aussi.
  await chip.click();
  await page.getByRole("menuitemradio", { name: /Spatial direct/ }).click();
  await expect(page).toHaveURL(/sector=space-direct/);
  await expect(chip).toContainText("Spatial direct");

  // « Toute la R&D » : le paramètre disparaît, le chip aussi — le
  // silence est l'état non cadré, jamais un cadrage muet.
  await chip.click();
  await page.getByRole("menuitemradio", { name: /Toute la R&D/ }).click();
  await expect(page).not.toHaveURL(/sector=/);
  await expect(chip).toHaveCount(0);
});

test("la recherche projets porte le même chip, et la dimension État / région est au menu", async ({
  page,
}) => {
  await page.goto("/projects?sector=space");
  await expect(
    page.getByRole("button", { name: /Périmètre spatial de cette vue/ }),
  ).toBeVisible({ timeout: 15_000 });

  // L'aspérité « dimension accessible seulement par URL » est fermée :
  // « État / région » se choisit au menu de la phrase.
  await page.goto("/explore?by=country&split=0");
  // Le segment de dimension porte l'aria-label « par », son texte dit
  // la dimension courante.
  await page.getByRole("button", { name: "par", exact: true }).click();
  await expect(page.getByRole("menuitemradio", { name: "État / région" })).toBeVisible();
});
