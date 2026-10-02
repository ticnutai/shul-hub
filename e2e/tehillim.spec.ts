import { expect, test } from "@playwright/test";
import { rememberShul } from "./support/chooseShul";

/**
 * Tehillim with a door of its own in the top row: the Siddur, opened on its
 * Tehillim tab. A link to a chapter and verse opens there (that is how a
 * bookmark comes back); the last place read is offered again; and "סידור"
 * goes back to the prayers.
 */
test.beforeEach(async ({ page }) => {
  await rememberShul(page);
});

test("the Tehillim tab opens Tehillim, remembers the place, and gives the Siddur back", async ({ page }) => {
  await page.goto("/siddur");
  const nav = page.getByRole("navigation", { name: "מדורים ראשיים" });
  await nav.getByRole("link", { name: "תהילים" }).click();
  await expect(page).toHaveURL(/\/siddur\?tab=tehillim/);
  await expect(nav.locator('[aria-current="page"]')).toHaveText("תהילים");
  await expect(page.locator('button[title="פרק א"]')).toBeVisible({ timeout: 20_000 });

  // A link to a chapter and verse - a bookmark's - opens there.
  await page.goto("/siddur?tab=tehillim&perek=23&pasuk=4");
  const bookmark = page.getByTestId("tehillim-bookmark");
  await expect(bookmark).toBeVisible({ timeout: 20_000 });
  await expect(bookmark).toHaveText("סימניה לפסוק");
  await expect(page.getByTestId("tehillim-breadcrumb")).toContainText("פרק כג");

  // Back to the chapters: the place just read is offered first.
  await page.getByRole("button", { name: "כל הפרקים" }).click();
  await expect(page.getByTestId("tehillim-return")).toContainText("המשך מפרק כג, פסוק ד");

  // A guest's bookmark asks them to sign in rather than vanishing.
  await page.getByTestId("tehillim-return").getByRole("button", { name: /המשך מפרק/ }).click();
  await page.getByTestId("tehillim-bookmark").click();
  await expect(page.getByText("יש להתחבר כדי להוסיף סימניות")).toBeVisible();

  // "סידור" goes back to the prayers.
  await nav.getByRole("link", { name: "סידור", exact: true }).click();
  await expect(page).toHaveURL(/\/siddur$/);
  await expect(nav.locator('[aria-current="page"]')).toHaveText("סידור");
});

/** Whatever is pinned at the top of the screen: where text starts to be readable. */
const pinnedBottom = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    Math.max(
      0,
      ...[...document.querySelectorAll<HTMLElement>("header, [data-sticky-chrome]")]
        .filter((e) => ["sticky", "fixed"].includes(getComputedStyle(e).position))
        .map((e) => e.getBoundingClientRect().bottom),
    ),
  );

test("a chapter opens at its first verse, a verse at itself - never under the header; numbers in letters; the trail reads right to left", async ({ page }) => {
  await page.goto("/siddur?tab=tehillim");
  const grid = page.locator('button[title="פרק צג"]');
  await expect(grid).toBeVisible({ timeout: 20_000 });
  // No numerals beside the letters.
  await expect(page.getByText(/\(\d+\)/)).toHaveCount(0);

  // From far down the list of chapters, the way it happens on a phone.
  await page.locator('button[title="פרק קנ"]').scrollIntoViewIfNeeded();
  await grid.click();
  const first = page.locator("p[data-pasuk='1']");
  await expect(first).toBeVisible();
  await expect
    .poll(async () => {
      const top = (await first.boundingBox())!.y;
      const pinned = await pinnedBottom(page);
      return top >= pinned && top < pinned + 260;
    }, { timeout: 5_000 })
    .toBe(true);

  // The trail: right to left, תהילים first (on the right), no numerals.
  const trail = page.getByTestId("tehillim-breadcrumb");
  await expect(trail).toHaveAttribute("dir", "rtl");
  await expect(trail).not.toContainText("(");
  const [home, chapter] = await Promise.all([
    trail.getByRole("button", { name: "תהילים" }).boundingBox(),
    trail.getByText("פרק צג").boundingBox(),
  ]);
  expect(home!.x).toBeGreaterThan(chapter!.x);

  // A verse from the row of verses comes into view, below the header.
  await page.getByRole("button", { name: "פסוק ה", exact: true }).click();
  const fifth = page.locator("p[data-pasuk='5']");
  await expect
    .poll(async () => {
      const box = (await fifth.boundingBox())!;
      const pinned = await pinnedBottom(page);
      const vh = page.viewportSize()!.height;
      return box.y >= pinned && box.y + box.height <= vh;
    }, { timeout: 5_000 })
    .toBe(true);
  await expect(trail).toContainText("פסוק ה");

  // A tap on a verse marks it; the chapter in the trail goes back to its top.
  await page.locator("p[data-pasuk='2']").click();
  await expect(trail).toContainText("פסוק ב");
  await trail.getByRole("button", { name: "פרק צג" }).click();
  await expect(trail).not.toContainText("פסוק");
  await expect
    .poll(async () => (await first.boundingBox())!.y >= (await pinnedBottom(page)), { timeout: 5_000 })
    .toBe(true);
});

