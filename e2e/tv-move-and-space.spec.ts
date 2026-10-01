import { expect, test, type Page } from "@playwright/test";
import { expectNotFrozen, serveEditor, settled } from "./support/tvEditor";

/**
 * Moving the medallion's parts, and the air around the panels from the
 * composer's sketch: the strip under the frames is an element like the
 * others; a double click opens editing on the spot; the sketch's lines above
 * the first row and under the last are the board's top and bottom spacing,
 * and the strip's bar sizes the strip.
 */
const HARNESS = "/e2e/harness/editor.html";
const BLOCKS = ["header", "clock", "footer", "prayers", "zmanim"].map((block) => ({ block }));

async function open(page: Page, config: Record<string, unknown>) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const served = await serveEditor(page, config);
  const res = await page.goto(HARNESS).catch(() => null);
  test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
  await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 20_000 });
  return served;
}
const frame = (page: Page) => page.locator(".tv-frame").first();
const boxOf = async (page: Page, sel: string) => (await frame(page).locator(sel).first().boundingBox())!;
const drag = async (page: Page, from: { x: number; y: number }, dx: number, dy: number) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  await page.mouse.up();
};

test("a double click opens editing on the strip, and the arrows move it", async ({ page }) => {
  await open(page, { screenLayout: "medallion" });
  const strip = frame(page).locator(".tv-med-strip");
  // Not editing yet: a hint says how, and the strip carries no mark.
  await frame(page).hover();
  await expect(page.getByTestId("edit-hint")).toBeVisible();
  await expect(strip).not.toHaveAttribute("data-edit", /.+/);

  await strip.dblclick();
  await expect(strip).toHaveAttribute("data-edit", "dash.strip");
  await expect(page.getByText("שורת הפרשה והנרות").first()).toBeVisible();
  // Measured once editing has opened: opening it moves the board a little.
  const before = (await strip.boundingBox())!;
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(strip).toHaveCSS("transform", /matrix/);
  await expect.poll(async () => (await strip.boundingBox())!.y).toBeLessThan(before.y - 2);

  // The date plaque and the clock move by dragging, as before.
  const date = await boxOf(page, ".tv-med-plaque.is-date");
  await drag(page, { x: date.x + date.width / 2, y: date.y + date.height / 2 }, 0, 30);
  expect((await boxOf(page, ".tv-med-plaque.is-date")).y).toBeGreaterThan(date.y + 10);
  await expectNotFrozen(page, "strip");
});

test("the sketch's top and bottom lines are the board's spacing; the line between rows shares their height", async ({ page }) => {
  const served = await open(page, {
    screenLayout: "rotate",
    screens: [{ id: "a", name: "הלוח", seconds: 20, blocks: [...BLOCKS, { block: "learning" }, { block: "shiurim" }] }],
  });
  await page.getByRole("tab", { name: "פריסה" }).click();
  const sketch = page.getByTestId("composer-sketch");
  await settled(sketch);
  const status = page.getByTestId("sketch-status");
  await sketch.scrollIntoViewIfNeeded();
  await settled(sketch);

  // Above the first row, dragged down: the panels on the board come down.
  const panelsTop = (await boxOf(page, ".tv-composed")).y;
  const top = (await sketch.locator('[data-sketch-handle="space-top"]').boundingBox())!;
  await drag(page, { x: top.x + top.width / 2, y: top.y + top.height / 2 }, 0, 20);
  await expect(status).toContainText("מרווח עליון");
  await expect.poll(async () => (await boxOf(page, ".tv-composed")).y).toBeGreaterThan(panelsTop + 10);

  // Under the last row, dragged up: air between the panels and the line below.
  const bottom = (await sketch.locator('[data-sketch-handle="space-bottom"]').boundingBox())!;
  await drag(page, { x: bottom.x + bottom.width / 2, y: bottom.y + bottom.height / 2 }, 0, -15);
  await expect(status).toContainText("מרווח תחתון");

  // The line between the two rows: the first takes what the second gives.
  const rowsHandle = sketch.locator('[data-sketch-row="0"] > [data-sketch-handle="rows"]');
  const h = (await rowsHandle.boundingBox())!;
  await drag(page, { x: h.x + h.width / 2, y: h.y + h.height / 2 }, 0, 25);
  await expect(status).toContainText("גובה: שורה 1");
  const [r0, r1] = await sketch.locator("[data-sketch-row]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(r0).toBeGreaterThan(r1);

  // A double click on the top line: back to the design's own spacing.
  await page.mouse.dblclick(top.x + top.width / 2, (await sketch.locator('[data-sketch-handle="space-top"]').boundingBox())!.y + 3);
  await expect(status).toContainText("מרווח עליון (מעל הלוחות): כמו בעיצוב");

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect
    .poll(() => JSON.stringify((served.saved() as { spacing?: unknown } | null)?.spacing ?? null))
    .toMatch(/"top":null.*"bottom":\d/);
  await expectNotFrozen(page, "spacing");
});

test("on the medallion the strip's bar in the sketch sizes the strip on the board", async ({ page }) => {
  await open(page, {
    screenLayout: "medallion",
    screens: [{ id: "a", name: "הלוח", seconds: 20, blocks: BLOCKS }],
  });
  await page.getByRole("tab", { name: "פריסה" }).click();
  const sketch = page.getByTestId("composer-sketch");
  await settled(sketch);
  await sketch.scrollIntoViewIfNeeded();
  await settled(sketch);
  const before = (await boxOf(page, ".tv-med-strip")).height;
  const handle = (await sketch.locator('[data-sketch-handle="strip"]').boundingBox())!;
  await drag(page, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, 0, -16);
  await expect(page.getByTestId("sketch-status")).toContainText("גובה שורת הפרשה והנרות: פי");
  await expect.poll(async () => (await boxOf(page, ".tv-med-strip")).height).toBeGreaterThan(before + 3);
  await expectNotFrozen(page, "strip size");
});
