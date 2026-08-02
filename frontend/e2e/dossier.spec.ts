import { expect, test } from "@playwright/test";

/** The dossier (lot 4): collect a view → the header counter appears →
 *  the assembly page renders the LIVING view with its provenance line →
 *  annotate, then remove back to the empty state. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
    window.localStorage.removeItem("orion.dossier.v1");
  });
});

test("collect, assemble, annotate, remove", async ({ page }) => {
  await page.goto("/explore?by=funder&split=0");
  await expect(page.getByRole("img", { name: /funding · funder/ })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "+ Add to dossier" }).click();
  await expect(page.getByRole("button", { name: "Added ✓" })).toBeVisible();

  // The discreet counter appears in the header and opens the dossier.
  const counter = page.getByRole("link", { name: /Dossier · 1/ });
  await expect(counter).toBeVisible();
  await counter.click();
  await expect(page).toHaveURL(/\/dossier/);

  // The block renders the LIVING view with its provenance line and the
  // one take-away CTA.
  await expect(page.getByRole("img", { name: /funding · funder/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/data as of \d{4}-\d{2}-\d{2}/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Take away/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open the living view/ })).toBeVisible();

  // Annotate: the margin voice.
  await page.getByRole("button", { name: "＋ Annotate" }).click();
  await page.getByLabel("Annotate").fill("The funders, compared before the meeting.");
  await page.getByLabel("Annotate").blur();
  await expect(page.getByText("The funders, compared before the meeting.")).toBeVisible();

  // Remove → back to the empty state; the header counter disappears.
  await page.getByRole("button", { name: "− Remove" }).click();
  await expect(page.getByText("Nothing collected yet")).toBeVisible();
  await expect(page.getByRole("link", { name: /Dossier ·/ })).toHaveCount(0);
});

test("the same view never stacks up twice", async ({ page }) => {
  await page.goto("/explore?by=funder&split=0");
  const add = page.getByRole("button", { name: "+ Add to dossier" });
  await expect(add).toBeVisible({ timeout: 15_000 });
  await add.click();
  await expect(page.getByRole("button", { name: "Added ✓" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Add to dossier" })).toBeVisible();
  await page.getByRole("button", { name: "+ Add to dossier" }).click();
  await expect(page.getByRole("link", { name: /Dossier · 1/ })).toBeVisible();
});
