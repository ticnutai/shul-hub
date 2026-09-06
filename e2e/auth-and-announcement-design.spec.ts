import { expect, test } from "@playwright/test";

test("guest account entry opens a complete login flow", async ({ page }) => {
  await page.goto("/community");

  const accountEntry = page.getByTestId("account-entry");
  await expect(accountEntry).toBeVisible();
  await expect(accountEntry).toHaveAttribute("href", "/auth");
  await accountEntry.click();
  await expect(page).toHaveURL(/\/auth$/);

  const password = page.getByLabel("סיסמה", { exact: true });
  const remember = page.getByRole("checkbox", { name: "זכור אותי" });
  await expect(password).toHaveAttribute("type", "password");
  await expect(remember).toBeChecked();
  await page.getByRole("button", { name: "הצגת הסיסמה" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "הסתרת הסיסמה" }).click();
  await expect(password).toHaveAttribute("type", "password");

  await remember.uncheck();
  await expect(remember).not.toBeChecked();
});

test("forgot password sends the email and the correct return address", async ({ page }) => {
  let requestBody = "";
  let redirectTarget = "";
  await page.route("**/auth/v1/recover**", async (route) => {
    requestBody = route.request().postData() ?? "";
    redirectTarget = new URL(route.request().url()).searchParams.get("redirect_to") ?? "";
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/auth");
  await page.getByLabel("אימייל").fill("reset-check@example.com");
  await page.getByRole("button", { name: "שכחתי סיסמה" }).click();

  await expect(page.getByText("קישור לאיפוס הסיסמה נשלח לאימייל")).toBeVisible();
  expect(JSON.parse(requestBody)).toMatchObject({ email: "reset-check@example.com" });
  expect(redirectTarget).toBe("http://127.0.0.1:4300/auth");
});

test("password recovery link opens the new-password form", async ({ page }) => {
  await page.goto("/auth#type=recovery");
  await expect(page.getByRole("heading", { name: "בחירת סיסמה חדשה" })).toBeVisible();
  await expect(page.getByLabel("אימות סיסמה חדשה")).toBeVisible();
  await expect(page.getByRole("button", { name: "עדכון סיסמה" })).toBeVisible();
});

test("the daily lesson flyer is published in announcements and lessons", async ({ page }) => {
  await page.goto("/community/announcements");
  const announcement = page.locator("article").filter({ hasText: "בשורה משמחת – שיעור העמוד היומי העולמי" });
  await expect(announcement).toBeVisible();
  await expect(announcement).toContainText("כל יום בשעה 16:15");
  await expect(announcement).toContainText("חצי שעה");
  await expect(announcement).toContainText("הרב יעקב טננבוים");
  await expect(announcement).toContainText("יוגש כיבוד לעמלי התורה");
  await expect(announcement).toContainText("054-6473461");

  await page.goto("/community/shiurim");
  const lesson = page.locator("article").filter({ hasText: "שיעור העמוד היומי העולמי" });
  await expect(lesson).toBeVisible();
  await expect(lesson).toContainText("בכל יום");
  await expect(lesson).toContainText("16:15 · חצי שעה");
  await expect(lesson).toContainText("הרב יעקב טננבוים");
  await expect(lesson).toContainText("בית הכנסת ב.ס.ר 3, קומה 34");
  await expect(lesson).toContainText("ידוע בבהירות ובהסבר נפלאים");
});

test("active Karovim layout keeps both logos centered and the hero logo larger", async ({ page }) => {
  test.skip(process.env.QA_KAROVIM_LAYOUT !== "1", "runs only while the shared Karovim setting is enabled for visual QA");
  await page.goto("/community");

  const headerLogo = page.getByTestId("community-karovim-logo");
  const heroLogo = page.getByTestId("community-karovim-hero-logo");
  await expect(headerLogo).toBeVisible();
  await expect(heroLogo).toBeVisible();
  const [headerBox, heroBox, contentCenter] = await Promise.all([
    headerLogo.boundingBox(),
    heroLogo.boundingBox(),
    page.evaluate(() => {
      const bodyBox = document.body.getBoundingClientRect();
      return bodyBox.left + bodyBox.width / 2;
    }),
  ]);
  expect(headerBox).not.toBeNull();
  expect(heroBox).not.toBeNull();
  expect(Math.abs((headerBox!.x + headerBox!.width / 2) - contentCenter)).toBeLessThanOrEqual(2);
  expect(Math.abs((heroBox!.x + heroBox!.width / 2) - contentCenter)).toBeLessThanOrEqual(2);
  expect(heroBox!.height).toBeGreaterThan(headerBox!.height * 2);
  await expect(page.getByTestId("community-site-address")).toHaveCount(0);
});

test("administrator can switch to the Karovim logo header and restore the current header", async ({ page }, testInfo) => {
  const email = process.env.QA_ADMIN_EMAIL;
  const password = process.env.QA_ADMIN_PASSWORD;
  test.skip(!email || !password, "QA admin credentials are not configured");

  await page.goto("/auth");
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "התחבר", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/auth"));

  if (testInfo.project.name !== "desktop-chromium") {
    await page.goto("/community/admin?tab=settings");
    const choices = page.getByRole("group", { name: "בחירת תצוגת כותרת" });
    await expect(choices.getByRole("button", { name: /שם וכתובת/ })).toBeVisible();
    await expect(choices.getByRole("button", { name: /קרובים/ })).toBeVisible();
    return;
  }

  try {
    await page.goto("/community/admin?tab=settings");
    const choices = page.getByRole("group", { name: "בחירת תצוגת כותרת" });
    await choices.getByRole("button", { name: /קרובים/ }).click();
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("/rest/v1/settings")),
      page.getByRole("button", { name: "שמירת הגדרות" }).click(),
    ]);
    await expect(page.getByText("נשמר בהצלחה")).toBeVisible();

    await page.goto("/community");
    const headerLogo = page.getByTestId("community-karovim-logo");
    const heroLogo = page.getByTestId("community-karovim-hero-logo");
    await expect(headerLogo).toBeVisible();
    await expect(heroLogo).toBeVisible();
    await expect(page.getByTestId("community-site-address")).toHaveCount(0);
    const [headerBox, heroBox, contentCenter] = await Promise.all([
      headerLogo.boundingBox(),
      heroLogo.boundingBox(),
      page.evaluate(() => {
        const bodyBox = document.body.getBoundingClientRect();
        return bodyBox.left + bodyBox.width / 2;
      }),
    ]);
    expect(headerBox).not.toBeNull();
    expect(heroBox).not.toBeNull();
    expect(Math.abs((headerBox!.x + headerBox!.width / 2) - contentCenter)).toBeLessThanOrEqual(2);
    expect(Math.abs((heroBox!.x + heroBox!.width / 2) - contentCenter)).toBeLessThanOrEqual(2);
    expect(heroBox!.height).toBeGreaterThan(headerBox!.height);
  } finally {
    await page.goto("/community/admin?tab=settings");
    const choices = page.getByRole("group", { name: "בחירת תצוגת כותרת" });
    await choices.getByRole("button", { name: /שם וכתובת/ }).click();
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("/rest/v1/settings")),
      page.getByRole("button", { name: "שמירת הגדרות" }).click(),
    ]);
    await expect(page.getByText("נשמר בהצלחה")).toBeVisible();
    await page.goto("/community");
    await expect(page.getByTestId("community-site-address")).toBeVisible();
  }
});

