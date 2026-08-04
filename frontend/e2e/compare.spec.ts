import { expect, test } from "@playwright/test";

/** M4: the organisation benchmark — hub CTA, picker, side-by-side columns. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("compare two organisations from the hub CTA", async ({ page }) => {
  await page.goto("/organisations?q=centre national de la recherche scientifique");
  await page
    .getByRole("link", { name: /^Centre national de la recherche scientifique/i })
    .first()
    .click();
  await page.getByRole("link", { name: "Compare" }).click();
  await expect(page).toHaveURL(/\/compare\?orgs=\d+/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Compare organisations");

  // One column already there, with its KPIs.
  await expect(page.getByText("Total public R&D funding")).toBeVisible({ timeout: 10_000 });

  // Add a second organisation through the picker.
  await page.getByLabel("Add a group or an organisation").fill("fraunhofer");
  await page.getByRole("option", { name: /Fraunhofer/i }).first().click();
  await expect(page).toHaveURL(/orgs=\d+(?:~|%7E)\d+/);

  // Two columns, the compared chart, per-column themes and partners.
  await expect(page.getByRole("link", { name: /Fraunhofer/i }).first()).toBeVisible({
    timeout: 10_000,
  });
  const chart = page.getByRole("img", { name: "Funding by year, compared" });
  await expect(chart).toBeVisible();
  await expect(chart.locator("polyline")).toHaveCount(2);
  expect(await page.getByText("Top themes").count()).toBe(2);

  // Removing one column narrows the URL back to a single id.
  await page.getByRole("button", { name: /^Remove / }).first().click();
  await expect(page).toHaveURL(/orgs=\d+$/);
});
