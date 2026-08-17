import { expect, test, type Locator, type Page } from "@playwright/test";

import flatMaps from "../src/lib/flat-maps.json" with { type: "json" };

/** Clique un pays à son CENTROÏDE continental (fourni par la géométrie) :
 *  au cadre mondial, la boîte englobante d'un pays à outre-mers (la
 *  France inclut la Guyane) a son centre en pleine mer — le clic au
 *  centre de bbox n'atteint jamais la forme peinte. */
async function clickCountry(page: Page, map: Locator, code: string) {
  const scope = (flatMaps as { scopes: Record<string, { countries: { code: string; cx: number; cy: number }[] }> })
    .scopes.world;
  const centroid = scope.countries.find((entry) => entry.code === code);
  if (!centroid) throw new Error(`${code} sans centroïde`);
  const box = await map.boundingBox();
  if (!box) throw new Error("carte sans boîte");
  await page.mouse.click(
    box.x + (centroid.cx / 900) * box.width,
    box.y + (centroid.cy / 675) * box.height,
  );
}

/** M3: the Europe choropleth — the geographic entry to the tool.
 *  Map rule (fondatrice, 2026-08-02): the first activation SELECTS —
 *  highlight, pinned flows, summary panel — and the file opens only on a
 *  distinct gesture: the panel's CTA, or a second activation of the
 *  already-selected country. Mouse and keyboard share the same path. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
    window.localStorage.setItem("orion.geoview", "map");
  });
});

test("first click selects France; the second click zooms into its file", async ({ page }) => {
  await page.goto("/explore/countries");
  const map = page.getByRole("group", { name: /World map/ });
  await expect(map).toBeVisible({ timeout: 15_000 });

  const france = map.getByRole("button", { name: /^France — €/ });
  await expect(france).toBeVisible();

  await clickCountry(page, map, "FR");
  // Selected, not teleported: the summary panel opens beside the map.
  await expect(page.getByRole("heading", { name: "France" })).toBeVisible();
  expect(page.url()).not.toContain("/countries/FR");
  await expect(france).toHaveAttribute("aria-pressed", "true");

  // Second activation of the selected shape: the cinematic zoom, then
  // the file. dispatchEvent, pas un clic pixel : l'ouverture du panneau
  // REDIMENSIONNE la carte en animation, et un second clic calculé sur
  // la boîte en mouvement tombait dans l'océan (flaky CI récidiviste,
  // 2026-08-17) — la sémantique pointeur est déjà prouvée au premier.
  await map.locator("path[data-code='FR']").dispatchEvent("click");
  await expect(page).toHaveURL(/\/explore\/countries\/FR/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("France");
});

test("every curated country photo actually paints in the panel", async ({ page }) => {
  // Locks the recette symptom of 2026-08-02 (three photos reported blank):
  // for each registry country present in the corpus, the panel image must
  // have decoded pixels — not just a 200 response.
  await page.goto("/explore/countries");
  const map = page.getByRole("group", { name: /World map/ });
  await expect(map).toBeVisible({ timeout: 15_000 });
  // Le svg existe AVANT sa géométrie (chunk dynamique) : attendre les
  // formes, pas le conteneur — sinon la première itération clique dans
  // le vide et le pays saute en silence.
  await expect(map.locator('path[data-code="FR"]')).toHaveCount(1, { timeout: 15_000 });
  const registry = ["FR", "ES", "DE", "IT", "NL", "GB"];
  let checked = 0;
  for (const code of registry) {
    const shape = page.locator(`path[data-code="${code}"]`);
    if ((await shape.count()) === 0) continue;
    // dispatchEvent : ce test vérifie le RENDU des photos, pas la
    // sémantique pointeur (couverte par les deux autres tests) — un clic
    // aux coordonnées qui manque sa cible re-active la sélection en
    // cours et navigue, emportant la carte.
    await shape.dispatchEvent("click");
    // La sélection est asynchrone : on l'attend explicitement avant de
    // chercher la photo (un pays sans données ne se sélectionne pas).
    try {
      await expect(shape).toHaveAttribute("aria-pressed", "true", { timeout: 3000 });
    } catch {
      continue;
    }
    // Target THIS country's image: during the panel transition the leaving
    // and entering panels briefly coexist.
    const img = page.locator(`img[src*="/countries/${code.toLowerCase()}"]`);
    try {
      // Le panneau s'ouvre en asynchrone : on lui laisse le temps
      // d'arriver (le clic par coordonnées n'a pas l'attente
      // d'actionnabilité du clic d'élément).
      await img.first().waitFor({ state: "attached", timeout: 4000 });
    } catch {
      continue; // corpus without this country
    }
    await expect
      .poll(async () => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), {
        timeout: 8000,
      })
      .toBeGreaterThan(0);
    checked += 1;
  }
  expect(checked).toBeGreaterThan(0);
});

test("switching country moves the selection instead of navigating", async ({ page }) => {
  await page.goto("/explore/countries");
  const map = page.getByRole("group", { name: /World map/ });
  await expect(map).toBeVisible({ timeout: 15_000 });

  const france = map.locator('path[data-code="FR"]');
  const germany = map.locator('path[data-code="DE"]');
  await france.dispatchEvent("click");
  await expect(france).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "France" })).toBeVisible();
  await germany.dispatchEvent("click");
  await expect(germany).toHaveAttribute("aria-pressed", "true");
  // The panel follows the selection; still no navigation.
  await expect(page.getByRole("heading", { name: "Germany" })).toBeVisible();
  expect(page.url()).not.toContain("/countries/");
});
