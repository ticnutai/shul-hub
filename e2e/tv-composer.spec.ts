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
    await expect(page.locator(".tv-frame").first()).toContainText("תורה ואהבתה");
  });

  test("reads the saved board as one screen, which is why an arrow had nowhere to go", async ({
    adminPage: page,
  }) => {
    await asTorahVeahavata(page);
    const composer = await openComposer(page);
    await expect(composer.getByText(/מסך אחד/)).toBeVisible();
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
    // This synagogue has the day's screen on, and until now no setting could
    // put it on a single board beside the times. Here it is, switched on.
    await expect(composer.locator("#block-festival")).toHaveAttribute("aria-checked", "true");
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

  test("adding a screen turns the standing board into a rotating one", async ({ adminPage: page }) => {
    await asTorahVeahavata(page);
    const composer = await openComposer(page);

    await composer.getByRole("button", { name: /^מסך$/ }).click();
    await expect(composer.getByText(/2 מסכים/)).toBeVisible();
    // Which is the whole point: with two screens the arrow has somewhere to go.
    await expect(composer.getByText(/חץ בשלט מדלג/)).toBeVisible();
  });
});
