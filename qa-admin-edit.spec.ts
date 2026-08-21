import { expect, test } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";
const email = process.env.QA_ADMIN_EMAIL;
const password = process.env.QA_ADMIN_PASSWORD;

test("minyan edit button opens and reveals the populated edit form", async ({ page }) => {
  test.skip(!email || !password, "Admin credentials are required");

  await page.goto(`${baseUrl}/auth`);
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה").fill(password!);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const editButton = page.getByRole("button", { name: /^פתיחת עריכת / }).first();
  const label = (await editButton.getAttribute("aria-label"))!.replace(/^פתיחת עריכת /, "");
  await editButton.click();

  await expect(page.getByRole("heading", { name: "עריכת מניין", exact: true })).toBeVisible();
  await expect(page.locator("form").last().getByRole("textbox").first()).toHaveValue(label);
  const formBox = await page.getByRole("heading", { name: "עריכת מניין" }).boundingBox();
  expect(formBox).not.toBeNull();
  expect(formBox!.y).toBeGreaterThanOrEqual(0);
  expect(formBox!.y).toBeLessThan(page.viewportSize()!.height);
});

test("admin can open direct inline editors without changing saved data", async ({ page }) => {
  test.skip(!email || !password, "Admin credentials are required");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/auth`);
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה").fill(password!);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const directEditors = [/^עריכת שם המניין /, /^עריכת מיקום /, /^עריכת הערה /];

  for (const name of directEditors) {
    const trigger = page.getByRole("button", { name }).first();
    await expect(trigger).toBeVisible();
    const label = await trigger.getAttribute("aria-label");
    await trigger.click();
    await expect(page.getByRole("textbox", { name: label! })).toBeVisible();
    await page.getByRole("textbox", { name: label! }).press("Escape");
  }

  const timeTrigger = page.getByRole("button", { name: /^עריכת (שעה|זמן יחסי) / }).first();
  await expect(timeTrigger).toBeVisible();
});

test("manager can open dynamic minyan category editor on mobile", async ({ page }) => {
  test.skip(!email || !password, "Admin credentials are required");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/auth`);
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה").fill(password!);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("main")).toHaveCSS("direction", "rtl");
  await expect(page.locator("main")).toHaveCSS("text-align", "right");
  await expect(page.getByRole("tablist")).toHaveCSS("direction", "rtl");
  await expect(page.getByRole("group", { name: "קטגוריות מניינים" })).toBeVisible();
  await expect(page.getByRole("group", { name: "קטגוריות מניינים" })).toHaveCSS("direction", "rtl");
  await page.getByRole("button", { name: "קטגוריה חדשה" }).click();
  await expect(page.getByRole("heading", { name: "קטגוריית מניינים חדשה" })).toBeVisible();
  await expect(page.getByLabel("שם הטאב")).toBeVisible();
  await expect(page.getByLabel("הצגה מתאריך (רשות)")).toBeVisible();
  await expect(page.getByLabel("עד תאריך (רשות)")).toBeVisible();
});

test("public schedule renders database-driven minyan categories", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl);

  const categories = page.getByRole("group", { name: "קטגוריות מניינים" });
  await expect(categories).toBeVisible();
  await expect(categories.getByRole("button", { name: "ימות החול" })).toBeVisible();
  await expect(page.getByRole("group", { name: "סוג תפילה" })).toBeVisible();
});
