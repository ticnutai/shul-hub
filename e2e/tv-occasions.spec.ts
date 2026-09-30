import { expect, test } from "@playwright/test";
import { expectNotFrozen, serveEditor } from "./support/tvEditor";

/**
 * Occasions, from the gabbai's side: one list for Shabbat, the festivals and
 * the shul's own days; a dialog for each; the preview jumping to its day.
 */
const HARNESS = "/e2e/harness/editor.html";

test.describe("TV editor, occasions", () => {
  test.beforeEach(async ({ page }) => {
    await serveEditor(page);
    const res = await page.goto(HARNESS).catch(() => null);
    test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
    await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("tab", { name: "מועדים" }).click();
  });

  const list = (page: import("@playwright/test").Page) => page.getByTestId("occasions");
  const row = (page: import("@playwright/test").Page, id: string) => list(page).locator(`li[data-occasion="${id}"]`);

  test("one list: Shabbat and the calendar's days, in order of importance", async ({ page }) => {
    await expect(row(page, "shabbat")).toBeVisible();
    await expect(row(page, "cal:sukkot")).toBeVisible();
    await expect(row(page, "shabbat")).toContainText("כל שבת");
    // Moving Shabbat up puts it above the day that was over it.
    const before = await list(page).locator("li").evaluateAll((els) => els.map((e) => e.getAttribute("data-occasion")));
    const i = before.indexOf("shabbat");
    await row(page, "shabbat").getByRole("button", { name: "שבת למעלה" }).click();
    const after = await list(page).locator("li").evaluateAll((els) => els.map((e) => e.getAttribute("data-occasion")));
    expect(after.indexOf("shabbat")).toBe(i - 1);
    await expectNotFrozen(page, "reordered");
  });

  test("a dialog for each: what shows on its screen, and the preview on its day", async ({ page }) => {
    await row(page, "shabbat").getByRole("button", { name: "הגדרות" }).click();
    const dialog = page.getByTestId("occasion-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("הכותרת על המסך").fill("שבת קודש לכולם");
    await dialog.getByRole("checkbox", { name: "כל זמני היום" }).check();
    await dialog.getByRole("button", { name: "סגירה" }).click();
    // An ordinary Shabbat (the next one, 3.10, is also Shmini Atzeret, which leads it).
    await list(page).getByLabel("תצוגה לתאריך").fill("2026-10-10");
    const card = page.locator('.tv-frame .tv-occasion[data-occasion="shabbat"]');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.locator(".tv-event-title")).toHaveText("שבת קודש לכולם");
    await expect(card.getByText("עלות השחר")).toBeVisible();
    await expectNotFrozen(page, "shabbat previewed");
  });

  test("a day of the shul's own: a Hebrew date, a line of text, and it is on", async ({ page }) => {
    await page.getByRole("button", { name: "הוספת מועד משלכם" }).click();
    const dialog = page.getByTestId("occasion-dialog");
    await dialog.getByLabel("שם המועד ברשימה").fill("הילולת הרב");
    await dialog.getByLabel("יום בחודש").selectOption("15");
    await dialog.getByLabel("חודש", { exact: true }).selectOption("11");
    await dialog.getByRole("button", { name: "טקסט" }).click();
    await dialog.getByLabel("הטקסט").fill("סעודת הילולא אחרי ערבית");
    await dialog.getByRole("button", { name: "תצוגה בתאריך הקרוב" }).click();
    await dialog.getByRole("button", { name: "סגירה" }).click();
    await expect(list(page)).toContainText("הילולת הרב");
    await expect(list(page)).toContainText("כל שנה, 15 בשבט");
    // Tu BiShvat is a day of its own in the list too; with both on, one screen
    // names them together (the calendar's day is higher in the list).
    await expect(page.locator(".tv-frame").getByText("סעודת הילולא אחרי ערבית")).toBeVisible({ timeout: 10_000 });
    await expectNotFrozen(page, "own day");
  });
});
