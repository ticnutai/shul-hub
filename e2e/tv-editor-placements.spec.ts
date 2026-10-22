import { expect, test } from "@playwright/test";
import { editorLayout, serveEditor } from "./support/tvEditor";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";

/**
 * Two more ways to lay the editor out, beside those there were: the board on
 * the right and the controls on the left; and every section a title that
 * opens - all the sections of a tab in sight at once, none hidden for
 * another. Both kept for the next visit.
 */
test("the board on the right, and the sections folded to their titles", async ({ page, isMobile }) => {
  test.skip(isMobile, "side by side is for a wide screen");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await serveEditor(page, JSON.parse(JSON.stringify(DEFAULT_TV_CONFIG)));
  await page.goto("/e2e/harness/editor.html");

  const board = page.getByTestId("preview-pinned");
  const controls = page.getByRole("tab", { name: "עיצוב", exact: true });
  expect((await board.boundingBox())!.x).toBeLessThan((await controls.boundingBox())!.x);
  await editorLayout(page, "הלוח מימין");
  await expect.poll(async () => (await board.boundingBox())!.x > (await controls.boundingBox())!.x).toBe(true);

  await editorLayout(page, "כותרות מתקפלות");
  // The tabs stay; every topic of the design tab is a title, the first open.
  await expect(controls).toBeVisible();
  const background = page.locator("#design-background");
  await expect(background).toBeVisible();
  await expect(background).toHaveAttribute("data-folded", "closed");
  await expect(page.locator("#design-sets")).toHaveAttribute("data-folded", "open");
  await background.getByRole("button", { expanded: false }).first().click();
  await expect(background).toHaveAttribute("data-folded", "open");
  await expect(page.getByTestId("design-topics")).toHaveCount(0);

  await page.reload();
  await expect(page.locator("#design-background")).toHaveAttribute("data-folded", /open|closed/);
  await expect.poll(async () => (await page.getByTestId("preview-pinned").boundingBox())!.x > (await page.getByRole("tab", { name: "עיצוב", exact: true }).boundingBox())!.x).toBe(true);
  expect(errors).toEqual([]);
});
