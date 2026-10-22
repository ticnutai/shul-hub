import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { applyDesign } from "../src/tv/designs";
import { ORIGINAL_LAYER_DESIGNS } from "../src/tv/originalLayerDesigns";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";
import { newElement } from "../src/tv/elements";

/**
 * The times of the day in black on the dark sapphire board - unread from
 * across the hall: the editor says so under the board, and one click gives it
 * the board's own light letters. The kit's own parts are not named.
 */
test("a part in letters that cannot be read on its board is named, and fixed in one click", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  const kit = ORIGINAL_LAYER_DESIGNS.find((d) => d.name.startsWith("ספיר"))!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  start.elements.push({ ...newElement("text"), id: "el_black_zmanim", name: "זמני היום", binding: "zmanim", text: "", color: "#000000", x: 40, y: 30, width: 22, height: 30 });
  await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");

  const note = page.getByTestId("parts-readability");
  await expect(note).toBeVisible();
  await expect(note).toContainText('"זמני היום"');
  await page.getByTestId("parts-readability-fix").click();
  await expect(note).toHaveCount(0);
  const ink = await page.locator('[data-board-preview] [data-content-binding="zmanim"]').first().evaluate((el) => getComputedStyle(el).color);
  expect(ink).not.toBe("rgb(0, 0, 0)");
  expect(errors).toEqual([]);
});
