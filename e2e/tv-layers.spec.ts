import { expect, test } from "@playwright/test";
import { expectNotFrozen, serveEditor } from "./support/tvEditor";

/**
 * The design tab in three layers - רקעים, מסגרות, טקסט - each asking "for
 * what" first (the board, every frame, one frame, one area), and "פריסה"
 * holding only where things stand.
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
  const bg = (el: import("@playwright/test").Locator) => el.evaluate((e) => getComputedStyle(e).backgroundColor);

  test("the design tab is backgrounds, frames and text; the layout tab is where things stand", async ({ page }) => {
    for (const name of ["ערכות נושא ועיצובים", "רקעים", "מסגרות", "טקסט"]) await expect(heading(page, name)).toBeVisible();
    await expect(page.getByTestId("layer-background")).toBeVisible();
    await expect(page.getByTestId("layer-frames")).toBeVisible();
    await expect(page.getByTestId("layer-text")).toBeVisible();
    // The paintings are not frames any more.
    await expect(page.getByTestId("layer-frames").getByTestId("painted-boards")).toHaveCount(0);

    await page.getByRole("tab", { name: "פריסה" }).click();
    await expect(page.getByTestId("skin-picker")).toHaveCount(0);
    await expect(page.getByTestId("frame-shapes")).toHaveCount(0);
    await expect(page.getByLabel("מרווח עליון", { exact: true })).toBeVisible();
    await expectNotFrozen(page, "layout tab");
  });

  test("the board's background has sliders of its own", async ({ page }) => {
    const layer = page.getByTestId("layer-background");
    await layer.getByLabel("בהירות").fill("1.3");
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-bg-tune");
    await expect
      .poll(() => root(page).locator(".tv-bg").evaluate((e) => getComputedStyle(e).filter))
      .toContain("brightness(1.3)");
    await layer.getByRole("button", { name: "הוספת צבע מעל הרקע" }).click();
    await expect(root(page).locator(".tv-bg-tint")).toHaveCount(1);
    await layer.getByRole("button", { name: "איפוס הסליידרים" }).click();
    await expect.poll(() => root(page).getAttribute("class")).not.toContain("has-bg-tune");
    await expectNotFrozen(page, "background sliders");
  });

  test("every frame gets a background from the same library, and one frame its own", async ({ page }) => {
    const layer = page.getByTestId("layer-background");
    await layer.getByLabel("רקע של").selectOption("frames");
    await layer.getByRole("radio", { name: "צבע", exact: true }).click();
    await layer.getByLabel("צבע הרקע").fill("#203a5c");
    const prayers = root(page).locator('[data-frame="prayers"]').first();
    const zmanim = root(page).locator('[data-frame="zmanim"]').first();
    await expect.poll(() => bg(prayers)).toBe("rgb(32, 58, 92)");
    await expect.poll(() => bg(zmanim)).toBe("rgb(32, 58, 92)");

    // One frame apart: the zmanim in burgundy, the rest stay blue.
    await layer.getByLabel("רקע של").selectOption("frame:zmanim");
    await layer.getByRole("radio", { name: "צבע", exact: true }).click();
    await layer.getByLabel("צבע הרקע").fill("#5a1a2a");
    await expect.poll(() => bg(zmanim)).toBe("rgb(90, 26, 42)");
    expect(await bg(prayers)).toBe("rgb(32, 58, 92)");

    // Half see-through.
    await layer.getByLabel("אטימות").fill("0.5");
    await expect.poll(() => bg(zmanim)).toBe("rgba(90, 26, 42, 0.5)");
    await expectNotFrozen(page, "frame backgrounds");
  });

  test("frames get a line, depth and the arch shape", async ({ page }) => {
    const layer = page.getByTestId("layer-frames");
    await layer.getByRole("button", { name: "הוספת קו מסביב" }).click();
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-frame-line");
    const panel = root(page).locator('[data-frame="prayers"]').first();
    await expect.poll(() => panel.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe("solid");
    await layer.getByLabel("כמה המסגרות בולטות").fill("0.6");
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-frame-depth");
    await page.getByTestId("frame-shapes").getByRole("button", { name: "קשת", exact: true }).click();
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-frame-arch");
    await expectNotFrozen(page, "frame line and arch");
  });

  test("the medallion layout is built from ordinary frames that every layer reaches", async ({ page }) => {
    await page.getByRole("tab", { name: "פריסה" }).click();
    await page.getByRole("button", { name: /^מדליון/ }).click();
    const med = root(page).locator(".tv-med");
    await expect(med).toBeVisible();
    for (const id of ["clock", "date", "prayers", "zmanim", "strip"])
      await expect(med.locator(`[data-frame="${id}"]`).first()).toBeVisible();
    // Its own header: the board's header strip is not drawn over it.
    await expect(root(page).locator(".tv-header")).toHaveCount(0);

    // A frame style reaches its frames, and one frame can stand apart.
    await page.getByRole("tab", { name: "עיצוב" }).click();
    await page.getByTestId("skin-picker").getByRole("button").nth(1).click();
    const layer = page.getByTestId("layer-background");
    await layer.getByLabel("רקע של").selectOption("frame:clock");
    await layer.getByRole("radio", { name: "צבע", exact: true }).click();
    await layer.getByLabel("צבע הרקע").fill("#5a1a2a");
    await expect.poll(() => bg(med.locator('[data-frame="clock"]'))).toBe("rgb(90, 26, 42)");
    // The plaque's text stays above whatever the style draws behind it.
    await expect(med.locator('[data-frame="date"] span').first()).toBeVisible();
    await expectNotFrozen(page, "medallion");
  });

  test("a ready design puts a whole look on the board, built from parts", async ({ page }) => {
    await page.getByTestId("builtin-designs").getByRole("button", { name: "וילון כחול וזהב" }).click();
    const med = root(page).locator(".tv-med");
    await expect(med).toBeVisible();
    await expect(root(page)).toHaveClass(/has-frame-image/);
    await expect.poll(() => bg(med.locator('[data-frame="clock"]'))).toBe("rgb(27, 52, 148)");
    // And every part stays its own: another background leaves the frames alone.
    await page.getByTestId("builtin-designs").getByRole("button", { name: "לוחות הברית מאבן" }).click();
    await expect(root(page)).toHaveClass(/has-frame-arch/);
    await expect(root(page)).not.toHaveClass(/has-frame-image/);
    await expectNotFrozen(page, "ready designs");
  });

  test("text is chosen for the board, inside one frame, or one area", async ({ page }) => {
    const layer = page.getByTestId("layer-text");
    await layer.getByLabel("טקסט של").selectOption("frame:zmanim");
    await layer.getByRole("button", { name: "הוספת טקסט" }).click();
    await layer.getByLabel("טקסט", { exact: true }).fill("#ffeeaa");
    const zmanim = root(page).locator('[data-frame="zmanim"]').first();
    await expect.poll(() => zmanim.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(255, 238, 170)");

    await layer.getByLabel("טקסט של").selectOption("area:header.title");
    await layer.getByLabel("גודל הטקסט באזור").fill("1.5");
    const title = root(page).locator("h1.tv-title").first();
    await expect.poll(() => title.evaluate((e) => getComputedStyle(e).getPropertyValue("--es").trim())).toBe("1.5");
    await layer.getByRole("button", { name: "מודגש" }).click();
    await expect.poll(() => title.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("700");
    await expectNotFrozen(page, "text layers");
  });
});
