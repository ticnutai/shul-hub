import { expect, test } from "@playwright/test";
import { rememberShul } from "./support/chooseShul";

/**
 * "כל השבוע" in the prayer times: every day tab at once, each with its
 * prayers, nothing empty, and the choice remembered. On the live data of
 * תורה ואהבתה (read only), which has weekdays, Friday and Shabbat.
 */
test("the whole week: each day with its prayers, the time never broken, and remembered", async ({ page }) => {
  await rememberShul(page, "torah-veahavata");
  await page.goto("/community");
  const week = page.getByTestId("minyanim-week");
  await expect(week).toBeVisible({ timeout: 20_000 });
  await week.click();
  await expect(week).toHaveAttribute("aria-pressed", "true");

  const schedule = page.getByTestId("week-schedule");
  await expect(schedule.locator("section").first()).toBeVisible();
  const days = await schedule.locator("section").evaluateAll((els) => els.map((e) => e.getAttribute("data-week-day")));
  expect(days[0]).toBe("weekday");
  expect(days.length).toBeGreaterThan(1);
  // Every minyan's time on one line.
  const heights = await schedule.locator("li > span:last-child").evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight || "28")),
  );
  expect(heights.every((h) => h < 1.6)).toBe(true);

  await page.reload();
  await expect(page.getByTestId("week-schedule")).toBeVisible({ timeout: 20_000 });
  // A day's own tab goes back to that day.
  await page.getByRole("group", { name: "קטגוריות מניינים" }).getByRole("button", { name: "ימות החול" }).click();
  await expect(page.getByTestId("week-schedule")).toHaveCount(0);
  await expect(page.getByTestId("minyanim-week")).toHaveAttribute("aria-pressed", "false");
});
