import { expect, hasAdmin, test } from "./support/admin";

/**
 * The composer, on the synagogue whose board is actually on a wall.
 *
 * The other TV specs manage whichever community the admin lands on, which is
 * the main one. תורה ואהבתה is the community driving a real screen and the
 * one whose config every fix this week was measured against - illustrated
 * layout, four slides, the day's screen on - so the editor was never once
 * opened against it in a browser. It is also the case most likely to be
 * wrong: a board read as a single screen rather than four, which is exactly
 * the confusion the composer exists to end.
 *
 * Read-only. Nothing here presses "שמור ושדר", so the wall is untouched.
 */

const SLUG = "torah-veahavata";

/** The admin manages whichever synagogue is remembered, by slug. */
async function asTorahVeahavata(page: import("@playwright/test").Page) {
  await page.addInitScript((slug) => {
    try {
      localStorage.setItem("shul-hub.community", slug);
    } catch {
      /* private mode: the spec will simply run on the default synagogue */
    }
  }, SLUG);
}

/** The composer lives in the "פריסה" tab inside the TV panel. */
async function openComposer(page: import("@playwright/test").Page) {
  await page.goto("/community/admin?tab=tv&tvTab=design");
  await page.getByRole("tab", { name: "פריסה" }).click({ timeout: 25_000 });
  const composer = page.getByTestId("screen-composer");
  await expect(composer).toBeVisible({ timeout: 25_000 });
  return composer;
}

test.describe("the composer on תורה ואהבתה", () => {
  test.skip(!hasAdmin, "QA admin credentials are not configured");

  test("opens on that synagogue's own board", async ({ adminPage: page }) => {
    await asTorahVeahavata(page);
    await openComposer(page);
    // The name on the board is this synagogue's, not the main one's - the
    // header override that said "בית הכנסת אפי קפיטל" was removed today and
    // this is what holds that fix down.
    //
    // The preview is beside the composer on a desktop and not drawn at all on
    // a phone, so the board is asked only where there is one; the composer
    // itself is the part that must be there on both.
    const frame = page.locator(".tv-frame").first();
    if (await frame.count()) await expect(frame).toContainText("תורה ואהבתה");
    await expect(page.getByTestId("composer-sketch")).toBeVisible();
  });

  test("reads the saved board as its content, the day and Shabbat, each in its time", async ({
    adminPage: page,
  }) => {
    await asTorahVeahavata(page);
    const composer = await openComposer(page);
    // The day's screen is no longer an overlay that decides for itself when
    // to take the board - it is a screen beside it, and so is Shabbat. Each
    // comes in only in its time, and the composer says when.
    await expect(composer.getByText(/כשיש מועד, מסך החג נכנס לסבב/)).toBeVisible();
    await expect(composer.getByText(/בשבת מוצגים רק מסך השבת/)).toBeVisible();
  });

  test("offers a switch for every block, and the day's screen is one of them", async ({
    adminPage: page,
  }) => {
    await asTorahVeahavata(page);
    const composer = await openComposer(page);

    // By id, not by label: the switch carries an aria-label and the text
    // beside it is a <label> for the same control, so asking by name finds
    // two elements. The id comes straight from the registry, which is the
    // thing being checked anyway.
    for (const id of ["prayers", "zmanim", "announcements", "shiurim", "learning", "festival"]) {
      await expect(composer.locator(`#block-${id}`), `no switch for ${id}`).toBeVisible();
    }
    // The day's screen and Shabbat are switches here like any other block,
    // and this synagogue has a screen of its own for each - shown only in
    // its time. (Whether the first screen also carries the day's line is the
    // gabbai's choice, and not asked here.)
    await expect(composer.locator("#block-shabbat")).toBeVisible();
    await expect(composer.getByRole("button", { name: /מסך החג.*רק במועד/ }).first()).toBeVisible();
    await expect(composer.getByRole("button", { name: /מסך השבת.*רק בשבת/ }).first()).toBeVisible();
  });

  test("turning a block off changes only the sketch, and saves nothing", async ({ adminPage: page }) => {
    await asTorahVeahavata(page);
    const composer = await openComposer(page);
    const sketch = page.getByTestId("composer-sketch");
    await expect(sketch).toContainText("שיעורים");

    await composer.locator("#block-shiurim").click();
    await expect(sketch).not.toContainText("שיעורים");
    // A change in the editor is a draft until somebody broadcasts it.
    await expect(page.getByText("יש שינויים שלא נשמרו").first()).toBeVisible();

    // Put it back, so nothing is left half-changed in the draft.
    await composer.locator("#block-shiurim").click();
    await expect(sketch).toContainText("שיעורים");
  });

  test("a new screen counts once something is on it", async ({ adminPage: page }) => {
    await asTorahVeahavata(page);
    const composer = await openComposer(page);
    // How many screens the wall shows now - whatever the saved board holds.
    const summary = composer.locator("p", { hasText: /מסכים —|מסך אחד —/ });
    const shown = async () => {
      const text = (await summary.textContent()) ?? "";
      return text.startsWith("מסך אחד") ? 1 : Number(/^(\d+) מסכים/.exec(text)?.[1]);
    };
    const before = await shown();

    await composer.getByRole("button", { name: /^מסך$/ }).click();
    // A new screen has only the bars, so the wall would skip it - and says so.
    await expect(composer.getByText(/אין עדיין תוכן במסך הזה/)).toBeVisible();
    expect(await shown()).toBe(before);

    // Something on it, and it is one more screen taking a turn.
    await composer.locator("#block-learning").click();
    await expect.poll(shown).toBe(before + 1);
    await expect(composer.getByText(/חץ בשלט מדלג/)).toBeVisible();
  });
});
