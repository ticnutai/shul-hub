import { expect, test } from "@playwright/test";

const publicRoutes = [
  ["/community", "זמני התפילות"],
  ["/community/announcements", "מודעות לציבור"],
  ["/community/shiurim", "שיעורי תורה"],
  ["/community/chavrutot", "חברותות"],
  ["/community/contact", "הודעה לגבאי"],
] as const;

test("Pash remains the full primary Torah experience and exposes community", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.locator("header")).toBeVisible();
  await expect(page.locator('button[title="בית הכנסת והקהילה"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-layout="sefer-selector"]')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

for (const [route, heading] of publicRoutes) {
  test(`${route} loads in RTL without runtime errors`, async ({ page }) => {
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("requestfailed", request => {
      if (!request.url().startsWith("ws:")) failedRequests.push(`${request.method()} ${request.url()}`);
    });
    const response = await page.goto(route);
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expect(page.locator("header")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("body")).toHaveCSS("direction", "rtl");
    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
}

test("community navigation stays usable at mobile width", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only assertion");
  await page.goto("/community");
  const nav = page.getByRole("navigation", { name: "ניווט קהילתי" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: /שיעורים/ }).click();
  await expect(page).toHaveURL(/\/community\/shiurim$/);
  await expect(page.getByRole("heading", { name: "שיעורי תורה" })).toBeVisible();
  const bodyWidth = await page.locator("body").evaluate(el => el.scrollWidth - el.clientWidth);
  expect(bodyWidth).toBeLessThanOrEqual(1);
});

test("admin route is protected and renders without exposing management to guests", async ({ page }) => {
  await page.goto("/community/admin");
  await expect(page.getByRole("heading", { name: "ניהול האתר" })).toBeVisible();
  await expect(page.getByText("אין לך הרשאת ניהול")).toBeVisible();
});

test("authenticated administrator can open every management section", async ({ page }) => {
  const email = process.env.QA_ADMIN_EMAIL;
  const password = process.env.QA_ADMIN_PASSWORD;
  test.skip(!email || !password, "QA admin credentials are not configured");

  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/auth");
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה").fill(password!);
  await page.getByRole("button", { name: "התחבר", exact: true }).click();
  await page.waitForURL(url => !url.pathname.endsWith("/auth"));
  const storedSession = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(item => item.startsWith("sb-") && item.endsWith("-auth-token"));
    if (!key) return { present: false, email: null };
    try {
      return { present: true, email: JSON.parse(localStorage.getItem(key) ?? "null")?.user?.email ?? null };
    } catch {
      return { present: true, email: null };
    }
  });
  expect(storedSession).toEqual({ present: true, email });
  await page.goto("/community/admin");
  await expect(page.getByRole("tab", { name: "מניינים" })).toBeVisible();

  for (const name of ["מודעות", "שיעורים", "חברותות", "בקשות חברותא", "הגדרות", "משתמשים", "ייצוא/ייבוא", "קודי QR"]) {
    const tab = page.getByRole("tab", { name: new RegExp(name) });
    await tab.click();
    await expect(tab).toHaveAttribute("data-state", "active");
  }
  expect(pageErrors).toEqual([]);
});
