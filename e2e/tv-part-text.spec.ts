import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { PREMIUM_DESIGNS } from "../src/tv/premiumDesigns";
/**
 * The text of a board of parts, from the board's preview itself: the one bar
 * of letters (size, font, bold, wrapping) under the preview, writing into a
 * text on the board, and never two bars on the screen at once.
 */
test("the text of the parts, from the preview", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  const server = await serveEditor(page, structuredClone(PREMIUM_DESIGNS[0].values) as Record<string, unknown>);
  const res = await page.goto("/e2e/harness/editor.html").catch(() => null);
  test.skip(!res, "the dev server is not running (npm run dev)");
  await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /עריכה ישירה בלוח/ }).first().click();
  const board = page.locator(".tv-frame").first();
  const heading = board.locator('[data-element-id]').filter({ hasText: "זמני תפילות" }).last();
  await heading.click();
  const tools = page.getByTestId("preview-text-tools");
  await expect(tools).toBeVisible();
  // One bar on screen at a time.
  await expect(page.getByTestId("element-text-tools")).toHaveCount(1);
  await tools.getByRole("button", { name: "הגדלת הטקסט" }).click();
  await tools.getByRole("button", { name: "הגדלת הטקסט" }).click();
  await tools.getByLabel("גופן").selectOption("rubik");
  await tools.getByRole("button", { name: "מודגש" }).click();
  // Written into on the board itself - and the board does not move for it.
  const column = board.locator("[data-element-id]").first();
  const before = (await column.boundingBox())!;
  await heading.dblclick();
  const box = board.locator("[data-writing]");
  await expect(box).toBeFocused();
  await page.keyboard.type("תפילות השבוע");
  await page.keyboard.press("Enter");
  await expect(board).toContainText("תפילות השבוע");

  // A name that would be made smaller: broken into lines instead.
  const title = board.locator('[data-content-binding="title"]').first();
  await title.click();
  await tools.getByRole("button", { name: "גלישת שורות" }).click();
  await expect(board.locator('[data-content-binding="title"][data-wrap="true"]')).toHaveCount(1);
  const after = (await column.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(1);
  // The parts list: in direct editing it points under the preview rather than showing a second bar.
  await page.getByRole("tab", { name: "עיצוב" }).click();
  await board.locator('[data-element-id]').filter({ hasText: "תפילות השבוע" }).last().click();
  await expect(page.getByTestId("text-tools-elsewhere")).toBeVisible();
  await expect(page.getByTestId("element-text-tools")).toHaveCount(1);
  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = server.saved() as { elements: { text: string; font?: string; weight?: string; fontSize: number; binding?: string; wrap?: boolean }[] };
  const h = saved.elements.find((e) => e.text === "תפילות השבוע");
  expect(h).toMatchObject({ font: "rubik", weight: "normal" });
  expect(h!.fontSize).toBeGreaterThan(PREMIUM_DESIGNS[0].values.elements!.find((e) => e.name === "כותרת תפילות")!.fontSize);
  expect(saved.elements.find((e) => e.binding === "title")?.wrap).toBe(true);
  expect(errors).toEqual([]);
});
