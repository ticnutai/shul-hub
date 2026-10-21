import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";

/**
 * How the editor looks, chosen once at the top of the design tab: the size of
 * every gallery's tiles, and the sliders - under their names, in one line, or
 * upright side by side. Kept for the next visit.
 */
test("the galleries' tiles small, the sliders upright - everywhere, and kept", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  await page.setViewportSize({ width: 1600, height: 1000 });
  await serveEditor(page, structuredClone(DEFAULT_TV_CONFIG));
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  const bar = page.getByTestId("editor-view-bar");

  await bar.getByRole("radio", { name: "משבצות קטנות" }).click();
  await expect(page.locator("[data-tile-size]").first()).toHaveAttribute("data-tile-size", "small");
  await expect(page.locator('[data-tile-size]:not([data-tile-size="small"])')).toHaveCount(0);

  await bar.getByRole("radio", { name: /סליידרים עומדים/ }).click();
  await page.getByRole("tab", { name: "פריסה", exact: true }).click();
  await expect(page.locator('#layout-screen [data-slider-layout="vertical"]')).toHaveCount(4, { timeout: 10_000 });
  // One "רגיל" for a slider left to the board, not a word and a button both.
  await expect(page.locator('#layout-screen [data-slider-layout="vertical"]').first().getByText("רגיל", { exact: true })).toHaveCount(1);

  // Kept: the same on the next visit.
  await page.reload();
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  await expect(page.getByTestId("editor-view-bar").getByRole("radio", { name: "משבצות קטנות" })).toHaveAttribute("aria-checked", "true");
});
