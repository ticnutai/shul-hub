import { expect, test } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";

test("notification toggle stays enabled when system permission is blocked", async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] });
  await context.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { configurable: true, value: "denied" });
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`);
  await page.getByRole("button", { name: "הגדרות התראות" }).click();

  const toggle = page.getByRole("switch", { name: "הפעלת התראות" });
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByText("התזכורות הופעלו בתוך האתר", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("shul-notification-preferences-v1") ?? "{}").enabled,
      ),
    )
    .toBe(true);
  await context.close();
});

test("admin can toggle reminders while editing a minyan", async ({ page }) => {
  const email = process.env.QA_ADMIN_EMAIL;
  const password = process.env.QA_ADMIN_PASSWORD;
  test.skip(!email || !password, "Admin credentials are required");

  await page.goto(`${baseUrl}/auth`);
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה").fill(password!);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page
    .getByRole("button", { name: /^עריכת / })
    .first()
    .click();

  const toggle = page.getByRole("switch", { name: "לאפשר תזכורת למניין" });
  const initial = await toggle.isChecked();
  await toggle.click();
  await expect(toggle).toBeChecked({ checked: !initial });
});
