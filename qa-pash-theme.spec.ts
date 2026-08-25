import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";
const routes = [
  "/",
  "/announcements",
  "/shiurim",
  "/chavrutot",
  "/contact",
  "/torah-chumash",
  "/torah-siddur",
] as const;

async function selectPashTheme(page: Page) {
  await page.getByRole("button", { name: "ערכת נושא" }).click();
  await page.getByRole("menuitem", { name: /תורה עם מפרשים/ }).click();
  await expect(page.locator("html")).toHaveClass(/theme-pash/);
}

test.describe("pash-inspired full-site theme", () => {
  test("selects, applies exact classic tokens and persists after reload", async ({ page }) => {
    await page.goto(baseUrl);
    await expect(page.locator("header[data-app-hydrated='true']")).toBeVisible();
    await selectPashTheme(page);

    const tokens = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      const header = document.querySelector("header[data-app-hydrated]");
      const card = document.querySelector(".card-elev");
      return {
        primary: styles.getPropertyValue("--primary").trim(),
        background: styles.getPropertyValue("--background").trim(),
        radius: styles.getPropertyValue("--radius").trim(),
        font: styles.getPropertyValue("--app-font-family").trim(),
        headerBackground: header ? getComputedStyle(header).backgroundColor : "",
        cardRadius: card ? getComputedStyle(card).borderRadius : "",
      };
    });

    expect(tokens.primary).toMatch(/^(hsl\(220 60% 20%\)|#142952)$/);
    expect(tokens.background).toMatch(/^(hsl\(40 20% 97%\)|#f9f8f6)$/);
    expect(tokens.radius).toMatch(/^0?\.5rem$/);
    expect(tokens.font).toContain("Heebo");
    expect(tokens.headerBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(tokens.cardRadius).toBe("8px");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("beit-knesset-theme")))
      .toBe("pash");

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/theme-pash/);
  });

  test("fits every public route on mobile without affecting another theme", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl);
    await expect(page.locator("header[data-app-hydrated='true']")).toBeVisible();
    await selectPashTheme(page);

    for (const route of routes) {
      await page.goto(`${baseUrl}${route}`);
      await expect(page.locator("html")).toHaveClass(/theme-pash/);
      const overflow = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(overflow.content).toBeLessThanOrEqual(overflow.viewport + 1);
    }

    await page.getByRole("button", { name: "ערכת נושא" }).click();
    await page.getByRole("menuitem", { name: /נייבי וזהב/ }).click();
    await expect(page.locator("html")).toHaveClass(/theme-navy/);
    await expect(page.locator("html")).not.toHaveClass(/theme-pash/);
    await expect(page.locator(".card-elev").first()).not.toHaveCSS("border-radius", "8px");
  });
});
