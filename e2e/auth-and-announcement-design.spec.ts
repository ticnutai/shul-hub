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
    await expect(page.getByTestId("community-karovim-logo")).toBeVisible();
    await expect(page.getByTestId("community-site-address")).toHaveCount(0);
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

test("administrator can design an announcement with live mobile preview", async ({ page }) => {
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
    await editor.getByText("קלף וזהב", { exact: true }).click();

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
