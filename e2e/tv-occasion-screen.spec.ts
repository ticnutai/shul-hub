import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";

/**
 * An occasion's screen in the layout tab, beside the board's screens: opened
 * like any screen, its card a block among the board's - and the preview goes
 * to its day and draws them together, as arranged.
 */
const HARNESS = "/e2e/harness/editor.html";

test("an occasion stands beside the screens; its card and the prayers share its screen", async ({ page }) => {
  // A day of the shul's own, today and first in importance: the test does not
  // depend on which festival happens to be near.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  const server = await serveEditor(page, {
    screenLayout: "medallion",
    occasions: [
      {
        id: "o_testday1",
        name: "יום הבדיקה",
        title: null,
        enabled: true,
        when: { type: "date", date: today },
        window: "day",
        display: "hold",
        banner: false,
        overlap: "only",
        seconds: 30,
        elements: ["title", "date", "zmanim"],
        blocks: [],
        items: [],
        pictures: [],
        pictureSeconds: 30,
        design: null,
        screen: null,
      },
    ],
  });
  const res = await page.goto(HARNESS).catch(() => null);
  test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
  const board = page.locator(".tv-frame").first();
  await expect(board.locator(".tv-root")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("tab", { name: "פריסה" }).click();
  const tab = page.getByTestId("occasion-screen-tab").and(page.locator('[data-occasion="o_testday1"]'));
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(tab).toHaveAttribute("aria-current", "true");
  await expect(tab).toContainText("היום");
  await expect(page.getByTestId("occasion-screen-note")).toContainText("המסך של יום הבדיקה");
  // The preview is on its day: its card over the whole board, as before.
  await expect(board.locator('.tv-occasion.is-stage[data-occasion="o_testday1"]')).toBeVisible({ timeout: 10_000 });

  // The card is a block that stays; the prayers go beside it.
  await expect(page.getByRole("switch", { name: "כרטיס המועד" })).toBeDisabled();
  await page.getByRole("switch", { name: "תפילות היום" }).click();
  await expect(page.getByTestId("composer-sketch")).toContainText("כרטיס המועד");
  await expect(page.getByTestId("composer-sketch")).toContainText("תפילות היום");

  // The preview draws the occasion's own screen: the card in a frame, the prayers beside it.
  await expect(board.locator(".tv-occasion-frame .tv-occasion.is-frame")).toBeVisible({ timeout: 10_000 });
  await expect(board.locator(".tv-occasion.is-stage")).toHaveCount(0);
  await expect(board.locator(".tv-med-list").first()).toBeVisible();
  if (process.env.SHOT_DIR) await board.screenshot({ path: `${process.env.SHOT_DIR}/occasion-screen-${test.info().project.name}.png` });

  // Saved with the board: the occasion carries its screen.
  await page.getByRole("button", { name: "שמור ושדר למסכים" }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = server.saved() as { occasions?: { id: string; screen?: { blocks: { block: string }[] } }[] };
  const day = saved.occasions?.find((o) => o.id === "o_testday1");
  expect(day?.screen?.blocks.map((b) => b.block)).toEqual(expect.arrayContaining(["festival", "prayers"]));

  // Back to the board's screen: the preview returns to now.
  await page.getByRole("button", { name: /הלוח/ }).first().click();
  await expect(page.getByTestId("occasion-screen-note")).toHaveCount(0);
});

test("an occasion's design: the editor says the screens wear it, and shows it as they do", async ({ page }) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  await serveEditor(page, {
    screenLayout: "medallion",
    theme: "navy",
    occasions: [
      {
        id: "o_testday2",
        name: "יום העץ",
        title: null,
        enabled: true,
        when: { type: "date", date: today },
        window: "day",
        display: "turns",
        banner: false,
        overlap: "only",
        seconds: 30,
        elements: ["title", "date"],
        blocks: [],
        items: [],
        pictures: [],
        pictureSeconds: 30,
        design: "d_wood",
        screen: null,
      },
    ],
  });
  const res = await page.goto(HARNESS).catch(() => null);
  test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
  const root = page.locator(".tv-frame .tv-root").first();
  await expect(root).toBeVisible({ timeout: 20_000 });

  // The board being edited: navy, no carved frames - and it says what the screens wear.
  const note = page.getByTestId("day-look-note");
  await expect(note).toContainText("מסגרת עץ מגולפת");
  await expect(note).toContainText("יום העץ");
  await expect(root).not.toHaveClass(/has-frame-image/);

  // As the screens show it.
  await note.getByRole("button", { name: "הצגה כמו במסכים" }).click();
  await expect(root).toHaveClass(/has-frame-image/);
  await expect(root).toHaveClass(/has-bg-image/);
  await note.getByRole("button", { name: "הצגת העיצוב הרגיל" }).click();
  await expect(root).not.toHaveClass(/has-frame-image/);
});
