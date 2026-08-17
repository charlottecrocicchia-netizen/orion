import { expect, test } from "@playwright/test";

/** L'honnêteté de couverture (lot E, 2026-08-17). Règle fondatrice :
 *  **plus jamais un écran où l'absence de données se fait passer pour un
 *  zéro.** La recette est une question posée à l'écran : « d'après ceci,
 *  l'Asie finance-t-elle la R&D ? » — la bonne réponse est « on ne sait
 *  pas », jamais « non ». Chaque test vérifie qu'un écran la rend
 *  possible. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
    window.localStorage.setItem("orion.geoview", "map");
  });
});

test("la carte du monde texture les pays non couverts et le dit en légende", async ({ page }) => {
  await page.goto("/explore/countries");
  const map = page.getByRole("group", { name: /Carte du monde/ });
  await expect(map).toBeVisible({ timeout: 15_000 });

  // Israël participe aux programmes-cadres (couvert) ; la graine porte
  // aussi des pays vus par leurs seules participations — la texture est
  // là pour eux, jamais pour un pays à bailleur chargé.
  await expect(map.locator("[data-not-covered]").first()).toBeAttached({ timeout: 10_000 });
  await expect(map.locator("[data-not-covered='FR']")).toHaveCount(0);

  // La texture a SA légende : sans elle, une hachure est une énigme.
  await expect(page.getByText("financements domestiques non couverts")).toBeVisible();
});

test("une vue qui mélange les couvertures le confesse ; une vue homogène se tait", async ({
  page,
}) => {
  // Le monde par pays : la Commission et NIH/NSF couvrent leurs pays,
  // les autres n'apparaissent que par leurs consortiums.
  await page.goto("/explore?by=country&split=0&limit=8");
  await expect(page.getByText("Couvertures inégales")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/leur budget propre est invisible ici, pas nul/)).toBeVisible();

  // Cadrée sur l'Europe, la même vue n'a rien à confesser.
  await page.goto("/explore?by=country&split=0&limit=8&scope=europe");
  await expect(page.getByRole("img").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Couvertures inégales")).toHaveCount(0);
});

test("le hero dit son assiette — 734 Md€ ne veut pas dire « tout l'argent public »", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/sur 4 sources officielles/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/programmes-cadres de l’UE/)).toBeVisible();
});
