import { expect, test } from "@playwright/test";
import { expectNotFrozen, serveEditor } from "./support/tvEditor";

/**
 * Occasions, from the gabbai's side: one list for Shabbat, the festivals and
 * the shul's own days; a dialog for each; the preview jumping to its day.
 */
const HARNESS = "/e2e/harness/editor.html";

test.describe("TV editor, the screen builder and the preview", () => {
  test("choosing a screen in the builder shows it in the preview, and is not an edit", async ({ page }) => {
    await serveEditor(page, {
      screenLayout: "rotate",
      screens: [
        { id: "a", name: "הלוח", seconds: 20, blocks: [{ block: "header" }, { block: "prayers" }] },
        { id: "b", name: "מסך ב", seconds: 20, blocks: [{ block: "header" }, { block: "learning" }] },
      ],
    });
    const res = await page.goto(HARNESS).catch(() => null);
    test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
    await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("tab", { name: "פריסה" }).click();
    const chips = page.getByRole("tablist", { name: "שקופיות" });
    await expect(chips.getByRole("tab", { selected: true })).toContainText("הלוח");

    await page.getByTestId("screen-composer").getByRole("button", { name: /מסך ב/ }).first().click();
    await expect(chips.getByRole("tab", { selected: true })).toContainText("מסך ב");
    // Looking is not changing: nothing waits to be saved.
    await expect(page.getByText("יש שינויים שלא נשמרו")).toHaveCount(0);
    await expectNotFrozen(page, "screen chosen");
  });
});

