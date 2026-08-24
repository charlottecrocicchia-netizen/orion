import { expect, test } from "@playwright/test";

/** R3 — ECONOMIC SCALE : % PIB et par-habitant, perspectives forcées
 *  par la dimension, dénominateurs WDI. Le contrat recetté : grammaire
 *  `value=gdp` (nu) / `value=capita&base=2025` (auto-écrit), intitulés
 *  qui disent l'économie (jamais un « % GDP » ambigu), refus explicite
 *  hors vue à dénominateur résoluble, légende orthogonale, FR strict. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("% of GDP depuis le sélecteur sur les financeurs : effort, valeurs en %", async ({
  page,
}) => {
  await page.goto("/explore?by=funder");
  await expect(page.getByRole("img", { name: /funding · funder/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /View funding as/ }).click();
  await expect(page.getByText("Economic scale", { exact: true })).toBeVisible();
  // Le panneau choisit la QUESTION, une micro-description au plus —
  // la perspective et la méthode vivent dans ⓘ (verrou de recette R3).
  await expect(page.getByText("Relative to economic size")).toBeVisible();
  await page.getByRole("radio", { name: /% of GDP/ }).click();
  await expect(page).toHaveURL(/value=gdp/);
  expect(page.url()).not.toContain("base=");
  await expect(page.getByRole("button", { name: /View funding as/ })).toContainText("% of GDP");
  await expect(page.getByText(/%/).first()).toBeVisible({ timeout: 15_000 });
  // Le panneau reste ouvert sur le mode choisi (paramètres révélés) :
  // on le ferme avant d'ouvrir la note.
  await page.keyboard.press("Escape");
  await page.getByText(/ⓘ Reference/).click();
  await expect(page.getByText(/Funding effort: the amounts each funder awarded/)).toBeVisible();
  // L'avertissement cohorte (verrou R3) et la double conversion, dits.
  await expect(page.getByText(/not annual public expenditure/)).toBeVisible();
  await expect(page.getByText(/never an exact exchange identity/)).toBeVisible();
  await expect(page.getByText(/NY\.GDP\.MKTP\.CD/)).toBeVisible();
});

test("par habitant sur les pays : base auto-écrite, intitulé bénéficiaire", async ({ page }) => {
  await page.goto("/explore?by=country&value=capita");
  await expect(page).toHaveURL(/base=2025/, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: /View funding as/ })).toContainText(
    "Per capita · 2025 EUR",
  );
  await page.getByText(/ⓘ Reference/).click();
  await expect(page.getByText(/Received funding intensity/)).toBeVisible();
  await expect(page.getByText(/SP\.POP\.TOTL/)).toBeVisible();
});

test("refus explicite hors vue à dénominateur résoluble, retour au nominal", async ({ page }) => {
  await page.goto("/explore?by=programme&value=gdp");
  await expect(page.getByText(/need a view with a resolvable economy/)).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Nominal", exact: true }).click();
  await expect(page).not.toHaveURL(/value=/);
});

test("la légende compose : hidden survit, Show all conserve value=gdp", async ({ page }) => {
  await page.goto("/explore?by=country&value=gdp&hidden=DE");
  await expect(page.getByRole("img", { name: /funding · country/ })).toBeVisible({
    timeout: 15_000,
  });
  const legendDe = page.getByRole("button", { name: /Germany/ });
  await expect(legendDe).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Show all" }).click();
  await expect(page).toHaveURL(/value=gdp/);
  await expect(page).not.toHaveURL(/hidden=/);
});

test("FR strict : % du PIB, économie du bénéficiaire", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
  });
  await page.goto("/explore?by=country&value=gdp");
  await expect(page.getByRole("button", { name: /Lire en/ })).toContainText("% du PIB", {
    timeout: 15_000,
  });
  await page.getByText(/ⓘ Référentiel/).click();
  await expect(page.getByText(/Intensité de financement reçu/)).toBeVisible();
  await expect(page.getByText(/Funding effort:/)).toHaveCount(0);
});


test("verrou : l'échantillon des séries est IDENTIQUE à travers tous les modes", async ({
  page,
}) => {
  // « View funding as » change comment on regarde, jamais QUI : le top
  // vient du classement Funding nominal canonique. On lit l'échantillon
  // par l'en-tête du CSV (interface stable), mode par mode.
  await page.addInitScript(() => {
    // Capture du CSV sans téléchargement réel.
    URL.createObjectURL = (blob: Blob) => {
      void blob.text().then((text) => {
        (window as unknown as { __csv?: string }).__csv = text;
      });
      return "blob:capture";
    };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {};
  });

  const seriesSet = async (query: string) => {
    await page.goto(`/explore?${query}`);
    await expect(page.getByRole("img", { name: /funding · country/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "CSV", exact: true }).click();
    await page.waitForFunction(() => (window as unknown as { __csv?: string }).__csv);
    const csv = await page.evaluate(() => {
      const w = window as unknown as { __csv?: string };
      const value = w.__csv;
      w.__csv = undefined;
      return value ?? "";
    });
    return new Set(csv.split("\n")[0].split(",").slice(1));
  };

  const base = "by=country&split=1";
  const nominal = await seriesSet(base);
  expect(nominal.size).toBeGreaterThan(1);
  for (const mode of [
    "value=real&base=2025",
    "value=gdp",
    "value=capita&base=2025",
    "value=index&base=2021",
    "value=growth",
  ]) {
    expect(await seriesSet(`${base}&${mode}`), mode).toEqual(nominal);
  }
});
