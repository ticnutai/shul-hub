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
  expect(await pinned.evaluate((el) => el.parentElement!.scrollHeight - el.parentElement!.clientHeight)).toBeGreaterThan(40);
  const before = (await board.boundingBox())!;
  await pinned.evaluate((el) => {
    const column = el.parentElement!;
    column.scrollTop = column.scrollHeight;
  });
  await page.waitForTimeout(200);
  const after = (await board.boundingBox())!;
  // Settles at the top of the column (a few pixels), never scrolled away with the panels.
  expect(Math.abs(after.y - before.y)).toBeLessThan(24);
  await expect(board).toBeInViewport({ ratio: 0.9 });
});

/**
 * One save button, in sight all the way down: there were two (over the
 * controls and at the foot of the preview), both on the screen at once,
 * and the one over the controls scrolled up under the site's header.
 */
test("one save button, and it stays in sight while the controls scroll", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is side by side on a desktop screen");
  await page.setViewportSize({ width: 1500, height: 800 });
  await serveEditor(page, structuredClone(PREMIUM_DESIGNS[0].values) as Record<string, unknown>);
  const res = await page.goto("/e2e/harness/editor.html").catch(() => null);
  test.skip(!res, "the dev server is not running (npm run dev)");
  await expect(page.locator("[data-board-preview] .tv-frame").first()).toBeVisible({ timeout: 30_000 });
  // Something changed, so there is something to save.
  await page.getByTestId("background-gallery").getByRole("button", { name: "זרקור זהב", exact: true }).click();
  const save = page.getByRole("button", { name: "שמור ושדר למסכים" });
  await expect(save).toHaveCount(1);
  await expect(save).toBeEnabled();
  // Far down the controls: still there, and still one.
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(300);
  await expect(save).toHaveCount(1);
  await expect(save).toBeInViewport();
});

/**
 * Ctrl+S is "שמור ושדר": from anywhere in the editor, a text field included,
 * and on a Hebrew keyboard (where S types "ד") too.
 */
test("Ctrl+S saves and broadcasts", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  await page.setViewportSize({ width: 1500, height: 800 });
  const server = await serveEditor(page, structuredClone(PREMIUM_DESIGNS[0].values) as Record<string, unknown>);
  const res = await page.goto("/e2e/harness/editor.html").catch(() => null);
  test.skip(!res, "the dev server is not running (npm run dev)");
  await expect(page.locator("[data-board-preview] .tv-frame").first()).toBeVisible({ timeout: 30_000 });
  const save = page.getByRole("button", { name: "שמור ושדר למסכים" });
  await expect(save).toBeDisabled();
  await page.getByTestId("background-gallery").getByRole("button", { name: "זרקור זהב", exact: true }).click();
  await expect(save).toBeEnabled();
  // The key, not the letter: a Hebrew layout sends "ד" for KeyS.
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ד", code: "KeyS", ctrlKey: true, bubbles: true, cancelable: true })),
  );
  await expect.poll(() => server.writes(), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(save).toBeDisabled();
  await expect(page.getByTestId("save-bar")).toContainText("הכול שמור");
});
