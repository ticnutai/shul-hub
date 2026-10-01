import { expect, test, type Page } from "@playwright/test";
import { rememberShul } from "./support/chooseShul";

/**
 * The prayer times on the website, as the gabbai set them in "איך יראו זמני
 * התפילות" (settings.minyan_days / minyan_layout). On the live data of
 * תורה ואהבתה (read only): the setting is laid over the settings row this
 * page receives, so the test never writes to the synagogue.
 */
async function withDisplay(page: Page, display: { minyan_days: string; minyan_layout?: string | null }) {
  await page.route("**/rest/v1/settings?**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const json = Array.isArray(body) ? body.map((r) => ({ ...r, ...display })) : { ...body, ...display };
    await route.fulfill({ response, json });
  });
}

test("each day in its own tab: no week tab, the page opens on today", async ({ page }) => {
  await withDisplay(page, { minyan_days: "day" });
  await rememberShul(page, "torah-veahavata");
  await page.goto("/community");
  await expect(page.getByRole("group", { name: "קטגוריות מניינים" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("minyanim-week")).toHaveCount(0);
  await expect(page.getByTestId("week-schedule")).toHaveCount(0);
});

test("the whole week, today on top: opens on it, today first and marked, each day in the chosen layout", async ({ page }) => {
  await withDisplay(page, { minyan_days: "week_today", minyan_layout: "list" });
  await rememberShul(page, "torah-veahavata");
  await page.goto("/community");
  const schedule = page.getByTestId("week-schedule");
  await expect(schedule.locator("section").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("minyanim-week")).toHaveAttribute("aria-pressed", "true");

  const days = await schedule.locator("section").evaluateAll((els) =>
    els.map((e) => ({ day: e.getAttribute("data-week-day"), today: e.hasAttribute("data-today") })),
  );
  expect(days.length).toBeGreaterThan(1);
  // Whatever today is, the first day is today's (when today has minyanim) and no other is.
  expect(days.filter((d) => d.today).length).toBeLessThanOrEqual(1);
  if (days.some((d) => d.today)) expect(days[0].today).toBe(true);
  // Every day drawn in the layout the gabbai chose.
  const modes = await schedule.locator("[data-minyan-display-mode]").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-minyan-display-mode")),
  );
  expect(new Set(modes)).toEqual(new Set(["list"]));
  // Every minyan's time on one line.
  const heights = await schedule.locator(".font-display").evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight || "28")),
  );
  expect(heights.every((h) => h < 1.6)).toBe(true);

  // A day's own tab goes to that day; "כל השבוע" brings the week back.
  await page.getByRole("group", { name: "קטגוריות מניינים" }).getByRole("button", { name: "ימות החול" }).click();
  await expect(schedule).toHaveCount(0);
  await expect(page.getByTestId("minyanim-week")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("minyanim-week").click();
  await expect(page.getByTestId("week-schedule")).toBeVisible();
});

test("the whole week in a fixed order: the tabs' own order, ימות החול first", async ({ page }) => {
  await withDisplay(page, { minyan_days: "week_fixed" });
  await rememberShul(page, "torah-veahavata");
  await page.goto("/community");
  const schedule = page.getByTestId("week-schedule");
  await expect(schedule.locator("section").first()).toBeVisible({ timeout: 20_000 });
  const days = await schedule.locator("section").evaluateAll((els) => els.map((e) => e.getAttribute("data-week-day")));
  expect(days[0]).toBe("weekday");
});
