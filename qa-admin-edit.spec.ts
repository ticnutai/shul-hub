import { expect, test } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";
const email = process.env.QA_ADMIN_EMAIL;
const password = process.env.QA_ADMIN_PASSWORD;

test("minyan edit button opens and reveals the populated edit form", async ({ page }) => {
  test.skip(!email || !password, "Admin credentials are required");

  await page.goto(`${baseUrl}/auth`);
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const editButton = page.getByRole("button", { name: /^פתיחת עריכת / }).first();
  await editButton.click();

  await expect(page.getByRole("heading", { name: "עריכת מניין", exact: true })).toBeVisible();
  await expect(page.locator("form").last().getByRole("textbox").first()).not.toHaveValue("");
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
  await page.getByLabel("סיסמה", { exact: true }).fill(password!);
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
  await page.getByLabel("סיסמה", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("main")).toHaveCSS("direction", "rtl");
  await expect(page.locator("main")).toHaveCSS("text-align", "right");
  await expect(page.getByRole("tablist")).toHaveCSS("direction", "rtl");
  await expect(page.getByRole("group", { name: "קטגוריות מניינים", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "קטגוריות מניינים", exact: true })).toHaveCSS(
    "direction",
    "rtl",
  );
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

test("manager can drag minyan rows and category tabs and persist their order", async ({ page }) => {
  test.skip(!email || !password, "Admin credentials are required");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${baseUrl}/auth`);
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const rows = page.locator('[data-reorder-kind="minyan"]');
  await expect(rows).toHaveCount(4);
  const firstRowId = await rows.nth(0).getAttribute("data-reorder-id");
  const secondRowId = await rows.nth(1).getAttribute("data-reorder-id");
  async function pointerDrag(
    handle: import("@playwright/test").Locator,
    target: import("@playwright/test").Locator,
  ) {
    const handleBox = await handle.boundingBox();
    const targetBox = await target.boundingBox();
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
  }

  await pointerDrag(rows.nth(0).getByRole("button", { name: /^גרירת המניין / }), rows.nth(1));
  await expect(page.getByText("סדר המניינים נשמר")).toBeVisible();
  await expect(rows.nth(0)).toHaveAttribute("data-reorder-id", secondRowId!);
  await pointerDrag(rows.nth(0).getByRole("button", { name: /^גרירת המניין / }), rows.nth(1));
  await expect(rows.nth(0)).toHaveAttribute("data-reorder-id", firstRowId!);

  const categories = page.locator('[data-reorder-kind="category"]');
  expect(await categories.count()).toBeGreaterThanOrEqual(2);
  const firstCategoryId = await categories.nth(0).getAttribute("data-reorder-id");
  const secondCategoryId = await categories.nth(1).getAttribute("data-reorder-id");
  await pointerDrag(
    categories.nth(0).getByRole("button", { name: /^גרירת הטאב / }),
    categories.nth(1),
  );
  await expect(page.getByText("סדר הטאבים נשמר")).toBeVisible();
  await expect(categories.nth(0)).toHaveAttribute("data-reorder-id", secondCategoryId!);
  await pointerDrag(
    categories.nth(0).getByRole("button", { name: /^גרירת הטאב / }),
    categories.nth(1),
  );
  await expect(categories.nth(0)).toHaveAttribute("data-reorder-id", firstCategoryId!);
});

test("each minyan category keeps an independent public display mode", async ({ page }) => {
  test.skip(!email || !password, "Admin credentials are required");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/auth`);
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const displayButtons = page.getByRole("button", { name: /^שינוי תצוגת / });
  await expect(displayButtons.first()).toBeVisible();
  const originalLabel = await displayButtons.first().getAttribute("aria-label");
  const secondOriginalLabel = await displayButtons.nth(1).getAttribute("aria-label");
  const categoryName = originalLabel!.match(/^שינוי תצוגת (.+)\. תצוגה נוכחית:/)?.[1];
  expect(categoryName).toBeTruthy();

  try {
    await displayButtons.first().click();
    await expect(displayButtons.first()).not.toHaveAttribute("aria-label", originalLabel!);
    if (secondOriginalLabel) {
      await expect(displayButtons.nth(1)).toHaveAttribute("aria-label", secondOriginalLabel);
    }

    const changedLabel = await displayButtons.first().getAttribute("aria-label");
    const changedToList = changedLabel?.includes("רשימה רציפה") ?? false;
    await page.goto(baseUrl);
    await page
      .getByRole("group", { name: "קטגוריות מניינים" })
      .getByRole("button", { name: categoryName!, exact: true })
      .click();

    const schedule = page.locator("[data-minyan-display-mode]");
    await expect(schedule).toHaveAttribute(
      "data-minyan-display-mode",
      changedToList ? "list" : "tabs",
    );
    if (changedToList) {
      await expect(page.getByRole("group", { name: "סוג תפילה" })).toHaveCount(0);
      await expect(schedule.getByRole("heading", { name: "שחרית", exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole("group", { name: "סוג תפילה" })).toBeVisible();
    }
  } finally {
    await page.goto(`${baseUrl}/admin`);
    const restoreButton = page.getByRole("button", {
      name: new RegExp(`^שינוי תצוגת ${categoryName}`),
    });
    await expect(restoreButton).toBeVisible();
    if ((await restoreButton.getAttribute("aria-label")) !== originalLabel) {
      await restoreButton.click();
      await expect(restoreButton).toHaveAttribute("aria-label", originalLabel!);
    }
  }
});

test("manager can create a category without subtabs, add and remove a custom subtab, then delete the category", async ({
  page,
}) => {
  test.skip(!email || !password, "Admin credentials are required");
  const categoryName = `בדיקת קטגוריה ${Date.now()}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/auth`);
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  try {
    await page.getByRole("button", { name: "קטגוריה חדשה" }).click();
    await page.getByLabel("שם הטאב").fill(categoryName);
    await expect(page.locator('[data-testid="minyan-subcategory-editor"] input')).toHaveCount(0);
    await page.getByRole("button", { name: "שמירת קטגוריה" }).click();
    await expect(page.getByText("נשמר בהצלחה").last()).toBeVisible();

    await page.getByRole("button", { name: categoryName, exact: true }).click();
    await expect(page.getByRole("group", { name: "תתי קטגוריות מניינים" })).toHaveCount(0);
    await page.goto(baseUrl);
    await page
      .getByRole("group", { name: "קטגוריות מניינים" })
      .getByRole("button", { name: categoryName, exact: true })
      .click();
    await expect(page.getByRole("group", { name: "סוג תפילה" })).toHaveCount(0);
    await page.goto(`${baseUrl}/admin`);
    await page.getByRole("button", { name: categoryName, exact: true }).click();
    await page.getByRole("button", { name: `ניהול הקטגוריה ${categoryName}` }).click();
    await page.getByLabel("שם תת־קטגוריה חדשה").fill("נעילה");
    await page.getByRole("button", { name: "הוספת תת־קטגוריה" }).click();
    await page.getByRole("button", { name: "שמירת קטגוריה" }).click();
    await expect(page.getByText("נשמר בהצלחה").last()).toBeVisible();
    await expect(page.getByRole("button", { name: "נעילה", exact: true })).toBeVisible();

    await page.getByRole("button", { name: `ניהול הקטגוריה ${categoryName}` }).click();
    await page.getByRole("button", { name: "מחיקת תת־קטגוריה נעילה" }).click();
    await page.getByRole("button", { name: "שמירת קטגוריה" }).click();
    await expect(page.getByText("נשמר בהצלחה").last()).toBeVisible();
    await expect(page.getByRole("group", { name: "תתי קטגוריות מניינים" })).toHaveCount(0);
  } finally {
    const categoryButton = page.getByRole("button", { name: categoryName, exact: true });
    if (await categoryButton.isVisible().catch(() => false)) {
      await categoryButton.click();
      await page.getByRole("button", { name: `ניהול הקטגוריה ${categoryName}` }).click();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "מחיקת הקטגוריה" }).click();
      await expect(categoryButton).toHaveCount(0);
    }
  }
});

test("QR tab renders separate downloadable codes for the website and Android app", async ({
  page,
}) => {
  test.skip(!email || !password, "Admin credentials are required");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/auth`);
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await page.getByRole("tab", { name: "קודי QR" }).click();

  await expect(page.getByRole("img", { name: "אתר בית הכנסת" })).toBeVisible();
  await expect(page.getByRole("img", { name: "האפליקציה ב־Google Play" })).toBeVisible();
  await expect(page.getByText("https://shul-hub.lovable.app", { exact: true })).toBeVisible();
  await expect(page.getByText(/play\.google\.com\/store\/apps\/details/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page
    .locator('[data-testid="qr-website"]')
    .getByRole("button", { name: "הורדת QR" })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("shul-hub-website-qr.svg");
});
