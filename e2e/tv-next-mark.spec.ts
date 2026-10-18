import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { PREMIUM_DESIGNS } from "../src/tv/premiumDesigns";
import { normalizeTvConfig } from "../src/tv/config";

/**
 * "הבא בתור" on the board's lists: the next minyan marked on the board, its
 * shape and colour chosen in the text bar under the preview, the same look
 * for every list of the board at once - and saved so.
 */
test("the next minyan marked, its shape and colour chosen", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  // Whenever it runs: the first is over, the second is next (the board's own clock is not stopped for it).
  const server = await serveEditor(page, structuredClone(PREMIUM_DESIGNS[0].values) as Record<string, unknown>, {
    minyanim: [["ותיקין", "00:01:00"], ["ערבית מאוחרת", "23:58:00"], ["ערבית אחרונה", "23:59:00"]],
  });
  const res = await page.goto("/e2e/harness/editor.html").catch(() => null);
  test.skip(!res, "the dev server is not running (npm run dev)");
  await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 30_000 });
  const board = page.locator(".tv-frame").first();
  const prayers = board.locator('[data-content-binding="prayers"]').first();
  await expect(prayers.locator("[data-next]")).toContainText("ערבית מאוחרת");

  await page.getByRole("button", { name: /עריכה ישירה בלוח/ }).first().click();
  await prayers.click();
  const tools = page.getByTestId("next-mark-tools");
  await expect(tools).toBeVisible();
  await tools.getByRole("radio", { name: "תווית \"הבא\"" }).click();
  await expect(prayers.locator("[data-next-badge]")).toHaveText("הבא");
  await tools.getByRole("radio", { name: "מסגרת" }).click();
  await expect(prayers.locator("[data-next-badge]")).toHaveCount(0);
  const lists = await board.locator('[data-content-binding="prayers"], [data-content-binding="lessons"], [data-content-binding="zmanim"]').count();
  const all = tools.getByRole("button", { name: /אותו סימון לכל הרשימות בלוח/ });
  if (lists > 1) await all.click();

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved());
  const marked = saved.elements.filter((e) => ["prayers", "lessons", "zmanim"].includes(e.binding ?? ""));
  expect(marked.length).toBeGreaterThan(0);
  for (const e of lists > 1 ? marked : marked.filter((x) => x.binding === "prayers")) expect(e.nextMark?.shape).toBe("frame");
  expect(errors).toEqual([]);
});
