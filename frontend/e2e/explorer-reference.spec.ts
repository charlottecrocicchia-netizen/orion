import { expect, test } from "@playwright/test";

/** R1 — le mode « valeur réelle » de l'Explorateur, sous la grammaire
 *  finale du Reference Engine (R0 § D10).
 *
 *  Le contrat recetté : nominal par défaut ; le sélecteur « View
 *  funding as » écrit `value=real&base=2025` (l'année de référence est
 *  auto-écrite dès la réponse — non négociable) ; la devise d'affichage
 *  s'écrit hors défaut (`cur=USD`) et n'est qu'une ré-expression ; la
 *  part exclue (FUTUREWATT, 2026 — indice non publié) est annoncée au
 *  point d'affichage avec ses chiffres ; l'axe temporel garde l'horizon
 *  nominal (2026 hachuré, jamais tronqué, jamais un faux zéro) ; la
 *  légende `hidden=` reste orthogonale ; EN 100 % EN, FR 100 % FR. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("nominal by default — no value parameter, explicit unit line", async ({ page }) => {
  await page.goto("/explore?by=year");
  await expect(page.getByRole("img", { name: /funding · year/ })).toBeVisible({
    timeout: 15_000,
  });
  expect(page.url()).not.toContain("value=");
  const selector = page.getByRole("button", { name: /View funding as/ });
  await expect(selector).toBeVisible();
  await expect(selector).toContainText("Nominal");
  // La ligne d'unité nominale, toujours visible (R0 § D7).
  await expect(page.getByText("EUR · at award time").first()).toBeVisible();
  await expect(page.getByText(/excluded from this view/)).toHaveCount(0);
});

test("the selector writes value=real&base, discloses the excluded share, keeps the horizon", async ({
  page,
}) => {
  await page.goto("/explore?by=year");
  const chart = page.getByRole("img", { name: /funding · year/ });
  await expect(chart).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /View funding as/ }).click();
  await page.getByRole("radio", { name: /Real value/ }).click();
  await expect(page).toHaveURL(/value=real/);
  // L'année de référence dans l'URL — écrite automatiquement dès la
  // réponse (précédent moneyYear, repris sous la grammaire R0).
  await expect(page).toHaveURL(/base=2025/, { timeout: 15_000 });
  expect(page.url()).not.toContain("cur=");

  // L'unité change au point d'affichage.
  await expect(page.getByText(/Real EUR · 2025 prices/).first()).toBeVisible();

  // La part exclue, chiffrée depuis le périmètre affiché : FUTUREWATT
  // (2026, 2 M€) est le seul projet hors indice de la graine.
  const excluded = page.getByText(/excluded from this view: 1 project/);
  await expect(excluded).toBeVisible();
  await excluded.click();
  await expect(page.getByText(/index for 2026 not yet published/)).toBeVisible();

  // L'axe garde l'horizon nominal : 2026 reste sur l'axe, hachuré.
  await expect(chart.getByText("2026")).toBeVisible();
  await expect(chart.locator('rect[fill^="url(#reference-unavailable"]')).toBeVisible();

  // URL = vue : le rechargement restaure mode et année de référence.
  await page.reload();
  await expect(page.getByText(/Real EUR · 2025 prices/).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/excluded from this view: 1 project/)).toBeVisible();
});

test("display currency USD is a re-expression: cur=USD in the URL, $ on the board", async ({
  page,
}) => {
  await page.goto("/explore?by=year&value=real&base=2025");
  await expect(page.getByText(/Real EUR · 2025 prices/).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /View funding as/ }).click();
  await page.getByRole("radio", { name: "USD", exact: true }).click();
  await expect(page).toHaveURL(/cur=USD/);
  await expect(page.getByText(/Real USD · 2025 prices/).first()).toBeVisible({
    timeout: 15_000,
  });
  // Retour à l'EUR : le défaut sort de l'URL canonique.
  await page.getByRole("radio", { name: "EUR", exact: true }).click();
  await expect(page).toHaveURL(/value=real/);
  await expect(page).not.toHaveURL(/cur=/, { timeout: 15_000 });
});

test("the reference and the legend compose — value/base/cur with hidden", async ({ page }) => {
  await page.goto("/explore?by=country&split=1&value=real&base=2025&hidden=DE");
  await expect(page.getByText(/Real EUR · 2025 prices/).first()).toBeVisible({
    timeout: 15_000,
  });
  // La série masquée reste masquée sous le mode real (orthogonalité).
  const legendDe = page.getByRole("button", { name: /Germany/ });
  await expect(legendDe).toHaveAttribute("aria-pressed", "false");
  // La réafficher ne touche pas au référentiel : value/base restent.
  await legendDe.click();
  await expect(page).toHaveURL(/value=real/);
  await expect(page).toHaveURL(/base=2025/);
  await expect(page).not.toHaveURL(/hidden=/);
});

test("the disclosure speaks French when the interface does", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
  });
  await page.goto("/explore?by=year&value=real&base=2025");
  await expect(page.getByText(/hors calcul : 1 projet/).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/€ constants 2025/).first()).toBeVisible();
  await expect(page.getByText(/excluded from this view/)).toHaveCount(0);
});
