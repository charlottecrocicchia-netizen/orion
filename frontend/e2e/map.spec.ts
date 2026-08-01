import { expect, test } from "@playwright/test";

/** M3: the Europe choropleth — the geographic entry to the tool. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("the map renders, France is focusable, clicking zooms into its hub", async ({ page }) => {
  await page.goto("/explore/countries");
  const map = page.getByRole("group", { name: /Map of Europe/ });
  await expect(map).toBeVisible({ timeout: 15_000 });

  const france = map.getByRole("link", { name: /^France — €/ });
  await expect(france).toBeVisible();

  await france.click();
  // The cinematic zoom (~450 ms) ends on the country hub.
  await expect(page).toHaveURL(/\/explore\/countries\/FR/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("France");
});

test("keyboard: Enter on a country shape opens its hub too", async ({ page }) => {
  await page.goto("/explore/countries");
  const map = page.getByRole("group", { name: /Map of Europe/ });
  await expect(map).toBeVisible({ timeout: 15_000 });

  await map.getByRole("link", { name: /^Germany — €/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/explore\/countries\/DE/, { timeout: 10_000 });
});
