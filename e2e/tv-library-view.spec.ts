import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";

/**
 * The kits drawn at the size chosen, from one small button in the library's
 * row: six to a row, four, three or two - kept for the next visit. Small,
 * each is its picture and its name.
 */
test("the kits' size chosen from the library's row, and kept", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await serveEditor(page, JSON.parse(JSON.stringify(DEFAULT_TV_CONFIG)));
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("button", { name: "פתיחת הכול" }).first().click();
  const grid = page.locator("[data-library-view]").first();
  await expect(grid).toHaveAttribute("data-library-view", "medium");

  await page.getByRole("radio", { name: "קטן מאוד - שש בשורה" }).first().click();
  await expect(grid).toHaveAttribute("data-library-view", "xs");
  // Small: the picture and the name; the folders' lists wait for a larger size.
  await expect(grid.locator("[data-library-controls]").first()).toBeHidden();
  const [a, b] = await grid.locator("[data-library-item]").evaluateAll((els) => els.slice(0, 2).map((e) => e.getBoundingClientRect().top));
  expect(Math.abs(a - b)).toBeLessThan(2);

  await page.reload();
  await page.getByRole("button", { name: "פתיחת הכול" }).first().click();
  await expect(page.locator("[data-library-view]").first()).toHaveAttribute("data-library-view", "xs");
  await page.getByRole("radio", { name: "גדול - שתיים בשורה" }).first().click();
  await expect(page.locator("[data-library-view]").first()).toHaveAttribute("data-library-view", "large");
  expect(errors).toEqual([]);
});