test("administrator can design, size, add and remove an announcement image", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const email = process.env.QA_ADMIN_EMAIL;
  const password = process.env.QA_ADMIN_PASSWORD;
  test.skip(!email || !password, "QA admin credentials are not configured");

  await page.goto("/auth");
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "התחבר", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/auth"));
  await page.goto("/community/admin?tab=announcements");

  const title = `בדיקת עיצוב אוטומטית ${Date.now()}`;
  const body = "תוכן הבדיקה מתעדכן מיד";
  try {
    await page.getByRole("button", { name: "מודעה חדשה" }).click();
    const editor = page.getByTestId("announcement-design-editor");
    await expect(editor).toBeVisible();
    await expect(editor.getByRole("group", { name: "תבניות עיצוב מודעה" })).toBeVisible();

    await page.getByPlaceholder("מזל טוב למשפחת…").fill(title);
    await page.locator("form textarea").fill(body);
    if (testInfo.project.name !== "desktop-chromium") {
      await expect(page.getByTestId("announcement-home-width")).toBeVisible();
      await expect(page.getByTestId("announcement-image-input")).toBeAttached();
      return;
    }
    await editor.getByText("קלף וזהב", { exact: true }).click();
    await page.getByTestId("announcement-home-width").click();
    await page.getByRole("option", { name: /רוחב מלא/ }).click();
    await page.getByTestId("announcement-image-input").setInputFiles({
      name: "announcement-test.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(page.getByTestId("announcement-image-preview")).toBeVisible();

    const preview = page.getByTestId("announcement-design-preview");
    await expect(preview.getByText(title)).toBeVisible();
    await expect(preview.getByText(body)).toBeVisible();
    await expect(preview).toHaveCSS("background-color", "rgb(255, 250, 240)");
    await expect(preview).toHaveCSS("text-align", "center");

    await page.getByRole("button", { name: "שמירה", exact: true }).click();
    const savedRow = page.locator('[data-testid^="announcement-row-"]').filter({ hasText: title });
    await expect(savedRow).toBeVisible();

    await page.goto("/community/announcements");
    const publicCard = page.locator("article").filter({ hasText: title });
    await expect(publicCard).toBeVisible();
    await expect(publicCard).toHaveAttribute("data-announcement-preset", "gold");
    await expect(publicCard).toHaveCSS("background-color", "rgb(255, 250, 240)");
    await expect(publicCard).toHaveCSS("text-align", "center");

    await page.goto("/community");
    const homeWrapper = page.locator('[data-announcement-home-width="full"]').filter({ hasText: title });
    await expect(homeWrapper).toBeVisible();
    await expect(homeWrapper.getByTestId("announcement-image")).toBeVisible();

    await page.goto("/community/admin?tab=announcements");
    const savedRowForEdit = page.locator('[data-testid^="announcement-row-"]').filter({ hasText: title });
    await savedRowForEdit.getByRole("button", { name: "עריכה" }).click();
    await expect(page.getByTestId("announcement-image-preview")).toBeVisible();
    await page.getByRole("button", { name: "הסרת תמונת המודעה" }).click();
    await expect(page.getByTestId("announcement-image-preview")).toHaveCount(0);
    await page.getByRole("button", { name: "שמירה", exact: true }).click();
    await expect(page.getByTestId("announcement-image-editor")).toHaveCount(0);

    await page.goto("/community");
    const homeCardWithoutImage = page.locator('[data-announcement-home-width="full"]').filter({ hasText: title });
    await expect(homeCardWithoutImage).toBeVisible();
    await expect(homeCardWithoutImage.getByTestId("announcement-image")).toHaveCount(0);
  } finally {
    // Remove only the exact temporary record created by this test.
    await page.goto("/community/admin?tab=announcements");
    await expect(page.getByRole("button", { name: "מודעה חדשה" })).toBeVisible();
    const testRow = page.locator('[data-testid^="announcement-row-"]').filter({ hasText: title });
    try {
      await testRow.waitFor({ state: "visible", timeout: 5_000 });
      await testRow.getByRole("button", { name: "מחיקה" }).click();
      await expect(testRow).toHaveCount(0);
    } catch {
      // If creation failed before persistence, there is no record to clean up.
    }
  }
});

test("administrator can persist a half-width home widget and restore it", async ({ page }, testInfo) => {
  const email = process.env.QA_ADMIN_EMAIL;
  const password = process.env.QA_ADMIN_PASSWORD;
  test.skip(!email || !password, "QA admin credentials are not configured");

  await page.goto("/auth");
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "התחבר", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/auth"));
  await page.goto("/community/admin?tab=widgets");

  const row = page.locator('[data-widget-key="announcements"]');
  const widthSelector = row.getByRole("combobox", { name: "רוחב מודעות לציבור בדף הבית" });
  await expect(widthSelector).toBeVisible();
  if (testInfo.project.name !== "desktop-chromium") return;

  const originalIsHalf = (await widthSelector.textContent())?.includes("חצי") ?? false;
  try {
    await widthSelector.click();
    await page.getByRole("option", { name: originalIsHalf ? /רוחב מלא/ : /חצי שורה/ }).click();
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/rest/v1/home_widgets")),
      page.getByRole("button", { name: "שמירת תצוגת דף הבית" }).click(),
    ]);
    await page.goto("/community");
    await expect(page.locator('[data-home-widget="announcements"]')).toHaveAttribute(
      "data-widget-width",
      originalIsHalf ? "full" : "half",
    );
  } finally {
    await page.goto("/community/admin?tab=widgets");
    const restoreRow = page.locator('[data-widget-key="announcements"]');
    const restoreSelector = restoreRow.getByRole("combobox", { name: "רוחב מודעות לציבור בדף הבית" });
    await restoreSelector.click();
    await page.getByRole("option", { name: originalIsHalf ? /חצי שורה/ : /רוחב מלא/ }).click();
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/rest/v1/home_widgets")),
      page.getByRole("button", { name: "שמירת תצוגת דף הבית" }).click(),
    ]);
  }
});
