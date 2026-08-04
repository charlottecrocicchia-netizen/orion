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
  const ask = page.getByRole("combobox", { name: /hydrogène par pays/ });
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
  await expect(page.getByText("€8M", { exact: true })).toBeVisible();
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
