import { expect, test, type Page } from "@playwright/test";
import { expectNotFrozen, serveEditor } from "./support/tvEditor";

/**
 * Whatever can be added can be edited and deleted - the board's frame and
 * the shapes and title styles too, like every other gallery: a ready one
 * hidden with ✕ and brought back; the shul's own saved, renamed and deleted.
 */
test.use({ viewport: { width: 1600, height: 1100 } });
const root = (page: Page) => page.locator(".tv-frame .tv-root").first();

async function open(page: Page, config: Record<string, unknown> = {}) {
  const server = await serveEditor(page, config);
  await page.goto("/e2e/harness/editor.html");
  await expect(root(page)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: "עיצוב" }).click();
  return server;
}

test("a ready board frame is hidden and brought back; one set by hand is kept, renamed and deleted", async ({ page }) => {
  await open(page);
  const frames = page.getByTestId("board-frames").first();

  // Hidden with ✕, and back from the shelf below.
  await frames.getByRole("button", { name: "הסתרת פרוכת" }).click();
  await expect(frames.getByRole("button", { name: "פרוכת", exact: true })).toHaveCount(0);
  const shelf = page.getByTestId("board-frames-hidden");
  await shelf.locator("summary").click();
  await shelf.getByRole("button", { name: "החזרת פרוכת" }).click();
  await expect(frames.getByRole("button", { name: "פרוכת", exact: true })).toHaveCount(1);

  // Columns, made wide on one side, and kept under a name.
  await frames.getByRole("button", { name: "עמודי זהב", exact: true }).click();
  const controls = page.getByTestId("board-frame-controls");
  await controls.getByLabel("רוחב העמודים", { exact: true }).fill("1.8");
  await controls.getByRole("button", { name: "רק ימין" }).click();
  await page.getByRole("button", { name: "שמירה כמסגרת שלי" }).click();
  await page.getByLabel("שם המסגרת").fill("עמוד ימני רחב");
  await page.getByRole("button", { name: "שמירת המסגרת" }).click();
  const mine = page.getByTestId("my-board-frame");
  await expect(mine).toHaveCount(1);
  await expect(mine.getByRole("button", { name: "עמוד ימני רחב", exact: true })).toHaveAttribute("aria-pressed", "true");

  // Another frame, then back to it in one click - its size and side with it.
  await frames.getByRole("button", { name: "קורות זהב", exact: true }).click();
  await mine.getByRole("button", { name: "עמוד ימני רחב", exact: true }).click();
  await expect(root(page)).toHaveClass(/is-board-frame-columns/);
  await expect(root(page).locator(".tv-bf-column")).toHaveCount(1);

  // Renamed, then deleted.
  await page.getByRole("button", { name: /שינוי שם ל/ }).click();
  await page.getByLabel("שם המסגרת").fill("עמוד ימין");
  await page.getByRole("button", { name: "שינוי השם" }).click();
  await expect(mine.getByRole("button", { name: "עמוד ימין", exact: true })).toBeVisible();
  await mine.getByRole("button", { name: "מחיקת עמוד ימין" }).click();
  await expect(page.getByTestId("my-board-frame")).toHaveCount(0);
  await expectNotFrozen(page, "own board frames");
});

test("a picture of the shul's own goes around the screen", async ({ page }) => {
  await open(page, {
    myBoardFrames: [{ id: "bf_pic12345", name: "המסגרת שלנו", frame: "picture", tune: {}, image: "https://logos.test/frame.svg" }],
  });
  await page.getByTestId("my-board-frame").getByRole("button", { name: "המסגרת שלנו", exact: true }).click();
  await expect(root(page)).toHaveClass(/is-board-frame-picture/);
  await expect(root(page).locator(".tv-bf-picture")).toHaveCount(1);
  await expect
    .poll(() => root(page).locator(".tv-bf-picture").evaluate((e) => getComputedStyle(e).borderImageSource))
    .toContain("logos.test/frame.svg");
  await expect(page.getByTestId("board-frame-controls").getByLabel("עובי המסגרת", { exact: true })).toBeVisible();
});

test("shapes and title styles: a ready one hidden and brought back", async ({ page }) => {
  await open(page);
  const shapes = page.getByTestId("frame-shapes");
  await shapes.getByRole("button", { name: "הסתרת משושה" }).click();
  await expect(shapes.getByRole("button", { name: "משושה", exact: true })).toHaveCount(0);
  const shapeShelf = page.getByTestId("frame-shapes-hidden");
  await shapeShelf.locator("summary").click();
  await shapeShelf.getByRole("button", { name: "החזרת משושה" }).click();
  await expect(shapes.getByRole("button", { name: "משושה", exact: true })).toHaveCount(1);

  const titles = page.getByTestId("title-styles").first();
  await titles.getByRole("button", { name: "הסתרת סרט" }).click();
  await expect(titles.getByRole("button", { name: "כותרת: סרט" })).toHaveCount(0);
  const titleShelf = page.getByTestId("title-styles-hidden");
  await titleShelf.locator("summary").click();
  await titleShelf.getByRole("button", { name: "החזרת סרט" }).click();
  await expect(titles.getByRole("button", { name: "כותרת: סרט" })).toHaveCount(1);
  await expectNotFrozen(page, "hidden shapes and titles");
});
