import { expect, test } from "@playwright/test";

/** The world globe is the default geographic entry; the map switch is a
 *  real button and the flat journeys stay available. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("the globe greets by default and the switch reaches the flat map", async ({ page }) => {
  await page.goto("/explore/countries");
  await expect(page.getByRole("img", { name: /World globe/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Current coverage: EU + France.")).toBeVisible();

  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.getByRole("group", { name: /Map of Europe/ })).toBeVisible();

  // The choice is remembered.
  await page.reload();
  await expect(page.getByRole("group", { name: /Map of Europe/ })).toBeVisible({
    timeout: 15_000,
  });
});
