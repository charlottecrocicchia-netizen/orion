import { expect, test } from "@playwright/test";

/** La porte d'Orion (révision D4, arbitrage ① du 2026-08-20) et sa
 *  mémoire — la règle gravée : la mémoire ne s'applique QU'À la racine
 *  nue, ne réécrit jamais une URL qui porte son contexte, et un geste
 *  évident en sort. L'URL reste la seule vérité. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("première visite : la racine nue passe par la salle ; le choix se mémorise", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/lenses$/);
  await expect(page.getByRole("button", { name: /Espace/ })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /Espace/ }).click();
  await expect(page).toHaveURL(/\/\?sector=space/);

  // Visite suivante : la racine nue SAUTE la salle vers le monde choisi.
  await page.goto("/");
  await expect(page).toHaveURL(/\/\?sector=space/);
});

test("« Toute la R&D » est un choix de plein droit : la racine nue reste nue", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /corpus entier/ }).click({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/");
  // Ni salle, ni sector : la home nue est l'état choisi.
  await expect(page).toHaveURL(/\/$/);
  await expect(page).not.toHaveURL(/lenses|sector=/);
});

test("une URL qui porte son contexte est souveraine — jamais interceptée", async ({ page }) => {
  // Sans aucune mémoire : un lien profond n'est PAS détourné.
  await page.goto("/projects?sector=space");
  await expect(page).toHaveURL(/\/projects\?sector=space/);
  await page.goto("/?sector=aviation");
  await expect(page).toHaveURL(/\/\?sector=aviation/);
  await expect(page.getByText("projets aéronautiques", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
});

test("une mémoire devenue fausse se purge : refus une fois, puis la salle", async ({ page }) => {
  // La mémoire se pose UNE fois (un initScript rejouerait à chaque
  // navigation et re-poserait la mémoire que le produit vient de
  // purger) : un détour neutre, puis l'écriture, puis la racine.
  await page.goto("/lenses");
  await page.evaluate(() => window.localStorage.setItem("orion.lens.entry", "zzdisparue"));
  await page.goto("/");
  // La mémoire pré-cadre → le refus M1.2 s'affiche (jamais un repli
  // silencieux), et la mémoire fausse est purgée.
  await expect(page.getByText(/n'est pas disponible/)).toBeVisible({ timeout: 15_000 });
  const entry = await page.evaluate(() => window.localStorage.getItem("orion.lens.entry"));
  expect(entry).toBeNull();
  await page.goto("/");
  await expect(page).toHaveURL(/\/lenses$/);
});
