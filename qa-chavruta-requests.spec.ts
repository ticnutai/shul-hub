import { expect, test } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";

test("approved requests render and a guest can submit a valid request", async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;

  await page.route("**/rest/v1/rpc/list_approved_chavruta_requests", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "11111111-1111-1111-1111-111111111111",
          name: "ישראל ישראלי",
          phone: "0501234567",
          email: "",
          topic: "דף היומי",
          level: "intermediate",
          intent: "learn",
          study_format: "chavruta",
          availability: "בערבים",
          notes: "מחפש לימוד קבוע",
          created_at: new Date().toISOString(),
        },
      ]),
    });
  });
  await page.route("**/rest/v1/chavruta_requests*", async (route) => {
    if (route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
    } else {
      await route.continue();
    }
  });

  await page.goto(`${baseUrl}/chavrutot`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("ישראל ישראלי")).toBeVisible();
  await expect(page.getByText("דף היומי", { exact: true })).toBeVisible();
  await expect(page.getByText("0501234567")).toBeVisible();

  await page.getByRole("button", { name: "בקשת חברותא" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "בקשה למציאת חברותא" })).toBeVisible();

  await dialog.getByRole("button", { name: "שליחת הבקשה" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("שם ונושא לימוד הם שדות חובה.");

  const inputs = dialog.locator("input");
  await inputs.nth(0).fill("יעקב כהן");
  await inputs.nth(1).fill("משנה ברורה");
  await dialog.getByRole("button", { name: "שליחת הבקשה" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("יש להזין לפחות טלפון או אימייל.");

  await inputs.nth(2).fill("0520000000");
  await dialog.getByRole("button", { name: "שליחת הבקשה" }).click();
  await expect(dialog).toBeHidden();
  expect(submitted).toMatchObject({
    name: "יעקב כהן",
    topic: "משנה ברורה",
    phone: "0520000000",
    status: "pending",
    share_contact: false,
  });
});

test("request dialog fits a mobile RTL viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/rest/v1/rpc/list_approved_chavruta_requests", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.goto(`${baseUrl}/chavrutot`, { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: "בקשת חברותא" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("dir", "rtl");
  await dialog.evaluate((element) =>
    element.getAnimations().length
      ? Promise.all(element.getAnimations().map((animation) => animation.finished))
      : Promise.resolve(),
  );
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});
