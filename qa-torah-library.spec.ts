import { expect, test } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";

test.describe("read-only Torah library", () => {
  test("desktop icons open Chumash and Siddur content", async ({ page }) => {
    await page.goto(baseUrl);
    await page.getByRole("link", { name: "פתיחת חומש ומפרשים" }).click();
    await expect(page).toHaveURL(/torah-chumash/);
    await expect(page.getByRole("heading", { name: "חומש ומפרשים" })).toBeVisible();
    await expect(page.getByText("בְּרֵאשִׁית בָּרָא אֱלֹהִים")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("link", { name: "פתיחת סידור תפילה" }).click();
    await expect(page).toHaveURL(/torah-siddur/);
    await expect(page.getByRole("heading", { name: "סידור תפילה" })).toBeVisible();
    await expect(page.getByText("מודה אני", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("mobile navigation and reading controls stay usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/torah-chumash`);
    await expect(page.getByRole("link", { name: "חומש", exact: true })).toBeVisible();
    await page.getByLabel("בחירת פרק").selectOption("2");
    await expect(page.getByRole("heading", { name: /פרק ב׳/ })).toBeVisible();

    await page.getByRole("link", { name: "סידור", exact: true }).click();
    await page.getByLabel("בחירת נוסח", { exact: true }).selectOption("sefard");
    await expect(page.getByLabel("בחירת תפילה")).toBeEnabled();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("content routes never call the pash Supabase account", async ({ page }) => {
    const supabaseRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("supabase.co")) supabaseRequests.push(request.url());
    });
    await page.goto(`${baseUrl}/torah-chumash`);
    await expect(page.getByText("בְּרֵאשִׁית בָּרָא אֱלֹהִים")).toBeVisible({ timeout: 20_000 });
    expect(supabaseRequests).not.toContainEqual(
      expect.stringContaining("mocukhvfqqzkekphifsr.supabase.co"),
    );
    expect(supabaseRequests.every((url) => url.includes("bfiayuuhjtyccqobsjvl.supabase.co"))).toBe(
      true,
    );
  });
});
