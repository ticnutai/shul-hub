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
    await expect(page.getByRole("group", { name: "לשוניות מניינים" })).toHaveCount(0);

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
    const choose = async (name: string) => {
      // A menu just chosen from closes first; then the chooser opens.
      await expect(page.getByRole("menu")).toHaveCount(0);
      await page.getByTestId("admin-layout-switch").click();
      await page.getByRole("menuitemradio", { name: new RegExp(`^${name}`) }).click();
    };
    await choose("אריחים");
    await expect(page.getByTestId("admin-home")).toBeVisible();
    await expect(tabs).toHaveCount(0);
    await choose("רשימה");
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

  test("ימים, תפילות ותצוגה: the tabs and how they are shown, not the list of minyanim again", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fakeGabbai(page);
    await page.goto("/community/admin?tab=minyanim");
    await page.getByTestId("minyan-tile-manage").click({ timeout: 30_000 });
    await expect(page.getByRole("group", { name: "לשוניות מניינים" })).toBeVisible();
    await expect(page.getByTestId("prayer-display")).toBeVisible();
    await expect(page.getByRole("button", { name: "מניין חדש" })).toHaveCount(0);
    // "לשונית שבת" is a template of the new-tab form now, not a button of its own.
    await expect(page.getByRole("button", { name: "לשונית שבת" })).toHaveCount(0);
  });
});

/**
 * The shiurim's categories: renamed and deleted where they are listed - a
 * shiur in a deleted category stays, with no category. Nothing is written:
 * the requests the page would send are caught and read here.
 */
test.describe("the shiurim's categories", () => {
  test.skip(!canFakeGabbai, "no Supabase address in .env");

  test("renamed by typing over the name, deleted after asking - its shiurim kept", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await fakeGabbai(page);
    const category = { id: "00000000-0000-4000-8000-0000000000c1", community_id: null, name: "קטגוריה לבדיקה", sort_order: 10, created_at: new Date().toISOString() };
    const shiur = {
      id: "00000000-0000-4000-8000-0000000000c2", community_id: null, title: "שיעור לבדיקה", teacher: "", day_of_week: 0,
      time_text: "", location: "", description: "", category_id: category.id, schedule_type: "weekly", sort_order: 10,
      active: true, notification_enabled: false, reminder_minutes: 15, created_at: new Date().toISOString(),
    };
    const fulfil = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    await page.route("**/rest/v1/shiur_categories**", (route) =>
      route.request().method() === "GET" ? route.fulfill(fulfil([category])) : route.fallback(),
    );
    await page.route("**/rest/v1/shiurim**", (route) =>
      route.request().method() === "GET" ? route.fulfill(fulfil([shiur])) : route.fallback(),
    );
    const writes: { method: string; url: string; body: string }[] = [];
    page.on("request", (req) => {
      if (req.method() !== "GET" && req.url().includes("/rest/v1/")) writes.push({ method: req.method(), url: req.url(), body: req.postData() ?? "" });
    });

    await page.goto("/community/admin?tab=shiurim");
    const panel = page.getByTestId("shiur-categories");
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await panel.getByRole("button", { name: /קטגוריות השיעורים/ }).click();

    // Renamed: typed over, and saved when the field is left.
    const name = panel.getByRole("textbox", { name: `שם הקטגוריה ${category.name}` });
    await name.fill("שם חדש לבדיקה");
    await name.press("Enter");
    await expect.poll(() => writes.find((w) => w.method === "PATCH" && w.url.includes("/shiur_categories"))?.body ?? "").toContain("שם חדש לבדיקה");

    // Deleted: asked first, its shiur kept (without a category), then the category goes.
    await panel.getByRole("button", { name: `מחיקת הקטגוריה ${category.name}` }).click();
    const dialog = page.getByTestId("confirm-dialog");
    await expect(dialog).toContainText(`למחוק את הקטגוריה „${category.name}”?`);
    await expect(dialog).toContainText("יישארו, בלי קטגוריה");
    await dialog.getByRole("button", { name: "מחיקה", exact: true }).click();
    await expect.poll(() => writes.some((w) => w.method === "DELETE" && w.url.includes("/shiur_categories") && w.url.includes(category.id))).toBe(true);
    const kept = writes.find((w) => w.method === "PATCH" && w.url.includes("/shiurim"));
    expect(kept?.body).toContain('"category_id":null');
    expect(writes.some((w) => w.method === "DELETE" && w.url.includes("/shiurim?"))).toBe(false);
  });
});

/** Unsaved changes, and links from before sections were merged. */
test.describe("moving around the gabbai's area", () => {
  test.skip(!canFakeGabbai, "no Supabase address in .env");

  test("leaving a half-filled form for another section asks first", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await fakeGabbai(page);
    await page.goto("/community/admin?tab=announcements");
    await page.getByRole("button", { name: "מודעה חדשה" }).click({ timeout: 30_000 });
    await page.getByPlaceholder("מזל טוב למשפחת…").fill("מודעה שלא נשמרה");

    const tabs = page.getByRole("tablist", { name: "מדורי ניהול" });
    await tabs.getByRole("tab", { name: "שיעורים" }).click();
    const dialog = page.getByTestId("confirm-dialog");
    await expect(dialog).toContainText("לצאת בלי לשמור?");
    // "ביטול": stays, the form as it was.
    await dialog.getByRole("button", { name: "ביטול", exact: true }).click();
    await expect(tabs.getByRole("tab", { name: "מודעות" })).toHaveAttribute("data-state", "active");
    await expect(page.getByPlaceholder("מזל טוב למשפחת…")).toHaveValue("מודעה שלא נשמרה");

    // Leaving after all: the other section opens.
    await tabs.getByRole("tab", { name: "שיעורים" }).click();
    await dialog.getByRole("button", { name: "יציאה בלי שמירה" }).click();
    await expect(tabs.getByRole("tab", { name: "שיעורים" })).toHaveAttribute("data-state", "active");
    await expect(page).toHaveURL(/tab=shiurim/);
  });

  test("an unchanged form leaves without asking", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await fakeGabbai(page);
    await page.goto("/community/admin?tab=announcements");
    await page.getByRole("button", { name: "מודעה חדשה" }).click({ timeout: 30_000 });
    const tabs = page.getByRole("tablist", { name: "מדורי ניהול" });
    await tabs.getByRole("tab", { name: "שיעורים" }).click();
    await expect(tabs.getByRole("tab", { name: "שיעורים" })).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
  });

  for (const [old, tab, panel] of [
    ["api", "ai", "api-keys"],
    ["qr", "share", "qr-codes"],
    ["apps", "share", "app-downloads"],
  ] as const) {
    test(`an old link to ?tab=${old} opens the section it is part of now`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 900 });
      await fakeGabbai(page);
      await page.goto(`/community/admin?tab=${old}`);
      await expect(page).toHaveURL(new RegExp(`tab=${tab}`), { timeout: 30_000 });
      await expect(page.getByTestId(panel)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("tablist", { name: "מדורי ניהול" }).getByRole("tab", { selected: true })).toHaveAttribute("data-state", "active");
    });
  }

  test("an old link opens the merged section from the tiles too", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fakeGabbai(page);
    await page.goto("/community/admin?tab=api");
    await expect(page).toHaveURL(/tab=ai/, { timeout: 30_000 });
    await expect(page.getByTestId("admin-path")).toContainText("עוזר חכם");
    await expect(page.getByTestId("api-keys")).toBeVisible();
  });
});

