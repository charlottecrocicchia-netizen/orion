import { expect, test } from "@playwright/test";

/** The Explorer: composed views over real data. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("the default view draws the top-5 countries over time", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("button", { name: "Show" })).toContainText("funding");
  // Five series end-labels drawn in the SVG, France first.
  const chart = page.getByRole("img", { name: /funding · country/ });
  await expect(chart).toBeVisible({ timeout: 15_000 });
  await expect(chart.locator("polyline")).toHaveCount(5);
  await expect(chart.getByText("France")).toBeVisible();
});

test("a story opens the explorer pre-filled, then stays editable", async ({ page }) => {
  await page.goto("/explore");
  await page.getByRole("link", { name: /Where does hydrogen money go/ }).click();
  await expect(page).toHaveURL(/q=hydrogen/);
  await expect(page).toHaveURL(/view=treemap/);
  // The theme chip is removable — the story is a starting point, not a cage.
  await expect(page.getByRole("button", { name: /« hydrogen »/ })).toBeVisible();
  const treemap = page.getByRole("img", { name: /funding · programme/ });
  await expect(treemap.locator("rect").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByRole("columnheader", { name: "Entry" })).toBeVisible();
});

test("dimension switch re-renders as bars with values", async ({ page }) => {
  await page.goto("/explore?by=funder&split=0");
  const bars = page.getByRole("img", { name: /funding · funder/ });
  await expect(bars).toBeVisible({ timeout: 15_000 });
  await expect(bars.getByText(/European Commission/).first()).toBeVisible();
});
