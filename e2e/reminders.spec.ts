import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 150_000 });
import { rememberShul } from "./support/chooseShul";

/**
 * The bell in the header: a minyan the member asked to be reminded of comes
 * as a message on the page, its minutes before (Shabbat and festivals:
 * reminderPlan.test.ts). On a
 * live synagogue's page (read only); its minyanim are replaced by one made
 * for the test, so the time is known.
 */

const PREFS = "shul-notification-preferences-v1";

async function withMinyan(page: Page, fixedTime: string, dayType = "weekday") {
  const minyan = {
    id: "00000000-0000-4000-8000-0000000000aa",
    community_id: "x",
    label: "שחרית בדיקה",
    active: true,
    notification_enabled: true,
    reminder_minutes: 10,
    time_mode: "fixed",
    fixed_time: fixedTime,
    relative_to: null,
    offset_minutes: 0,
    day_type: dayType,
    category_id: null,
    active_from: null,
    active_until: null,
    room: "היכל",
    note: "",
    prayer: "shacharit",
    sort_order: 0,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };
  await page.route("**/rest/v1/minyanim?**", (route) => route.fulfill({ json: [minyan] }).catch(() => {}));
  await page.route("**/rest/v1/minyan_categories?**", (route) => route.fulfill({ json: [] }).catch(() => {}));
  await page.route("**/rest/v1/minyan_overrides?**", (route) => route.fulfill({ json: [] }).catch(() => {}));
}

async function remindersOn(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ enabled: true, minyanim: true, sound: true }));
  }, PREFS);
}

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message, (e.stack ?? "").slice(0, 600)));
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

/** Now in Jerusalem: the weekday (0 = Sunday) and the time `ahead` minutes from now, as HH:MM. */
function jerusalem(aheadMinutes: number) {
  const at = new Date(Date.now() + aheadMinutes * 60_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", hourCycle: "h23", weekday: "short", hour: "2-digit", minute: "2-digit" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday), hhmm: `${parts.hour}:${parts.minute}` };
}

test("a minyan is reminded on the page its minutes before, with the room - and only once", async ({ page }) => {
  // A minyan 11 minutes from now, reminded 10 before: due within the minute.
  // (A fake clock cannot be used: it breaks the date formatting the page relies on.)
  const now = jerusalem(0);
  const start = jerusalem(11);
  test.skip(now.weekday >= 5 || start.hhmm < now.hhmm, "on a weekday, away from midnight - Friday and Shabbat have their own tests");
  await withMinyan(page, start.hhmm);
  await remindersOn(page);
  await rememberShul(page, "torah-veahavata");
  await page.goto("/community");
  const reminder = page.getByText(`שחרית בדיקה ${start.hhmm}`);
  await expect(reminder).toBeVisible({ timeout: 100_000 });
  await expect(page.getByText("בעוד 10 דקות · היכל")).toBeVisible();

  // Told once: a reload does not tell it again.
  await page.reload();
  await expect(page.getByRole("button", { name: "הגדרות התראות" })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(35_000);
  await expect(reminder).toHaveCount(0);
});

test("the bell: sound on or off, and a try that shows what a reminder looks like", async ({ page }) => {
  await remindersOn(page);
  await rememberShul(page, "torah-veahavata");
  await page.goto("/community");
  await page.getByRole("button", { name: "הגדרות התראות" }).click({ timeout: 20_000 });
  const how = page.getByTestId("reminder-how");
  await expect(how).toBeVisible();
  // No alarm-clock ring in a browser: only the app can.
  await expect(page.getByLabel("מניין מצלצל כמו שעון מעורר")).toHaveCount(0);
  await page.getByLabel("צליל עם כל התראה").click();
  await expect
    .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").sound, PREFS))
    .toBe(false);
  await how.getByRole("button", { name: "לנסות: כך תיראה תזכורת" }).click();
  await expect(page.getByText("בדיקה: מנחה 13:30").first()).toBeVisible();
});
