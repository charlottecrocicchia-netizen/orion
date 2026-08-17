import { expect, test } from "@playwright/test";

/** La symétrie géographique (validée le 2026-08-17) : une hiérarchie
 *  prévisible — Monde → Région → Pays → Maille — où chaque niveau est
 *  une VRAIE page et où le geste ne change jamais : premier clic, un
 *  panneau ; second clic, on descend. La recette est le voyage entier,
 *  parcouru au clic, jamais par l'URL seule. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
    window.localStorage.setItem("orion.geoview", "map");
  });
});

test("le voyage entier : monde → Europe → France → région → Explorateur, le même geste partout", async ({
  page,
}) => {
  // NIVEAU MONDE — la pilule Europe est une adresse, pas un recadrage.
  await page.goto("/explore/countries");
  await page.getByRole("link", { name: "Europe", exact: true }).click();
  await expect(page).toHaveURL(/\/explore\/regions\/europe/);

  // NIVEAU RÉGION — une vraie page : son hero chiffré, son classement.
  await expect(page.getByRole("heading", { level: 1, name: "Europe" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Les pays, classés")).toBeVisible();

  // Le geste : premier clic sur la France, elle se SÉLECTIONNE (panneau,
  // pas de téléportation) ; second clic, on descend vers sa fiche.
  const map = page.getByRole("group", { name: /Carte du monde/ });
  const fr = map.locator('[data-code="FR"]');
  await fr.click();
  await expect(fr).toHaveAttribute("aria-pressed", "true");
  expect(page.url()).toContain("/explore/regions/europe");
  await fr.dispatchEvent("click");
  await expect(page).toHaveURL(/\/explore\/countries\/FR/, { timeout: 10_000 });

  // NIVEAU PAYS — le fil d'Ariane dit le chemin entier, chaque segment
  // est un lieu ; la maille française est NOMMÉE, jamais dessinée.
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(
    "Monde › Europe › France",
  );
  await expect(page.getByText("Par région", { exact: true })).toBeVisible();
  const idf = page.locator('[data-mesh="FR1"]');
  await expect(idf).toContainText("Ile de France");

  // Le MÊME geste sur les barres : premier clic sélectionne…
  await idf.click();
  await expect(idf).toHaveAttribute("aria-pressed", "true");
  expect(page.url()).toContain("/explore/countries/FR");
  // …second clic, on descend : l'Explorateur cadré sur la maille.
  await idf.click();
  await expect(page).toHaveURL(/\/explore\?.*subdivision=FR1/, { timeout: 10_000 });
});

test("la maille française avoue son résidu — jamais un zéro déguisé", async ({ page }) => {
  await page.goto("/explore/countries/FR");
  // AEROSTELLAR porte un NUTS national sec : ses montants ne sont
  // d'aucune région, et la fiche le DIT (règle du lot E, prolongée).
  await expect(page.getByText(/Non rattaché à une région/)).toBeVisible({ timeout: 15_000 });
  // Les deux régions semées sortent, dans l'ordre des montants.
  await expect(page.locator("[data-mesh]").first()).toContainText("Ile de France");
  await expect(page.locator('[data-mesh="FRK"]')).toContainText("Auvergne-Rhône-Alpes");
});

test("la page région confesse son assiette et rebondit d'une région à l'autre", async ({
  page,
}) => {
  // L'Europe du seed est homogène (que des pays couverts par la
  // Commission) : rien à confesser. L'Asie-Pacifique, elle, n'est vue
  // QUE par participations — pas un mélange : une absence totale de
  // bailleur domestique, qui se confesse encore plus fort (trou trouvé
  // par CE test à l'écriture : la note « mixte » se taisait ici).
  await page.goto("/explore/regions/asia-pacific");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Aucun bailleur domestique de cette zone/)).toBeVisible();

  // Les pilules font le tour du monde sans repasser par la case départ.
  await page.getByRole("link", { name: "Europe", exact: true }).click();
  await expect(page).toHaveURL(/\/explore\/regions\/europe/);
  await expect(page.getByText("Couvertures inégales")).toHaveCount(0);
});

test("la fiche États-Unis garde sa choroplèthe — la seule géométrie licite", async ({ page }) => {
  await page.goto("/explore/countries/US");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(
    "Monde › Amérique du Nord › United States",
  );
  // La carte d'États est toujours là (lot D) — la symétrie n'a rien cassé.
  await expect(page.getByText("Par État", { exact: true })).toBeVisible();
  const map = page.getByRole("group", { name: /Carte du monde/ });
  await expect(map.locator('[data-code="US-MA"]')).toHaveCount(1, { timeout: 15_000 });
});
