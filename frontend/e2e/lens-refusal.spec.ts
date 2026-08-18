import { expect, test } from "@playwright/test";

/** M1.2 — le refus unifié. La règle, partout où `sector` se comprend :
 *  absent → vue non cadrée ; exactement une valeur publiée → cadrage ;
 *  inconnue, indisponible, vide ou répétée → refus explicite. Jamais de
 *  repli silencieux sur le corpus entier : un lien qui montrerait
 *  700 000 projets en prétendant montrer une lentille mentirait.
 *
 *  Et le refus ne dit JAMAIS pourquoi : une lentille en préparation est
 *  « indisponible », comme une lentille qui n'existe pas. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

const REFUSED = "Cette lentille n'est pas disponible";

test("le même refus à l'Explorateur et à la recherche", async ({ page }) => {
  for (const url of ["/explore?sector=martien&by=country&split=0", "/projects?sector=martien"]) {
    await page.goto(url);
    await expect(page.getByText(REFUSED)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Orion ne peut pas reproduire cette vue/)).toBeVisible();
    // Aucun repli : ni résultats, ni vue cadrée.
    await expect(page.getByRole("group", { name: /Carte du monde/ })).toHaveCount(0);
  }
});

test("vide, répété, en préparation : refusés, et sans dire pourquoi", async ({ page }) => {
  // Vide : le paramètre a été envoyé, il doit dire quelque chose.
  await page.goto("/explore?sector=&by=country&split=0");
  await expect(page.getByText(REFUSED)).toBeVisible({ timeout: 15_000 });

  // Répété : jamais réduit à la première ni à la dernière valeur —
  // même quand les deux valeurs sont valides.
  await page.goto("/explore?sector=space&sector=test-lens&by=country&split=0");
  await expect(page.getByText(REFUSED)).toBeVisible();
  await page.goto("/projects?sector=space&sector=space-direct");
  await expect(page.getByText(REFUSED)).toBeVisible();

  // En préparation (draft au registre) : « indisponible », pas un mot
  // de plus — l'écran ne trahit ni le statut ni le registre.
  await page.goto("/projects?sector=test-draft");
  await expect(page.getByText(REFUSED)).toBeVisible();
  const shown = (await page.locator("body").innerText()).toLowerCase();
  for (const secret of ["draft", "préparation", "brouillon", "retired"]) {
    expect(shown, `le refus ne dit pas « ${secret} »`).not.toContain(secret);
  }
});

test("les vues justes ne bougent pas", async ({ page }) => {
  // Une lentille publiée, ses deux périmètres, et l'absence de
  // paramètre : rien de tout cela ne change.
  await page.goto("/explore?sector=space&by=country&split=0");
  await expect(page.getByRole("button", { name: /Périmètre spatial de cette vue/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.goto("/explore?sector=space-direct&by=country&split=0");
  await expect(page.getByRole("button", { name: /Périmètre spatial de cette vue/ })).toContainText(
    "Spatial direct",
  );
  await page.goto("/explore?by=country&split=0");
  await expect(page.getByRole("group", { name: /Carte du monde/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(REFUSED)).toHaveCount(0);
});

test("la sortie retire la lentille et PRÉSERVE tout le reste du lien", async ({ page }) => {
  await page.goto("/explore?metric=projects&by=country&split=0&q=hydrogen&sector=martien");
  await expect(page.getByText(REFUSED)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: /Voir toute la R&D/ }).click();
  await expect(page).not.toHaveURL(/sector=/);
  await expect(page).toHaveURL(/metric=projects/);
  await expect(page).toHaveURL(/by=country/);
  await expect(page).toHaveURL(/split=0/);
  await expect(page).toHaveURL(/q=hydrogen/);
  // Et la vue se rend vraiment, non cadrée : le composeur est là, le
  // refus a disparu, et plus aucun chip ne prétend cadrer quoi que ce soit.
  await expect(page.getByRole("button", { name: "par", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(REFUSED)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Périmètre/ })).toHaveCount(0);
});
