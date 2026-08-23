import { expect, test } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";

test.describe("mobile authentication controls", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("password visibility and remember-me controls are accessible", async ({ page }) => {
    await page.goto(`${baseUrl}/auth`);

    const password = page.getByLabel("סיסמה", { exact: true });
    await password.fill("secret123");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "הצגת הסיסמה" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "הסתרת הסיסמה" }).click();
    await expect(password).toHaveAttribute("type", "password");

    const remember = page.getByRole("checkbox", { name: "זכור אותי" });
    await expect(remember).toBeChecked();
    await remember.click();
    await expect(remember).not.toBeChecked();
    await expect(page.getByRole("button", { name: "שכחתי סיסמה" })).toBeVisible();

    const storageResult = await page.evaluate(async () => {
      const modulePath = "/src/lib/auth-storage.ts";
      const { authStorage, setRememberAuth } = await import(/* @vite-ignore */ modulePath);
      const testKey = "qa-auth-storage";

      setRememberAuth(false);
      authStorage.setItem(testKey, "session-value");
      const sessionOnly = {
        local: localStorage.getItem(testKey),
        session: sessionStorage.getItem(testKey),
      };

      setRememberAuth(true);
      authStorage.setItem(testKey, "local-value");
      const localOnly = {
        local: localStorage.getItem(testKey),
        session: sessionStorage.getItem(testKey),
      };

      authStorage.removeItem(testKey);
      return { sessionOnly, localOnly };
    });

    expect(storageResult.sessionOnly).toEqual({ local: null, session: "session-value" });
    expect(storageResult.localOnly).toEqual({ local: "local-value", session: null });
  });

  test("forgot-password submits the email and the correct return URL", async ({ page }) => {
    let requestBody: Record<string, unknown> | undefined;
    let requestUrl = "";
    await page.route("**/auth/v1/recover*", async (route) => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      requestUrl = route.request().url();
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto(`${baseUrl}/auth`);
    await page.getByLabel("אימייל").fill("tester@example.com");
    await page.getByRole("button", { name: "שכחתי סיסמה" }).click();
    await page.getByRole("button", { name: "שליחת קישור לאיפוס" }).click();

    await expect(page.getByRole("status")).toContainText("קישור לאיפוס הסיסמה נשלח");
    expect(requestBody?.["email"]).toBe("tester@example.com");
    expect(new URL(requestUrl).searchParams.get("redirect_to")).toBe(`${baseUrl}/auth?recovery=1`);
  });

  test("the recovery link opens the new-password form", async ({ page }) => {
    await page.goto(`${baseUrl}/auth?recovery=1`);

    await expect(page.getByRole("heading", { name: "בחירת סיסמה חדשה" })).toBeVisible();
    await expect(page.getByLabel("סיסמה חדשה", { exact: true })).toBeVisible();
    await expect(page.getByLabel("אימות סיסמה חדשה", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "שמירת הסיסמה החדשה" })).toBeVisible();
  });
});
