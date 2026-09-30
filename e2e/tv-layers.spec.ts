import { expect, test } from "@playwright/test";
import { expectNotFrozen, serveEditor } from "./support/tvEditor";

/**
 * The design tab in layers: רקע, מסגרות, טקסט - each thing edited in one
 * place - and "פריסה" holding only where things stand.
 *
 * Same harness as tv-editor.spec.ts: the real TvDesignPanel with its
 * database answered from the spec.
 */

const HARNESS = "/e2e/harness/editor.html";

test.describe("TV editor, by layer", () => {
  test.skip(({ isMobile }) => isMobile, "the editor is for a desktop screen");

  test.beforeEach(async ({ page }) => {
    await serveEditor(page);
    const res = await page.goto(HARNESS).catch(() => null);
    test.skip(!res, "the dev server is not running (npm run dev)");
    await expect(page.locator(".tv-frame .tv-root")).toBeVisible({ timeout: 20_000 });
  });

  const root = (page: import("@playwright/test").Page) => page.locator(".tv-frame .tv-root").first();
  const heading = (page: import("@playwright/test").Page, name: string) =>
    page.getByRole("heading", { name, exact: true, level: 3 });

  test("the design tab is background, frames and text; the layout tab is where things stand", async ({ page }) => {
    for (const name of ["ערכת נושא", "רקע", "מסגרות", "טקסט"]) await expect(heading(page, name)).toBeVisible();
    // Styles and frame shapes are how frames look - here, not under layout.
    await expect(page.getByTestId("skin-picker")).toBeVisible();
    await expect(page.getByTestId("painted-boards")).toBeVisible();
    await expect(page.getByTestId("frame-shapes")).toBeVisible();
    await expect(page.getByTestId("frame-looks")).toBeVisible();
    await expect(page.getByTestId("text-areas")).toBeVisible();

    await page.getByRole("tab", { name: "פריסה" }).click();
    await expect(page.getByTestId("skin-picker")).toHaveCount(0);
    await expect(page.getByTestId("painted-boards")).toHaveCount(0);
    await expect(page.getByTestId("frame-shapes")).toHaveCount(0);
    await expect(page.getByLabel("מרווח עליון", { exact: true })).toBeVisible();
    await expectNotFrozen(page, "layout tab");
  });

  test("a painted board is chosen with the frames, and a drawn style takes the board back", async ({ page }) => {
    await page.getByTestId("painted-boards").getByRole("button", { name: /לוחות הברית מאבן/ }).click();
    await expect(root(page).locator(".tv-ill.is-stone")).toBeVisible();
    // Its wall is edited with the background, its frames with the frames, its text with the text.
    await expect(page.getByTestId("painted-wall")).toBeVisible();
    await expect(page.getByTestId("painted-frames")).toBeVisible();
    await expect(page.getByTestId("painted-text")).toBeVisible();
    await expectNotFrozen(page, "painted board");

    await page.getByTestId("skin-picker").getByRole("button").nth(1).click();
    await expect(root(page).locator(".tv-ill")).toHaveCount(0);
    await expect(page.getByTestId("painted-wall")).toHaveCount(0);
    await expectNotFrozen(page, "back to a drawn style");
  });

  test("one frame can be dressed apart from the others", async ({ page }) => {
    const looks = page.getByTestId("frame-looks");
    await looks.getByRole("radio", { name: "זמני היום" }).click();
    // Nothing set yet: a tap puts a colour on, and the colour box appears.
    await looks.getByRole("button", { name: "זמני היום: רקע בצבע אחיד" }).click();
    await looks.getByLabel("זמני היום: צבע רקע").fill("#5a1a2a");
    await looks.getByRole("button", { name: "זמני היום: הוספת טקסט" }).click();
    await looks.getByLabel("זמני היום: טקסט", { exact: true }).fill("#ffeeaa");

    const zmanim = root(page).locator('[data-frame="zmanim"]').first();
    await expect(zmanim).toBeVisible();
    await expect.poll(() => zmanim.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(90, 26, 42)");
    await expect.poll(() => zmanim.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 238, 170)");
    // The other frames keep the board's look.
    const prayers = root(page).locator('[data-frame="prayers"]').first();
    expect(await prayers.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe("rgb(90, 26, 42)");
    await expectNotFrozen(page, "frame look");

    await looks.getByRole("button", { name: /החזרת "זמני היום"/ }).click();
    await expect.poll(() => zmanim.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe("rgb(90, 26, 42)");
  });

  test("text is styled by area with sliders", async ({ page }) => {
    const areas = page.getByTestId("text-areas");
    await areas.getByLabel("אזור טקסט").selectOption({ label: "שם בית הכנסת" });
    await areas.getByLabel("גודל הטקסט באזור").fill("1.5");
    const title = root(page).locator("h1.tv-title").first();
    await expect.poll(() => title.evaluate((el) => getComputedStyle(el).getPropertyValue("--es").trim())).toBe("1.5");
    await areas.getByRole("button", { name: "מודגש" }).click();
    await expect.poll(() => title.evaluate((el) => getComputedStyle(el).fontWeight)).toBe("700");
    await expectNotFrozen(page, "text area");
  });
});
