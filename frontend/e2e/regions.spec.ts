import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
    window.localStorage.setItem("orion.geoview", "map");
  });
});

/** La règle du chantier régions (fondatrice, 2026-08-04) : tout pays
 *  présent dans le corpus est colorié, survolable et cliquable — sur le
 *  globe comme sur les cartes ; le gris est réservé aux pays sans
 *  aucune donnée. L'interactivité DÉRIVE du corpus semé (la leçon Vega
 *  du « nom en dur » appliquée à la géographie) : le seed porte un
 *  projet NSF avec le MIT (US, polygone), le Technion (IL, région
 *  Moyen-Orient & Afrique) et Malte (MT — aucun polygone dans le 110m,
 *  une pastille). */

test("every seeded corpus country is alive on the flat map — polygon, region tint and dot alike", async ({
  page,
}) => {
  await page.goto("/explore/countries");
  const map = page.getByRole("group", { name: /World map/ });
  await expect(map).toBeVisible();

  // Les États-Unis : polygone, cliquable, teinte de région (pas la surface).
  const us = map.locator('[data-code="US"]');
  await expect(us).toHaveAttribute("role", /button|link/);
  await expect(us).toHaveAttribute("aria-label", /—/);
  const usFill = await us.getAttribute("fill");
  expect(usFill).toContain("--region-north-america");

  // Israël : cliquable, la teinte Moyen-Orient & Afrique (verdict ③).
  const il = map.locator('[data-code="IL"]');
  await expect(il).toHaveAttribute("role", /button|link/);
  expect(await il.getAttribute("fill")).toContain("--region-middle-east-africa");

  // Malte : AUCUN polygone dans la géométrie 110m — une pastille, tout
  // aussi vivante (elle était invisible avant ce chantier).
  const mt = map.locator('circle[data-code="MT"]');
  await expect(mt).toHaveAttribute("role", /button|link/);
  expect(await mt.getAttribute("fill")).toContain("--region-europe");

  // Un pays sans donnée reste gris surface et muet — le contraste de la règle.
  const noData = map.locator('path[data-code="TD"]'); // Tchad : pas de seed
  await expect(noData).toHaveCount(1);
  expect(await noData.getAttribute("fill")).toContain("--color-surface");
  expect(await noData.getAttribute("role")).toBeNull();
});

test("first activation selects the US, second leaves for its file (map rule)", async ({ page }) => {
  await page.goto("/explore/countries");
  const us = page.locator('svg[role="group"] [data-code="US"]').first();
  await us.click();
  // Premier clic : sélection, jamais de téléportation.
  await expect(us).toHaveAttribute("aria-pressed", "true");
  expect(page.url()).not.toContain("/countries/US");
  await us.click();
  await expect(page).toHaveURL(/\/explore\/countries\/US/, { timeout: 10_000 });
});

test("the scope lives in the URL and frames the map to the region", async ({ page }) => {
  await page.goto("/explore/countries?scope=europe");
  // La chip Europe est pressée, l'URL porte le scope.
  await expect(page.getByRole("button", { name: "Europe", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const map = page.getByRole("group", { name: /World map/ });
  await expect(map.locator('path[data-code="FR"]')).toHaveCount(1, { timeout: 15_000 });
  // Le cadre Europe ne contient pas les États-Unis — le scope cadre.
  await expect(map.locator('[data-code="US"]')).toHaveCount(0);

  // Retour au monde : les États-Unis réapparaissent, l'URL se nettoie.
  await page.getByRole("button", { name: /World|Monde/ }).click();
  await expect(map.locator('[data-code="US"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(page).not.toHaveURL(/scope=/);
});
