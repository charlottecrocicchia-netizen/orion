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
  // The library page (site architecture, lot B) is the decks' storefront.
  await page.goto("/analyses");
  await page.getByRole("link", { name: /Where does hydrogen money go/ }).click();
  await expect(page).toHaveURL(/angles=hydrogen/);
  await expect(page.getByRole("region", { name: /angles/i })).toBeVisible();
  await expect(page.getByRole("group", { name: /Angle 1 of 5/ })).toBeVisible();

  // Deck-level presentation: the question as title, the active angle as a
  // read-only sentence — no interactive composer in angles mode.
  await expect(
    page.getByRole("heading", { level: 1, name: /Where does hydrogen money go/ }),
  ).toBeVisible();
  await expect(page.getByText(/« hydrogen »/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Show" })).toHaveCount(0);

  // The next arrow advances the deck and the URL deep-links the angle.
  await page.getByRole("button", { name: "Next angle" }).click();
  await expect(page).toHaveURL(/angle=1/);

  // Handing over to the composer leaves angles mode with the ACTIVE
  // angle's state.
  await page.getByRole("button", { name: /Open in the composer/ }).click();
  await expect(page).toHaveURL(/q=hydrogen/);
  await expect(page).toHaveURL(/view=donut/);
  expect(page.url()).not.toContain("angles=");
  await expect(page.getByRole("button", { name: "Show" })).toBeVisible();
  const donut = page.getByRole("img", { name: /funding · programme/ });
  await expect(donut.locator("path, circle").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByRole("columnheader", { name: "Entry" })).toBeVisible();
});

test("the donut drills into a programme and the URL carries the drill", async ({ page }) => {
  await page.goto("/explore?by=programme&split=0&view=donut&limit=6");
  const donut = page.getByRole("img", { name: /funding · programme/ });
  await expect(donut).toBeVisible({ timeout: 15_000 });
  // The legend rows are the accessible drill controls.
  await page.getByRole("button", { name: /Zoom into/ }).first().click();
  await expect(page).toHaveURL(/programme=\d+/);
  // Either sub-programmes render, or the childless message — both honest;
  // the back affordance always leads out.
  await page.getByRole("button", { name: /^‹ / }).click();
  expect(page.url()).not.toContain("programme=");
});

test("the before/after view names its windows and says who moved", async ({ page }) => {
  await page.goto("/explore?by=theme&split=1&limit=5&view=delta");
  const chart = page.getByRole("img", { name: /funding · theme/ });
  await expect(chart).toBeVisible({ timeout: 15_000 });
  // Window totals legend derived from the data years — a single year when
  // the corpus is short (CI seeds), a range on the full corpus.
  await expect(chart.getByText(/\d{4}/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Before / after" })).toBeVisible();
});

test("the ranks view races the series over time", async ({ page }) => {
  await page.goto("/explore?by=theme&split=1&limit=5&view=bump");
  const chart = page.getByRole("img", { name: /funding · theme/ });
  await expect(chart).toBeVisible({ timeout: 15_000 });
  await expect(chart.locator("polyline").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ranks" })).toBeVisible();
});

test("static bars are never the default — the designed donut leads", async ({ page }) => {
  await page.goto("/explore?by=funder&split=0");
  const chart = page.getByRole("img", { name: /funding · funder/ });
  await expect(chart).toBeVisible({ timeout: 15_000 });
  // The donut draws arcs; bars would render no SVG. Bars stay available
  // as an explicit choice.
  await expect(chart.locator("path, circle").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Bars" })).toBeVisible();
});

test("the theme dimension aggregates euroSciVoc level-2 themes", async ({ page }) => {
  await page.goto("/explore?by=theme&split=0&view=bars");
  const bars = page.getByRole("img", { name: /funding · theme/ });
  await expect(bars).toBeVisible({ timeout: 15_000 });
  await expect(bars.getByText(/electrical engineering/).first()).toBeVisible();
  await expect(page.getByText(/several themes/)).toBeVisible();
});

test("the map view selects first, and only a second click opens the file", async ({ page }) => {
  await page.goto("/explore?by=country&split=0");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  const map = page.getByRole("group", { name: /World map/ });
  await expect(map).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/funding · €/)).toBeVisible();
  const france = map.locator('path[data-code="FR"]');
  await expect(france).toHaveCount(1, { timeout: 15_000 });

  // First click: the country pins — summary bar, no navigation.
  await france.dispatchEvent("click");
  await expect(page.getByRole("link", { name: "Open the country file" })).toBeVisible();
  expect(page.url()).toContain("/explore?");

  // Second click on the selected shape: the cinematic zoom into the file.
  await france.dispatchEvent("click");
  await expect(page).toHaveURL(/\/explore\/countries\/FR/, { timeout: 10_000 });
});
