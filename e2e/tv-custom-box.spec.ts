import { expect, test } from "@playwright/test";
import { expectNotFrozen, serveEditor } from "./support/tvEditor";

/**
 * A box of the shul's own: added in the composer beside the built-in ones,
 * written there, on the board at once, dressed in the design tab like any
 * box, and taken off again.
 */
test.use({ viewport: { width: 1600, height: 1100 } });

test("a box added by hand: written, on the board, dressed like any box, and removed", async ({ page }) => {
  const server = await serveEditor(page);
  await page.goto("/e2e/harness/editor.html");
  const root = page.locator(".tv-frame .tv-root").first();
  await expect(root).toBeVisible({ timeout: 20_000 });

  await page.getByRole("tab", { name: "פריסה" }).click();
  await page.getByRole("button", { name: "+ הוספת תיבה משלי" }).click();
  const editor = page.getByTestId("custom-box-editor");
  await expect(editor).toBeVisible();
  await editor.getByLabel("כותרת התיבה").fill("חוגים");
  await editor.getByLabel("מה כתוב בה").fill("שחמט - יום שני 20:00\nציור - יום רביעי 19:30");

  // In the list like the others: a switch and a place.
  await expect(page.getByRole("switch", { name: "חוגים" })).toBeChecked();
  await expect(page.getByLabel("מיקום של חוגים")).toBeVisible();

  // On the board, in a box of its own.
  const box = root.locator(".tv-custom-text");
  await expect(box).toContainText("ציור - יום רביעי 19:30");
  const cell = root.locator('[data-frame^="custom:"]').first();
  await expect(cell).toHaveClass(/tv-panel/);

  // Dressed in the design tab, chosen by its title.
  await page.getByRole("tab", { name: "עיצוב" }).click();
  const scope = page.getByLabel("התיבות והטקסט של");
  const option = scope.locator("option", { hasText: "חוגים" });
  await scope.selectOption(await option.getAttribute("value"));
  const layer = page.getByTestId("box-part-background").getByTestId("box-layer-background");
  await layer.getByRole("radio", { name: "צבע", exact: true }).click();
  await layer.getByLabel("צבע הרקע").fill("#5a1a2a");
  await expect.poll(() => cell.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(90, 26, 42)");

  // Saved with the board.
  await page.getByRole("button", { name: "שמור ושדר למסכים" }).first().click();
  await expect.poll(() => server.writes(), { timeout: 10_000 }).toBeGreaterThan(0);
  const saved = server.saved() as { customBoxes?: { title: string }[] };
  expect(saved.customBoxes?.map((b) => b.title)).toEqual(["חוגים"]);

  // Taken off: from the list and from the board.
  await page.getByRole("tab", { name: "פריסה" }).click();
  await page.getByRole("button", { name: "עריכת חוגים" }).click();
  page.once("dialog", (d) => void d.accept());
  await page.getByTestId("custom-box-editor").getByRole("button", { name: "מחיקת התיבה" }).click();
  await expect(page.getByRole("switch", { name: "חוגים" })).toHaveCount(0);
  await expect(root.locator(".tv-custom-text")).toHaveCount(0);
  await expectNotFrozen(page, "custom box");
});
