import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { PREMIUM_DESIGNS } from "../src/tv/premiumDesigns";

for (const occasion of [false, true]) {
  test(`colour of a part, ${occasion ? "on the occasion" : "on the board"}`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await serveEditor(page, structuredClone(PREMIUM_DESIGNS[0].values) as Record<string, unknown>);
    await page.goto("/e2e/harness/editor.html");
    await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 30_000 });
    if (occasion) {
      const bar = page.getByTestId("part-pages");
      const tab = bar.locator('[data-occasion-tab="cal:rosh_chodesh"]');
      if (await tab.count()) await tab.click();
      else await bar.getByLabel("הוספת מועד לפס").selectOption("cal:rosh_chodesh");
      await page.getByTestId("builtin-designs").locator('[data-design-id="d_premium_rc_night-moon"] button[title^="ממלא"]').click();
    }
    await page.getByRole("button", { name: /עריכה ישירה בלוח/ }).first().click();
    const board = page.locator("[data-board-preview] .tv-frame").first();
    const title = board.locator('[data-free-edit="true"] [data-element-id]').filter({ has: page.locator('[data-content-binding="title"]') }).first();
    await title.click();
    const tools = page.getByTestId("preview-text-tools");
    await expect(tools).toBeVisible();
    const before = await title.evaluate((el) => getComputedStyle(el).color);
    await tools.getByRole("button", { name: /צבע/ }).first().click();
    const panel = page.getByTestId("color-panel");
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "צבע #6e1d2f" }).click();
    await expect.poll(() => title.evaluate((el) => getComputedStyle(el).color)).not.toBe(before);
  });
}
