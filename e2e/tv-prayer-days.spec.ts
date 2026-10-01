import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";

/**
 * The board's own choice of days for the prayer times (tv_config.prayerDays),
 * in the layout tab: today alone, as it always was, or the whole week - the
 * medallion's prayer frame then shows today, and then each following day in
 * turn, and only today's minyanim are "הבא". The website has its own setting.
 */
const HARNESS = "/e2e/harness/editor.html";

const day = (id: string, name: string, system_key: string | null, sort_order: number) => ({
  id, name, system_key, sort_order, active: true, visible_from: null, visible_until: null,
  subcategories: [], display_mode: "tabs",
});
const minyan = (id: string, label: string, fixed: string, category_id: string, day_type: string) => ({
  id, label, prayer: "shacharit", day_type, time_mode: "fixed", fixed_time: fixed, relative_to: null,
  offset_minutes: 0, category_id, sort_order: 1, active: true, note: "", room: "", reminder_minutes: 0,
  notification_enabled: false, active_from: null, active_until: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
});

test("the whole week on the board: today first, then each day in turn, 'הבא' only today", async ({ page }) => {
  // Whatever day the test runs on: today first, then the days as they come.
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Jerusalem" }).format(new Date()),
  );
  const after = weekday <= 4 ? ["יום שישי", "שבת"] : weekday === 5 ? ["שבת", "ימות החול"] : ["ימות החול", "יום שישי"];
  await serveEditor(page, {
    screenLayout: "medallion",
    slides: [{ kind: "prayer", enabled: true, seconds: 5, layout: "split" }],
    screens: [{ id: "a", name: "הלוח", seconds: 60, blocks: [{ block: "header" }, { block: "prayers" }, { block: "zmanim" }] }],
  });
  // A week to show: weekdays, Friday and Shabbat (registered after the
  // harness's routes, so these answer first).
  await page.route("**/rest/v1/minyan_categories?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([day("c1", "ימות החול", "weekday", 1), day("c3", "יום שישי", "friday", 2), day("c4", "שבת", "shabbat", 3)]),
    }),
  );
  await page.route("**/rest/v1/minyanim?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        minyan("m1", "שחרית א'", "06:15:00", "c1", "weekday"),
        minyan("m2", "מנחה", "13:30:00", "c1", "weekday"),
        minyan("f1", "שחרית שישי", "07:00:00", "c3", "friday"),
        minyan("s1", "שחרית שבת", "08:30:00", "c4", "shabbat"),
      ]),
    }),
  );

  const res = await page.goto(HARNESS).catch(() => null);
  test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
  const board = page.locator(".tv-frame").first();
  const prayers = board.locator(".tv-med-list").first();
  await expect(prayers).toBeVisible({ timeout: 20_000 });
  // As before: today alone.
  await expect(prayers.locator("h3")).toHaveText("תפילות היום");

  await page.getByRole("tab", { name: "פריסה" }).click();
  const choice = page.getByTestId("board-prayer-days").getByRole("button", { name: /כל השבוע · היום ראשון/ });
  await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");

  // Today, then each following day - one after another, in that order.
  const seen: string[] = [];
  await expect
    .poll(
      async () => {
        const title = (await prayers.locator("h3").textContent())?.trim() ?? "";
        if (seen.at(-1) !== title) seen.push(title);
        return seen.join(" | ");
      },
      { timeout: 25_000, intervals: [500] },
    )
    .toContain(["תפילות היום", ...after.map((d) => `תפילות ${d}`)].join(" | "));

  // Another day's turn: its own minyanim, and none of them "הבא" or over,
  // whatever the clock says.
  await expect(prayers.locator("h3")).toHaveText(`תפילות ${after[1]}`, { timeout: 20_000 });
  await expect(prayers.locator("li")).not.toHaveCount(0);
  await expect(prayers.locator(".is-next")).toHaveCount(0);
});
