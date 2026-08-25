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
  await expect(page.getByTestId("dev-galaxy-preview-trigger")).toHaveCount(0);
  await expect(page.getByTitle("Dev Chat – דבר עם קופיילוט")).toHaveCount(0);
  await expect(page.getByTitle("📸 צלם מסך (Ctrl+Shift+S)")).toHaveCount(0);
  await expect(page.getByTitle("עבור לסיידבר")).toHaveCount(0);
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
      const outerFrame = getComputedStyle(element, "::after");
      return {
        left: rect.left,
        right: rect.right,
        height: rect.height,
        border: style.borderTopColor,
        outerFrameContent: outerFrame.content,
        outerFrameBorder: outerFrame.borderTopWidth,
      };
    }));
    expect(geometry.every(item => item.height <= 36)).toBeTruthy();
    expect(geometry.every(item => item.outerFrameContent === "none" && item.outerFrameBorder === "0px")).toBeTruthy();
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

test("community destinations use a compact strip separated from the main tabs", async ({ page }) => {
  await page.goto("/community/announcements");
  const primary = page.getByRole("navigation", { name: "מדורים ראשיים" });
  const secondary = page.getByRole("navigation", { name: "ניווט קהילתי" });
  await expect(primary).toBeVisible();
  await expect(secondary).toBeVisible();

  const metrics = await secondary.evaluate((element, primarySelector) => {
    const secondaryRect = element.getBoundingClientRect();
    const primaryRect = document.querySelector(primarySelector as string)!.getBoundingClientRect();
    const itemRects = Array.from(element.querySelectorAll(".community-nav-item"), item => item.getBoundingClientRect());
    return {
      viewportWidth: document.documentElement.clientWidth,
      width: secondaryRect.width,
      height: secondaryRect.height,
      gap: secondaryRect.top - primaryRect.bottom,
      maxItemHeight: Math.max(...itemRects.map(rect => rect.height)),
    };
  }, '.primary-destination-nav[aria-label="מדורים ראשיים"]');

  expect(metrics.width).toBeLessThanOrEqual(Math.min(320, metrics.viewportWidth - 72));
  expect(metrics.height).toBeLessThanOrEqual(36);
  expect(metrics.gap).toBeGreaterThanOrEqual(14);
  expect(metrics.maxItemHeight).toBeLessThanOrEqual(32);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the full synagogue name stays visible while management moves to the footer", async ({ page }) => {
  await page.goto("/community");

  const header = page.locator("header").first();
  const title = page.getByTestId("community-site-title");
  await expect(title).toHaveText("בית הכנסת אושר של יהודי");
  await expect(title).toBeVisible();
  await expect(header.getByRole("link", { name: "ניהול האתר" })).toHaveCount(0);

  const footer = page.locator("footer");
  const rabbiContact = footer.getByTestId("community-rabbi-contact");
  await expect(rabbiContact).toBeVisible();
  const topic = footer.getByTestId("community-contact-topic");
  const rabbiName = footer.getByTestId("community-rabbi-name");
  await expect(topic).toHaveText("לכל נושא של יהדות");
  await expect(rabbiName).toHaveText("הרב חיים אושרי");
  const phone = footer.getByTestId("community-phone");
  await expect(phone).toBeVisible();
  await expect(phone).toHaveAttribute("href", /^tel:\+?\d+$/);
  const contactOrder = await Promise.all([
    topic.evaluate(element => element.getBoundingClientRect().top),
    rabbiName.evaluate(element => element.getBoundingClientRect().top),
    phone.evaluate(element => element.getBoundingClientRect().top),
  ]);
  expect(contactOrder[0]).toBeLessThan(contactOrder[1]);
  expect(contactOrder[1]).toBeLessThan(contactOrder[2]);
  const managementLink = footer.getByRole("link", { name: "ניהול האתר" });
  await managementLink.scrollIntoViewIfNeeded();
  await expect(managementLink).toBeVisible();
  await expect(managementLink).toHaveAttribute("href", "/community/admin?tab=settings");

  const placement = await managementLink.evaluate(element => {
    const link = element.getBoundingClientRect();
    const footerRect = element.parentElement!.getBoundingClientRect();
    return {
      width: link.width,
      height: link.height,
      rightInset: footerRect.right - link.right,
      bottomInset: footerRect.bottom - link.bottom,
    };
  });
  expect(placement.width).toBeLessThanOrEqual(36);
  expect(placement.height).toBeLessThanOrEqual(36);
  expect(placement.rightInset).toBeLessThanOrEqual(16);
  expect(placement.bottomInset).toBeGreaterThanOrEqual(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("admin route is protected and renders without exposing management to guests", async ({ page }) => {
  await page.goto("/community/admin");
  await expect(page.getByRole("heading", { name: "ניהול האתר" })).toBeVisible();
  await expect(page.getByText("אין לך הרשאת ניהול")).toBeVisible();
});

test("live design editor is available on synagogue pages and closes cleanly", async ({ page }) => {
  await page.goto("/community?designMode=1");
  const editor = page.getByRole("dialog", { name: "עורך עיצוב חי" });
  await expect(editor).toBeVisible();
  await expect(editor.getByText("בחר רכיב כלשהו בעמוד")).toBeVisible();
  await expect(editor.locator('[data-testid^="live-design-resize-"]')).toHaveCount(8);

  await editor.getByRole("button", { name: "סגירת עורך העיצוב" }).click();
  await expect(editor).toHaveCount(0);
  await expect(page).not.toHaveURL(/designMode=1/);
});

test("restored synagogue themes can be selected and persist", async ({ page }) => {
  await page.goto("/chumash");
  await page.getByRole("button", { name: "פתח ערכות נושא" }).first().click();
  await expect(page.getByText("נייבי וזהב", { exact: true })).toBeVisible();
  await page.getByText("אבן ירושלמית", { exact: true }).first().click();
  await expect(page.locator("html")).toHaveClass(/jerusalem/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/jerusalem/);
});

test("authenticated administrator can open every management section", async ({ page, isMobile }) => {
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

  if (isMobile) {
    const adminTabs = page.getByRole("tablist", { name: "מדורי ניהול" });
    const adminTabsMetrics = await adminTabs.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {
        height: rect.height,
        scrollable: element.scrollWidth > element.clientWidth,
        bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(adminTabsMetrics.height).toBeLessThanOrEqual(52);
    expect(adminTabsMetrics.scrollable).toBeTruthy();
    expect(adminTabsMetrics.bodyOverflow).toBeLessThanOrEqual(1);
  }

  for (const name of ["מודעות", "שיעורים", "חברותות", "בקשות חברותא", "הגדרות", "משתמשים", "ייצוא/ייבוא", "קודי QR"]) {
    const tab = page.getByRole("tab", { name: new RegExp(name) });
    await tab.click();
    await expect(tab).toHaveAttribute("data-state", "active");
  }
  await page.getByRole("tab", { name: "הגדרות", exact: true }).click();
  await expect(page.getByRole("tab", { name: "ערכות נושא" })).toBeVisible();
  await page.getByRole("tab", { name: "ערכות נושא" }).click();
  const themeManagerButton = page.getByRole("button", { name: "פתיחת מנהל ערכות הנושא" });
  const liveDesignButton = page.getByRole("button", { name: "פתיחת עורך עיצוב חי" });
  await expect(themeManagerButton).toBeVisible();
  await expect(liveDesignButton).toBeVisible();

  await themeManagerButton.click();
  const themePanel = page.locator('[data-theme-panel="chumash"]');
  await expect(themePanel).toBeVisible();
  await expect(themePanel.getByText("נייבי וזהב", { exact: true })).toBeVisible();
  if (isMobile) {
    const panelMetrics = await themePanel.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(panelMetrics.top).toBeLessThanOrEqual(1);
    expect(panelMetrics.left).toBeLessThanOrEqual(1);
    expect(Math.abs(panelMetrics.width - panelMetrics.viewportWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(panelMetrics.height - panelMetrics.viewportHeight)).toBeLessThanOrEqual(1);
    expect(panelMetrics.overflow).toBeLessThanOrEqual(1);
  }
  await themePanel.getByTitle("סגור").click();

  await liveDesignButton.click();
  await expect(page).toHaveURL(/\/community\?designMode=1/);
  await expect(page.getByRole("dialog", { name: "עורך עיצוב חי" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