test.describe("TV editor, occasions", () => {
  test.beforeEach(async ({ page }) => {
    await serveEditor(page);
    const res = await page.goto(HARNESS).catch(() => null);
    test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
    await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("tab", { name: "מועדים" }).click();
  });

  const list = (page: import("@playwright/test").Page) => page.getByTestId("occasions");
  const row = (page: import("@playwright/test").Page, id: string) => list(page).locator(`li[data-occasion="${id}"]`);

  test("one list: Shabbat and the calendar's days, in order of importance", async ({ page }) => {
    await expect(row(page, "shabbat")).toBeVisible();
    await expect(row(page, "cal:sukkot")).toBeVisible();
    await expect(row(page, "shabbat")).toContainText("כל שבת");
    // Moving Shabbat up puts it above the day that was over it.
    const before = await list(page).locator("li").evaluateAll((els) => els.map((e) => e.getAttribute("data-occasion")));
    const i = before.indexOf("shabbat");
    await row(page, "shabbat").getByRole("button", { name: "שבת למעלה" }).click();
    const after = await list(page).locator("li").evaluateAll((els) => els.map((e) => e.getAttribute("data-occasion")));
    expect(after.indexOf("shabbat")).toBe(i - 1);
    await expectNotFrozen(page, "reordered");
  });

  test("a dialog for each: what shows on its screen, and the preview on its day", async ({ page }) => {
    await row(page, "shabbat").getByRole("button", { name: "הגדרות" }).click();
    const dialog = page.getByTestId("occasion-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("הכותרת על המסך").fill("שבת קודש לכולם");
    await dialog.getByRole("checkbox", { name: "כל זמני היום" }).check();
    await dialog.getByRole("button", { name: "סגירה" }).click();
    // An ordinary Shabbat (the next one, 3.10, is also Shmini Atzeret, which leads it).
    await list(page).getByLabel("תצוגה לתאריך").fill("2026-10-10");
    const card = page.locator('.tv-frame .tv-occasion[data-occasion="shabbat"]');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.locator(".tv-event-title")).toHaveText("שבת קודש לכולם");
    await expect(card.getByText("עלות השחר")).toBeVisible();
    await expectNotFrozen(page, "shabbat previewed");
  });

  test("👁 shows the day on its own screen, in sight; 🎨 edits its own design; its times on its line", async ({ page }) => {
    const yk = row(page, "cal:yom_kippur");
    // The old "מועדים ואירועים" tab is this list now: each day's timetable is on its line.
    await expect(yk.getByTestId("timetable-create-yom_kippur")).toBeVisible();

    // The eye was far below the preview and showed the board's first screen:
    // it seemed to do nothing (אהל אברהם, 3.10.2026).
    await yk.getByRole("button", { name: "תצוגה בתאריך הקרוב" }).click();
    await expect(page.locator(".tv-frame .tv-event-title").first()).toContainText("יום כיפור", { timeout: 10_000 });
    await expect(page.locator("[data-board-preview]")).toBeInViewport();

    await yk.getByTestId("occasion-design").click();
    const banner = page.getByTestId("occasion-design-banner");
    await expect(banner).toContainText("יום כיפור");
    await expect(page.getByRole("tab", { name: "עיצוב", exact: true })).toHaveAttribute("data-state", "active");
    await banner.getByRole("button", { name: "חזרה לעיצוב הלוח" }).click();
    await expect(banner).toHaveCount(0);
    await expectNotFrozen(page, "occasion design");
  });

  test("a ready ראש חודש kit picked in its settings is its screen; each of its screens can be hidden", async ({ page }) => {
    // Picked, and nothing changed: the kit's id was dropped on saving, and the
    // card covered the board anyway (אושר של יהודי, 11.10.2026).
    await row(page, "cal:rosh_chodesh").getByRole("button", { name: "הגדרות" }).click();
    const dialog = page.getByTestId("occasion-dialog");
    await dialog.getByLabel("עיצוב המועד").selectOption({ label: "לבנה בשמי לילה · ראש חודש" });
    await expect(dialog.getByLabel("עיצוב המועד")).toHaveValue("d_premium_rc_night-moon");
    await dialog.getByRole("button", { name: "סגירה" }).click();
    await expect(row(page, "cal:rosh_chodesh")).toContainText("עם עיצוב");
    await list(page).getByLabel("תצוגה לתאריך").fill("2026-10-11");
    const chips = page.getByRole("tablist", { name: "שקופיות" });
    await chips.getByRole("tab", { name: /ראש חודש/ }).first().click();
    const frame = page.locator(".tv-frame").first();
    await expect(frame.locator('img[src*="rosh-chodesh-night-moon"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(frame.locator(".tv-occasion")).toHaveCount(0);
    await expect(frame).toContainText("ראש חודש חשון");

    // Its own screen hidden: no ראש חודש screen among the slides that day.
    await row(page, "cal:rosh_chodesh").getByRole("button", { name: "הגדרות" }).click();
    await dialog.getByRole("switch", { name: "מסך המועד מוצג" }).click();
    await dialog.getByRole("button", { name: "סגירה" }).click();
    await expect(chips.getByRole("tab", { name: /ראש חודש/ })).toHaveCount(0);
    await expectNotFrozen(page, "rosh chodesh kit");
  });

  test("🎨 on an occasion with no kit and with one: add a kit, swap it, change its parts, copy one of one's own", async ({ page }) => {
    const rc = row(page, "cal:rosh_chodesh");
    const preview = page.locator("[data-board-preview] .tv-frame").first();
    const library = page.getByTestId("builtin-designs");
    // The kit's own button (beside it: ✕ to hide it, and "שכפול לעריכה").
    const kit = (id: string) => library.locator(`[data-design-id="d_premium_rc_${id}"] button[title^="ממלא"]`);

    // No kit yet: its screen is the card.
    await rc.getByTestId("occasion-design").click();
    await expect(page.getByTestId("occasion-design-banner")).toContainText("ראש חודש");
    await expect(preview.locator(".tv-occasion")).toBeVisible({ timeout: 10_000 });

    // A kit added from the ready ones: the kit is its screen.
    await kit("night-moon").click();
    await expect(preview.locator('img[src*="rosh-chodesh-night-moon"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(preview.locator(".tv-occasion")).toHaveCount(0);

    // Swapped for another.
    await kit("teal-dawn").click();
    await expect(preview.locator('img[src*="rosh-chodesh-teal-dawn"]').first()).toBeVisible();
    await expect(preview.locator('img[src*="rosh-chodesh-night-moon"]')).toHaveCount(0);

    // One of its parts changed: the parasha line hidden, in the occasion's design only.
    await page.getByRole("button", { name: "הסתרת פרשת השבוע" }).first().click();
    await expect(page.getByRole("button", { name: "הצגת פרשת השבוע" }).first()).toBeVisible();

    // A ready kit copied, inside the occasion, to edit as one's own.
    const copy = library.locator('[data-design-id="d_premium_rc_onyx-gold"]').getByRole("button", { name: "שכפול לעריכה" });
    await copy.click();
    await expect(page.getByTestId("design-library")).toContainText("(שלי)");

    // Back to the board: the board itself never wore any of it.
    await page.getByTestId("occasion-design-banner").getByRole("button", { name: "חזרה לעיצוב הלוח" }).click();
    await page.getByRole("tab", { name: "מועדים" }).click();
    await expect(rc).toContainText("עם עיצוב");

    // An occasion that has a kit: 🎨 again, and another kit put on it.
    await rc.getByTestId("occasion-design").click();
    await expect(preview.locator('img[src*="rosh-chodesh-teal-dawn"]').first()).toBeVisible({ timeout: 10_000 });
    await kit("silver-phases").click();
    await expect(preview.locator('img[src*="rosh-chodesh-silver-phases"]').first()).toBeVisible();
    await expectNotFrozen(page, "occasion kits");
  });

  test("a day of the shul's own: a Hebrew date, a line of text, and it is on", async ({ page }) => {
    await page.getByRole("button", { name: "הוספת מועד משלכם" }).click();
    const dialog = page.getByTestId("occasion-dialog");
    await dialog.getByLabel("שם המועד ברשימה").fill("הילולת הרב");
    await dialog.getByLabel("יום בחודש").selectOption("15");
    await dialog.getByLabel("חודש", { exact: true }).selectOption("11");
    await dialog.getByRole("button", { name: "טקסט" }).click();
    await dialog.getByLabel("הטקסט").fill("סעודת הילולא אחרי ערבית");
    // The preview is behind the dialog: asking for it closes the dialog, to show it.
    await dialog.getByRole("button", { name: "תצוגה בתאריך הקרוב" }).click();
    await expect(dialog).toBeHidden();
    await expect(list(page)).toContainText("הילולת הרב");
    await expect(list(page)).toContainText("כל שנה, 15 בשבט");
    // Tu BiShvat is a day of its own in the list too; with both on, one screen
    // names them together (the calendar's day is higher in the list).
    await expect(page.locator(".tv-frame").getByText("סעודת הילולא אחרי ערבית")).toBeVisible({ timeout: 10_000 });
    await expectNotFrozen(page, "own day");
  });
});

test.describe("TV editor, an occasion's pictures", () => {
  test("an uploaded picture taken off the screen stays in the gallery; ✕ removes it", async ({ page }) => {
    // One click on an uploaded picture took it off the screen and out of the
    // gallery with it - gone, with no way back (אהל אברהם, 3.10.2026).
    const photo = "https://example.com/hillula.jpg";
    await serveEditor(page, {
      occasions: [
        {
          id: "o_hillula1",
          name: "הילולא",
          title: null,
          enabled: true,
          when: { type: "hebrew", month: 11, day: 15 },
          window: "day",
          display: "turns",
          banner: false,
          overlap: "together",
          seconds: 30,
          elements: ["title", "pictures"],
          blocks: [],
          items: [],
          pictures: [photo],
          pictureSeconds: 30,
          design: null,
          screen: null,
        },
      ],
    });
    const res = await page.goto(HARNESS).catch(() => null);
    test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
    await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("tab", { name: "מועדים" }).click();
    await page.getByTestId("occasions").locator('li[data-occasion="o_hillula1"]').getByRole("button", { name: "הגדרות" }).click();

    const gallery = page.getByTestId("occasion-dialog").getByTestId("occasion-pictures");
    const picture = gallery.locator("div", { has: page.locator(`img[src="${photo}"]`) }).getByRole("button").first();
    await expect(picture).toHaveAttribute("aria-pressed", "true");
    await picture.click();
    await expect(picture).toHaveAttribute("aria-pressed", "false");
    await expect(picture).toContainText("לא מוצגת");
    await picture.click();
    await expect(picture).toHaveAttribute("aria-pressed", "true");

    await gallery.getByRole("button", { name: /^מחיקת .* מהגלריה$/ }).click();
    await expect(gallery.locator(`img[src="${photo}"]`)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("occasion-dialog")).toBeHidden();
    await expectNotFrozen(page, "pictures");
  });
});
