import { expect, test, type Page } from "@playwright/test";
import { canFakeGabbai, fakeGabbai } from "./support/fakeGabbai";

/**
 * The three layouts beside the tabs and the tiles - a side menu, a row of
 * menus, a search - each another way into the same screens: one way to
 * choose on the screen, never two.
 */
async function choose(page: Page, name: string) {
  // A menu just chosen from closes first; then the chooser opens.
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByTestId("admin-layout-switch").click();
  await page.getByRole("menuitemradio", { name: new RegExp(`^${name}`) }).click();
}

test.describe("the gabbai's area, laid out other ways", () => {
  test.skip(!canFakeGabbai, "no Supabase address in .env");

  test("a side menu: the sections in groups, the screen beside it, folded to icons", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await fakeGabbai(page);
    await page.goto("/community/admin");
    await expect(page.getByTestId("admin-layout-switch")).toBeVisible({ timeout: 30_000 });
    await choose(page, "תפריט צד");
    const menu = page.getByTestId("admin-side-menu");
    await expect(menu.getByRole("group")).toHaveCount(4);
    // One way to choose: no row of tabs as well, and the synagogues in the menu, not a button above it too.
    await expect(page.getByRole("tablist", { name: "מדורי ניהול" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "בתי כנסת ופרטים" })).toHaveCount(1);
    await menu.getByRole("button", { name: "מודעות" }).click();
    await expect(menu.getByRole("button", { name: "מודעות" })).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveURL(/tab=announcements/);
    await menu.getByRole("button", { name: "צמצום התפריט" }).click();
    await expect(menu.getByRole("button", { name: "מודעות" })).toBeVisible();
    await expect(menu).toHaveCSS("width", "56px");
    await choose(page, "רשימה");
  });

  test("menus: a group opens its sections; where one is, beside them", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await fakeGabbai(page);
    await page.goto("/community/admin");
    await expect(page.getByTestId("admin-layout-switch")).toBeVisible({ timeout: 30_000 });
    await choose(page, "תפריטים");
    const menus = page.getByTestId("admin-menus");
    await menus.getByRole("button", { name: "קהילה ופניות" }).click();
    await page.getByRole("menuitem", { name: /^מודעות/ }).click();
    await expect(page).toHaveURL(/tab=announcements/);
    await expect(page.getByTestId("admin-menus-where")).toContainText("מודעות");
    await expect(page.getByRole("tablist", { name: "מדורי ניהול" })).toHaveCount(0);
    await choose(page, "רשימה");
  });

  test("search: found by a word, opened, back to the search; what was opened shown first", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await fakeGabbai(page);
    await page.goto("/community/admin");
    await expect(page.getByTestId("admin-layout-switch")).toBeVisible({ timeout: 30_000 });
    await choose(page, "חיפוש");
    await page.goto("/community/admin");
    const box = page.getByRole("searchbox", { name: "מה לנהל?" }).or(page.getByLabel("מה לנהל?", { exact: true }));
    await box.fill("רקע");
    // The boards' steps are places too: "עיצוב" holds the background.
    await expect(page.getByTestId("admin-search-tv:design:design")).toBeVisible();
    await box.fill("מודעות");
    await box.press("Enter");
    await expect(page).toHaveURL(/tab=announcements/);
    await page.getByTestId("admin-search-back").click();
    await expect(page.getByText("נפתחו לאחרונה")).toBeVisible();
    await choose(page, "רשימה");
  });
});
