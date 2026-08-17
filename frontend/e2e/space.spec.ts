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

test("la home raconte le spatial : le hero dit son périmètre, la ligne corpus dit l'assise", async ({
  page,
}) => {
  // Lot 2 (validé 2026-08-17) : les rôles s'inversent — le grand chiffre
  // est SPATIAL et dit « direct + habilitant » dans la phrase même
  // (exigence fondatrice ①) ; le corpus général devient la ligne
  // discrète, avec sa porte vers Toute la R&D.
  await page.goto("/");
  await expect(page.getByText("Orion Space Intelligence").first()).toBeVisible();
  await expect(page.getByText(/direct \+ habilitant/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("projets spatiaux", { exact: true })).toBeVisible();
  await expect(page.getByText("groupes industriels", { exact: true })).toBeVisible();

  // L'assise : le corpus entier, jamais caché.
  const corpus = page.getByRole("region", { name: "Le corpus entier" });
  await expect(corpus).toBeVisible();
  await expect(corpus.getByText(/Adossé à un corpus/)).toBeVisible();

  // La porte spatiale du hero cadre l'Explorateur, en carte.
  await page.getByRole("link", { name: /Explorer l.espace/ }).click();
  await expect(page).toHaveURL(/\/explore\?.*sector=space/);
  const map = page.getByRole("group", { name: /Carte du monde/ });
  await expect(map).toBeVisible({ timeout: 15_000 });
  await expect(map.locator("path[data-code='NL']")).toHaveCount(1, { timeout: 10_000 });

  // Et la porte corpus mène à Toute la R&D (sans cadrage).
  await page.goto("/");
  await page.getByRole("link", { name: /Toute la R&D/ }).click();
  await expect(page).toHaveURL(/\/explore\?/);
  await expect(page).not.toHaveURL(/sector=/);
});

test("la recherche projets parle la lentille : ?sector=space cadre au projet tagué", async ({
  page,
}) => {
  await page.goto("/projects?sector=space");
  // Deux projets spatiaux au seed depuis le lot 2 (ORBITGUARD core +
  // TERRASCOPE earth observation — la constellation exige deux années).
  await expect(page.getByText("2 résultats", { exact: true })).toBeVisible({ timeout: 10_000 });
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

test("les decks spatiaux : la section Espace mène, le deck 2 enseigne la distinction", async ({
  page,
}) => {
  // Lot 3 (validé 2026-08-17) : trois decks 100 % spatiaux EN TÊTE de la
  // bibliothèque — les généralistes restent dessous, jamais retirés.
  await page.goto("/analyses");
  const space = page.getByRole("region", { name: "Espace" });
  await expect(space).toBeVisible({ timeout: 10_000 });
  await expect(space.getByText("Où va l’argent spatial ?")).toBeVisible();
  await expect(space.getByText("Direct ou habilitant ?")).toBeVisible();
  await expect(space.getByText("Qui monte dans le spatial ?")).toBeVisible();
  await expect(page.getByText(/hydrogène/).first()).toBeVisible();

  // Le deck 2 — sa raison d'être : chaque angle porte SON périmètre dans
  // l'adresse, et le chip le dit à l'écran, deck compris.
  await space.getByText("Direct ou habilitant ?").click();
  await expect(page).toHaveURL(/angles=spaceDirect/);
  const chip = page.getByRole("button", { name: /Périmètre spatial de cette vue/ });
  await expect(chip).toContainText("Spatial + habilitant", { timeout: 15_000 });
  // L'angle 2 est le cœur seul : le chip suit l'angle actif.
  await page.getByRole("tab", { name: /Le cœur seul/ }).click();
  await expect(chip).toContainText("Spatial direct");
});

test("la porte Analyser de la home ouvre le deck spatial", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Où va l.argent spatial/ }).click();
  await expect(page).toHaveURL(/angles=spaceMoney/);
  await expect(page.getByText("La trajectoire (direct + habilitant)")).toBeVisible({
    timeout: 15_000,
  });
});
