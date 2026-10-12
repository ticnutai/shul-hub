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
    // By their marks, not their words: the two tiles beside the days are worded in Hebrew that may change.
    const day = page.locator('[data-testid^="minyan-tile-"]:not([data-testid="minyan-tile-overrides"]):not([data-testid="minyan-tile-manage"])').first();
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

  test("deleting an announcement asks first, and \"ביטול\" leaves it", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await fakeGabbai(page);
    const deletes: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "DELETE") deletes.push(req.url());
    });
    // One announcement of our own, whatever the synagogue has: the list is
    // read here, so there is always a row to try deleting.
    const announcement = {
      id: "00000000-0000-4000-8000-0000000000a1", community_id: null, kind: "general", title: "מודעה לבדיקה",
      body: "", pinned: false, notification_enabled: false, show_on_home: false, home_width: "half",
      image_url: null, image_path: null, expires_at: null, sort_order: 10, style: null,
      created_at: new Date().toISOString(),
    };
    await page.route("**/rest/v1/announcements**", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([announcement]) })
        : route.fallback(),
    );
    await page.goto("/community/admin?tab=announcements");
    const list = page.getByTestId("announcements-sort-list");
    await expect(list).toBeVisible({ timeout: 30_000 });
    const row = list.getByTestId(`announcement-row-${announcement.id}`);
    await expect(row).toBeVisible({ timeout: 30_000 });
    const remove = row.getByRole("button", { name: "מחיקת מודעה לבדיקה" });
    await remove.click();
    const dialog = page.getByTestId("confirm-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("למחוק את המודעה „מודעה לבדיקה”?");
    await dialog.getByRole("button", { name: "ביטול", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row).toBeVisible();
    expect(deletes).toEqual([]);
  });
});
