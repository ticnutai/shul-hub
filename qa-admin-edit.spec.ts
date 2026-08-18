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

  const editButton = page.getByRole("button", { name: /^עריכת / }).first();
  const label = (await editButton.getAttribute("aria-label"))!.replace(/^עריכת /, "");
  await editButton.click();

  await expect(page.getByRole("heading", { name: "עריכת מניין", exact: true })).toBeVisible();
  await expect(page.locator("form").last().getByRole("textbox").first()).toHaveValue(label);
  const formBox = await page.getByRole("heading", { name: "עריכת מניין" }).boundingBox();
  expect(formBox).not.toBeNull();
  expect(formBox!.y).toBeGreaterThanOrEqual(0);
  expect(formBox!.y).toBeLessThan(page.viewportSize()!.height);
});
