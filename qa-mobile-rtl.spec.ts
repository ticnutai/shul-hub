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

async function waitForInteractiveHeader(page: Page) {
  await expect(page.locator("header[data-app-hydrated='true']")).toBeVisible();
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

    test("mobile header title is centered while the BH mark stays at the right edge", async ({
      page,
    }) => {
      await page.goto(`${baseUrl}/`);
      const titleBox = await page.getByTestId("site-header-title").boundingBox();
      const markBox = await page.getByLabel("ב״ה").boundingBox();
      expect(titleBox).not.toBeNull();
      expect(markBox).not.toBeNull();
      expect(Math.abs(titleBox!.x + titleBox!.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(
        2,
      );
      expect(viewport.width - (markBox!.x + markBox!.width)).toBeLessThanOrEqual(20);
    });
  });
}

test.describe("mobile interactive states", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("horizontal swipe gestures navigate between public pages in RTL order", async ({ page }) => {
    await page.goto(`${baseUrl}/`);
    await waitForInteractiveHeader(page);
    const cdp = await page.context().newCDPSession(page);
    const swipe = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: from.x, y: from.y }],
      });
      for (let step = 1; step <= 8; step += 1) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              x: from.x + ((to.x - from.x) * step) / 8,
              y: from.y + ((to.y - from.y) * step) / 8,
            },
          ],
        });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };

    await swipe({ x: 330, y: 420 }, { x: 80, y: 425 });
    await expect(page).toHaveURL(/\/announcements$/);

    await swipe({ x: 80, y: 420 }, { x: 330, y: 425 });
    await expect(page).toHaveURL(/\/$/);

    await swipe({ x: 210, y: 180 }, { x: 190, y: 650 });
    await expect(page).toHaveURL(/\/$/);
  });

  test("primary mobile tabs stay visible and secondary links remain in the menu", async ({
    page,
  }) => {
    await page.goto(`${baseUrl}/`);
    await waitForInteractiveHeader(page);

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
    const menu = page.getByRole("navigation", { name: "תפריט ניווט נוסף" });
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

  test("the Hebrew date appears before the Gregorian date", async ({ page }) => {
    await page.goto(`${baseUrl}/`);
    const hebrewDate = page.getByTestId("hebrew-date");
    const gregorianDate = page.getByTestId("gregorian-date");
    await expect(hebrewDate).toContainText(
      /(תשרי|חשוון|כסלו|טבת|שבט|אדר|ניסן|אייר|סיוון|תמוז|אב|אלול)/,
    );
    await expect(hebrewDate).not.toContainText(/[0-9]/);
    await expect(hebrewDate).toContainText(/[׳״]/);
    await expect(gregorianDate).toBeVisible();
    const hebrewBox = await hebrewDate.boundingBox();
    const gregorianBox = await gregorianDate.boundingBox();
    expect(hebrewBox!.y).toBeLessThan(gregorianBox!.y);
  });

  test("theme presets can be updated or duplicated on mobile", async ({ page }) => {
    await page.goto(`${baseUrl}/`);
    await expect(page.getByRole("heading", { name: "זמני התפילות" })).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "ערכת נושא" }).click();
    await page.getByRole("menuitem", { name: "עריכת הערכה הנוכחית" }).click();

    const dialog = page.getByRole("dialog", { name: "עריכת ערכת נושא" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("תצוגה מקדימה לערכת הנושא")).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.width).toBeLessThanOrEqual(390);
    expect(dialogBox!.height).toBeLessThanOrEqual(844 * 0.86);

    await dialog.getByLabel("שם הערכה").fill("ערכת מובייל");
    await dialog.getByRole("button", { name: "בחירת צבע ראשי" }).click();
    await page.getByLabel("לוח צבעים מלא עבור צבע ראשי").fill("#4a225f");
    await page.getByRole("button", { name: "שמירת הצבע" }).click();
    await expect(page.getByText("הצבעים השמורים שלי")).toBeVisible();
    await expect(page.getByRole("button", { name: "בחירת הצבע #4a225f" })).toBeVisible();
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: "שכפל ושמור" }).click();

    await page.getByRole("button", { name: "ערכת נושא" }).click();
    await expect(page.getByRole("menuitem", { name: /ערכת מובייל/ })).toBeVisible();
    await page.getByRole("menuitem", { name: /ערכת מובייל/ }).click();
    await expect(page.locator("html")).toHaveCSS("--primary", "#4a225f");

    await page.getByRole("button", { name: "ערכת נושא" }).click();
    await page.getByRole("menuitem", { name: "עריכת הערכה הנוכחית" }).click();
    await page
      .getByRole("dialog", { name: "עריכת ערכת נושא" })
      .getByLabel("שם הערכה")
      .fill("ערכת מובייל מעודכנת");
    await page
      .getByRole("dialog", { name: "עריכת ערכת נושא" })
      .getByRole("button", { name: "עדכן ושמור" })
      .click();
    await page.getByRole("button", { name: "ערכת נושא" }).click();
    await expect(page.getByRole("menuitem", { name: /ערכת מובייל מעודכנת/ })).toBeVisible();
  });

  test("live design editor leaves the page visible on mobile", async ({ page }) => {
    await page.goto(`${baseUrl}/?designMode=1`);
    const editor = page.getByRole("dialog", { name: "עורך עיצוב חי" });
    await expect(editor).toBeVisible();
    const editorBox = await editor.boundingBox();
    expect(editorBox).not.toBeNull();
    expect(editorBox!.height).toBeLessThanOrEqual(844 * 0.45);
    expect(editorBox!.y).toBeGreaterThan(844 * 0.45);
    await expect(page.getByRole("heading", { name: "זמני התפילות" })).toBeVisible();
    await expect(page.getByRole("button", { name: "יציאה ממצב עיצוב" })).toBeVisible();
  });

  test("all themes and text settings fit mobile", async ({ page }) => {
    await page.goto(`${baseUrl}/`);
    await waitForInteractiveHeader(page);
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
    await dialog.evaluate((element) =>
      element.getAnimations().length
        ? Promise.all(element.getAnimations().map((animation) => animation.finished))
        : Promise.resolve(),
    );
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
    await page.getByRole("button", { name: "ימות החול", exact: true }).click();
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
