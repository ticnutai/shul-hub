import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { BUILTIN_DESIGNS, applyDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";

/**
 * "מסך מלא לעריכה": the board stays pinned at the top while the controls under
 * it scroll - it scrolled away with them (18.10.2026) - and takes about half the
 * screen, so there is room to edit under it.
 */
test("full screen for editing: the board pinned at the top, the controls scrolling under it", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  await page.setViewportSize({ width: 1500, height: 950 });
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_sapphirelayers")!;
  await serveEditor(page, JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit))));
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("button", { name: "תצוגה למעלה" }).first().click();
  await page.getByTestId("view-menu").click();
  await page.getByRole("menuitemcheckbox", { name: "מסך מלא לעריכה" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);

  const pinned = page.getByTestId("preview-pinned");
  const before = (await pinned.boundingBox())!;
  expect(before.height).toBeLessThan(950 * 0.75);
  // Scroll the full-screen column far down.
  await page.evaluate(() => { const el = document.fullscreenElement as HTMLElement; el.scrollTop = 4000; });
  await page.waitForTimeout(300);
  const after = (await pinned.boundingBox())!;
  expect(Math.abs(after.y - before.y)).toBeLessThan(40);
  await expect(page.locator("[data-board-preview] .tv-frame").first()).toBeInViewport();
});
