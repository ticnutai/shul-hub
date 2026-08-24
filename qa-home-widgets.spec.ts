import { expect, test } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";
const email = process.env.QA_ADMIN_EMAIL;
const password = process.env.QA_ADMIN_PASSWORD;

test("home widgets load from Supabase in their configured order", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const response = await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);

  const headings = [
    "זמני התפילות",
    "זמני היום",
    "מודעות לציבור",
    "שיעורי תורה",
    "חברותות",
    "הודעה לגבאי",
  ];
  const positions: number[] = [];
  for (const name of headings) {
    const heading = page.getByRole("heading", { name, exact: true });
    await expect(heading).toBeVisible();
    positions.push((await heading.boundingBox())!.y);
  }

  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(errors).toEqual([]);
});

test("all configured home widgets fit and remain usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });

  const widgets = page.locator("[data-home-widget]");
  await expect(widgets).toHaveCount(6);
  for (const key of ["minyanim", "zmanim", "announcements", "shiurim", "chavrutot", "contact"]) {
    await expect(page.locator(`[data-home-widget="${key}"]`)).toBeVisible();
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("link", { name: "כל השיעורים" })).toBeVisible();
  await expect(page.getByRole("link", { name: "לכל החברותות" })).toBeVisible();
  await expect(page.getByRole("link", { name: "שליחת הודעה" })).toBeVisible();
});

test("manager can reorder home widgets from the mobile layout and persist the choice", async ({
  page,
}) => {
  test.skip(!email || !password, "Admin credentials are required");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/auth`);
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await page.getByRole("tab", { name: /תצוגת דף הבית/ }).click();

  const card = page.getByRole("heading", { name: "מקטעי דף הבית" }).locator("..");
  const rows = card.locator("[data-widget-index]");
  await expect(rows).toHaveCount(6);
  const firstLabel = (await rows.nth(0).innerText()).trim();
  const secondLabel = (await rows.nth(1).innerText()).trim();

  async function dragFirstToSecond() {
    const handle = rows.nth(0).getByRole("button", { name: /^גרירת / });
    const handleBox = await handle.boundingBox();
    const targetBox = await rows.nth(1).boundingBox();
    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2,
      handleBox!.y + handleBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBox!.x + targetBox!.width / 2,
      targetBox!.y + targetBox!.height / 2,
      {
        steps: 8,
      },
    );
    await page.mouse.up();
  }

  try {
    await dragFirstToSecond();
    await expect(rows.nth(0)).toContainText(secondLabel);
    await page.getByRole("button", { name: /שמירת תצוגת דף הבית/ }).click();
    await expect(page.getByText("סדר הווידג'טים נשמר לכל המשתמשים")).toBeVisible();

    await page.goto(baseUrl);
    const firstPublicWidget = page.locator("[data-home-widget]").first();
    await expect(firstPublicWidget).toHaveAttribute(
      "data-home-widget",
      secondLabel.includes("זמני היום") ? "zmanim" : "minyanim",
    );
  } finally {
    await page.goto(`${baseUrl}/admin`);
    await page.getByRole("tab", { name: /תצוגת דף הבית/ }).click();
    const restoreCard = page.getByRole("heading", { name: "מקטעי דף הבית" }).locator("..");
    const restoreRows = restoreCard.locator("[data-widget-index]");
    if ((await restoreRows.nth(0).innerText()).includes(secondLabel)) {
      const handle = restoreRows.nth(0).getByRole("button", { name: /^גרירת / });
      const handleBox = await handle.boundingBox();
      const targetBox = await restoreRows.nth(1).boundingBox();
      await page.mouse.move(
        handleBox!.x + handleBox!.width / 2,
        handleBox!.y + handleBox!.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        targetBox!.x + targetBox!.width / 2,
        targetBox!.y + targetBox!.height / 2,
        { steps: 8 },
      );
      await page.mouse.up();
      await expect(restoreRows.nth(0)).toContainText(firstLabel);
      await page.getByRole("button", { name: /שמירת תצוגת דף הבית/ }).click();
      await expect(page.getByText("סדר הווידג'טים נשמר לכל המשתמשים")).toBeVisible();
    }
  }
});
