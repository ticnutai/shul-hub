import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("fab_position");
    localStorage.removeItem("fab_position_ts");
  });
});

test("mobile yellow action opens the compact Torah selector directly", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-android", "Mobile-only behavior");
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/chumash");
  const yellowAction = page.locator('[data-layout="fab-toggle"]');
  await expect(yellowAction).toBeVisible();
  await yellowAction.click();

  const selector = page.getByTestId("mobile-torah-selector");
  await expect(selector).toBeVisible();
  await expect(selector.getByRole("heading", { name: "פרשות" })).toBeVisible();
  await expect(page.getByPlaceholder("חיפוש בתורה...")).toBeHidden();

  const actionBar = page.getByTestId("mobile-selector-actions");
  await expect(actionBar.getByRole("button", { name: "חיפוש" })).toBeVisible();
  await actionBar.getByRole("button", { name: "פעולות נוספות" }).click();
  for (const label of ["סימניות", "הערות", "שיתוף", "הגדרות"]) {
    await expect(actionBar.getByRole("button", { name: label })).toBeVisible();
  }

  const parshaGrid = selector.locator('[data-selector-level="parsha"]');
  await expect(parshaGrid.locator("button").first()).toBeVisible();
  expect(await parshaGrid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(2);
  await parshaGrid.locator("button").first().click();

  const perekGrid = selector.locator('[data-selector-level="perek"]');
  await expect(selector.getByRole("heading", { name: "פרקים" })).toBeVisible();
  await expect(perekGrid.locator("button").first()).toBeVisible();
  expect(await perekGrid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(4);
  expect((await perekGrid.locator("button").allTextContents()).some(text => text.includes("פרק"))).toBeFalsy();
  await perekGrid.locator("button").first().click();

  const pasukGrid = selector.locator('[data-selector-level="pasuk"]');
  await expect(selector.getByRole("heading", { name: "פסוקים" })).toBeVisible();
  await expect(pasukGrid.locator("button").first()).toBeVisible();
  expect(await pasukGrid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(5);
  expect((await pasukGrid.locator("button").allTextContents()).some(text => text.includes("פסוק"))).toBeFalsy();

  const overflow = await selector.evaluate(element => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(pageErrors).toEqual([]);
});

test("desktop keeps the existing intermediate action menu", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop regression check");
  await page.goto("/chumash");
  await page.locator('[data-layout="fab-toggle"]').click();
  await expect(page.getByPlaceholder("חיפוש בתורה...")).toBeVisible();
  await expect(page.getByTestId("mobile-torah-selector")).toBeHidden();
});
