import { expect, test } from "@playwright/test";
import { BOARD_SKINS } from "../src/tv/config";
import { TV_THEMES } from "../src/tv/themes";
import { expectNotFrozen, serveEditor, type EditorServer } from "./support/tvEditor";

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

  /** The board's own root, which carries the theme variables and the skin. */
  const root = (page: import("@playwright/test").Page) => page.locator(".tv-frame .tv-root").first();

  const cssVar = (page: import("@playwright/test").Page, name: string) =>
    root(page).evaluate((el, v) => getComputedStyle(el).getPropertyValue(v).trim(), name);

  test("every theme applies to the board, one after another", async ({ page }) => {
    const seen: string[] = [];
    for (const theme of TV_THEMES) {
      await page.getByRole("button", { name: new RegExp(`^${theme.name} `) }).click();
      // The board carries the theme's own background colour.
      await expect
        .poll(() => cssVar(page, "--tv-bg-a"), { message: `theme ${theme.name}` })
        .toBe(theme.vars["--tv-bg-a"]);
      seen.push(theme.name);
      await expectNotFrozen(page, `theme ${theme.name}`);
    }
    expect(seen).toEqual(TV_THEMES.map((t) => t.name));
  });

  test("every style in the picker applies, and they are all the board's own", async ({ page }) => {
    await page.getByRole("tab", { name: "פריסה" }).click();
    const skins = page.locator("button", { has: page.locator("span.aspect-\\[16\\/10\\]") });
    const count = await skins.count();
    expect(count).toBe(BOARD_SKINS.length);

    const applied: string[] = [];
    for (let i = 0; i < count; i++) {
      await skins.nth(i).click();
      const className = await root(page).getAttribute("class");
      const match = /is-skin-([a-z]+)/.exec(className ?? "");
      expect(match, `style #${i + 1} set no skin`).toBeTruthy();
      applied.push(match![1]);
      await expectNotFrozen(page, `style ${match![1]}`);
    }
    expect([...applied].sort()).toEqual([...BOARD_SKINS].sort());
  });

  test("every frame shape applies, and the roundness sliders work", async ({ page }) => {
    await page.getByRole("tab", { name: "פריסה" }).click();
    const shapes = ["לפי הסגנון", "מעוגל", "רך", "קטום", "מגורע", "מדורג"];
    const frames = page.getByTestId("frame-shapes");
    for (const shape of shapes) {
      await frames.getByRole("button", { name: shape, exact: true }).click();
      const className = (await root(page).getAttribute("class")) ?? "";
      if (shape === "לפי הסגנון") expect(className).not.toContain("has-frame-shape");
      else expect(className).toContain("has-frame-shape");
      await expectNotFrozen(page, `frame ${shape}`);
    }

    // The roundness of the top, set by hand, reaches the board.
    // The two sliders start on "לפי הסגנון"; the button beside one turns it on.
    const topRow = page.locator("div", { has: page.getByLabel("עיגול למעלה", { exact: true }) }).last();
    await topRow.getByRole("button", { name: "לפי הסגנון" }).click();
    await page.getByLabel("עיגול למעלה", { exact: true }).fill("8");
    await expect.poll(() => cssVar(page, "--frame-top")).not.toBe("");
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-frame-radius");
    await expectNotFrozen(page, "frame radius");
  });

  test("a gradient reaches the board and can be kept in the library", async ({ page }) => {
    await page.getByRole("button", { name: "בורדו מלכותי" }).click();
    await page.getByRole("button", { name: "החלה על רקע הלוח" }).click();
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-bg-gradient");
    await expect.poll(() => cssVar(page, "--tv-bg-gradient")).toContain("gradient");
    await expectNotFrozen(page, "gradient applied");

    await page.getByPlaceholder("שם לשמירה בספרייה").fill("בדיקה");
    await page.getByRole("button", { name: "שמירה בספרייה" }).click();
    await expect(page.getByRole("button", { name: "בדיקה" }).first()).toBeVisible();
    await expectNotFrozen(page, "gradient saved");
  });

  test("a theme can be saved as a new one, and the board can be broadcast", async ({ page }) => {
    await page.getByRole("button", { name: /^זהב מלכותי/ }).click();
    await page.getByRole("button", { name: "שמירה כערכה חדשה" }).click();
    await expectNotFrozen(page, "save as new theme");

    await page.getByRole("button", { name: "שמור ושדר למסכים" }).click();
    await expect.poll(() => server.writes(), { timeout: 10_000 }).toBeGreaterThan(0);
    await expectNotFrozen(page, "saved and broadcast");
  });

  test("discarding unsaved changes does not leave the page stuck", async ({ page }) => {
    await page.getByRole("button", { name: /^ירוק שבת/ }).click();
    await expect(page.getByRole("button", { name: "ביטול שינויים" })).toBeEnabled();

    await page.getByRole("button", { name: "ביטול שינויים" }).click();
    await page.getByRole("button", { name: "לבטל הכל?" }).click();
    // Back to what the database holds, and the page still answers.
    await expect.poll(() => cssVar(page, "--tv-bg-a")).toBe(TV_THEMES[0].vars["--tv-bg-a"]);
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
  test("saving, renaming and deleting a theme all leave the page working", async ({ page }) => {
    // Save the current look as a theme of its own.
    await page.getByRole("button", { name: "שמירה כערכה חדשה" }).click();
    await page.getByPlaceholder(/שם לערכה החדשה/).fill("ערכת בדיקה");
    await page.getByRole("button", { name: "שמירת הערכה" }).click();
    await expect(page.getByRole("button", { name: /^ערכת בדיקה/ })).toBeVisible();
    await expectNotFrozen(page, "theme saved");

    // Renaming it, from the same row.
    await page.getByRole("button", { name: "שינוי שם" }).first().click();
    await page.getByPlaceholder("שם חדש").fill("ערכה אחרת");
    await page.getByRole("button", { name: "שינוי השם" }).click();
    await expect(page.getByRole("button", { name: /^ערכה אחרת/ })).toBeVisible();
    await expectNotFrozen(page, "theme renamed");

    const mine = page.getByRole("button", { name: "מחיקה" });
    if (await mine.count()) {
      await mine.first().click();
      await expectNotFrozen(page, "delete asked");
      await page.getByRole("button", { name: /^למחוק?/ }).first().click();
      await expectNotFrozen(page, "theme deleted");
    }
  });

  test("the reset dialog opens, cancels and confirms without sticking", async ({ page }) => {
    await page.getByRole("tab", { name: "כלים" }).click();
    const open = page.getByRole("button", { name: /איפוס לעיצוב ברירת המחדל/ });

    await open.click();
    await page.getByRole("button", { name: "ביטול" }).first().click();
    await expectNotFrozen(page, "reset cancelled");

    await open.click();
    await page.getByRole("button", { name: "אפס", exact: true }).click();
    await expectNotFrozen(page, "reset confirmed");
  });

  test("a run through the editor, the way an admin actually uses it", async ({ page }) => {
    // Theme, style, frame, gradient, a slide, the Shabbat screen, and save -
    // one after another, checking after each that the page still answers.
    await page.getByRole("button", { name: /^אבן ירושלים / }).click();
    await expectNotFrozen(page, "theme");

    await page.getByRole("tab", { name: "פריסה" }).click();
    await page.getByTestId("skin-picker").getByRole("button").nth(12).click();
    await expectNotFrozen(page, "style");
    await page.getByTestId("frame-shapes").getByRole("button", { name: "קטום" }).click();
    await expectNotFrozen(page, "frame");

    await page.getByRole("tab", { name: "עיצוב" }).click();
    await page.getByRole("button", { name: "זרקור זהב" }).click();
    await page.getByRole("button", { name: "החלה על רקע הלוח" }).click();
    await expectNotFrozen(page, "gradient");

    await page.getByRole("button", { name: /תצוגת מסך שבת/ }).click();
    await expectNotFrozen(page, "shabbat preview");
    // The same button now offers the way back.
    await page.getByRole("button", { name: /חזרה לזמן אמת/ }).click();
    await expectNotFrozen(page, "back from shabbat");

    await page.getByRole("button", { name: "דוגמת התראת זמנים" }).click();
    await expectNotFrozen(page, "alert demo");

    await page.getByRole("button", { name: "שמור ושדר למסכים" }).click();
    await expect.poll(() => server.writes(), { timeout: 10_000 }).toBeGreaterThan(0);
    await expectNotFrozen(page, "saved");
  });
  test("the board itself is editable from the board: style, frame, theme, colour", async ({ page }) => {
    // Clicking an empty part of the board selects the board, and everything
    // about its look is then in one panel - the way the live editor is used.
    await page.getByRole("button", { name: "עריכה ישירה בלוח" }).click();
    await page.locator(".tv-frame .tv-root").first().click({ position: { x: 8, y: 8 } });
    await expect(page.getByText("רקע הלוח, סגנון ומסגרות")).toBeVisible();
    await expectNotFrozen(page, "board selected");

    // A style, chosen from the board's own panel.
    const panel = page.getByTestId("board-background");
    await panel.getByRole("button", { name: "אבני ירושלים" }).first().click();
    await expect.poll(() => root(page).getAttribute("class")).toContain("is-skin-stone");
    await expectNotFrozen(page, "style from the board");

    // A theme, from the same panel - imported ones are listed here too.
    await panel.getByRole("button", { name: "ירוק שבת", exact: true }).click();
    await expect.poll(() => cssVar(page, "--tv-bg-a")).toBe(TV_THEMES[2].vars["--tv-bg-a"]);
    await expectNotFrozen(page, "theme from the board");

    // A flat colour for the whole background, which beats the style's wall.
    await panel.getByLabel("צבע רקע אחיד").fill("#123456");
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-bg-gradient");
    await expect
      .poll(() => root(page).locator(".tv-bg").evaluate((el) => getComputedStyle(el).backgroundImage))
      .toContain("rgb(18, 52, 86)");
    await expectNotFrozen(page, "flat colour");

    // And back to what the style paints.
    await panel.getByRole("button", { name: "לפי הערכה" }).click();
    await expect.poll(() => root(page).getAttribute("class")).not.toContain("has-bg-gradient");
    await expectNotFrozen(page, "back to the style");
  });
  test("no style cuts a row off the board", async ({ page }) => {
    // The chrome a style adds - a carved border, a crown, a curtain over the
    // top - is paid for out of the panels below it. Four styles were caught
    // cutting the last line of the day-times panel this way, so every style
    // is now measured: content taller than its panel means a lost row.
    await page.getByRole("tab", { name: "פריסה" }).click();
    const skins = page.getByTestId("skin-picker").getByRole("button");
    const count = await skins.count();
    const clipped: string[] = [];

    for (let i = 0; i < count; i++) {
      await skins.nth(i).click();
      await page.waitForTimeout(150);
      const skin = /is-skin-([a-z]+)/.exec((await root(page).getAttribute("class")) ?? "")?.[1] ?? `#${i}`;
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
      if (over.length) clipped.push(`${skin}: ${over.map((o) => `${o.title} -${o.cut}px`).join(", ")}`);
    }

    expect(clipped, `styles that cut a row: ${clipped.join(" | ")}`).toEqual([]);
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

    // Turn the slider on (it starts on "לפי הסגנון") and close the gap.
    const row = page.locator("div", { has: page.getByLabel("מרווח עליון", { exact: true }) }).last();
    await row.getByRole("button", { name: "לפי הסגנון" }).click();
    await page.getByLabel("מרווח עליון", { exact: true }).fill("0");
    await expect.poll(() => root(page).getAttribute("class")).toContain("has-space-top");

    await expect
      .poll(async () => (await panel.boundingBox())?.height ?? 0, { message: "the panel grew" })
      .toBeGreaterThan(before);
    await expectNotFrozen(page, "spacing");

    // And back to what the layout draws.
    await row.getByRole("button", { name: "לפי הסגנון" }).click();
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
  test("an edit can be kept to a copy of the theme, leaving the others alone", async ({ page }) => {
    // The third answer to "which themes does this apply to": neither all of
    // them nor the one in use, but a copy made for the purpose.
    await page.getByRole("button", { name: "עריכה ישירה בלוח" }).click();
    await page.locator(".tv-frame .tv-panel-title").first().click();
    await expect(page.getByText("בערכות נושא:")).toBeVisible();

    const themesBefore = await page.getByRole("button", { name: /^לילה כחול / }).count();
    await page.getByRole("button", { name: /שכפול לערכה חדשה/ }).click();
    await expectNotFrozen(page, "theme duplicated");

    // A new theme exists, the board is on it, and the edit is scoped to it.
    await expect(page.getByTestId("style-scope")).toContainText("(עותק)");
    await page.getByRole("tab", { name: "עיצוב" }).click();
    await expect(
      page.getByRole("button", { name: "לילה כחול (עותק)", exact: false }).first(),
    ).toBeVisible();
    expect(themesBefore).toBe(1);
  });
});
