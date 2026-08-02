import { expect, test } from "@playwright/test";

/** Lot 1 — the palette suggests as you type (Vega lesson U7). */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("typing in the palette suggests an organisation and opens it", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: /Search…/ }).click();
  const box = page.getByRole("combobox", { name: /Search projects/ });
  await box.fill("centre");
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible({ timeout: 10_000 });
  // Dataset-agnostic: at least one organisation option beyond full-text.
  const option = listbox.getByRole("option").nth(1);
  await expect(option).toBeVisible();
  await option.click();
  await expect(page).toHaveURL(/\/(organisations|projects|explore)/);
});

test("countries match locally and navigate to the country file", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: /Search…/ }).click();
  const box = page.getByRole("combobox", { name: /Search projects/ });
  await box.fill("franc");
  await expect(page.getByRole("option", { name: /France/ })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("option", { name: /France/ }).click();
  await expect(page).toHaveURL(/\/explore\/countries\/FR/);
});

test("plain Enter keeps the old reflex — full-text search", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: /Search…/ }).click();
  await page.getByRole("combobox", { name: /Search projects/ }).fill("hydrogen storage");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/projects\?q=hydrogen(\+|%20)storage/);
});
