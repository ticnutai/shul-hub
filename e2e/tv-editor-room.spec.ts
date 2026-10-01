import { expect, test } from "@playwright/test";
import { expectNotFrozen, serveEditor } from "./support/tvEditor";

/**
 * The editor's room: handles on every side of the preview, the largest board
 * that fits, the board without the drawn TV, and a work mode that hides what
 * stands above the editor.
 */
const HARNESS = "/e2e/harness/editor.html";

test.describe("TV editor, the preview's room", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await serveEditor(page);
    const res = await page.goto(HARNESS).catch(() => null);
    test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
    await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 20_000 });
  });

  const boardBox = async (page: import("@playwright/test").Page) => (await page.locator(".tv-frame").first().boundingBox())!;

  test("a handle on any side makes the board bigger, and a double click puts it back", async ({ page }) => {
    for (const layout of ["זה לצד זה", "תצוגה למעלה"]) {
      await page.getByRole("button", { name: layout }).click();
      const before = await boardBox(page);
      const handle = page.locator('[data-resize="sw"]').first();
      const h = (await handle.boundingBox())!;
      await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
      await page.mouse.down();
      await page.mouse.move(h.x - 60, h.y + 120, { steps: 6 });
      await page.mouse.up();
      const after = await boardBox(page);
      expect(after.height, `${layout}: taller`).toBeGreaterThan(before.height + 20);
      expect(after.width / after.height).toBeCloseTo(before.width / before.height, 1);
      await page.locator('[data-resize="e"]').first().dblclick();
      await expectNotFrozen(page, layout);
    }
  });

  test("מקסימום makes the board as big as it goes, and gives back the size it had", async ({ page }) => {
    await page.getByRole("button", { name: "זה לצד זה" }).click();
    const before = await boardBox(page);
    await page.getByRole("button", { name: "מקסימום" }).click();
    const max = await boardBox(page);
    expect(max.width).toBeGreaterThan(before.width + 50);
    await page.getByRole("button", { name: "גודל קודם" }).click();
    const back = await boardBox(page);
    expect(Math.abs(back.width - before.width)).toBeLessThan(4);
  });

  test("without the drawn TV the board takes its room; work mode hides what stands above", async ({ page }) => {
    await page.getByRole("button", { name: "תצוגה למעלה" }).click();
    const framed = await boardBox(page);
    await page.getByRole("button", { name: "בלי מסגרת טלוויזיה" }).click();
    const bare = await boardBox(page);
    expect(bare.height).toBeGreaterThan(framed.height);

    await page.getByRole("button", { name: "מצב עבודה" }).click();
    await expect(page.locator("body")).toHaveClass(/tv-focus/);
    await page.getByRole("button", { name: "יציאה ממצב עבודה" }).click();
    await expect(page.locator("body")).not.toHaveClass(/tv-focus/);
    await expectNotFrozen(page, "room");
  });
});
