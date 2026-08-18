import { expect, test } from "@playwright/test";

/** I3 (validé fondatrice, 2026-08-18) : le vocabulaire d'Orion est UNE
 *  paire à deux registres — technique `core` / `enabling` en base et au
 *  contrat d'API, utilisateur « X direct » / « X + habilitant » à
 *  l'écran. Ces deux tests gardent la frontière, une langue chacun :
 *  les libellés recettés au chantier Space natif s'affichent, et le
 *  vocabulaire de la donnée ne fuit pas sur les surfaces utilisateur.
 *
 *  Nuance déclarée : en ANGLAIS, « enabling » EST le mot utilisateur
 *  validé (« Space + enabling ») — les deux registres coïncident dans
 *  cette langue, par construction. Le test anglais garde donc ce qui
 *  est gardable : « adjacent », le terme sorti du produit, ne doit
 *  apparaître nulle part. */

const SURFACES = ["/", "/analyses", "/about-data"];

async function visibleText(page: import("@playwright/test").Page): Promise<string> {
  return (await page.locator("body").innerText()).toLowerCase();
}

test("le vocabulaire à l'écran, en français : les libellés recettés, et rien de la donnée", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });

  await page.goto("/explore?sector=space&by=country&split=0");
  const chip = page.getByRole("button", { name: /Périmètre spatial de cette vue/ });
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await expect(chip).toContainText("Spatial + habilitant");

  // Le menu porte les DEUX libellés recettés, et son aide dit la même
  // chose en clair — sans jamais nommer le tag de la base.
  await chip.click();
  await expect(page.getByRole("menuitemradio", { name: /Spatial direct/ })).toBeVisible();
  // L'aide est vérifiée SUR l'entrée spatiale : depuis M1.1 le registre
  // publie plusieurs lentilles, et chacune porte la même aide générique.
  await expect(page.getByRole("menuitemradio", { name: /Spatial \+ habilitant/ })).toContainText(
    "cœur + technologies habilitantes",
  );

  const explorer = await visibleText(page);
  expect(explorer).not.toContain("adjacent");
  expect(explorer).not.toContain("enabling");

  for (const path of SURFACES) {
    await page.goto(path);
    await expect(page.getByText(/Orion/).first()).toBeVisible({ timeout: 15_000 });
    const text = await visibleText(page);
    expect(text, `« adjacent » sur ${path}`).not.toContain("adjacent");
    expect(text, `« enabling » sur ${path}`).not.toContain("enabling");
  }

  // L'À-propos montre la MÉTHODE, jamais l'implémentation (correction
  // de clôture M1.0, fondatrice).
  await expect(
    page.getByText(/identifiées comme habilitantes par les règles de la lentille/),
  ).toBeVisible();
});

test("le vocabulaire à l'écran, en anglais : les libellés recettés, et « adjacent » nulle part", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });

  await page.goto("/explore?sector=space&by=country&split=0");
  const chip = page.getByRole("button", { name: /Space perimeter of this view/ });
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await expect(chip).toContainText("Space + enabling");

  await chip.click();
  await expect(page.getByRole("menuitemradio", { name: /Space direct/ })).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: /Space \+ enabling/ })).toBeVisible();

  expect(await visibleText(page)).not.toContain("adjacent");

  for (const path of SURFACES) {
    await page.goto(path);
    await expect(page.getByText(/Orion/).first()).toBeVisible({ timeout: 15_000 });
    expect(await visibleText(page), `« adjacent » sur ${path}`).not.toContain("adjacent");
  }
});
