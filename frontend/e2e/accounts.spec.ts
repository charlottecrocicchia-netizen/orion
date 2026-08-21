import { expect, test } from "@playwright/test";

/** Le socle comptes + la frontière d'accès (pivot 2026-08-22 : Orion
 *  est une application privée derrière une landing publique).
 *
 *  Ce fichier repart ANONYME (storageState vide) : c'est la frontière
 *  elle-même qu'il teste — le reste de la suite navigue connecté via
 *  auth.setup. Huit adresses e2e approuvées, choisie par la minute :
 *  le cooldown de 60 s par email ne mord pas les runs rapprochés. */

test.use({ storageState: { cookies: [], origins: [] } });

const EMAILS = "abcdefgh".split("").map((letter) => `e2e-${letter}@lensorion.test`);
// Décalée d'une position par rapport à auth.setup (même minute) pour ne
// pas partager le cooldown avec la session de la suite.
const EMAIL = EMAILS[(new Date().getMinutes() + 1) % EMAILS.length];

/** Demande un lien en essayant les adresses jusqu'à en obtenir un —
 *  des runs rapprochés partagent les cooldowns de 60 s par email. */
async function requestDevLink(page: import("@playwright/test").Page): Promise<string> {
  const start = EMAILS.indexOf(EMAIL);
  for (let step = 0; step < EMAILS.length; step += 1) {
    const candidate = EMAILS[(start + step) % EMAILS.length];
    await page.getByLabel("Email").fill(candidate);
    await page.getByRole("button", { name: /Send me a link/ }).click();
    const link = page.getByRole("link", { name: /Dev mode: open the link/ });
    // waitFor, pas isVisible : isVisible() répond IMMÉDIATEMENT (son
    // timeout est ignoré) et brûlait les 8 adresses en 3 secondes.
    const appeared = await link
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) return candidate;
    await page.reload();
  }
  throw new Error("aucun dev_link sur les 8 adresses e2e");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
    window.localStorage.setItem("orion.lens.entry", "all");
    // NE PAS purger orion.login.from ici : l'initScript rejoue à CHAQUE
    // navigation et effacerait la destination pendant le parcours même
    // qu'on teste (constaté à la première exécution).
    window.localStorage.removeItem("orion.dossier.v1");
  });
});

test("anonyme : la landing, et RIEN d'autre — vues et API refusées", async ({ page }) => {
  // La racine est une vraie page publique de présentation.
  await page.goto("/");
  await expect(page.getByText(/of public R&D funding, mapped/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Sign in/ }).first()).toBeVisible();
  // Le header ne promet aucune application : pas d'intentions, pas de ⌘K.
  await expect(page.getByRole("button", { name: "Discover" })).toHaveCount(0);

  // Chaque vue applicative renvoie au login, l'URL demandée conservée.
  for (const route of ["/projects", "/organisations", "/explore", "/compare", "/workspace", "/lenses", "/dossier"]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/login\\?from=${encodeURIComponent(route).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }

  // L'API elle-même refuse — la sécurité ne dépend pas d'un écran caché.
  for (const api of ["/api/stats", "/api/search/projects?q=space", "/api/organisations/1", "/api/sources"]) {
    const res = await page.request.get(api);
    expect(res.status(), api).toBe(401);
  }
  // La liste publique, elle, répond.
  expect((await page.request.get("/api/health")).status()).toBe(200);
  expect((await page.request.get("/api/public/overview")).status()).toBe(200);
});

test("deep link → login → retour à l'URL demandée → tout Orion s'ouvre", async ({ page }) => {
  // Le parcours est long (deux connexions complètes + le ménage) : il
  // mérite le triple du budget standard.
  test.slow();
  // — L'URL profonde voulue, demandée sans session.
  await page.goto("/explore?by=funder&split=0");
  await expect(page).toHaveURL(/\/login\?from=/);

  // — Connexion par lien magique (mode dev : le lien s'affiche).
  const used = await requestDevLink(page);
  await page.getByRole("link", { name: /Dev mode: open the link/ }).click();
  await expect(page.getByText(/e••••@lensorion\.test/)).toBeVisible();
  expect(page.url()).not.toContain("token=");
  await page.getByRole("button", { name: /^Sign in/ }).click();

  // — Le retour EXACT sur l'URL initialement demandée.
  await expect(page).toHaveURL(/\/explore\?by=funder&split=0/);

  // — L'application entière répond : collecter, garder, survivre à la
  //   purge du navigateur, reprendre.
  await page.getByRole("button", { name: "+ Add to dossier" }).click();
  await page.getByRole("link", { name: /Dossier · 1/ }).click();
  await page.getByRole("button", { name: "Keep in my space" }).click();
  await expect(page.getByText(/Kept in your space/)).toBeVisible();
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: used })).toBeVisible();
  const saved = page.getByRole("link", { name: /Dossier —/ }).first();
  await expect(saved).toBeVisible();
  await saved.click();
  await page.getByRole("button", { name: /Resume as a new version/ }).click();
  await expect(page).toHaveURL(/\/dossier/);

  // — Déconnexion : retour à la landing, et le Back ne rouvre rien.
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByText(/of public R&D funding, mapped/)).toBeVisible();
  await page.goto("/explore");
  await expect(page).toHaveURL(/\/login\?from=/);
  expect((await page.request.get("/api/stats")).status()).toBe(401);

  // — Ménage (au mieux : les cooldowns peuvent l'empêcher — comptes e2e
  //   jetables de la pile locale, sans conséquence).
  try {
    await requestDevLink(page);
    await page.getByRole("link", { name: /Dev mode: open the link/ }).click();
    await page.getByRole("button", { name: /^Sign in/ }).click();
    // La redirection post-connexion (retour au deep link) doit ATTERRIR
    // avant le goto — sinon elle gagne la course et emporte la page.
    await page.waitForURL(/\/explore/);
    await page.goto("/workspace");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page.getByText(/of public R&D funding, mapped/)).toBeVisible();
  } catch {
    // rien — le prochain run réutilisera les comptes existants
  }
});
