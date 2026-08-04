import { expect, test } from "@playwright/test";

/** The world globe is the default geographic entry; the map switch is a
 *  real button and the flat journeys stay available. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("the act-3 globe opens the country panel and Escape closes it", async ({ page }) => {
  await page.goto("/");
  // The globe lives in act 3 and SPINS continuously.
  const france = page.locator("path[data-code=FR]");
  await france.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  // The globe now keeps turning (recette 2026-08-02) and pauses on
  // hover/FOCUS — focusing France pauses it deterministically, then
  // Enter selects (the keyboard path shares the click path).
  await france.focus();
  await page.waitForTimeout(150);
  await page.keyboard.press("Enter");
  const panel = page.getByRole("complementary", { name: "France" });
  await expect(panel).toBeVisible({ timeout: 10_000 });
  // Dataset-agnostic: the essentials and the one full CTA are there.
  await expect(panel.getByRole("link", { name: /Open the France file/ })).toBeVisible();
  await expect(panel.getByText("What it funds first")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
});

test("the globe greets by default and the switch reaches the flat map", async ({ page }) => {
  await page.goto("/explore/countries");
  await expect(page.getByRole("img", { name: /World globe/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/^Current coverage:/)).toBeVisible();

  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.getByRole("group", { name: /World map/ })).toBeVisible();

  // The choice is remembered.
  await page.reload();
  await expect(page.getByRole("group", { name: /World map/ })).toBeVisible({
    timeout: 15_000,
  });
});
