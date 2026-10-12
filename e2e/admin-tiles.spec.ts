import { expect, test } from "@playwright/test";
import { canFakeGabbai, fakeGabbai } from "./support/fakeGabbai";

/**
 * The gabbai's area as tiles: each step opens the next in the whole frame,
 * the path back at the top, the phone's back button a step back. The tabs
 * stay, as another way to the same screens.
 */
test.describe("the gabbai's area, as tiles", () => {
  test.skip(!canFakeGabbai, "no Supabase address in .env");

  test("on a phone: מניינים → a day → a prayer → its list; back by the path and by the phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fakeGabbai(page);
    await page.goto("/community/admin");
    const home = page.getByTestId("admin-home");
    await expect(home).toBeVisible({ timeout: 30_000 });
    await expect(home.getByTestId("admin-tile-announcements")).toBeVisible();

    await home.getByTestId("admin-tile-minyanim").click();
    const path = page.getByTestId("admin-path");
    await expect(path).toContainText("מניינים");
    // A day (when there are several) - and the two tiles beside the days.
    const day = page.locator('[data-testid^="minyan-tile-"]').filter({ hasNotText: "שינויים ליום מסוים" }).filter({ hasNotText: "ימים, תפילות ותצוגה" }).first();
    await expect(day).toBeVisible();
    const dayName = (await day.locator("span.font-semibold").first().textContent())!.trim();
    await day.click();
    await expect(path).toContainText(dayName);
    // A prayer, when the day has several.
    const prayerTile = page.locator('[data-testid^="minyan-tile-prayer-"]').first();
    if (await prayerTile.count()) {
      const prayer = (await prayerTile.locator("span.font-semibold").first().textContent())!.trim();
      await prayerTile.click();
      await expect(path).toContainText(prayer);
    }
    // The list itself, without its own rows of tabs - the tiles stood in their place.
    await expect(page.getByRole("button", { name: "מניין חדש" })).toBeVisible();
    await expect(page.getByRole("group", { name: "קטגוריות מניינים" })).toHaveCount(0);

    // The phone's back button: a step back.
    await page.goBack();
    await expect(page.locator('[data-testid^="minyan-tile-"]').first()).toBeVisible();
    // The path's "ראשי": home.
    await path.getByRole("button", { name: /ראשי/ }).click();
    await expect(home).toBeVisible();
  });

  test("תצוגות → עיצוב: the editor with its preview beside it", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fakeGabbai(page);
    await page.goto("/community/admin?tab=tv");
    await page.getByTestId("tv-tile-design").click();
    await expect(page.getByTestId("admin-path")).toContainText("עיצוב");
    await expect(page.locator("[data-board-preview] .tv-frame").first()).toBeVisible({ timeout: 30_000 });
  });

  test("the tabs stay: switched to, and back to the tiles", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await fakeGabbai(page);
    await page.goto("/community/admin");
    const tabs = page.getByRole("tablist", { name: "מדורי ניהול" });
    // A computer opens on the tabs, as it always did.
    await expect(tabs).toBeVisible({ timeout: 30_000 });
    const sw = page.getByTestId("admin-layout-switch");
    await sw.getByRole("radio", { name: "אריחים" }).click();
    await expect(page.getByTestId("admin-home")).toBeVisible();
    await expect(tabs).toHaveCount(0);
    await sw.getByRole("radio", { name: "לשוניות" }).click();
    await expect(page.getByRole("tablist", { name: "מדורי ניהול" })).toBeVisible();
  });
});
