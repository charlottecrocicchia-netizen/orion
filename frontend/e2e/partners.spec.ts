import { expect, test } from "@playwright/test";

/** M2: recurring partners on the organisation hub — the scout's rebound. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("the watch-post shows the thematic profile when themes exist", async ({ page }) => {
  await page.goto("/organisations?q=centre national de la recherche scientifique");
  await page
    .getByRole("link", { name: /^Centre national de la recherche scientifique/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/organisations\/\d+/);
  // Structural: the profile section renders with at least one theme bar
  // when the corpus carries themes (seeded CI does). Signals are
  // threshold-gated by design — never asserted here.
  await expect(page.getByText("Thematic profile")).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText("A project carrying several themes counts in each."),
  ).toBeVisible();
});

test("the organisation hub lists recurring partners and rebounds to one", async ({ page }) => {
  await page.goto("/organisations?q=centre national de la recherche scientifique");
  await page
    .getByRole("link", { name: /^Centre national de la recherche scientifique/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/organisations\/\d+/);
  const hubUrl = page.url();

  // Structural assertions — dataset-agnostic: the section renders, every
  // partner row carries its shared-project count, and clicking one lands on
  // that partner's own hub with its own partners section. No dead ends.
  await expect(page.getByRole("heading", { name: "Where its partners live" })).toBeVisible({ timeout: 10_000 });
  const partner = page.getByRole("link", { name: /shared projects?/ }).first();
  await expect(partner).toBeVisible();

  await partner.click();
  await expect(page).toHaveURL(/\/organisations\/\d+/);
  expect(page.url()).not.toBe(hubUrl);
  await expect(page.getByRole("heading", { name: "Where its partners live" })).toBeVisible({ timeout: 10_000 });
});
