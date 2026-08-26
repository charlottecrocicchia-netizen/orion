import { expect, test } from "@playwright/test";

/** R5B — la surface dédiée « Share of NSF award obligations ».
 *
 *  Le contrat recetté (R5A § 19/§ 20.1) : métrique indépendante, axe
 *  `fy=` propre à la surface (jamais `time=`), sélecteur qui n'offre
 *  QUE les FY disponibles du /meta, parts en % du total officiel qui ne
 *  bouclent jamais à 100 %, couverture toujours affichée, refus nommés
 *  — un FY indisponible se dit INDISPONIBLE, jamais zéro.
 *
 *  Graine (seed_e2e, vintage 2026-08-26) : FY2022 official 1 000 000 $
 *  dont 990 000 joignables (coverage 0,99), FY2023 official 1 500 000 $
 *  tout joignable (coverage 1,0), FY2019 FERMÉ (coverage 0 →
 *  indisponible). Divisions : Ocean Sciences et Polar Programs. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Le choix d'entrée est déjà fait : sans lui, le voile de la home
    // intercepte les clics du header (même réglage que navigation.spec).
    window.localStorage.setItem("orion.lens.entry", "all");
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("la navigation mène à la surface et la métrique est nommée", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("banner");
  await banner.getByRole("button", { name: "Analyse" }).click();
  await banner.getByRole("link", { name: /NSF award obligations/ }).click();
  await expect(page).toHaveURL(/\/nsf-obligations/);
  await expect(
    page.getByRole("heading", { name: "Share of NSF award obligations" }),
  ).toBeVisible({ timeout: 15_000 });
});

test("défauts : dernier FY disponible, vue par division, parts du total officiel", async ({
  page,
}) => {
  await page.goto("/nsf-obligations");
  await expect(
    page.getByRole("heading", { name: "Share of NSF award obligations" }),
  ).toBeVisible({ timeout: 15_000 });

  // Le dernier FY disponible (2023) — libellé « FY 2023 », jamais nu.
  await expect(page.getByText("FY 2023").first()).toBeVisible();

  // La vue par division : montants et parts en % du total officiel.
  await expect(page.getByText("Geosciences — Ocean Sciences")).toBeVisible();
  await expect(page.getByText("Geosciences — Polar Programs")).toBeVisible();
  await expect(page.getByRole("cell", { name: "60 %" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "40 %" })).toBeVisible();

  // La provenance : la source officielle et son millésime.
  await expect(
    page.getByText(/Source: NSF by the Numbers \(@Award Details Sheet\)/).first(),
  ).toBeVisible();
  await expect(page.getByText(/2026-08-26/).first()).toBeVisible();
});

test("le sélecteur de FY n'offre jamais le FY fermé (2019)", async ({ page }) => {
  await page.goto("/nsf-obligations");
  await expect(
    page.getByRole("button", { name: "First fiscal year" }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "First fiscal year" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitemradio", { name: "FY 2022" })).toBeVisible();
  await expect(menu.getByRole("menuitemradio", { name: "FY 2023" })).toBeVisible();
  // 2019 est fermé (coverage 0) : il n'est JAMAIS proposé — la doctrine
  // interdit d'offrir un choix qui finirait en 422.
  await expect(menu.getByRole("menuitemradio", { name: "FY 2019" })).toHaveCount(0);
});

test("la plage s'écrit fy=2022..2023 et la couverture s'affiche, jamais renormalisée", async ({
  page,
}) => {
  await page.goto("/nsf-obligations");
  await expect(
    page.getByRole("button", { name: "First fiscal year" }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "First fiscal year" }).click();
  await page.getByRole("menu").getByRole("menuitemradio", { name: "FY 2022" }).click();

  // L'URL porte la grammaire propre de la surface — fy=, jamais time=.
  await expect(page).toHaveURL(/fy=2022\.\.2023/);
  await expect(page).not.toHaveURL(/time=/);

  // La couverture de la période : 2 490 000 / 2 500 000 = 99,6 % — et le
  // non joignable est dit, jamais masqué.
  await expect(
    page.getByText(/99.6 % of the official total is joinable/).first(),
  ).toBeVisible();
  await expect(page.getByText(/\$10k is not joinable/).first()).toBeVisible();

  // Le Top par les obligations elles-mêmes : Ocean Sciences (1,51 M$,
  // 60,4 %) devant Polar Programs (990 k$, 39,6 %).
  await expect(page.getByRole("cell", { name: "60.4 %" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "39.6 %" })).toBeVisible();
});

test("l'URL profonde est rejouable — la même vue au rechargement", async ({ page }) => {
  await page.goto("/nsf-obligations?fy=2022..2023&by=organisation");
  await expect(
    page.getByText("Massachusetts Institute of Technology"),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("FY 2022 – FY 2023").first()).toBeVisible();

  await page.reload();
  await expect(
    page.getByText("Massachusetts Institute of Technology"),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/fy=2022\.\.2023/);
  await expect(page).toHaveURL(/by=organisation/);
});

test("la vue par exercice est une série, pas un ratio unique", async ({ page }) => {
  await page.goto("/nsf-obligations?fy=2022..2023&by=fy");
  // Chaque exercice porte SA ligne : official, joignable, couverture.
  await expect(page.getByRole("cell", { name: "FY 2022" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("cell", { name: "FY 2023" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "99 %" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "100 %" })).toBeVisible();
});

test("FR : la métrique porte son nom français gelé", async ({ page }) => {
  await page.goto("/nsf-obligations");
  await expect(
    page.getByRole("heading", { name: "Share of NSF award obligations" }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Passer en français" }).click();
  await expect(
    page.getByRole("heading", { name: "Part des obligations annuelles d'awards NSF" }),
  ).toBeVisible();
  await expect(
    page.getByText(/millésime de référence Orion 2026-08-26/).first(),
  ).toBeVisible();
});

test("un FY forcé indisponible se dit INDISPONIBLE — jamais un zéro", async ({
  page,
}) => {
  await page.goto("/nsf-obligations?fy=2031");
  await expect(page.getByText(/FY 2031 is unavailable/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/Unavailable is not zero/)).toBeVisible();
  // Aucun chiffre de repli : ni dénominateur ni part à zéro.
  await expect(page.getByText("$0", { exact: true })).toHaveCount(0);
  await expect(page.getByText("0 %", { exact: true })).toHaveCount(0);
});

test("lens= n'a pas cours ici : l'URL forcée est canonicalisée", async ({
  page,
}) => {
  // La lentille n'a aucun effet sur la surface R5 : la doctrine D10
  // (l'URL canonique fait foi) la retire — jamais l'apparence d'un
  // effet. Le reste de l'état (fy=) survit intact.
  await page.goto("/nsf-obligations?fy=2022&lens=test-lens");
  await expect(page).toHaveURL(/\/nsf-obligations\?fy=2022$/, {
    timeout: 15_000,
  });
  await expect(page.getByText("FY 2022").first()).toBeVisible();
});

test("non-régression : l'Explorateur répond toujours", async ({ page }) => {
  await page.goto("/explore");
  await expect(
    page.getByRole("button", { name: /View funding as/ }),
  ).toBeVisible({ timeout: 15_000 });
});
