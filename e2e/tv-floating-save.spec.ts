import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";

/**
 * The save bar floats over the page: small, in sight as the page scrolls,
 * dragged by its handle to where the gabbai wants it and kept there; what is
 * being edited (the screens) is a small label in it, its words behind an ⓘ.
 */
test("the save bar floats, stays in sight, is dragged and kept; explanations open from an ⓘ", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  await page.setViewportSize({ width: 1500, height: 900 });
  await serveEditor(page, structuredClone(DEFAULT_TV_CONFIG));
  await page.goto("/e2e/harness/editor.html");
  const bar = page.getByTestId("save-bar");
  await expect(bar).toBeInViewport();
  await expect(bar).toContainText("הכול שמור");
  await expect(bar.getByTestId("device-scope")).toContainText("עורך עכשיו: כל המסכים");

  // In sight as the page scrolls.
  await page.mouse.wheel(0, 1500);
  await expect(bar).toBeInViewport();

  // Dragged by its handle near the top of the screen, and there next time.
  const handle = bar.locator("[title^='גרירה מזיזה']");
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(300, 120, { steps: 6 });
  await page.mouse.up();
  const moved = (await bar.boundingBox())!;
  expect(moved.y).toBeLessThan(200);
  await page.reload();
  await expect.poll(async () => (await page.getByTestId("save-bar").boundingBox())!.y).toBeLessThan(200);

  // A double click on the handle: back in its corner.
  await page.getByTestId("save-bar").locator("[title^='גרירה מזיזה']").dblclick();
  await expect.poll(async () => (await page.getByTestId("save-bar").boundingBox())!.y).toBeGreaterThan(700);

  // An explanation: an ⓘ beside the title, its words shown on a click.
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  const tip = page.locator("#design-sets [data-info-tip]").first();
  await expect(tip.getByRole("note")).toBeHidden();
  await tip.getByRole("button", { name: "הסבר" }).click();
  await expect(tip.getByRole("note")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tip.getByRole("note")).toBeHidden();
});
