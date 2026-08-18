import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";

const routes = [
  ["/", "זמני התפילות"],
  ["/announcements", "מודעות לציבור"],
  ["/shiurim", "שיעורי תורה"],
  ["/chavrutot", "חברותות"],
  ["/contact", "הודעה לגבאי"],
] as const;

const mobileViewports = [
  { name: "small-android", width: 320, height: 700 },
  { name: "iphone", width: 390, height: 844 },
  { name: "large-android", width: 430, height: 932 },
] as const;

async function expectRtlWithoutHorizontalOverflow(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("body")).toHaveCSS("direction", "rtl");

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    htmlWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    mainDirection: getComputedStyle(document.querySelector("main") ?? document.body).direction,
  }));

  expect(layout.mainDirection).toBe("rtl");
  expect(layout.htmlWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
}

for (const viewport of mobileViewports) {
  test.describe(viewport.name, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: true,
      hasTouch: true,
    });

    test("all public routes remain RTL and fit the viewport", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });

      for (const [path, heading] of routes) {
        const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
        expect(response?.status(), path).toBe(200);
        await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
        await expectRtlWithoutHorizontalOverflow(page);
      }

      expect(errors).toEqual([]);
    });
  });
}

test.describe("mobile interactive states", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("primary mobile tabs stay visible and secondary links remain in the menu", async ({
    page,
  }) => {
    await page.goto(`${baseUrl}/`);

    const quickNav = page.getByRole("navigation", { name: "ניווט מהיר" });
    for (const [path, label] of [
      ["/", "זמני תפילות"],
      ["/announcements", "מודעות"],
      ["/shiurim", "שיעורים"],
    ] as const) {
      await expect(quickNav.getByRole("link", { name: label, exact: true })).toBeVisible();
      await quickNav.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : `${path}$`}`));
      await expectRtlWithoutHorizontalOverflow(page);
    }

    await page.getByRole("button", { name: "תפריט" }).click();
    const menu = page.locator("header nav").last();
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCSS("direction", "rtl");
    for (const primaryLabel of ["זמני תפילות", "מודעות", "שיעורים"]) {
      await expect(menu.getByRole("link", { name: primaryLabel, exact: true })).toHaveCount(0);
    }

    for (const [path, label] of [
      ["/chavrutot", "חברותות"],
      ["/contact", "הודעה למנהל"],
    ] as const) {
      await menu.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : `${path}$`}`));
      await expectRtlWithoutHorizontalOverflow(page);
      if (path !== "/contact") {
        await page.getByRole("button", { name: "תפריט" }).click();
      }
    }
  });

  test("the BH mark is unframed and aligned to the right edge", async ({ page }) => {
    await page.goto(`${baseUrl}/`);
    const mark = page.getByLabel("ב״ה");
    await expect(mark).toBeVisible();
    await expect(mark).toHaveCSS("border-top-width", "0px");
    await expect(mark).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const markBox = await mark.boundingBox();
    expect(markBox).not.toBeNull();
    expect(390 - (markBox!.x + markBox!.width)).toBeLessThanOrEqual(20);
  });

  test("all themes and text settings fit mobile", async ({ page }) => {
    await page.goto(`${baseUrl}/`);
    const themes = [
      "נייבי וזהב",
      "אבן ירושלמית",
      "בורדו וזהב",
      "ירוק זית",
      "תכלת ולבן",
      "מצב לילה",
    ];

    for (const theme of themes) {
      await page.getByRole("button", { name: "ערכת נושא" }).click();
      await page.getByRole("menuitem", { name: new RegExp(theme) }).click();
      await expectRtlWithoutHorizontalOverflow(page);
    }

    await page.getByRole("button", { name: "הגדרות טקסט וכתב" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("direction", "rtl");
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390);
    await expectRtlWithoutHorizontalOverflow(page);
    await page.getByRole("button", { name: "ביטול" }).click();
  });

  test("prayer tabs match the synagogue weekly schedule", async ({ page }) => {
    await page.goto(`${baseUrl}/`);

    const prayerTabs = page.locator('[aria-label="סוג תפילה"]');
    await expect(page.getByRole("button", { name: "שבת קודש", exact: true })).toHaveCount(0);
    await expect(prayerTabs.getByRole("button", { name: "שחרית", exact: true })).toBeVisible();
    await expect(prayerTabs.getByRole("button", { name: "מנחה", exact: true })).toBeVisible();
    await expect(prayerTabs.getByRole("button", { name: "ערבית", exact: true })).toBeVisible();

    await prayerTabs.getByRole("button", { name: "מנחה", exact: true }).click();
    await expect(page.getByText("13:30", { exact: true })).toBeVisible();
    await prayerTabs.getByRole("button", { name: "ערבית", exact: true }).click();
    await expect(page.getByText("22:30", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "יום שישי", exact: true }).click();
    await expect(prayerTabs.getByRole("button", { name: "שחרית", exact: true })).toBeVisible();
    await expect(prayerTabs.getByRole("button", { name: "מנחה", exact: true })).toHaveCount(0);
    await expect(prayerTabs.getByRole("button", { name: "ערבית", exact: true })).toHaveCount(0);
    await expect(page.getByText("08:30", { exact: true })).toBeVisible();
    await expectRtlWithoutHorizontalOverflow(page);
  });
});
