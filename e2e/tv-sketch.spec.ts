import { expect, test } from "@playwright/test";
import { expectNotFrozen, serveEditor } from "./support/tvEditor";

/**
 * The composer's sketch worked by hand: a block dragged to another place,
 * the edge between two blocks dragged, a row made taller - and a line under
 * the sketch saying what happens. The board follows.
 */
const HARNESS = "/e2e/harness/editor.html";
const BLOCKS = ["header", "clock", "footer", "prayers", "zmanim", "learning", "announcements", "shiurim"].map((block) => ({ block }));

test("drag a block, split a row, make a row taller; the board follows", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const served = await serveEditor(page, { screenLayout: "rotate", screens: [{ id: "a", name: "הלוח", seconds: 20, blocks: BLOCKS }] });
  const res = await page.goto(HARNESS).catch(() => null);
  test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
  await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: "פריסה" }).click();

  const sketch = page.getByTestId("composer-sketch");
  const status = page.getByTestId("sketch-status");
  const cell = (id: string) => sketch.locator(`[data-sketch-cell="${id}"]`);
  const rowOf = (id: string) => cell(id).evaluate((el) => Number(el.closest("[data-sketch-row]")!.getAttribute("data-sketch-row")));
  await expect(cell("shiurim")).toBeVisible();
  expect(await rowOf("shiurim")).toBe(2);

  // Shiurim, from its own row at the bottom, to the left of the prayers in the first row.
  const from = (await cell("shiurim").boundingBox())!;
  const to = (await cell("prayers").boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width * 0.1, to.y + to.height / 2, { steps: 10 });
  await expect(status).toContainText("שחררו כדי לשים את «שיעורים»");
  await page.mouse.up();
  await expect(status).toContainText("«שיעורים» עבר לשורה 1");
  expect(await rowOf("shiurim")).toBe(0);
  // The board too: its first row has three blocks.
  await expect(page.locator(".tv-frame .tv-composed-row").first().locator(".tv-composed-cell")).toHaveCount(3);

  // The edge between the prayers and the shiurim: the prayers take more of the row.
  const handle = cell("prayers").locator('[data-sketch-handle="width"]');
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x - 80, h.y + h.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(status).toContainText("רוחב בשורה 1");
  const widths = await sketch.locator('[data-sketch-row="0"] [data-sketch-cell]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  expect(widths[0]).toBeGreaterThan(widths[1]);

  // The bottom of the first row: taller.
  const rowHandle = sketch.locator('[data-sketch-row="0"] > [data-sketch-handle="height"]');
  const before = (await sketch.locator('[data-sketch-row="0"]').boundingBox())!.height;
  const rh = (await rowHandle.boundingBox())!;
  await page.mouse.move(rh.x + rh.width / 2, rh.y + rh.height / 2);
  await page.mouse.down();
  await page.mouse.move(rh.x + rh.width / 2, rh.y + 40, { steps: 6 });
  await page.mouse.up();
  await expect(status).toContainText("גובה שורה 1");
  expect((await sketch.locator('[data-sketch-row="0"]').boundingBox())!.height).toBeGreaterThan(before + 5);

  // Saved with the screen; and "סידור אוטומטי" gives the arrangement back.
  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => JSON.stringify((served.saved() as { screens?: { grid?: unknown }[] } | null)?.screens?.[0]?.grid ?? null)).toContain("shiurim");
  await page.getByRole("button", { name: "סידור אוטומטי" }).click();
  expect(await rowOf("shiurim")).toBe(2);
  await expectNotFrozen(page, "sketch");
});
