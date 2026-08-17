import { expect, test } from "@playwright/test";

/** La fiche groupe (recette fondatrice, 2026-08-04) — la couche
 *  identité devient une surface produit. Deux exigences se testent :
 *  taper le nom d'un groupe le fait remonter EN TÊTE avec son badge
 *  distinctif, partout ; et sa fiche consolide honnêtement — un projet
 *  co-signé par deux entités compte UNE fois (SKYFORGE : 1 projet,
 *  8 M€, jamais 2). */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("le groupe ressort en tête des destinations, badge au revers", async ({ page }) => {
  await page.goto("/projects");
  const bar = page.getByRole("combobox", { name: /Composez/ });
  await bar.click();
  await bar.fill("aerostellar");

  const listbox = page.locator("#sc-listbox");
  await expect(listbox.getByText("Aller à")).toBeVisible({ timeout: 10_000 });
  // La première destination est le GROUPE — avant les organisations
  // homonymes — et porte le badge.
  const first = listbox.locator("[id^='sc-go-']").first();
  await expect(first).toHaveAttribute("id", /^sc-go-g-/);
  await expect(first.getByText("Groupe", { exact: true })).toBeVisible();
  await expect(first).toContainText(/aerostellar group/i);

  await first.click();
  await expect(page).toHaveURL(/\/groups\/\d+/);
});

test("la demande de l'accueil propose le groupe aussi, badge compris", async ({ page }) => {
  await page.goto("/");
  const ask = page.getByRole("combobox", { name: /observation de la Terre/ });
  await ask.click();
  await ask.fill("aerostellar");

  const listbox = page.locator("#home-ask-listbox");
  await expect(listbox).toBeVisible({ timeout: 10_000 });
  const groupOption = listbox.locator("[id^='home-go-g-']").first();
  await expect(groupOption).toBeVisible();
  await expect(groupOption.getByText("Groupe", { exact: true })).toBeVisible();
});

test("la fiche consolide : un projet co-signé compte une fois, la carte et les parts disent vrai", async ({
  page,
}) => {
  await page.goto("/projects");
  const bar = page.getByRole("combobox", { name: /Composez/ });
  await bar.click();
  await bar.fill("aerostellar");
  const groupOption = page.locator("#sc-listbox [id^='sc-go-g-']").first();
  await expect(groupOption).toBeVisible({ timeout: 10_000 });
  await groupOption.click();
  await expect(page).toHaveURL(/\/groups\/\d+/);

  // L'en-tête : badge, compte d'entités, LEI.
  await expect(page.getByRole("heading", { name: /aerostellar group/i })).toBeVisible();
  await expect(page.getByText("Groupe de 2 entités légales")).toBeVisible();

  // Le consolidé : SKYFORGE est co-signé par les deux entités —
  // 1 projet distinct, 8 M€, jamais 2 projets.
  await expect(page.locator(".font-display.tnum").first()).toHaveText("€8M");
  const act1 = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Le groupe d’un seul tenant" }),
  });
  await expect(act1.getByText("projets distincts")).toBeVisible();
  await expect(
    act1.locator("span", { hasText: /^1$/ }).first(),
  ).toBeVisible();

  // L'acte 02 : la carte du monde des entités (la règle gravée vaut ici
  // aussi — les pays du groupe sont vivants), et les parts sur le total.
  await expect(page.getByRole("heading", { name: "Où vit le groupe" })).toBeVisible();
  const act2 = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Où vit le groupe" }),
  });
  await expect(act2.locator("path[data-code='FR']")).toHaveCount(1, { timeout: 10_000 });
  await expect(act2.locator("path[data-code='DE']")).toHaveCount(1);

  const entities = act2.getByRole("listitem");
  await expect(entities).toHaveCount(2);
  await expect(entities.first()).toContainText(/aerostellar sa/i);
  await expect(entities.first()).toContainText("62,5 % du groupe");
  await expect(entities.nth(1)).toContainText("37,5 % du groupe");

  // Filtrer par la carte : cliquer l'Allemagne réduit la liste à
  // l'entité allemande (première activation = explorer, la règle).
  await act2
    .locator("path[data-code='DE']")
    .dispatchEvent("click");
  await expect(act2.getByRole("listitem")).toHaveCount(1);
  await expect(act2.getByRole("listitem").first()).toContainText(/avionics/i);

  // Le sélecteur de régions ramène tout le monde.
  await act2.getByRole("button", { name: "Toutes régions" }).click();
  await expect(act2.getByRole("listitem")).toHaveCount(2);

  // Chaque entité relie à sa fiche organisation canonique.
  await act2.getByRole("link", { name: /aerostellar sa/i }).click();
  await expect(page).toHaveURL(/\/organisations\/\d+/);
});

