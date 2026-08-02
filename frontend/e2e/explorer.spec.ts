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

test("a story opens as Angles, slides, and hands over to the composer", async ({ page }) => {
  await page.goto("/explore");
  await page.getByRole("link", { name: /Where does hydrogen money go/ }).click();
  await expect(page).toHaveURL(/angles=hydrogen/);
  await expect(page.getByRole("region", { name: /angles/i })).toBeVisible();
  await expect(page.getByRole("group", { name: /Angle 1 of 5/ })).toBeVisible();

  // The next arrow advances the deck and the URL deep-links the angle.
  await page.getByRole("button", { name: "Next angle" }).click();
  await expect(page).toHaveURL(/angle=1/);

  // The composer mirrors the active angle and stays editable — the story
  // is a starting point, not a cage.
  await expect(page.getByRole("button", { name: /« hydrogen »/ })).toBeVisible();

  // Handing over to the composer leaves angles mode with the slide's state.
  await page
    .getByRole("group", { name: /Angle 2 of 5/ })
    .getByRole("button", { name: /Open in the composer/ })
    .click();
  await expect(page).toHaveURL(/q=hydrogen/);
  await expect(page).toHaveURL(/view=treemap/);
  expect(page.url()).not.toContain("angles=");
  const treemap = page.getByRole("img", { name: /funding · programme/ });
  await expect(treemap.locator("rect").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByRole("columnheader", { name: "Entry" })).toBeVisible();
});

test("the ranks view races the series over time", async ({ page }) => {
  await page.goto("/explore?by=theme&split=1&limit=5&view=bump");
  const chart = page.getByRole("img", { name: /funding · theme/ });
  await expect(chart).toBeVisible({ timeout: 15_000 });
  await expect(chart.locator("polyline").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ranks" })).toBeVisible();
});

test("dimension switch re-renders as bars with values", async ({ page }) => {
  await page.goto("/explore?by=funder&split=0");
  const bars = page.getByRole("img", { name: /funding · funder/ });
  await expect(bars).toBeVisible({ timeout: 15_000 });
  await expect(bars.getByText(/European Commission/).first()).toBeVisible();
});

test("the theme dimension aggregates euroSciVoc level-2 themes", async ({ page }) => {
  await page.goto("/explore?by=theme&split=0");
  const bars = page.getByRole("img", { name: /funding · theme/ });
  await expect(bars).toBeVisible({ timeout: 15_000 });
  await expect(bars.getByText(/electrical engineering/).first()).toBeVisible();
  await expect(page.getByText(/several themes/)).toBeVisible();
});

test("the map view is wired for euro country views", async ({ page }) => {
  await page.goto("/explore?by=country&split=0");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.getByRole("group", { name: /Map of Europe/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/funding · €/)).toBeVisible();
});
