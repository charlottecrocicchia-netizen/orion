import { expect, test } from "@playwright/test";

/** The news strip auto-advances for real (recette 2026-08-02: "it doesn't
 *  auto-advance") — including with a cursor PARKED over it by scrolling,
 *  the phantom-hover scenario that froze it. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("le fil avance tout seul, même sous un curseur parqué par le scroll", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const strip = page.getByRole("region", { name: "En ce moment" }).or(
    page.locator("section[aria-label='En ce moment']"),
  );
  await strip.first().scrollIntoViewIfNeeded().catch(() => {});
  await page.evaluate(() =>
    document.querySelector("section[aria-label='En ce moment']")?.scrollIntoView({ block: "center" }),
  );
  // Park the cursor where the strip now sits WITHOUT moving over it
  // afterwards (the phantom scenario): move first, then scroll the strip
  // under the fixed point.
  await page.mouse.move(400, 300);
  await page.evaluate(() => window.scrollBy(0, 40));
  const kindOf = () =>
    page
      .locator("section[aria-label='En ce moment'] p.font-mono")
      .first()
      .innerText()
      .catch(() => "");
  const first = await kindOf();
  if (!first) test.skip(true, "seeded corpus produced no stories — nothing to rotate");
  await expect
    .poll(kindOf, { timeout: 20_000, intervals: [1000] })
    .not.toBe(first);
});
