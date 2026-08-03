import { expect, test } from "@playwright/test";

/** The news band auto-advances for real (recette 2026-08-02: "it doesn't
 *  auto-advance") — including with a cursor PARKED over it by scrolling,
 *  the phantom-hover scenario that froze it. Since the band became a
 *  scroll-snap rail every slide stays mounted, so progress is read from
 *  the selected dot, not the visible text. And the rail must answer the
 *  Angles decks' gesture: a horizontal swipe changes the slide. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "fr");
    window.localStorage.setItem("orion.theme", "light");
  });
});

const selectedDot = (page: import("@playwright/test").Page) => () =>
  page
    .locator("section[aria-label='Actualités'] [role='tab'][aria-selected='true']")
    .getAttribute("aria-label")
    .catch(() => null);

test("le fil avance tout seul, même sous un curseur parqué par le scroll", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const band = page.locator("section[aria-label='Actualités']");
  await band.scrollIntoViewIfNeeded().catch(() => {});
  await page.evaluate(() =>
    document.querySelector("section[aria-label='Actualités']")?.scrollIntoView({ block: "center" }),
  );
  // Park the cursor where the band now sits WITHOUT moving over it
  // afterwards (the phantom scenario): move first, then scroll the band
  // under the fixed point.
  await page.mouse.move(400, 300);
  await page.evaluate(() => window.scrollBy(0, 40));
  const dotCount = await band.locator("[role='tab']").count();
  if (dotCount < 2) test.skip(true, "seeded corpus produced fewer than two stories — nothing to rotate");
  const first = await selectedDot(page)();
  await expect
    .poll(selectedDot(page), { timeout: 20_000, intervals: [1000] })
    .not.toBe(first);
});

test("après un clic sur la flèche, le fil repart et défile indéfiniment", async ({ page }) => {
  // The real usage that froze the bar (recette 2026-08-03): click an
  // arrow — in Chrome the button keeps focus — then leave the page
  // alone. Click focus must NOT hold the carousel; only keyboard focus
  // is reading intent. Two consecutive auto-advances prove it rolls.
  test.setTimeout(90_000);
  await page.goto("/");
  const band = page.locator("section[aria-label='Actualités']");
  await page.evaluate(() =>
    document.querySelector("section[aria-label='Actualités']")?.scrollIntoView({ block: "center" }),
  );
  const dotCount = await band.locator("[role='tab']").count();
  if (dotCount < 2) test.skip(true, "seeded corpus produced fewer than two stories — nothing to rotate");
  await band.getByRole("button", { name: "Actualité suivante" }).click();
  const afterClick = await selectedDot(page)();
  // First auto-advance: the click's real pointer move holds ~8 s, then
  // the 3.8 s cadence runs — and the arrow button still holds focus.
  await expect
    .poll(selectedDot(page), { timeout: 25_000, intervals: [1000] })
    .not.toBe(afterClick);
  const afterFirst = await selectedDot(page)();
  // Second auto-advance, cursor and keyboard untouched: still rolling.
  await expect
    .poll(selectedDot(page), { timeout: 15_000, intervals: [1000] })
    .not.toBe(afterFirst);
});

test("le geste des decks marche sur le fil : un glissement horizontal change d'actualité", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const band = page.locator("section[aria-label='Actualités']");
  await page.evaluate(() =>
    document.querySelector("section[aria-label='Actualités']")?.scrollIntoView({ block: "center" }),
  );
  const dotCount = await band.locator("[role='tab']").count();
  if (dotCount < 2) test.skip(true, "seeded corpus produced fewer than two stories — nothing to swipe");
  const first = await selectedDot(page)();
  // The gesture itself: scroll the snap rail horizontally, as a trackpad
  // swipe does — the rail must land on the next slide and sync the state.
  await band
    .locator("div[class*='snap-x']")
    .evaluate((rail) => rail.scrollTo({ left: rail.clientWidth, behavior: "smooth" }));
  await expect
    .poll(selectedDot(page), { timeout: 10_000, intervals: [500] })
    .not.toBe(first);
});
