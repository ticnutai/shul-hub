import { expect, test, type Page } from "@playwright/test";

const eventPath = "/events/yamim-noraim-concord-2026";

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test("the concise announcement opens the complete event page", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/chumash");

  const announcement = page.getByTestId("yamim-noraim-announcement");
  await expect(announcement).toBeVisible({ timeout: 30_000 });
  await expect(announcement).toContainText("תפילות הימים הנוראים");
  await expect(announcement).toContainText("אולמי קונקורד");
  await expect(announcement).toContainText("054-6473461");
  const whatsapp = page.getByTestId("yamim-noraim-whatsapp");
  await expect(whatsapp).toBeVisible();
  await expect(whatsapp).toHaveAttribute("href", /wa\.me\/972546473461\?text=/);
  await expect(whatsapp).toHaveAttribute("href", /%D7%A9%D7%9C%D7%95%D7%9D/);
  await announcement.getByRole("link", { name: "פתח את כל פרטי תפילות הימים הנוראים" }).click();

  await expect(page).toHaveURL(new RegExp(`${eventPath}$`));
  await expect(page.getByTestId("yamim-noraim-event-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "תפילות הימים הנוראים" })).toBeVisible();
  await expect(page.getByText("ראש השנה", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("יום כיפור", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("אחות קטנה", { exact: true })).toBeVisible();
  await expect(page.getByText("19:10", { exact: true })).toBeVisible();
  await expect(page.getByText("19:54", { exact: true })).toBeVisible();
  await expect(page.getByText("עלות מקום", { exact: true })).toBeVisible();
  await expect(page.getByText(/כיסא ב־20/)).toBeVisible();
  await expect(page.getByText(/אין עזרת נשים במקום/)).toBeVisible();
  await expect(page.getByRole("link", { name: /054-6473461/ }).first()).toBeVisible();

  const poster = page.getByRole("img", { name: /המודעה המקורית/ });
  await poster.scrollIntoViewIfNeeded();
  await expect(poster).toBeVisible();
  await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(500);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("the event page remains readable on a wide screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(eventPath);
  await expect(page.getByTestId("yamim-noraim-event-page")).toBeVisible();
  await expect(page.getByText("מעמד הסליחות האחרונות והתרת נדרים")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
