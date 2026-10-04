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
    // The look in its parts: ready sets, the background, the boxes, their
    // frames and the text - for every box or one, chosen once.
    for (const name of ["1. ערכות", "2. רקע", "3. תיבות", "4. מסגרות", "5. טקסט"])
      await expect(heading(page, name)).toBeVisible();
    await expect(page.getByTestId("layer-background")).toBeVisible();
    await expect(page.getByTestId("parts-scope")).toBeVisible();
    for (const part of ["shape", "background", "frames"]) await expect(page.getByTestId(`box-part-${part}`)).toBeVisible();
    await expect(page.getByTestId("layer-text")).toBeVisible();
    // The ready boxes are with the boxes, not with the sets of the whole board.
    await expect(page.locator("#design-boxes").getByTestId("box-presets")).toBeVisible();
    await expect(page.locator("#design-sets").getByTestId("box-presets")).toHaveCount(0);

    // The topics side by side: a click brings its section to the top.
    const topics = page.getByTestId("design-topics");
    for (const [label, id] of [["טקסט", "design-text"], ["תיבות", "design-boxes"], ["ערכות מוכנות", "design-sets"]] as const) {
      await topics.getByRole("button", { name: label, exact: true }).click();
      await expect.poll(() => page.locator(`#${id}`).evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(300);
      await expect(topics.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-current", "true");
    }
    await expect(page.getByTestId("painted-boards")).toHaveCount(0);

    await page.getByRole("tab", { name: "פריסה" }).click();
    await expect(page.getByTestId("board-frames")).toHaveCount(0);
    await expect(page.getByTestId("frame-shapes")).toHaveCount(0);
    await expect(page.getByLabel("מרווח עליון", { exact: true })).toBeVisible();
    await expectNotFrozen(page, "layout tab");
  });

  test("a board from nothing: what is on it first, then a guide through the steps", async ({ page }) => {
    const starter = page.getByTestId("blank-board");
    await starter.getByRole("button", { name: "לוח ריק - בוחרים מה יופיע" }).click();
    // The common ones are ticked to begin with; the shiurim are added, the zmanim taken off.
    await starter.getByRole("checkbox", { name: /שיעורים/ }).check();
    await starter.getByRole("checkbox", { name: /זמני היום/ }).uncheck();
    await starter.getByRole("button", { name: "יצירת לוח ריק עם מה שבחרתי" }).click();

    // The board shows what was ticked, and nothing it was not.
    await expect(root(page).locator(".tv-board-frame")).toHaveCount(0);
    await expect(root(page)).not.toHaveClass(/has-bg-image|has-bg-gradient/);
    await expect(page.getByRole("button", { name: "ביטול שינויים" })).toBeEnabled();

    // The guide: the arrangement first, in the layout tab, then the look.
    const guide = page.getByTestId("build-guide");
    await guide.getByRole("button", { name: /סידור על המסך/ }).click();
    await expect(page.getByRole("tab", { name: "פריסה" })).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => page.locator("#layout-screens").evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(300);
    await guide.getByRole("button", { name: /תיבות/ }).click();
    await expect(page.getByRole("tab", { name: "עיצוב" })).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => page.locator("#design-boxes").evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(300);
    await expect(guide.getByRole("button", { name: /✓ סידור על המסך/ })).toBeVisible();
    await expectNotFrozen(page, "blank board");
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
    await layer.getByRole("button", { name: "איפוס הכוונון" }).click();
    await expect.poll(() => root(page).getAttribute("class")).not.toContain("has-bg-tune");
    await expectNotFrozen(page, "background sliders");
  });

  test("every box gets a background from the same gallery, and one box its own - beside its shape and line", async ({ page }) => {
    // A box's background is its own part, from the same gallery.
    const scope = page.getByLabel("התיבות, המסגרות והטקסט של");
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

    // Its whole design, copied to the prayers in one click.
    const copy = page.getByTestId("copy-box-look");
    await copy.getByLabel("העתקה אל").selectOption("prayers");
    await copy.getByRole("button", { name: "העתקה" }).click();
    await expect.poll(() => bg(prayers)).toBe("rgba(90, 26, 42, 0.5)");
    await expectNotFrozen(page, "frame backgrounds");
  });

  test("text too faint for its box is pointed out, and a click goes to that box's text", async ({ page }) => {
    // The board as it comes reads well: nothing to say.
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("readability")).toHaveCount(0);

    // Pale text's own box made pale too.
    await page.getByLabel("התיבות, המסגרות והטקסט של").selectOption("frame:zmanim");
    const layer = page.getByTestId("box-part-background").getByTestId("box-layer-background");
    await layer.getByRole("radio", { name: "צבע", exact: true }).click();
    await layer.getByLabel("צבע הרקע").fill("#eeeeee");
    const note = page.getByTestId("readability");
    await expect(note).toBeVisible({ timeout: 5000 });
    await note.getByRole("button", { name: /בדיקת קריאוּת/ }).click();
    await expect(note).toContainText("זמני היום");

    await page.getByLabel("התיבות, המסגרות והטקסט של").selectOption("frames");
    await note.getByRole("button", { name: "לתיקון" }).first().click();
    await expect(page.getByLabel("התיבות, המסגרות והטקסט של")).toHaveValue("frame:zmanim");
    await expectNotFrozen(page, "readability");
  });

  test("boxes: a ready one, a shape of its own for one box, and a frame from the gallery", async ({ page }) => {
    // A ready box: a hexagon, its gold line drawn as a ring that follows the cut.
    await page.getByTestId("box-presets").getByRole("button", { name: "משושה זהב", exact: true }).click();
    await expect(root(page)).toHaveClass(/has-shape-hexagon/);
    const prayers = root(page).locator('[data-frame="prayers"]').first();
    await expect.poll(() => prayers.evaluate((e) => getComputedStyle(e).clipPath)).toContain("polygon");
    await expect.poll(() => prayers.evaluate((e) => getComputedStyle(e, "::after").clipPath)).toContain("evenodd");

    // One box apart: the zmanim an ellipse, the others stay hexagons.
    await page.getByLabel("התיבות, המסגרות והטקסט של").selectOption("frame:zmanim");
    await page.getByTestId("box-shapes").getByRole("button", { name: "אליפסה" }).click();
    const zmanim = root(page).locator('[data-frame="zmanim"]').first();
    await expect(zmanim).toHaveAttribute("data-shape", "ellipse");
    await expect.poll(() => zmanim.evaluate((e) => getComputedStyle(e).clipPath)).toBe("none");
    await expect.poll(() => prayers.evaluate((e) => getComputedStyle(e).clipPath)).toContain("polygon");

    // And a frame of its own from the gallery; a second click takes it off.
    const pictures = page.getByTestId("frame-pictures");
    await pictures.getByRole("button", { name: "קו כפול זהב", exact: true }).click();
    await expect(zmanim).toHaveAttribute("data-own-image", "");
    await pictures.getByRole("button", { name: "קו כפול זהב", exact: true }).click();
    await expect(zmanim).not.toHaveAttribute("data-own-image", "");
    await expectNotFrozen(page, "boxes");
  });

  test("frames get a line, depth and the arch shape", async ({ page }) => {
    const layer = page.getByTestId("box-part-frames");
    await layer.getByRole("button", { name: "הוספת קו מסביב" }).click();
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-frame-line");
    const panel = root(page).locator('[data-frame="prayers"]').first();
    await expect.poll(() => panel.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe("solid");
    await layer.getByLabel("כמה התיבות בולטות").fill("0.6");
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
    await page.getByTestId("board-frames").first().getByRole("button").nth(1).click();
    await page.getByLabel("התיבות, המסגרות והטקסט של").selectOption("frame:clock");
    const layer = page.getByTestId("box-part-background").getByTestId("box-layer-background");
    await layer.getByRole("radio", { name: "צבע", exact: true }).click();
    await layer.getByLabel("צבע הרקע").fill("#5a1a2a");
    await expect.poll(() => bg(med.locator('[data-frame="clock"]'))).toBe("rgb(90, 26, 42)");
    // The plaque's text stays above whatever the style draws behind it.
    await expect(med.locator('[data-frame="date"] span').first()).toBeVisible();
    await expectNotFrozen(page, "medallion");
  });

  test("a ready design puts a whole look on the board, built from parts", async ({ page }) => {
    await page.getByTestId("builtin-designs").getByRole("button", { name: /^וילון כחול וזהב/ }).click();
    const med = root(page).locator(".tv-med");
    await expect(med).toBeVisible();
    await expect(root(page)).toHaveClass(/has-frame-image/);
    await expect.poll(() => bg(med.locator('[data-frame="clock"]'))).toBe("rgb(27, 52, 148)");
    // And every part stays its own: another background leaves the frames alone.
    await page.getByTestId("builtin-designs").getByRole("button", { name: /^לוחות הברית מאבן/ }).click();
    await expect(root(page)).toHaveClass(/has-frame-arch/);
    await expect(root(page)).not.toHaveClass(/has-frame-image/);
    await expectNotFrozen(page, "ready designs");
  });

  test("text is chosen for the board, one box - its colours, font and size - or one part of it", async ({ page }) => {
    const layer = page.getByTestId("layer-text");
    await page.getByLabel("התיבות, המסגרות והטקסט של").selectOption("frame:zmanim");
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

    await page.getByLabel("התיבות, המסגרות והטקסט של").selectOption("frames");
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
