import { expect, test } from "@playwright/test";

/** E1 — la page /calls et la fiche appel (GO fondatrice 2026-08-22).
 *  Les règles recettées : le statut affiché DÉRIVE des dates (« aucun
 *  appel clos présenté comme ouvert »), le fait source et la lecture
 *  Orion restent séparés, la provenance (source officielle, fraîcheur,
 *  attribution) est à l'écran, l'état vit dans l'URL. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lens.entry", "all");
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("le catalogue groupe par statut dérivé — la deadline passée prime le code source", async ({
  page,
}) => {
  await page.goto("/calls");
  await expect(page.getByRole("heading", { name: "Calls", exact: true })).toBeVisible();

  // Les ouverts de la graine, dans la section « Open ».
  const open = page.getByRole("region", { name: "Open for submission" });
  await expect(open.getByText("TEST-CALL-2026-OPEN-01")).toBeVisible({ timeout: 15_000 });
  await expect(open.getByText("Cryogenic test rigs for the seed corpus")).toBeVisible();
  // Le budget publié s'affiche ; l'absent reste absent.
  await expect(open.getByText("€2M – €4M")).toBeVisible();

  // L'à-venir dit sa date d'ouverture.
  const upcoming = page.getByRole("region", { name: "Upcoming" });
  await expect(upcoming.getByText("TEST-UPCOMING-2026-ZZ-01")).toBeVisible();

  // LE test du chantier : la source dit encore « Open », la date dit
  // clos — le topic est dans « Recently closed », nulle part ailleurs.
  await expect(open.getByText("TEST-CALL-2026-STALE-01")).toHaveCount(0);
  const closed = page.locator("details", { hasText: "Recently closed" });
  await closed.locator("summary").click();
  await expect(closed.getByText("TEST-CALL-2026-STALE-01")).toBeVisible();

  // La provenance de page : fraîcheur + attribution.
  await expect(page.getByText(/Synchronised .* from the EU Funding & Tenders Portal/)).toBeVisible();
  await expect(page.getByText(/© European Union, CC BY 4.0/)).toBeVisible();
});

test("la recherche vit dans l'URL et resserre les groupes", async ({ page }) => {
  await page.goto("/calls");
  await page.getByRole("searchbox").fill("OPEN-01");
  await expect(page).toHaveURL(/q=OPEN-01/);
  const open = page.getByRole("region", { name: "Open for submission" });
  await expect(open.getByText("TEST-CALL-2026-OPEN-01")).toBeVisible({ timeout: 15_000 });
  await expect(open.getByText("TEST-CALL-2026-OPEN-02")).toHaveCount(0);
});

test("la fiche sépare fait source, lecture Orion et provenance", async ({ page }) => {
  await page.goto("/calls?q=OPEN-01");
  await page.getByText("Cryogenic test rigs for the seed corpus").click();
  await expect(page).toHaveURL(/\/calls\/\d+/);

  // Le fait source : dates officielles et heure de Bruxelles dite.
  await expect(page.getByRole("heading", { name: /Cryogenic test rigs/ })).toBeVisible();
  await expect(page.getByText("Brussels time")).toBeVisible();

  // La lecture Orion, bloc distinct, avec la règle qui a mordu.
  const reading = page.getByRole("region", { name: "Orion classification" });
  await expect(reading).toBeVisible();
  await expect(reading.getByText("call:TEST-CALL-")).toBeVisible();

  // La sortie officielle et l'attribution.
  await expect(page.getByRole("link", { name: /View on the official portal/ })).toBeVisible();
  await expect(page.getByText(/© European Union, CC BY 4.0/)).toBeVisible();
});

test("E2 — les acteurs historiques : niveau nommé, preuves cliquables", async ({ page }) => {
  // L'appel OPEN-01 porte le pont exact de la graine (TEST-CALL-2026,
  // trois projets). Le bloc vit dans la colonne — le document officiel
  // reste le centre.
  await page.goto("/calls?q=OPEN-01");
  await page.getByText("Cryogenic test rigs for the seed corpus").click();
  const block = page.getByRole("region", { name: "Historical actors" });
  await expect(block).toBeVisible({ timeout: 15_000 });
  // Le niveau de preuve est NOMMÉ — jamais un rapprochement muet.
  await expect(block.getByText("Exact match on the call code")).toBeVisible();
  // Des compteurs historiques, pas des scores : « N linked projects ».
  await expect(block.getByText(/linked project/).first()).toBeVisible();
  // La preuve est cliquable : le premier acteur ouvre sa fiche.
  await block.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/organisations\/\d+/);
});

test("E3 — la boucle se referme : de l'appel à l'acteur, de l'acteur à l'opportunité", async ({
  page,
}) => {
  // L'acteur historique d'OPEN-01 retrouve, sur SA fiche, ce même appel
  // en « opportunité détectée » (pont exact) — composantes décomposées,
  // jamais un score.
  await page.goto("/calls?q=OPEN-01");
  await page.getByText("Cryogenic test rigs for the seed corpus").click();
  const actors = page.getByRole("region", { name: "Historical actors" });
  await expect(actors).toBeVisible({ timeout: 15_000 });
  await actors.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/organisations\/\d+/);

  const opps = page.getByRole("region", { name: "Detected opportunities" });
  await expect(opps).toBeVisible({ timeout: 15_000 });
  await expect(opps.getByText("TEST-CALL-2026-OPEN-01")).toBeVisible();
  await expect(opps.getByText("Already funded under this call code")).toBeVisible();
  await expect(opps.getByText(/historical project/)).toBeVisible();
  // Le wording reste historique : la promesse d'honnêteté est à l'écran.
  await expect(opps.getByText(/never a guarantee/)).toBeVisible();
});

test("E2 — sans historique comparable : l'état vide honnête, avec sa raison", async ({ page }) => {
  await page.goto("/calls?q=TEST-UPCOMING");
  await page.getByText("Upcoming orbital logistics topic").click();
  const block = page.getByRole("region", { name: "Historical actors" });
  await expect(block).toBeVisible({ timeout: 15_000 });
  await expect(
    block.getByText("Not enough comparable history in the Orion corpus."),
  ).toBeVisible();
  // Et la méthode est à un clic.
  await block.getByText("Method").click();
  await expect(block.getByText(/organisation × projet distinct/)).toBeVisible();
});

test("la lentille cadre le catalogue — et le refus reste le refus", async ({ page }) => {
  // Le tag structurel de la graine : la lentille de test cadre à 1.
  await page.goto("/calls?sector=test-lens");
  const open = page.getByRole("region", { name: "Open for submission" });
  await expect(open.getByText("TEST-CALL-2026-OPEN-01")).toBeVisible({ timeout: 15_000 });
  await expect(open.getByText("TEST-CALL-2026-OPEN-02")).toHaveCount(0);

  // Une lentille inconnue est refusée, jamais repliée en silence.
  await page.goto("/calls?sector=inconnue");
  await expect(
    page.getByRole("heading", { name: "This lens is not available" }),
  ).toBeVisible({ timeout: 15_000 });
});
