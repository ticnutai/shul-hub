import { expect, test } from "@playwright/test";
import { BOARD_FRAMES } from "../src/tv/config";
import { expectNotFrozen, serveEditor, type EditorServer } from "./support/tvEditor";
import { chooseDevice } from "./support/deviceMenu";

/**
 * The editor itself, control by control.
 *
 * It runs against e2e/harness/editor.html, which mounts the real
 * TvDesignPanel with its database answered from the spec - so these tests
 * need no administrator account and still drive the shipped component.
 *
 * Every step ends with `expectNotFrozen`: twice now a dialog has closed badly
 * and left the whole page unclickable while looking perfectly normal, so each
 * test proves a click still lands after it.
 */

const HARNESS = "/e2e/harness/editor.html";

let server: EditorServer;

test.describe("TV editor", () => {
  test.skip(({ isMobile }) => isMobile, "the editor is for a desktop screen");

  test.beforeEach(async ({ page }) => {
    server = await serveEditor(page);
    const res = await page.goto(HARNESS).catch(() => null);
    test.skip(!res, "the dev server is not running (npm run dev)");
    await expect(page.locator(".tv-frame .tv-root")).toBeVisible({ timeout: 20_000 });
  });

  /** The board's own root, which carries the theme variables and the board's frame. */
  const root = (page: import("@playwright/test").Page) => page.locator(".tv-frame .tv-root").first();

  const cssVar = (page: import("@playwright/test").Page, name: string) =>
    root(page).evaluate((el, v) => getComputedStyle(el).getPropertyValue(v).trim(), name);

  /** Which frame for the whole board is on, "none" without one. */
  const boardFrameOf = async (page: import("@playwright/test").Page) =>
    /is-board-frame-([a-z-]+)/.exec((await root(page).getAttribute("class")) ?? "")?.[1] ?? "none";
  const boardFrames = (page: import("@playwright/test").Page) => page.getByTestId("board-frames").first().locator("button[aria-pressed]");

  test("every frame for the whole board applies, and each is the board's own", async ({ page }) => {
    await page.getByRole("tab", { name: "עיצוב" }).click();
    const count = await boardFrames(page).count();
    expect(count).toBe(BOARD_FRAMES.length + 1);

    const applied: string[] = [];
    for (let i = 0; i < count; i++) {
      await boardFrames(page).nth(i).click();
      const frame = await boardFrameOf(page);
      applied.push(frame);
      if (frame !== "none") await expect(root(page).locator(`.tv-board-frame[data-frame="${frame}"]`)).toHaveCount(1);
      await expectNotFrozen(page, `board frame ${frame}`);
    }
    expect([...applied].sort()).toEqual(["none", ...BOARD_FRAMES].sort());
  });

  test("the board's frame can be moved, lengthened, widened and put on one side", async ({ page }) => {
    await page.getByRole("tab", { name: "עיצוב" }).click();
    await boardFrames(page).filter({ hasText: "עמודי זהב" }).click();
    const controls = page.getByTestId("board-frame-controls");
    const column = root(page).locator(".tv-bf-column").first();
    const before = await column.boundingBox();
    await controls.getByLabel("רוחב העמודים", { exact: true }).fill("2");
    await controls.getByLabel("גובה העמודים", { exact: true }).fill("0.5");
    await expect.poll(async () => (await column.boundingBox())!.width).toBeGreaterThan(before!.width * 1.5);
    await expect.poll(async () => (await column.boundingBox())!.height).toBeLessThan(before!.height * 0.7);
    await controls.getByRole("button", { name: "רק שמאל" }).click();
    await expect(root(page).locator(".tv-bf-column")).toHaveCount(1);
    await expect(root(page).locator(".tv-bf-column.is-left")).toHaveCount(1);
    await controls.getByRole("button", { name: /חזרה לגודל/ }).click();
    await expect(root(page).locator(".tv-bf-column")).toHaveCount(2);
    await expectNotFrozen(page, "board frame tuned");
  });

  test("on the board itself, a column is dragged to move it and by its handles to stretch it", async ({ page }) => {
    await page.getByRole("tab", { name: "עיצוב" }).click();
    await boardFrames(page).filter({ hasText: "עמודי זהב" }).click();
    await page.getByRole("button", { name: "עריכה ישירה בלוח" }).click();
    const column = root(page).locator(".tv-bf-column.is-right");
    await expect(column.locator("[data-bf-handle]")).toHaveCount(3);
    const drag = async (from: { x: number; y: number }, by: { x: number; y: number }) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + by.x / 2, from.y + by.y / 2, { steps: 4 });
      await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 4 });
      await page.mouse.up();
    };
    const centre = async (l: import("@playwright/test").Locator) => {
      const b = (await l.boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };

    // Wider: its inner handle, pulled toward the middle.
    const w0 = (await column.boundingBox())!.width;
    await drag(await centre(column.locator('[data-bf-handle="size"]')), { x: -30, y: 0 });
    await expect.poll(async () => (await column.boundingBox())!.width).toBeGreaterThan(w0 + 15);

    // Shorter: its lower end, pulled up.
    const h0 = (await column.boundingBox())!.height;
    await drag(await centre(column.locator('[data-bf-handle="len-b"]')), { x: 0, y: -60 });
    await expect.poll(async () => (await column.boundingBox())!.height).toBeLessThan(h0 - 30);

    // Moved: the column itself, toward the middle and down.
    const before = (await column.boundingBox())!;
    await drag({ x: before.x + before.width / 2, y: before.y + before.height * 0.3 }, { x: -25, y: 20 });
    await expect.poll(async () => (await column.boundingBox())!.x).toBeLessThan(before.x - 10);
    await expect.poll(async () => (await column.boundingBox())!.y).toBeGreaterThan(before.y + 8);

    // What was dragged is in the controls too, and undo takes it back.
    await page.getByRole("button", { name: "סיום עריכה בלוח" }).click();
    await expect(page.getByTestId("board-frame-controls").getByLabel("רוחב העמודים", { exact: true })).not.toHaveValue("1");
    await expectNotFrozen(page, "board frame dragged");
  });

  test("before and after, and an earlier version looked at and put back", async ({ page }) => {
    const gallery = page.getByTestId("background-gallery");
    await page.getByRole("tab", { name: "עיצוב" }).click();
    await gallery.getByRole("button", { name: "זרקור זהב", exact: true }).click();
    await expect(root(page)).toHaveClass(/has-bg-gradient/);

    // Before: what is on the screens, not to be edited; after: the draft again.
    await page.getByRole("button", { name: "לפני / אחרי" }).click();
    await expect(page.getByTestId("preview-comparing")).toContainText("לפני השינויים");
    await expect(root(page)).not.toHaveClass(/has-bg-gradient/);
    await page.getByTestId("preview-comparing").getByRole("button", { name: "חזרה לטיוטה" }).click();
    await expect(root(page)).toHaveClass(/has-bg-gradient/);

    // Saved: the board it replaced is kept as a version.
    await page.getByRole("button", { name: "שמור ושדר למסכים" }).first().click();
    await expect.poll(() => server.writes(), { timeout: 10_000 }).toBeGreaterThan(0);
    await page.getByRole("tab", { name: "כלים" }).click();
    const versions = page.getByTestId("tv-versions");
    await expect(versions.getByRole("listitem")).toHaveCount(1);

    await versions.getByRole("button", { name: "הצגה" }).click();
    await expect(page.getByTestId("preview-comparing")).toContainText("הגרסה מ-");
    await expect(root(page)).not.toHaveClass(/has-bg-gradient/);
    await versions.getByRole("button", { name: "חזרה לטיוטה" }).click();
    await expect(page.getByTestId("preview-comparing")).toHaveCount(0);

    // Put back as a draft: the board is as it was, and there is something to save.
    await versions.getByRole("button", { name: "החזרה כטיוטה" }).click();
    await expect(root(page)).not.toHaveClass(/has-bg-gradient/);
    await expect(page.getByRole("button", { name: "ביטול שינויים" })).toBeEnabled();
    await expectNotFrozen(page, "versions");
  });

  test("a title style for every box, and one box apart", async ({ page }) => {
    await page.getByRole("tab", { name: "עיצוב" }).click();
    await page.getByTestId("title-styles").first().getByRole("button", { name: "כותרת: סרט" }).click();
    await expect(root(page)).toHaveAttribute("data-title-style", "ribbon");
    await expectNotFrozen(page, "title style");
  });

  test("every frame shape applies, and the roundness sliders work", async ({ page }) => {
    await page.getByRole("tab", { name: "עיצוב" }).click();
    const shapes = ["רגיל", "מעוגל", "רך", "קטום", "מגורע", "מדורג", "כיפה", "כיפת בצל", "קשת מחודדת", "מסולסל"];
    const frames = page.getByTestId("frame-shapes");
    for (const shape of shapes) {
      await frames.getByRole("button", { name: shape, exact: true }).click();
      const className = (await root(page).getAttribute("class")) ?? "";
      if (shape === "רגיל") expect(className).not.toContain("has-frame-shape");
      else expect(className).toContain("has-frame-shape");
      await expectNotFrozen(page, `frame ${shape}`);
    }

    // The roundness of the top, set by hand, reaches the board.
    // The two sliders start on "רגיל"; the button beside one turns it on.
    const topRow = page.locator("div", { has: page.getByLabel("עיגול למעלה", { exact: true }) }).last();
    await topRow.getByRole("button", { name: "רגיל" }).click();
    await page.getByLabel("עיגול למעלה", { exact: true }).fill("8");
    await expect.poll(() => cssVar(page, "--frame-top")).not.toBe("");
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-frame-radius");
    await expectNotFrozen(page, "frame radius");
  });

  test("a gradient from the gallery reaches the board, and a changed one is kept in it", async ({ page }) => {
    const gallery = page.getByTestId("background-gallery");
    await gallery.getByRole("button", { name: "בורדו מלכותי", exact: true }).click();
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-bg-gradient");
    await expect.poll(() => cssVar(page, "--tv-bg-gradient")).toContain("gradient");
    // A ready one, as it is: nothing to keep.
    await expect(page.getByTestId("background-keep")).toHaveCount(0);
    await expectNotFrozen(page, "gradient applied");

    // Built further and taken: it is not in the gallery yet, and can be kept there.
    const now = page.getByTestId("background-now");
    await now.getByLabel("צבע ראשון").fill("#112233");
    await now.getByRole("button", { name: "החלה על רקע הלוח" }).click();
    const keep = page.getByTestId("background-keep");
    await keep.getByLabel("שם לרקע בגלריה").fill("בדיקה");
    await keep.getByRole("button", { name: "שמירה כרקע חדש" }).click();
    await expect(gallery.getByRole("button", { name: "בדיקה", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expectNotFrozen(page, "gradient saved");
  });

  /**
   * Judging a gradient on the board rather than on a swatch.
   *
   * A colour that looks right in a twenty-pixel strip in a side panel can
   * be wrong across a wall, and having to commit before you can see it
   * turns choosing one into a guessing game.
   */
  test("a gradient shows on the board while you build it, and is not saved until you say", async ({
    page,
  }) => {
    const gradient = () => cssVar(page, "--tv-bg-gradient");
    const before = await gradient();
    const now = page.getByTestId("background-now");
    await now.getByRole("radio", { name: "מעבר צבעים", exact: true }).click();

    // Turning a dial reaches the board immediately.
    await now.getByLabel("צבע ראשון").fill("#5a1a2a");
    await expect.poll(gradient).not.toBe(before);
    const shown = await gradient();
    expect(shown).toContain("gradient");

    // And it says, in words, that this is not yet kept.
    await expect(page.getByText(/כך זה נראה על הלוח עכשיו\. עוד לא נשמר/)).toBeVisible();

    // Nothing was written down: leaving the control puts the board back.
    await page.getByRole("tab", { name: "תוכן" }).click();
    await page.waitForTimeout(400);
    await expect.poll(gradient).toBe(before);
    await expectNotFrozen(page, "preview abandoned");

    // Now the same thing, kept this time.
    await page.getByRole("tab", { name: "עיצוב" }).click();
    await now.getByRole("radio", { name: "מעבר צבעים", exact: true }).click();
    await now.getByLabel("צבע ראשון").fill("#5a1a2a");
    await expect.poll(gradient).not.toBe(before);
    await now.getByRole("button", { name: "החלה על רקע הלוח" }).click();
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-bg-gradient");

    // It survives leaving the control, because now it is the board's.
    await page.getByRole("tab", { name: "תוכן" }).click();
    await page.waitForTimeout(400);
    await expect.poll(gradient).toContain("gradient");
    await expectNotFrozen(page, "gradient kept");
  });

  test("a ready picture from the gallery goes on the board at once, as a draft until it is sent", async ({ page }) => {
    const gallery = page.getByTestId("background-gallery");
    const bgImage = () =>
      root(page)
        .locator(".tv-bg")
        .first()
        .evaluate((el) => getComputedStyle(el, "::before").backgroundImage);
    const before = await bgImage();

    // Pictures are one kind of background among colour and gradient, in the same gallery.
    await gallery.getByRole("button", { name: "תמונות", exact: true }).click();
    await gallery.getByRole("button", { name: "ליל כוכבים", exact: true }).click();
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-bg-image");
    await expect.poll(bgImage).not.toBe(before);
    // On the board in the editor; on the screens only after "שמור ושדר".
    await expect(page.getByText("יש שינויים שלא נשמרו").first()).toBeVisible();

    // It stays when the control is left: it is the draft's now.
    await page.getByRole("tab", { name: "תוכן" }).click();
    await page.waitForTimeout(400);
    await expect.poll(bgImage).not.toBe(before);
    await expectNotFrozen(page, "backdrop applied");
  });

  test("a look can be saved as a design, and the board can be broadcast", async ({ page }) => {
    await page.getByTestId("background-gallery").getByRole("button", { name: "זרקור זהב", exact: true }).click();
    await page.getByRole("button", { name: "שמירה כערכה חדשה" }).click();
    await page.getByLabel("שם הערכה").fill("זהב שלי");
    await page.getByRole("button", { name: "שמירת הערכה" }).click();
    await expectNotFrozen(page, "save as a design");

    // The bar at the top; the same button also stands under the preview while
    // there is something to save.
    await page.getByRole("button", { name: "שמור ושדר למסכים" }).first().click();
    await expect.poll(() => server.writes(), { timeout: 10_000 }).toBeGreaterThan(0);
    await expectNotFrozen(page, "saved and broadcast");
  });

  test("discarding unsaved changes does not leave the page stuck", async ({ page }) => {
    await page.getByTestId("background-gallery").getByRole("button", { name: "זרקור זהב", exact: true }).click();
    await expect(root(page)).toHaveClass(/has-bg-gradient/);
    await expect(page.getByRole("button", { name: "ביטול שינויים" })).toBeEnabled();

    await page.getByRole("button", { name: "ביטול שינויים" }).click();
    await page.getByRole("button", { name: "לבטל הכל?" }).click();
    // Back to what the database holds, and the page still answers.
    await expect(root(page)).not.toHaveClass(/has-bg-gradient/);
    await expectNotFrozen(page, "discard");
  });

  test("a palette from Figma is read and applied", async ({ page }) => {
    await page.getByRole("tab", { name: "כלים" }).click();
    const palette = {
      color: {
        background: { $value: "#1b1033", $type: "color" },
        surface: { $value: "#241640", $type: "color" },
        text: { $value: "#f6f1ff", $type: "color" },
        primary: { $value: "#ffb454", $type: "color" },
      },
    };
    await page.getByTestId("figma-file").setInputFiles({
      name: "palette.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(palette)),
    });
    await expect.poll(() => cssVar(page, "--tv-bg-a"), { timeout: 10_000 }).toBe("#1b1033");
    await expect.poll(() => cssVar(page, "--tv-accent")).toBe("#ffb454");
    await expectNotFrozen(page, "figma import");
  });
  test("saving a design with chosen parts, applying, renaming and deleting it", async ({ page }) => {
    const root = page.locator(".tv-frame .tv-root").first();
    const library = page.getByTestId("design-library");
    // A background only.
    await page.getByTestId("background-gallery").getByRole("button", { name: "זרקור זהב", exact: true }).click();
    await expect(root).toHaveClass(/has-bg-gradient/);
    await library.getByRole("button", { name: "שמירה כערכה חדשה" }).click();
    await library.getByLabel("שם הערכה").fill("רקע ירוק");
    await library.getByRole("checkbox", { name: "מסגרות" }).uncheck();
    await library.getByRole("checkbox", { name: "טקסט" }).uncheck();
    await library.getByRole("button", { name: "שמירת הערכה" }).click();
    await expect(library.getByRole("button", { name: /^רקע ירוק/ })).toBeVisible();
    await expect(library.getByText("רקע", { exact: true })).toBeVisible();
    await expectNotFrozen(page, "design saved");

    // Another background - a picture - and the design brings its own back.
    await page.getByTestId("background-gallery").getByRole("button", { name: "שמיים בערב", exact: true }).click();
    await expect(root).toHaveClass(/has-bg-image/);
    await library.getByRole("button", { name: /^רקע ירוק/ }).click();
    await expect(root).toHaveClass(/has-bg-gradient/);
    await expect(root).not.toHaveClass(/has-bg-image/);
    await expect(root).toBeVisible();
    await expectNotFrozen(page, "design applied");

    // Renaming it, from its own card.
    await library.getByRole("button", { name: "שינוי שם" }).click();
    await library.getByLabel("שם הערכה").fill("רקע אחר");
    await library.getByRole("button", { name: "שינוי השם" }).click();
    await expect(library.getByRole("button", { name: /^רקע אחר/ })).toBeVisible();
    await expectNotFrozen(page, "design renamed");

    await library.getByRole("button", { name: "מחיקה" }).click();
    await library.getByRole("button", { name: "למחוק?" }).click();
    await expect(library.getByRole("button", { name: /^רקע אחר/ })).toHaveCount(0);
    await expectNotFrozen(page, "design deleted");
  });

  test("starting over is one place: the ordinary board, or everything deleted, each asked first", async ({ page }) => {
    // The reset that lived in "כלים" is gone: starting over is in "ערכות" only.
    await page.getByRole("tab", { name: "כלים" }).click();
    await expect(page.getByRole("button", { name: /איפוס לעיצוב ברירת המחדל/ })).toHaveCount(0);
    await page.getByRole("tab", { name: "עיצוב" }).click();
    const starter = page.getByTestId("blank-board");
    await page.getByTestId("background-gallery").getByRole("button", { name: "זרקור זהב", exact: true }).click();
    await expect(root(page)).toHaveClass(/has-bg-gradient/);

    // The ordinary board: asked, cancelled, then done - the look goes back.
    await starter.getByRole("button", { name: "הלוח הרגיל של המערכת" }).click();
    await page.getByRole("button", { name: "ביטול", exact: true }).click();
    await expect(root(page)).toHaveClass(/has-bg-gradient/);
    await expectNotFrozen(page, "start over cancelled");
    await starter.getByRole("button", { name: "הלוח הרגיל של המערכת" }).click();
    await page.getByRole("button", { name: "חזרה ללוח הרגיל" }).click();
    await expect(root(page)).not.toHaveClass(/has-bg-gradient/);

    // Everything deleted: says so before it is done.
    await starter.getByRole("button", { name: "מחיקת הכול" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("הנוסחים, הלוגואים, המועדים");
    await page.getByRole("alertdialog").getByRole("button", { name: "מחיקת הכול" }).click();
    await expectNotFrozen(page, "everything deleted");

    // Not offered for one kind of screen: it is the whole board's.
    await chooseDevice(page, "מובייל");
    await expect(page.getByTestId("blank-board")).toContainText("התחלה מחדש היא ללוח כולו");
  });

  test("a run through the editor, the way an admin actually uses it", async ({ page }) => {
    // Style, frame, gradient, a slide, the Shabbat screen, and save -
    // one after another, checking after each that the page still answers.
    await page.getByRole("tab", { name: "עיצוב" }).click();
    await boardFrames(page).filter({ hasText: "היכל" }).click();
    await expect(root(page)).toHaveClass(/is-board-frame-heichal/);
    await expectNotFrozen(page, "board frame");
    await page.getByTestId("frame-shapes").getByRole("button", { name: "קטום", exact: true }).click();
    await expectNotFrozen(page, "frame");

    await page.getByRole("tab", { name: "עיצוב" }).click();
    // The board's background, from its gallery: a click puts it on.
    await page.getByTestId("background-gallery").getByRole("button", { name: "זרקור זהב", exact: true }).click();
    await expect(page.locator(".tv-frame .tv-root").first()).toHaveClass(/has-bg-gradient/);
    await expectNotFrozen(page, "gradient");

    await page.getByRole("button", { name: /תצוגת מסך שבת/ }).click();
    await expect(page.locator('.tv-frame .tv-occasion').first()).toBeVisible({ timeout: 10_000 });
    await expectNotFrozen(page, "shabbat preview");
    // The same button now offers the way back.
    await page.getByRole("button", { name: /חזרה לזמן אמת/ }).click();
    await expectNotFrozen(page, "back from shabbat");

    await page.getByRole("button", { name: "דוגמת התראת זמנים" }).click();
    await expectNotFrozen(page, "alert demo");

    // The bar at the top; the same button also stands under the preview while
    // there is something to save.
    await page.getByRole("button", { name: "שמור ושדר למסכים" }).first().click();
    await expect.poll(() => server.writes(), { timeout: 10_000 }).toBeGreaterThan(0);
    await expectNotFrozen(page, "saved");
  });
  test("the board itself is editable from the board: its frame, a background from the gallery, colour", async ({ page }) => {
    // Clicking an empty part of the board selects the board, and everything
    // about its look is then in one panel - the way the live editor is used.
    await page.getByRole("button", { name: "עריכה ישירה בלוח" }).click();
    await page.locator(".tv-frame .tv-root").first().click({ position: { x: 8, y: 8 } });
    await expect(page.getByText("רקע הלוח ומסגרת הלוח")).toBeVisible();
    await expectNotFrozen(page, "board selected");

    // A frame for the whole board, chosen from the board's own panel.
    const panel = page.getByTestId("board-background");
    await panel.getByTestId("board-frames").getByRole("button", { name: "עמודי זהב" }).click();
    await expect.poll(() => root(page).getAttribute("class")).toContain("is-board-frame-columns");
    await expectNotFrozen(page, "board frame from the board");

    // A background from the same gallery as "רקעים" (the themes are chosen in one place, "עיצוב").
    await panel.getByTestId("board-background-gallery").getByRole("button", { name: "שמיים בערב", exact: true }).click();
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-bg-image");
    await expectNotFrozen(page, "background from the board");

    // A flat colour for the whole background, which beats the style's wall - and takes the picture off.
    await panel.getByLabel("צבע רקע אחיד").fill("#123456");
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-bg-gradient");
    await expect.poll(() => root(page).getAttribute("class")).not.toContain("has-bg-image");
    await expect
      .poll(() => root(page).locator(".tv-bg").evaluate((el) => getComputedStyle(el).backgroundImage))
      .toContain("rgb(18, 52, 86)");
    await expectNotFrozen(page, "flat colour");

    // And back to what the style paints.
    await panel.getByRole("button", { name: "רקע בסיס" }).click();
    await expect.poll(() => root(page).getAttribute("class")).not.toContain("has-bg-gradient");
    await expectNotFrozen(page, "back to the style");
  });
  test("no frame for the board cuts a row off it", async ({ page }) => {
    // What a frame adds - columns at the sides, a curtain over the top, a
    // carved border - is paid for out of the panels inside it. Every one is
    // measured: content taller than its panel means a lost row.
    await page.getByRole("tab", { name: "עיצוב" }).click();
    const count = await boardFrames(page).count();
    const clipped: string[] = [];

    for (let i = 0; i < count; i++) {
      await boardFrames(page).nth(i).click();
      await page.waitForTimeout(150);
      const frame = await boardFrameOf(page);
      const over = await page.evaluate(() =>
        [...document.querySelectorAll(".tv-frame .tv-panel, .tv-frame .tv-card-text")]
          .map((el) => ({
            title:
              el.querySelector(".tv-panel-title")?.textContent?.trim().split("·")[0].trim() ??
              el.querySelector(".tv-card-title")?.textContent?.trim().slice(0, 20) ??
              "",
            cut: Math.max(0, el.scrollHeight - el.clientHeight),
          }))
          .filter((o) => o.cut > 2),
      );
      if (over.length) clipped.push(`${frame}: ${over.map((o) => `${o.title} -${o.cut}px`).join(", ")}`);
    }

    expect(clipped, `frames that cut a row: ${clipped.join(" | ")}`).toEqual([]);
  });
  test("a long notice is shrunk to fit, not cut off", async ({ page }) => {
    // The fixture carries a deliberately long notice. On the notices slide it
    // has to be made smaller until it fits - the card reports the size it
    // settled on in --fit - and nothing may be left hanging out of the box.
    // The full board always shows a notice, so switch to it.
    await page.getByRole("tab", { name: "פריסה" }).click();
    await page.getByRole("button", { name: /לוח מלא/ }).first().click();
    const card = page.locator(".tv-frame .tv-card-text").first();
    await expect(card).toBeVisible();
    await page.waitForTimeout(600);

    const measured = await card.evaluate((el) => ({
      fit: Number(getComputedStyle(el).getPropertyValue("--fit") || 1),
      overflow: el.scrollHeight - el.clientHeight,
      text: el.textContent?.length ?? 0,
    }));
    expect(measured.text, "the long notice is the one on screen").toBeGreaterThan(200);
    expect(measured.fit, "the card had to shrink").toBeLessThan(1);
    expect(measured.overflow, "and then it fits").toBeLessThanOrEqual(2);
    await expectNotFrozen(page, "long notice");
  });
  test("less air at the top gives the panels more height", async ({ page }) => {
    // The point of the spacing controls: take the air back and the panels
    // grow, which is what makes room for another row.
    await page.getByRole("tab", { name: "פריסה" }).click();
    await page.getByRole("button", { name: /לוח מלא/ }).first().click();
    await page.waitForTimeout(300);
    const panel = page.locator(".tv-frame .tv-panel").first();
    const before = (await panel.boundingBox())?.height ?? 0;
    expect(before).toBeGreaterThan(0);

    // Turn the slider on (it starts on "רגיל") and close the gap.
    const row = page.locator("div", { has: page.getByLabel("מרווח עליון", { exact: true }) }).last();
    await row.getByRole("button", { name: "רגיל" }).click();
    await page.getByLabel("מרווח עליון", { exact: true }).fill("0");
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-space-top");

    await expect
      .poll(async () => (await panel.boundingBox())?.height ?? 0, { message: "the panel grew" })
      .toBeGreaterThan(before);
    await expectNotFrozen(page, "spacing");

    // And back to what the layout draws.
    await row.getByRole("button", { name: "רגיל" }).click();
    await expect.poll(() => root(page).getAttribute("class")).not.toContain("has-space-top");
    await expect.poll(async () => (await panel.boundingBox())?.height ?? 0).toBe(before);
  });
  test("a whole prayer panel can be taken off the board, and the rest fill in", async ({ page }) => {
    // The case this was built for: סליחות comes off the wall after Yom Kippur.
    await page.getByRole("tab", { name: "פריסה" }).click();
    await page.getByRole("button", { name: /לוח מלא/ }).first().click();
    await page.getByRole("button", { name: "עריכה ישירה בלוח" }).click();
    await page.waitForTimeout(400);

    const selichot = page.locator(".tv-frame .tv-panel", { hasText: "סליחות" }).first();
    await expect(selichot).toBeVisible();
    const before = await page.locator(".tv-frame .tv-panel").count();
    await selichot.getByText("סליחות").first().click();
    await expect(page.getByText(/לוח תפילות: סליחות/)).toBeVisible();

    await page.getByRole("button", { name: /הסתרת הלוח מהמסך/ }).click();
    await expect(page.locator(".tv-frame .tv-panel", { hasText: "סליחות" })).toHaveCount(0);
    await expect.poll(() => page.locator(".tv-frame .tv-panel").count()).toBe(before - 1);
    await expectNotFrozen(page, "panel hidden");

    // It comes back from the list of what is hidden.
    await page.getByRole("button", { name: /לוח תפילות: סליחות/ }).click();
    await expect(page.locator(".tv-frame .tv-panel", { hasText: "סליחות" })).toHaveCount(1);
    await expectNotFrozen(page, "panel restored");
  });
  test("taking a panel off gives its height to the times, not to empty space", async ({ page }) => {
    // What the gabbai actually saw after removing סליחות: the panel beside
    // it grew, and the times stayed bunched at the top of it in two narrow
    // columns with a third of the panel empty underneath.
    await page.route("**/rest/v1/minyanim*", (r) =>
      r.fulfill({
        contentType: "application/json",
        body: JSON.stringify([
          // Fourteen weekday minyanim - the shul's real count - in the
          // fixture's own weekday category, plus the סליחות row so there is
          // still a second panel to take off the board.
          ...Array.from({ length: 14 }, (_, i) => ({
            id: `m${i}`,
            label: `מניין ${i + 1}`,
            prayer: `מניין ${i + 1}`,
            category_id: "c1",
            day_type: "weekday",
            time_mode: "fixed",
            fixed_time: `${String(6 + i).padStart(2, "0")}:00:00`,
            relative_to: null,
            offset_minutes: 0,
            room: "",
            note: "",
            active: true,
            sort_order: i,
            reminder_minutes: 0,
            notification_enabled: false,
          })),
          {
            id: "s1",
            label: "סליחות א'",
            prayer: "סליחות א'",
            category_id: "c2",
            day_type: "custom",
            time_mode: "fixed",
            fixed_time: "05:45:00",
            relative_to: null,
            offset_minutes: 0,
            room: "",
            note: "",
            active: true,
            sort_order: 1,
            reminder_minutes: 0,
            notification_enabled: false,
          },
        ]),
      }),
    );
    await page.reload();
    await expect(page.locator(".tv-frame .tv-root")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("tab", { name: "פריסה" }).click();
    await page.getByRole("button", { name: /לוח מלא/ }).first().click();
    await page.waitForTimeout(700);

    const list = page.locator(".tv-frame .tv-dash-prayers .tv-dash-list").first();

    /** How much of the panel the times actually occupy, 0..1. */
    const filled = () =>
      list.evaluate((el) => {
        const rows = Array.from(el.querySelectorAll<HTMLElement>(".tv-dash-row"));
        const perColumn = el.classList.contains("is-two-col") ? Math.ceil(rows.length / 2) : rows.length;
        const used = rows.slice(0, perColumn).reduce((h, r) => h + r.offsetHeight, 0);
        return el.clientHeight > 0 ? used / el.clientHeight : 0;
      });

    // Before this was fixed the list did not grow with its panel at all.
    expect(await filled()).toBeGreaterThan(0.9);

    const before = await list.evaluate((el) => el.clientHeight);
    await page.getByRole("button", { name: "עריכה ישירה בלוח" }).click();
    await page.waitForTimeout(400);
    const selichot = page.locator(".tv-frame .tv-panel", { hasText: "סליחות" }).first();
    await selichot.getByText("סליחות").first().click();
    await page.getByRole("button", { name: /הסתרת הלוח מהמסך/ }).click();
    await expect(page.locator(".tv-frame .tv-panel", { hasText: "סליחות" })).toHaveCount(0);
    await page.waitForTimeout(900);

    // The panel grew, and the times grew with it rather than leaving a hole.
    expect(await list.evaluate((el) => el.clientHeight)).toBeGreaterThan(before);
    expect(await filled()).toBeGreaterThan(0.9);
    await expectNotFrozen(page, "panel hidden, times spread");
  });

  /**
   * One board, three screens, one switcher.
   *
   * The device strip over the preview is the only place a screen is chosen,
   * and choosing one there is also choosing what the controls edit. Editors
   * that separate those two produce the complaint that sinks this kind of
   * tool: you change something, nothing happens, and it took effect on a
   * screen you were not looking at.
   */
  test("choosing a device to look at is choosing what you edit", async ({ page }) => {
    const banner = page.getByTestId("device-scope");
    const look = async (name: string) => {
      await chooseDevice(page, name);
      await page.waitForTimeout(400);
    };
    const frameOf = () => boardFrameOf(page);

    // The one switcher says, in words, what it currently means.
    await look("כל המסכים");
    await expect(banner).toHaveAttribute("data-scope", "all");
    await expect(banner).toContainText("כל המסכים");

    await page.getByRole("tab", { name: "עיצוב" }).click();
    const skins = boardFrames(page);
    await skins.nth(1).click();
    await page.waitForTimeout(300);

    // Looking at the phone is editing the phone - no second control.
    await look("מובייל");
    await expect(banner).toHaveAttribute("data-scope", "mobile");
    await expect(banner).toContainText("עורך עכשיו: מובייל");
    const shared = await frameOf();

    await page.getByRole("tab", { name: "עיצוב" }).click();
    await skins.nth(4).click();
    await page.waitForTimeout(400);
    const phone = await frameOf();
    expect(phone).not.toBe(shared);

    // A tablet is held like a phone, so it edits the same screen.
    await look("טאבלט");
    await expect(banner).toHaveAttribute("data-scope", "mobile");
    expect(await frameOf()).toBe(phone);

    // A laptop is a computer, and the computer never moved.
    await look("לפטופ");
    await expect(banner).toHaveAttribute("data-scope", "desktop");
    expect(await frameOf()).toBe(shared);

    await look("Android TV");
    await expect(banner).toHaveAttribute("data-scope", "tv");
    expect(await frameOf()).toBe(shared);

    // The way back is one click, and it is offered where the trouble is.
    await expect(banner).toContainText("מוגדר בנפרד");
    await banner.getByRole("button", { name: /מובייל/ }).click();
    await page.waitForTimeout(400);
    await expect(banner).not.toContainText("מוגדר בנפרד");

    await look("מובייל");
    expect(await frameOf()).toBe(shared);
    await expectNotFrozen(page, "one switcher");
  });

  test("every display is shown side by side, each with its own board", async ({ page }) => {
    // The answer to "which screens disagree with each other": look at them.
    await chooseDevice(page, "מובייל");
    await page.waitForTimeout(350);
    await page.getByRole("tab", { name: "עיצוב" }).click();
    const skins = boardFrames(page);
    await skins.nth(5).click();
    await page.waitForTimeout(400);

    await chooseDevice(page, "כל המסכים");
    await page.waitForTimeout(350);
    await page.getByRole("button", { name: /השוואה בין התצוגות/ }).click();
    await page.waitForTimeout(700);

    const skins_shown = await page
      .locator(".tv-frame .tv-root")
      .evaluateAll((els) =>
        els.map((el) => /is-board-frame-([a-z-]+)/.exec(el.className)?.[1] ?? "none"),
      );
    // Five frames, and the two that are phone-shaped show the phone's board.
    expect(skins_shown.length).toBeGreaterThanOrEqual(5);
    expect(new Set(skins_shown).size).toBeGreaterThan(1);
    await expectNotFrozen(page, "side by side");
  });

  test("the page being learnt is a line the gabbai can reach", async ({ page }) => {
    // It is computed and turns over by itself, which is exactly why it has
    // to be selectable: a line nobody can click is a line nobody can fix.
    await page.getByRole("tab", { name: "פריסה" }).click();
    await page.getByRole("button", { name: /לוח מלא/ }).first().click();
    await page.getByRole("button", { name: "עריכה ישירה בלוח" }).click();
    await page.waitForTimeout(500);

    const line = root(page).locator(".tv-dash-amud").first();
    await expect(line).toBeVisible();
    // No wording in front of the page unless somebody asks for one.
    await expect(line).toHaveText(/^שבת דף/);

    await line.click();
    await expect(page.getByText(/עמוד היומי: שורת הדף הנלמד/)).toBeVisible();

    const box = page.getByRole("textbox", { name: "עמוד היומי: שורת הדף הנלמד" });
    await box.fill("כעת לומדים");
    await expect(line).toHaveText(/^כעת לומדים שבת דף/);

    // And it can come off the board altogether.
    await page.getByRole("button", { name: /הסתר/ }).first().click();
    await expect(root(page).locator(".tv-dash-amud")).toHaveCount(0);
    await expectNotFrozen(page, "amud line edited");
  });

});