test("la fiche avoue son périmètre et déroule ses actes de deck", async ({ page }) => {
  await page.goto("/projects");
  const bar = page.getByRole("combobox", { name: /Composez/ });
  await bar.click();
  await bar.fill("aerostellar");
  const groupOption = page.locator("#sc-listbox [id^='sc-go-g-']").first();
  await expect(groupOption).toBeVisible({ timeout: 10_000 });
  await groupOption.click();
  await expect(page).toHaveURL(/\/groups\/\d+/);

  // Le bouton dossier (aspérité du mémo, corrigée le 2026-08-17) : la
  // fiche groupe collectionne sa vue vivante comme les six autres
  // surfaces — le toggle de la recette du 2026-08-04 vaut ici aussi.
  await expect(page.getByRole("button", { name: /Ajouter au dossier/ })).toBeVisible();

  // La note d'honnêteté : AEROSTELLAR GROUP SERVICES BV porte le nom du
  // groupe sans y être rattachée — la fiche le dit, pesé.
  const note = page.getByText(/pas encore rattachée/);
  await expect(note).toBeVisible();
  await expect(note).toContainText("€400k");
  await expect(note).toContainText("jamais le groupe entier");

  // Acte 03 — les partenaires : MIT co-signe SKYFORGE sans être du
  // groupe ; les entités internes ne sont jamais des partenaires.
  const act3 = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Avec qui le groupe travaille" }),
  });
  await expect(act3.getByRole("link", { name: /massachusetts/i })).toBeVisible();
  await expect(act3.getByText("1 projet partagé")).toBeVisible();
  await expect(act3.getByRole("link", { name: /aerostellar/i })).toHaveCount(0);

  // Acte 04 — le poste de veille consolidé, profil thématique en tête.
  const act4 = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Le poste de veille consolidé" }),
  });
  await expect(act4).toBeVisible();
  await expect(act4.getByText(/Alimenté par 1 source/)).toBeVisible();

  // La porte du benchmark : ce groupe, comparé EN TANT QUE groupe.
  await page.getByRole("link", { name: /Comparer ce groupe/ }).click();
  await expect(page).toHaveURL(/\/compare\?orgs=g\d+/);
});

test("le benchmark compare un groupe à une organisation, badge au revers", async ({ page }) => {
  await page.goto("/compare");
  const picker = page.getByRole("textbox", { name: /Ajouter/ });
  await picker.fill("aerostellar");
  const groupOption = page.getByRole("option", { name: /aerostellar group.*Groupe/i }).first();
  await expect(groupOption).toBeVisible({ timeout: 10_000 });
  await groupOption.click();
  await expect(page).toHaveURL(/orgs=g\d+/);

  // La colonne du groupe : badge, compte d'entités, total consolidé.
  const table = page.locator("table");
  await expect(table.getByText("Groupe", { exact: true })).toBeVisible();
  await expect(table.getByText("2 entités légales")).toBeVisible();

  await picker.fill("centre");
  const orgOption = page.getByRole("option", { name: /centre/i }).first();
  await expect(orgOption).toBeVisible({ timeout: 10_000 });
  await orgOption.click();
  await expect(table.locator("th").filter({ has: page.getByRole("link") })).toHaveCount(2);

  // L'écran d'analyse composable (recette 2026-08-05) : la trajectoire
  // par défaut avec son écart à deux entités, COLLECTABLE — le parcours
  // complet jusqu'au dossier, groupe compris (le bug de la recette).
  await expect(page.getByText(/Écart par année/)).toBeVisible({ timeout: 10_000 });
  await page
    .getByRole("button", { name: /Ajouter au dossier/ })
    .click();
  await expect(page.getByRole("button", { name: /Au dossier/ }).first()).toBeVisible();

  // Une composition côte à côte : par programme, deux vues jumelles,
  // ajoutées d'un clic.
  await page.getByRole("button", { name: "Par programme" }).click();
  await expect(page).toHaveURL(/cby=programme/);
  const twin = page.getByRole("button", { name: /Ajouter les 2 vues au dossier/ });
  await expect(twin).toBeVisible();
  await expect(page.getByText(/programme — Aerostellar group/i).first()).toBeVisible({
    timeout: 10_000,
  });
  await twin.click();
  await expect(page.getByRole("button", { name: /Au dossier · retirer/ })).toBeVisible();

  // Le dossier rend les trois blocs — la trajectoire du benchmark de
  // groupes comprise (compare=g…, le chemin qui manquait).
  await page.goto("/dossier");
  await expect(page.locator(".dossier-section")).toHaveCount(3);
  await expect(page.getByText(/Trajectoires — /).first()).toBeVisible();
  await expect(
    page.locator(".dossier-section").first().locator("polyline").first(),
  ).toBeAttached({ timeout: 10_000 });

  // Les actes non composables restent : partenaires communs honnêtement
  // vides, géographie du groupe.
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Partenaires communs" })).toBeVisible();
  await expect(page.getByText("Aucun partenaire commun dans le corpus.")).toBeVisible();
  const geo = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Géographie face à face" }),
  });
  await expect(geo).toBeVisible();
  await expect(geo.locator("path[data-code='FR']")).toHaveCount(1, { timeout: 10_000 });
});

test("la recherche des pages remonte les groupes en tête, badge au revers", async ({ page }) => {
  // Recette 2026-08-05 : « airbus leonardo » sur /organisations rendait
  // 35 entités éparses et AUCUN groupe — la règle du moment Safran vaut
  // partout.
  await page.goto("/organisations?q=aerostellar");
  const band = page.locator("article").filter({ has: page.getByText("Groupe", { exact: true }) });
  await expect(band.first()).toBeVisible({ timeout: 10_000 });
  await expect(band.first()).toContainText(/aerostellar group/i);
  await expect(band.first()).toContainText("2 entités légales");
  await expect(band.first()).toContainText("€8M");
  // Le bloc mène à la fiche groupe.
  await band.first().getByRole("link").click();
  await expect(page).toHaveURL(/\/groups\/\d+/);
});
