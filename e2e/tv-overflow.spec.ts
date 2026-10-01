import { expect, test } from "@playwright/test";
import { expectNotFrozen, serveEditor } from "./support/tvEditor";

/**
 * Content that does not fit its frame: cut as before, or scrolled - with a
 * stop at each end, or as an endless curtain. Chosen in the layout tab.
 */
const HARNESS = "/e2e/harness/editor.html";

test("the layout tab chooses what a frame does with content that does not fit", async ({ page }) => {
  await serveEditor(page, {
    screenLayout: "medallion",
    screens: [
      {
        id: "a",
        name: "הלוח",
        seconds: 20,
        blocks: [{ block: "header" }, { block: "clock" }, { block: "footer" }, { block: "prayers" }, { block: "zmanim" }, { block: "learning" }, { block: "shiurim" }, { block: "announcements" }],
      },
    ],
  });
  const res = await page.goto(HARNESS).catch(() => null);
  test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
  const frame = page.locator(".tv-frame").first();
  await expect(frame.locator(".tv-root")).toBeVisible({ timeout: 20_000 });
  // As before: nothing moves.
  await expect(frame.locator("[data-scrolling]")).toHaveCount(0);

  await page.getByRole("tab", { name: "פריסה" }).click();
  await page.getByRole("button", { name: "גלילה עם עצירות" }).click();
  await expect(frame.locator('[data-scrolling="pause"]').first()).toBeVisible();
  // The daf yomi's cards fill their frame; they never scroll.
  await expect(frame.locator('[data-block="learning"] [data-scrolling]')).toHaveCount(0);

  await page.getByRole("button", { name: "וילון רציף" }).click();
  await expect(frame.locator('[data-scrolling="loop"]').first()).toBeVisible();
  await expect(frame.locator(".tv-autoscroll-copy.is-echo").first()).toBeAttached();

  await page.getByRole("button", { name: "בלי גלילה" }).click();
  await expect(frame.locator("[data-scrolling]")).toHaveCount(0);
  await expectNotFrozen(page, "overflow");
});