test("the T of the text settings is on the Tehillim page too, and sets Tehillim's own text", async ({ page }) => {
  await page.goto("/siddur?tab=tehillim");
  const t = page.getByRole("button", { name: "הגדרות תצוגת טקסט" });
  await expect(t).toBeVisible({ timeout: 20_000 });
  await t.click();
  const panel = page.locator('[data-layout="dialog-text-display"]');
  await expect(panel).toBeVisible();
  // Tehillim's settings alone - not the Chumash's פסוקים, שאלות and the rest.
  await expect(panel.getByTestId("text-settings-scope")).toHaveText("תהילים");
  await expect(panel.getByRole("tab")).toHaveCount(0);
});

test("a verse that runs on starts its next line under its first word, not under its letter", async ({ page }) => {
  await page.goto("/siddur?tab=tehillim");
  await page.locator('button[title="פרק ב"]').click({ timeout: 20_000 });
  const text = page.locator("p[data-pasuk='2'] [data-verse-text]");
  await expect(text).toBeVisible();
  const starts = await text.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = new Map<number, number>();
    for (const r of range.getClientRects()) {
      const key = Math.round(r.top / 4);
      lines.set(key, Math.max(lines.get(key) ?? 0, r.right));
    }
    return [...lines.values()].map(Math.round);
  });
  // Long enough to run on, on any screen the test runs on.
  test.skip(starts.length < 2, "the verse fits one line here");
  expect(new Set(starts).size).toBe(1);
  // And the letter stands beside the text, not under it.
  const letter = await page.locator("p[data-pasuk='2'] span[aria-hidden]").boundingBox();
  expect(letter!.x).toBeGreaterThanOrEqual(starts[0] - 1);
});

test("opening a chapter scrolls there in one smooth movement - no step back, no twitch after it arrives", async ({ page }) => {
  await page.goto("/siddur?tab=tehillim");
  await page.locator('button[title="פרק קנ"]').scrollIntoViewIfNeeded({ timeout: 20_000 });
  const trace = await page.evaluate(async () => {
    const out: number[] = [];
    const t0 = performance.now();
    await new Promise<void>((done) => {
      const tick = () => {
        out.push(Math.round(window.scrollY));
        if (performance.now() - t0 < 2200) requestAnimationFrame(tick);
        else done();
      };
      (document.querySelector('button[title="פרק קיט"]') as HTMLButtonElement).click();
      tick();
    });
    return out;
  });
  const steps = trace.slice(1).map((y, i) => y - trace[i]).filter((d) => d !== 0);
  // One direction all the way.
  expect(new Set(steps.map(Math.sign)).size).toBeLessThanOrEqual(1);
  // And once it reaches where it ends, it stays there.
  const end = trace[trace.length - 1];
  const arrived = trace.indexOf(end);
  expect(trace.slice(arrived).every((y) => y === end)).toBe(true);
});
