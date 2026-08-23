import { expect, test } from "@playwright/test";

/** R2 — le groupe TREND du Reference Engine : Index 100 et croissance
 *  annuelle, transformations CLIENT de la série real (le backend les
 *  ignore). Le contrat recetté : grammaire `value=index&base=…` /
 *  `value=growth` (base auto-écrite en replace, ré-ancrée quand la
 *  fenêtre change), sélecteur étendu — jamais refait —, refus explicite
 *  hors axe temporel, ⓘ Reference qui dit la transformation puis la
 *  méthode Real héritée, légende orthogonale, FR strict.
 *
 *  Graine : projets 2021-2024 (+ 2026 hors indice) → la première année
 *  de base exploitable est 2021. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("Index 100 depuis le sélecteur : base auto-écrite, unité et note", async ({ page }) => {
  await page.goto("/explore?by=year");
  await expect(page.getByRole("img", { name: /funding · year/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /View funding as/ }).click();
  // Le groupe TREND existe sur une vue temporelle.
  await expect(page.getByText("Trend", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: /Index 100/ }).click();
  await expect(page).toHaveURL(/value=index/);
  await expect(page).toHaveURL(/base=2021/, { timeout: 15_000 });
  const selector = page.getByRole("button", { name: /View funding as/ });
  await expect(selector).toContainText("Index 100 · 2021");
  // La note vit dans le détail replié : on l'ouvre au sommaire ⓘ.
  await page.getByText(/ⓘ Reference/).click();
  await expect(
    page.getByText(/expressed relative to its real funding value in 2021/),
  ).toBeVisible();
});

test("changement de fenêtre : la base sort de la fenêtre → ré-ancrée et réécrite", async ({
  page,
}) => {
  await page.goto("/explore?by=year&value=index&base=2021&time=2022..2024");
  // 2021 n'appartient plus à la fenêtre visible : première année pleine
  // valide de la nouvelle fenêtre, en remplacement d'historique.
  await expect(page).toHaveURL(/base=2022/, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: /View funding as/ })).toContainText(
    "Index 100 · 2022",
  );
});

test("croissance annuelle : % signés, avertissement cohorte, aucun symbole monétaire", async ({
  page,
}) => {
  await page.goto("/explore?by=year&value=growth");
  const chart = page.getByRole("img", { name: /funding · year/ });
  await expect(chart).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /View funding as/ })).toContainText(
    "Annual growth",
  );
  expect(page.url()).not.toContain("base=");
  // L'axe parle en %, plus jamais en euros.
  await expect(chart.getByText(/%/).first()).toBeVisible();
  await expect(chart.getByText(/€/)).toHaveCount(0);
  await page.getByText(/ⓘ Reference/).click();
  await expect(page.getByText(/Year-over-year change in real funding/)).toBeVisible();
  await expect(page.getByText(/commitment cohorts/)).toBeVisible();
});

test("la légende compose avec TREND : hidden survit, Show all conserve le mode", async ({
  page,
}) => {
  await page.goto("/explore?by=country&split=1&value=index&base=2021&hidden=DE");
  await expect(page.getByRole("img", { name: /funding · country/ })).toBeVisible({
    timeout: 15_000,
  });
  const legendDe = page.getByRole("button", { name: /Germany/ });
  await expect(legendDe).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Show all" }).click();
  await expect(page).toHaveURL(/value=index/);
  await expect(page).toHaveURL(/base=2021/);
  await expect(page).not.toHaveURL(/hidden=/);
  await expect(legendDe).toHaveAttribute("aria-pressed", "true");
});

test("TREND sans axe temporel : refus en toutes lettres, retour au nominal", async ({ page }) => {
  await page.goto("/explore?by=country&value=growth");
  await expect(page.getByText(/need a time axis/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Nominal", exact: true }).click();
  await expect(page).not.toHaveURL(/value=/);
  await expect(page.getByRole("button", { name: /View funding as/ })).toContainText("Nominal", {
    timeout: 15_000,
  });
});

test("la note parle français quand l'interface le fait", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
  });
  await page.goto("/explore?by=year&value=growth");
  await expect(page.getByRole("button", { name: /Lire en/ })).toContainText(
    "Croissance annuelle",
    { timeout: 15_000 },
  );
  await page.getByText(/ⓘ Référentiel/).click();
  await expect(page.getByText(/Variation d'une année sur l'autre/)).toBeVisible();
  await expect(page.getByText(/Year-over-year change/)).toHaveCount(0);
});
