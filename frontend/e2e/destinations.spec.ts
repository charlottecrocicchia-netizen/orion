import { expect, test } from "@playwright/test";

/** The shared destination intelligence in the VISIBLE bars (recette
 *  2026-08-03: "I type Safran in the projects bar and there is no
 *  obvious path to the Safran page") — and the dossier fillable from
 *  the rich pages it leads to. Dataset-agnostic: "centre" matches the
 *  seeded corpus' organisations, France is always a country. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
    // Init scripts replay on EVERY navigation — clear the dossier only
    // once per test context, or the collect scenario wipes itself.
    if (!window.sessionStorage.getItem("e2e-dossier-cleared")) {
      window.localStorage.removeItem("orion.dossier.v1");
      window.sessionStorage.setItem("e2e-dossier-cleared", "1");
    }
  });
});

test("la barre des projets propose la fiche organisation en destination", async ({ page }) => {
  await page.goto("/projects");
  const bar = page.getByRole("combobox", { name: /Composez/ });
  await bar.click();
  await bar.fill("centre");
  const listbox = page.locator("#sc-listbox");
  await expect(listbox.getByText("Aller à")).toBeVisible({ timeout: 10_000 });
  const orgOption = listbox.locator("[id^='sc-go-o-']").first();
  await expect(orgOption).toBeVisible();
  await orgOption.click();
  await expect(page).toHaveURL(/\/organisations\/\d+/);
});

test("la demande de l'accueil propose les destinations aussi", async ({ page }) => {
  await page.goto("/");
  const ask = page.getByRole("combobox", { name: /hydrogène par pays/ });
  await ask.click();
  await ask.fill("centre");
  const listbox = page.locator("#home-ask-listbox");
  await expect(listbox).toBeVisible({ timeout: 10_000 });
  const orgOption = listbox.locator("[id^='home-go-o-']").first();
  await expect(orgOption).toBeVisible();
  await orgOption.click();
  await expect(page).toHaveURL(/\/organisations\/\d+/);
});

test("la fiche organisation et la fiche pays se collectent au dossier", async ({ page }) => {
  // Reach a real organisation file through the new destination path.
  await page.goto("/projects");
  const bar = page.getByRole("combobox", { name: /Composez/ });
  await bar.click();
  await bar.fill("centre");
  const orgOption = page.locator("#sc-listbox [id^='sc-go-o-']").first();
  await expect(orgOption).toBeVisible({ timeout: 10_000 });
  await orgOption.click();
  await expect(page).toHaveURL(/\/organisations\/\d+/);
  await page.getByRole("button", { name: /Ajouter au dossier/ }).click();
  await expect(page.getByRole("button", { name: /Ajouté/ })).toBeVisible();

  // The country file offers the same collect.
  await page.goto("/explore/countries/FR");
  await page.getByRole("button", { name: /Ajouter au dossier/ }).click();
  await expect(page.getByRole("button", { name: /Ajouté/ })).toBeVisible();

  // Both views landed as living blocks of the dossier.
  await page.goto("/dossier");
  await expect(page.locator(".dossier-section")).toHaveCount(2);
});
