import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { PREMIUM_DESIGNS } from "../src/tv/premiumDesigns";

/**
 * The board stays in sight while what is under it scrolls: the panel being
 * edited, the text bar, the buttons. It scrolled away with them, and the
 * change being made could not be seen (11.10.2026).
 */
test("the board's preview stays pinned while the panels under it scroll", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is side by side on a desktop screen");
  await page.setViewportSize({ width: 1500, height: 620 });
  await serveEditor(page, structuredClone(PREMIUM_DESIGNS[0].values) as Record<string, unknown>);
  const res = await page.goto("/e2e/harness/editor.html").catch(() => null);
  test.skip(!res, "the dev server is not running (npm run dev)");
  const board = page.locator("[data-board-preview] .tv-frame").first();
  await expect(board).toBeVisible({ timeout: 30_000 });
  // Editing on the board: the text bar and the help come under the preview.
  await page.getByRole("button", { name: /עריכה ישירה בלוח/ }).first().click();
  await board.locator('[data-free-edit="true"] [data-element-id]').filter({ has: page.locator('[data-content-binding="title"]') }).first().click();
  const pinned = page.getByTestId("preview-pinned");
  // The column scrolled to its end: the board is still where it was.
  // It does scroll (more under the board than the window holds).
  expect(await pinned.evaluate((el) => el.parentElement!.scrollHeight - el.parentElement!.clientHeight)).toBeGreaterThan(100);
  const before = (await board.boundingBox())!;
  await pinned.evaluate((el) => {
    const column = el.parentElement!;
    column.scrollTop = column.scrollHeight;
  });
  await page.waitForTimeout(200);
  const after = (await board.boundingBox())!;
  expect(Math.abs(after.y - before.y)).toBeLessThan(4);
  await expect(board).toBeInViewport({ ratio: 0.9 });
});
