import { expect, test } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";

test("home page renders without browser or network errors", async ({ page }) => {
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
  });

  const response = await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "בית הכנסת אושר של יהודי" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "זמני התפילות" })).toBeVisible();
  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("all public routes are RTL and render their main heading", async ({ page }) => {
  const routes = [
    ["/announcements", "מודעות לציבור"],
    ["/shiurim", "שיעורי תורה"],
    ["/chavrutot", "חברותות"],
    ["/contact", "הודעה לגבאי"],
  ] as const;

  for (const [path, heading] of routes) {
    const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
});

test("text settings preview, cancel, save and persist after reload", async ({ page }) => {
  await page.goto(`${baseUrl}/`);
  await page.evaluate(() => localStorage.removeItem("shul-text-settings-v1"));
  await page.reload();

  const body = page.locator("body");
  const initialFont = await body.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(initialFont).toContain("Heebo");

  await page.getByRole("button", { name: "הגדרות טקסט וכתב" }).click();
  await page.getByRole("combobox", { name: "גופן טקסט" }).click();
  await page.getByRole("option", { name: "Noto Serif Hebrew" }).click();
  await expect
    .poll(() => body.evaluate((element) => getComputedStyle(element).fontFamily))
    .toContain("Noto Serif Hebrew");
  await page.getByRole("button", { name: "ביטול" }).click();
  await expect
    .poll(() => body.evaluate((element) => getComputedStyle(element).fontFamily))
    .toContain("Heebo");

  await page.getByRole("button", { name: "הגדרות טקסט וכתב" }).click();
  await page.getByRole("combobox", { name: "גופן טקסט" }).click();
  await page.getByRole("option", { name: "Noto Serif Hebrew" }).click();
  await page.getByRole("button", { name: "שמירה" }).click();
  await page.reload();
  await expect
    .poll(() => body.evaluate((element) => getComputedStyle(element).fontFamily))
    .toContain("Noto Serif Hebrew");
});
