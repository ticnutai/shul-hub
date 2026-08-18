import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";
const email = process.env.QA_ADMIN_EMAIL;
const password = process.env.QA_ADMIN_PASSWORD;

const themeNames = {
  navy: "נייבי וזהב",
  jerusalem: "אבן ירושלמית",
  bordeaux: "בורדו וזהב",
  forest: "ירוק זית",
  sand: "תכלת ולבן",
  night: "מצב לילה",
} as const;

type ThemeId = keyof typeof themeNames;

async function signIn(page: Page) {
  await page.goto(`${baseUrl}/auth`);
  await page.getByLabel("אימייל").fill(email!);
  await page.getByLabel("סיסמה").fill(password!);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function selectTheme(page: Page, theme: ThemeId) {
  await page.getByRole("button", { name: "ערכת נושא" }).click();
  await page.getByRole("menuitem", { name: new RegExp(themeNames[theme]) }).click();
  await expect(page.locator("html")).toHaveClass(new RegExp(`theme-${theme}`));
}

test("authenticated theme uploads and hydrates in a clean browser context", async ({ browser }) => {
  test.skip(!email || !password, "Admin credentials are required");

  const firstContext = await browser.newContext({ locale: "he-IL" });
  const firstPage = await firstContext.newPage();
  await signIn(firstPage);

  const originalClass = await firstPage.locator("html").getAttribute("class");
  const originalTheme =
    (Object.keys(themeNames) as ThemeId[]).find((id) => originalClass?.includes(`theme-${id}`)) ??
    "navy";
  const testTheme: ThemeId = originalTheme === "forest" ? "bordeaux" : "forest";

  try {
    await selectTheme(firstPage, testTheme);
    await firstPage.waitForTimeout(900);

    const cleanContext = await browser.newContext({ locale: "he-IL" });
    const cleanPage = await cleanContext.newPage();
    await signIn(cleanPage);
    await expect(cleanPage.locator("html")).toHaveClass(new RegExp(`theme-${testTheme}`), {
      timeout: 5000,
    });
    await cleanContext.close();
  } finally {
    await selectTheme(firstPage, originalTheme);
    await firstPage.waitForTimeout(900);
    await firstContext.close();
  }
});
