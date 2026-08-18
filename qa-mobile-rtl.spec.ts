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

  test("menu opens in RTL and every public link navigates", async ({ page }) => {
    await page.goto(`${baseUrl}/`);

    for (const [path, label] of [
      ["/announcements", "מודעות"],
      ["/shiurim", "שיעורים"],
      ["/chavrutot", "חברותות"],
      ["/contact", "הודעה למנהל"],
      ["/", "זמני תפילות"],
    ] as const) {
      await page.getByRole("button", { name: "תפריט" }).click();
      const nav = page.locator("header nav").last();
      await expect(nav).toBeVisible();
      await expect(nav).toHaveCSS("direction", "rtl");
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : `${path}$`}`));
      await expectRtlWithoutHorizontalOverflow(page);
    }
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
});
