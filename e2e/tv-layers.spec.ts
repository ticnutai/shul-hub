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

  test("the design tab is its parts, each in its own place; the layout tab is where things stand", async ({ page }) => {
    // The look in its parts: the board's background, then the boxes' shape,
    // background, frames and text - for every box or one, chosen once.
    for (const name of ["ערכות נושא ועיצובים", "1. רקע הלוח", "2. צורת התיבה", "3. רקע התיבה", "4. מסגרות", "5. טקסט"])
      await expect(heading(page, name)).toBeVisible();
    await expect(page.getByTestId("layer-background")).toBeVisible();
    await expect(page.getByTestId("parts-scope")).toBeVisible();
    for (const part of ["shape", "background", "frames"]) await expect(page.getByTestId(`box-part-${part}`)).toBeVisible();
    await expect(page.getByTestId("layer-text")).toBeVisible();
    // A ready box is a bundle: among the sets, not among the parts.
    await expect(page.getByTestId("box-part-presets").getByTestId("box-presets")).toBeVisible();
    await expect(page.getByTestId("painted-boards")).toHaveCount(0);

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

  test("every box gets a background from the same gallery, and one box its own - beside its shape and line", async ({ page }) => {
    // A box's background is its own part, from the same gallery.
    const scope = page.getByLabel("התיבות והטקסט של");
    const part = page.getByTestId("box-part-background");
    const layer = part.getByTestId("box-layer-background");
    await expect(part.getByTestId("box-background-gallery")).toBeVisible();
    await layer.getByRole("radio", { name: "צבע", exact: true }).click();
    await layer.getByLabel("צבע הרקע").fill("#203a5c");
    const prayers = root(page).locator('[data-frame="prayers"]').first();
    const zmanim = root(page).locator('[data-frame="zmanim"]').first();
    await expect.poll(() => bg(prayers)).toBe("rgb(32, 58, 92)");
    await expect.poll(() => bg(zmanim)).toBe("rgb(32, 58, 92)");

    // One box apart, chosen once at the top: the zmanim in burgundy, the rest stay blue.
    await scope.selectOption("frame:zmanim");
    await layer.getByRole("radio", { name: "צבע", exact: true }).click();
    await layer.getByLabel("צבע הרקע").fill("#5a1a2a");
    await expect.poll(() => bg(zmanim)).toBe("rgb(90, 26, 42)");
    expect(await bg(prayers)).toBe("rgb(32, 58, 92)");

    // Half see-through.
    await layer.getByLabel("אטימות").fill("0.5");
    await expect.poll(() => bg(zmanim)).toBe("rgba(90, 26, 42, 0.5)");
    await expectNotFrozen(page, "frame backgrounds");
  });

  test("boxes: a ready one, a shape of its own for one box, and a frame from the gallery", async ({ page }) => {
    // A ready box: a hexagon, its gold line drawn as a ring that follows the cut.
    await page.getByTestId("box-presets").getByRole("button", { name: "משושה זהב" }).click();
    await expect(root(page)).toHaveClass(/has-shape-hexagon/);
    const prayers = root(page).locator('[data-frame="prayers"]').first();
    await expect.poll(() => prayers.evaluate((e) => getComputedStyle(e).clipPath)).toContain("polygon");
    await expect.poll(() => prayers.evaluate((e) => getComputedStyle(e, "::after").clipPath)).toContain("evenodd");

    // One box apart: the zmanim an ellipse, the others stay hexagons.
    await page.getByLabel("התיבות והטקסט של").selectOption("frame:zmanim");
    await page.getByTestId("box-shapes").getByRole("button", { name: "אליפסה" }).click();
    const zmanim = root(page).locator('[data-frame="zmanim"]').first();
    await expect(zmanim).toHaveAttribute("data-shape", "ellipse");
    await expect.poll(() => zmanim.evaluate((e) => getComputedStyle(e).clipPath)).toBe("none");
    await expect.poll(() => prayers.evaluate((e) => getComputedStyle(e).clipPath)).toContain("polygon");

    // And a frame of its own from the gallery; a second click takes it off.
    const pictures = page.getByTestId("frame-pictures");
    await pictures.getByRole("button", { name: "קו כפול זהב" }).click();
    await expect(zmanim).toHaveAttribute("data-own-image", "");
    await pictures.getByRole("button", { name: "קו כפול זהב" }).click();
    await expect(zmanim).not.toHaveAttribute("data-own-image", "");
    await expectNotFrozen(page, "boxes");
  });

  test("frames get a line, depth and the arch shape", async ({ page }) => {
    const layer = page.getByTestId("box-part-frames");
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
    await page.getByLabel("התיבות והטקסט של").selectOption("frame:clock");
    const layer = page.getByTestId("box-part-background").getByTestId("box-layer-background");
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

  test("text is chosen for the board, one box - its colours, font and size - or one part of it", async ({ page }) => {
    const layer = page.getByTestId("layer-text");
    await page.getByLabel("התיבות והטקסט של").selectOption("frame:zmanim");
    await layer.getByRole("button", { name: "הוספת טקסט" }).click();
    await layer.getByLabel("טקסט", { exact: true }).fill("#ffeeaa");
    const zmanim = root(page).locator('[data-frame="zmanim"]').first();
    await expect.poll(() => zmanim.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(255, 238, 170)");
    // Its own font and size, over the board's.
    const boardFont = await root(page).evaluate((e) => getComputedStyle(e).getPropertyValue("--tv-font-body"));
    const other = boardFont.includes("Heebo") ? "traditional" : "modern";
    await layer.getByLabel("גופן התיבה").selectOption(other);
    await expect.poll(() => zmanim.evaluate((e) => getComputedStyle(e).getPropertyValue("--tv-font-body"))).not.toBe(boardFont);
    // ...and the board's own is untouched.
    expect(await root(page).evaluate((e) => getComputedStyle(e).getPropertyValue("--tv-font-body"))).toBe(boardFont);
    await layer.getByLabel("גודל הטקסט בתיבה").fill("1.4");
    await expect.poll(() => zmanim.evaluate((e) => getComputedStyle(e).getPropertyValue("--fs"))).toContain("1.4");

    await page.getByLabel("התיבות והטקסט של").selectOption("frames");
    await layer.getByLabel("חלק מסוים בטקסט").selectOption("header.title");
    // The same editor as a click on the board: size in steps, weight from one list.
    const bigger = layer.getByRole("button", { name: "הגדלת גודל טקסט של הרכיב" });
    for (let i = 0; i < 10; i++) await bigger.click();
    const title = root(page).locator("h1.tv-title").first();
    await expect.poll(() => title.evaluate((e) => getComputedStyle(e).getPropertyValue("--es").trim())).toBe("1.5");
    await layer.getByLabel("עובי הגופן של הרכיב").selectOption("700");
    await expect.poll(() => title.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("700");
    await expectNotFrozen(page, "text layers");
  });
});
