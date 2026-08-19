import { expect, test } from "@playwright/test";

/** Le lot navigation (2026-08-19) : la lentille active se PROPAGE.
 *  L'URL reste la seule vérité — mais tant qu'une vue porte
 *  sector=<slug>, la navigation le transporte. Les sorties du monde
 *  restent explicites, et le site nu est un état de plein droit. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lens.entry", "all");
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("le header transporte la lentille ; le logo ramène à la home cadrée", async ({ page }) => {
  await page.goto("/?sector=aviation");
  await expect(page.getByText("projets aéronautiques", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  // Le menu Analyser → la bibliothèque, cadrée (le motif du spec
  // navigation : scope à la bannière, pas de role menu).
  const banner = page.getByRole("banner");
  await banner.getByRole("button", { name: "Analyse" }).click();
  await banner.getByRole("link", { name: /Analyses prêtes|Ready-made/ }).click();
  await expect(page).toHaveURL(/\/analyses\?sector=aviation/);
  // Le logo ramène à la HOME CADRÉE — la sortie du monde est ailleurs.
  await page.getByRole("link", { name: /Orion — home/ }).click();
  await expect(page).toHaveURL(/\/\?sector=aviation/);
});

test("la bibliothèque cadrée : une seule section, et la porte vers tout", async ({ page }) => {
  await page.goto("/analyses?sector=aviation");
  await expect(page.getByRole("region", { name: "Aéronautique" })).toBeVisible({
    timeout: 15_000,
  });
  // La section spatiale n'y est pas — et les generalistes non plus.
  await expect(page.getByRole("region", { name: "Espace" })).toHaveCount(0);
  // La porte discrète mène à la bibliothèque complète.
  await page.getByRole("link", { name: "Voir toutes les analyses →" }).click();
  await expect(page).toHaveURL(/\/analyses$/);
  await expect(page.getByRole("region", { name: "Espace" })).toBeVisible();
});

test("la recherche transporte ; la sortie chip nettoie ; le site nu reste nu", async ({
  page,
}) => {
  // La recherche depuis la home cadrée : le résultat garde le cadre.
  await page.goto("/?sector=aviation");
  // Le champ vit sous le hero pinné : on l'atteint au clavier de la
  // page, pas au scroll du pin.
  const ask = page.locator("input[aria-label]").first();
  await ask.scrollIntoViewIfNeeded();
  await ask.fill("hydrogen");
  await ask.press("Enter");
  await expect(page).toHaveURL(/sector=aviation/);
  await expect(page).toHaveURL(/q=hydrogen/);

  // La sortie explicite : « Toute la R&D » du chip retire le paramètre
  // et préserve le reste (M1.2, inchangé).
  await page.goto("/explore?sector=aviation&by=country&split=0");
  const chip = page.getByRole("button", { name: /Périmètre aéronautique de cette vue/ });
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await chip.click();
  await page.getByRole("menuitemradio", { name: /Toute la R&D/ }).click();
  await expect(page).not.toHaveURL(/sector=/);
  // Le reste de l'état survit (M1.2) — l'explorer normalise seulement
  // sa valeur par défaut by=country hors de l'URL, comme toujours.
  await expect(page).toHaveURL(/split=0/);

  // Le site nu : aucune lentille par défaut, aucune mémoire — le menu
  // du header ne fabrique JAMAIS un sector spontané.
  await page.goto("/");
  const nakedBanner = page.getByRole("banner");
  await nakedBanner.getByRole("button", { name: "Analyse" }).click();
  await nakedBanner.getByRole("link", { name: /Analyses prêtes|Ready-made/ }).click();
  await expect(page).toHaveURL(/\/analyses$/);
  await expect(page).not.toHaveURL(/sector=/);
});

test("fuite ① colmatée : home Aviation → organisations → fiche → retour, le cadrage survit", async ({
  page,
}) => {
  await page.goto("/?sector=aviation");
  const banner = page.getByRole("banner");
  await banner.getByRole("button", { name: "Découvrir" }).click();
  await banner.getByRole("link", { name: /Organisations/ }).click();
  await expect(page).toHaveURL(/\/organisations\?sector=aviation/);

  // Les onglets de recherche transportent q ET le cadre.
  await page.getByRole("link", { name: /Projets/ }).first().click();
  await expect(page).toHaveURL(/\/projects\?sector=aviation/);
});

test("fuite ② colmatée : deck Aviation → logo → home cadrée Aviation", async ({ page }) => {
  await page.goto("/explore?angles=aviationClean");
  // Le périmètre de l'angle est DÉRIVABLE de l'URL : le header compose
  // ORION / AÉRONAUTIQUE sur le deck même.
  const identity = page.getByRole("link", { name: "Les lentilles", exact: true });
  await expect(identity).toContainText("AÉRONAUTIQUE", { timeout: 15_000 });
  // Et le logo ramène à la HOME CADRÉE, jamais à la home nue.
  await page.getByRole("link", { name: /Orion — home/ }).click();
  await expect(page).toHaveURL(/\/\?sector=aviation/);
  await expect(page.getByText("projets aéronautiques", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
});

test("bug de doctrine : /organisations cadrée montre le monde de la lentille", async ({ page }) => {
  // 2026-08-19 : la page PORTAIT le cadrage sans l'appliquer — l'URL
  // disait aviation, la liste montrait le corpus entier. Une URL qui
  // ment sur son périmètre est l'interdit d'U2.
  // Cadré sur la lentille qui PORTE des projets dans la graine.
  await page.goto("/organisations?sector=space&sort=funding");
  // Le chip de périmètre est là, comme partout.
  await expect(page.getByRole("button", { name: /Périmètre spatial de cette vue/ })).toBeVisible({
    timeout: 15_000,
  });
  // Le compte est celui de la lentille, jamais celui du corpus.
  const framedCount = await page.getByTestId("orgs-total").innerText();
  const framed = Number(framedCount.replace(/\D/g, ""));
  expect(framed).toBeGreaterThan(0);

  // Et une lentille publiée SANS projet tagué dit honnêtement zéro —
  // jamais le corpus entier sous une URL qui annonce l'aéronautique.
  await page.goto("/organisations?sector=aviation&sort=funding");
  await expect(page.getByTestId("orgs-total")).toBeVisible({ timeout: 15_000 });
  const emptyCount = await page.getByTestId("orgs-total").innerText();
  expect(Number(emptyCount.replace(/\D/g, ""))).toBe(0);

  // Le corpus nu reste intact : sans paramètre, rien ne change. On
  // ATTEND la valeur au lieu de la lire une fois — la liste arrive
  // après sa requête.
  await page.goto("/organisations?sort=funding");
  await expect
    .poll(async () =>
      Number((await page.getByTestId("orgs-total").innerText()).replace(/\D/g, "")),
    )
    .toBeGreaterThan(framed);
});
