import { expect, test } from "@playwright/test";

/** The 5-minute demo journey is the definition of done for phase 2:
 *  search "hydrogen" → filter by country → open a project → jump to a
 *  participating organisation → rebound to its country hub → back to a
 *  filtered search. No dead ends anywhere. */

test.beforeEach(async ({ page }) => {
  // Deterministic language and theme; animations are irrelevant to the flow.
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("home shows the animated hero fed by real data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("European R&D funding intelligence")).toBeVisible();
  // The hero figure settles on a €…B amount once /api/stats lands.
  await expect(page.locator(".hero-gradient")).toContainText(/€\d+B/, { timeout: 10_000 });
  await expect(page.getByText("funded projects")).toBeVisible();
  await expect(page.getByRole("img", { name: "Funding per year" })).toBeVisible();
});

test("the enriched demo journey holds end to end", async ({ page }) => {
  // 1 — search "hydrogen" from the home page.
  await page.goto("/");
  await page.getByRole("searchbox").fill("hydrogen");
  await page.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/\/projects\?q=hydrogen/);
  const resultsHeading = page.getByRole("heading", { level: 1 });
  await expect(resultsHeading).toContainText(/[\d,]+ results/, { timeout: 10_000 });
  const totalBefore = Number(
    (await resultsHeading.innerText()).replace(/[^\d]/g, ""),
  );
  expect(totalBefore).toBeGreaterThan(0);

  // Bilingual promise: highlighted snippets are present.
  await expect(page.locator("article b").first()).toBeVisible();

  // 2 — refine with the FR country facet.
  await page.getByRole("button", { name: /^FR · / }).click();
  await expect(page).toHaveURL(/country=FR/);
  await expect
    .poll(async () => Number((await resultsHeading.innerText()).replace(/[^\d]/g, "")))
    .toBeLessThan(totalBefore);

  // 3 — open the first project.
  await page.locator("article h2 a").first().click();
  await expect(page).toHaveURL(/\/projects\/\d+/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Participants \(\d+\)/)).toBeVisible();

  // 4 — jump to the first participating organisation.
  await page.locator("tbody a").first().click();
  await expect(page).toHaveURL(/\/organisations\/\d+/);
  await expect(page.getByText("Total EU + FR funding")).toBeVisible();
  await expect(page.getByText("Portfolio")).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();

  // 5 — rebound to the organisation's country hub (no dead ends).
  await page.getByRole("link", { name: /^Countries · / }).click();
  await expect(page).toHaveURL(/\/explore\/countries\/[A-Z]{2}/);
  await expect(page.getByText("Top organisations")).toBeVisible();
  await expect(page.getByText("Funding by year")).toBeVisible();

  // 6 — back to a search filtered on that country.
  await page.getByRole("link", { name: /^Search projects from / }).click();
  await expect(page).toHaveURL(/\/projects\?country=[A-Z]{2}/);
  await expect(resultsHeading).toContainText(/[\d,]+ results/);
});

test("language toggle switches the whole interface to French", async ({ page }) => {
  await page.goto("/projects?q=hydrogen");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("results");
  await page.getByRole("button", { name: "Passer en français" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("résultats");
  await expect(page.getByText("recherche en anglais et en français")).toBeVisible();
});

test("a dead link lands on the 404 page, never a blank screen", async ({ page }) => {
  await page.goto("/nowhere/at/all");
  await expect(page.getByText("Page not found")).toBeVisible();
  await page.getByRole("link", { name: "Back to search" }).click();
  await expect(page).toHaveURL(/\/$/);
});
