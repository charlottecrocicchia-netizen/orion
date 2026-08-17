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

test("le globe porte la même texture — c'est LUI que l'on voit en premier", async ({ page }) => {
  // Recette fondatrice du 2026-08-17 : la texture avait été livrée sur
  // la carte plate seulement. Or le globe est la vue par DÉFAUT — le
  // seul écran que tout le monde voit taisait donc son assiette. Ce
  // test existe pour que ça ne puisse pas revenir en silence.
  await page.addInitScript(() => window.localStorage.setItem("orion.geoview", "globe"));
  await page.goto("/explore/countries");
  const globe = page.getByRole("img", { name: /Globe/ });
  await expect(globe).toBeVisible({ timeout: 15_000 });

  await expect(globe.locator("[data-not-covered]").first()).toBeAttached({ timeout: 10_000 });
  // Jamais sur un pays à bailleur chargé — la France est couverte.
  await expect(globe.locator("[data-not-covered='FR']")).toHaveCount(0);
  await expect(page.getByText("financements domestiques non couverts")).toBeVisible();
});

test("une vue qui mélange les couvertures le confesse ; une vue homogène se tait", async ({
  page,
}) => {
  // Le monde par pays : la Commission et NIH/NSF couvrent leurs pays,
  // les autres n'apparaissent que par leurs consortiums.
  await page.goto("/explore?by=country&split=0&limit=20");
  await expect(page.getByText("Couvertures inégales")).toBeVisible({ timeout: 15_000 });
  // La carte de l'EXPLORATEUR hachure aussi (aspérité du mémo, corrigée
  // le 2026-08-17) : le Japon, vu par ses seules participations, porte
  // la texture ici comme sur toutes les cartes géographiques.
  await expect(page.locator("[data-not-covered='JP']")).toBeAttached({ timeout: 10_000 });
  await expect(page.getByText(/leur budget propre est invisible ici, pas nul/)).toBeVisible();
  // Elle NOMME le pays concerné : « le Japon finance peu » et « nous ne
  // voyons du Japon que ce qu'il fait avec l'Europe » ne se disent pas
  // de la même façon.
  await expect(page.getByText(/Japon/)).toBeVisible();

  // La note décrit ce qui est AFFICHÉ, pas le corpus entier. Resserrée
  // au top 8, la vue ne contient plus que des pays couverts : elle n'a
  // rien à avouer et se tait. C'est ce qui la garde crédible — une
  // phrase qui apparaît partout ne se lit bientôt plus nulle part.
  // On attend que la carte ait RENDU avant de constater une absence :
  // sans cette ancre, le test passerait au vert sur une page vide.
  const map = page.getByRole("group", { name: /Carte du monde/ });
  await page.goto("/explore?by=country&split=0&limit=8");
  await expect(map.getByRole("button", { name: /United States/ })).toBeVisible({ timeout: 15_000 });
  await expect(map.getByRole("button", { name: /Japan/ })).toHaveCount(0);
  await expect(page.getByText("Couvertures inégales")).toHaveCount(0);

  // Et une vue qui ne parle pas de géographie ne parle pas de
  // couverture : par thème, la question ne se pose pas.
  await page.goto("/explore?by=theme&split=0&limit=20");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Couvertures inégales")).toHaveCount(0);
});

test("le hero dit son assiette — 734 Md€ ne veut pas dire « tout l'argent public »", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/sur 4 sources officielles/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/programmes-cadres de l’UE/)).toBeVisible();
});
