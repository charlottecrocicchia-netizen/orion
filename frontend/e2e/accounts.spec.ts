import { expect, test } from "@playwright/test";

/** Le socle comptes (lot 1) : le parcours complet en mode dev — le lien
 *  magique s'affiche dans la page au lieu de partir par email
 *  (ORION_AUTH_DEV=1 dans le .env de la pile locale).
 *
 *  Huit adresses e2e sont approuvées dans l'allowlist locale ; le spec
 *  tourne sur celle de la minute courante : le cooldown de 60 s par
 *  email ne mord jamais deux exécutions rapprochées. */

const EMAILS = "abcdefgh".split("").map((letter) => `e2e-${letter}@lensorion.test`);
const EMAIL = EMAILS[new Date().getMinutes() % EMAILS.length];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
    window.localStorage.setItem("orion.lens.entry", "all");
    window.localStorage.removeItem("orion.dossier.v1");
  });
});

test("login → keep a dossier → survive a localStorage purge → resume → logout", async ({
  page,
}) => {
  // — Se connecter : la porte, le lien dev, la confirmation (verrou 2).
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByRole("button", { name: /Send me a link/ }).click();
  await expect(page.getByText(/a sign-in link is on its way/)).toBeVisible();

  const devLink = page.getByRole("link", { name: /Dev mode: open the link/ });
  await expect(devLink).toBeVisible();
  await devLink.click();

  // La consommation n'est jamais invisible : l'adresse masquée d'abord.
  await expect(page.getByText(/You are about to sign in as/)).toBeVisible();
  await expect(page.getByText(/e••••@lensorion\.test/)).toBeVisible();
  // Verrou 1 : le fragment a déjà quitté la barre d'adresse.
  expect(page.url()).not.toContain("token=");
  await page.getByRole("button", { name: /^Sign in/ }).click();

  // Connecté : l'initiale au header.
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();

  // — Collecter une vue puis la GARDER.
  await page.goto("/explore?by=funder&split=0");
  await page.getByRole("button", { name: "+ Add to dossier" }).click();
  await page.getByRole("link", { name: /Dossier · 1/ }).click();
  await page.getByRole("button", { name: "Keep in my space" }).click();
  await expect(page.getByText(/Kept in your space/)).toBeVisible();

  // — Purger le localStorage : la session (cookie) et le dossier gardé
  //   (serveur) survivent — c'est toute la capacité du lot.
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: EMAIL })).toBeVisible();
  const saved = page.getByRole("link", { name: /Funding by funder|Dossier —/ }).first();
  await expect(saved).toBeVisible();

  // — Ouvrir le dossier gardé, le reprendre comme nouvelle version.
  await saved.click();
  await expect(page).toHaveURL(/\/workspace\/dossiers\/\d+/);
  await expect(page.getByRole("button", { name: /Resume as a new version/ })).toBeVisible();
  await page.getByRole("button", { name: /Resume as a new version/ }).click();
  await expect(page).toHaveURL(/\/dossier/);
  await expect(page.getByRole("button", { name: "Keep in my space" })).toBeVisible();

  // — Se déconnecter : l'entrée sobre revient.
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  // — Ménage : le compte e2e s'efface derrière lui (comptes jetables).
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByRole("button", { name: /Send me a link/ }).click();
  const relink = page.getByRole("link", { name: /Dev mode: open the link/ });
  if (await relink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await relink.click();
    await page.getByRole("button", { name: /^Sign in/ }).click();
    await page.goto("/workspace");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page).toHaveURL(/\/$/);
  }
});

test("anonymous surfaces are untouched — one sober entry, no walls", async ({ page }) => {
  await page.goto("/");
  // La seule trace du compte : « Se connecter » au header. Ni bannière,
  // ni modal, ni compteur (D4).
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await page.goto("/dossier");
  // Le bandeau du dossier dit la vérité au point d'usage.
  await expect(page.getByText(/Nothing collected yet/)).toBeVisible();
});
