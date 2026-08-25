import { expect, test } from "@playwright/test";

const publicRoutes = [
  ["/community", "זמני התפילות"],
  ["/community/announcements", "מודעות לציבור"],
  ["/community/shiurim", "שיעורי תורה"],
  ["/community/chavrutot", "חברותות"],
  ["/community/contact", "הודעה לגבאי"],
] as const;

test("the default route opens the synagogue and exposes clear primary tabs", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveURL(/\/community$/);
  const primaryNav = page.getByRole("navigation", { name: "מדורים ראשיים" });
  await expect(primaryNav.getByRole("link", { name: "בית הכנסת" })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "סידור" })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "חומש ומפרשים" })).toBeVisible();
  const communityNav = page.getByRole("navigation", { name: "ניווט קהילתי" });
  await expect(communityNav.getByRole("link", { name: "שיעורים" })).toBeVisible();
  await expect(communityNav.getByRole("link", { name: "חברותות" })).toBeVisible();
  await expect(communityNav.getByRole("link", { name: "מודעות" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("the full Pash Torah experience remains available under the Chumash tab", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/chumash");
  await expect(page.locator('[data-layout="sefer-selector"]')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("the Siddur uses the same primary navigation row as Chumash", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/siddur");

  const primaryNav = page.getByRole("navigation", { name: "מדורים ראשיים" });
  await expect(primaryNav.getByRole("link", { name: "חומש ומפרשים" })).toBeVisible();
  await expect(primaryNav.locator('[aria-current="page"]')).toHaveText("סידור");
  await expect(primaryNav.getByRole("link", { name: "בית הכנסת" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "סידור תפילה" })).toHaveCount(0);

  const overflow = await page.locator("body").evaluate(el => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(pageErrors).toEqual([]);
});

test("fresh Siddur installs use the current continuous David Libre reading defaults", async ({ page }) => {
  await page.goto("/siddur");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const root = page.locator("[data-siddur-theme]");
  await expect(root).toHaveAttribute("data-siddur-view-mode", "continuous");
  await expect(root).toHaveAttribute("data-siddur-font", "David Libre");
  await expect(root).toHaveAttribute("data-siddur-content-width", "narrow");
  await expect(root).toHaveAttribute("data-siddur-text-alignment", "right");
  await expect(root).toHaveAttribute("data-siddur-heading-bold", "true");
  await expect(root).toHaveAttribute("data-siddur-opening-bold", "true");
  await expect(root).toHaveAttribute("data-siddur-show-taamim", "false");
});

test("all three main screens share compact, separate destination controls", async ({ page }) => {
  for (const [route, activeLabel] of [
    ["/community", "בית הכנסת"],
    ["/siddur", "סידור"],
    ["/chumash", "חומש ומפרשים"],
  ] as const) {
    await page.goto(route);
    const nav = page.getByRole("navigation", { name: "מדורים ראשיים" });
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(3);
    await expect(nav.locator('[aria-current="page"]')).toHaveText(activeLabel);

    const geometry = await links.evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { left: rect.left, right: rect.right, height: rect.height, border: style.borderTopColor };
    }));
    expect(geometry.every(item => item.height <= 36)).toBeTruthy();
    const visualOrder = [...geometry].sort((a, b) => a.left - b.left);
    for (let index = 1; index < visualOrder.length; index += 1) {
      expect(visualOrder[index].left - visualOrder[index - 1].right).toBeGreaterThanOrEqual(4);
    }
  }
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
