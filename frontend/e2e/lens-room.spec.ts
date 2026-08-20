import { expect, test } from "@playwright/test";

/** La scène optique (feu vert 2026-08-20). Un clic ENTRE — le focus
 *  intermédiaire du premier jet a disparu avec l'arbitrage ③ : la
 *  salle est une porte, le monde derrière est le vrai. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lens.entry", "all");
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("trois objets réels ; un clic entre dans la vraie home cadrée", async ({ page }) => {
  await page.goto("/lenses");
  await expect(page.getByRole("button", { name: /Espace/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Aéronautique/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /corpus entier/ })).toBeVisible();
  // Jamais une lentille sans glyphe, jamais de barre horizontale.
  await expect(page.getByText("test-lens")).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // LE GESTE (recette ③) : au clic, l'AVION part — puis la navigation
  // s'accomplit vers la vraie home cadrée.
  await page.getByRole("button", { name: /Aéronautique/ }).click();
  await expect(page.locator('[data-world-launch="aviation"]')).toBeVisible({ timeout: 900 });
  await expect(page).toHaveURL(/\/\?sector=aviation/);
  await expect(page.getByText("projets aéronautiques", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  const entry = await page.evaluate(() => window.localStorage.getItem("orion.lens.entry"));
  expect(entry).toBe("aviation");
});

test("la sortie du chip mène à la salle", async ({ page }) => {
  await page.goto("/explore?sector=space&by=country&split=0");
  const chip = page.getByRole("button", { name: /Périmètre spatial de cette vue/ });
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await chip.click();
  await page.getByRole("menuitem", { name: /Les lentilles/ }).click();
  await expect(page).toHaveURL(/\/lenses$/);
});

test("⓪ les trois verres, trois destinations exactes — le choix explicite bat la mémoire", async ({
  page,
}) => {
  // Une mémoire « space » préexistante ne détourne JAMAIS un choix
  // explicite fait dans la salle.
  await page.goto("/lenses");
  await page.evaluate(() => window.localStorage.setItem("orion.lens.entry", "space"));

  // ① Espace → la FUSÉE part, puis la home cadrée space.
  await page.getByRole("button", { name: /Espace/ }).click();
  await expect(page.locator('[data-world-launch="space"]')).toBeVisible({ timeout: 900 });
  await expect(page).toHaveURL(/\/\?sector=space$/);

  // ② Aéronautique → la home cadrée aviation.
  await page.goto("/lenses");
  await page.getByRole("button", { name: /Aéronautique/ }).click();
  await expect(page).toHaveURL(/\/\?sector=aviation$/);

  // ③ Tout le corpus → la home NUE : aucun sector, aucun halo de
  // lentille, les compteurs du corpus entier — et la mémoire retient
  // « all » : revenir plus tard rouvre la vue nue.
  await page.goto("/lenses");
  await page.getByRole("button", { name: /corpus/ }).click();
  // pas d'objet volant pour le corpus : transition sobre.
  await expect(page.locator("[data-world-launch]")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(page).not.toHaveURL(/sector=/);
  await expect(page.locator(".world-word")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Tout le corpus/ })).toBeVisible({
    timeout: 15_000,
  });
  const entry = await page.evaluate(() => window.localStorage.getItem("orion.lens.entry"));
  expect(entry).toBe("all");
});

test("③ reduced-motion : navigation immédiate, jamais d'objet volant", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lens.entry", "all");
    window.localStorage.setItem("orion.lang", "fr");
  });
  await page.goto("/lenses");
  await page.getByRole("button", { name: /Espace/ }).click({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/\?sector=space/);
  await expect(page.locator("[data-world-launch]")).toHaveCount(0);
  await context.close();
});
