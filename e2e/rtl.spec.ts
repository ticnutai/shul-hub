import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";

/**
 * Nothing in the editor is left-to-right by accident.
 *
 * The site is Hebrew and `<html dir="rtl">`, but that attribute does not
 * reach Radix: its tabs, menus, sliders and popovers build themselves
 * left-to-right unless told otherwise, and the whole of the TV editor sat
 * inside a Radix Tabs root. Headings and help text aligned to the left in an
 * otherwise right-to-left page. `DirectionProvider` in App.tsx fixes that at
 * the root; this test is what keeps it fixed.
 *
 * Deliberate islands are allowed: a hex colour, a resolution, a product name
 * in English, the device frame of the preview. What marks them as deliberate
 * is an explicit dir="ltr" on the element or on something above it. Anything
 * left-to-right *without* that is a mistake.
 */

const strayLtr = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const stray: string[] = [];
    const root = document.querySelector("#root");
    if (!root) return stray;
    for (const el of root.querySelectorAll<HTMLElement>("*")) {
      if (el.closest(".tv-frame")) continue; // the board draws itself
      if (el.closest('[dir="ltr"]')) continue; // someone chose this
      const text = (el.textContent ?? "").trim();
      if (!text || el.children.length > 2) continue;
      const cs = getComputedStyle(el);
      if (cs.direction === "ltr" || cs.textAlign === "left") {
        stray.push(`<${el.tagName.toLowerCase()} class="${el.className}"> ${text.slice(0, 40)}`);
      }
    }
    return stray;
  });

test.describe("right to left", () => {
  test.skip(({ isMobile }) => isMobile, "one pass over the editor is enough");

  test("every part of the editor lays out right to left", async ({ page }) => {
    await serveEditor(page);
    await page.setViewportSize({ width: 1600, height: 1000 });
    const res = await page.goto("/e2e/harness/editor.html").catch(() => null);
    test.skip(!res, "the dev server is not running (npm run dev)");
    await expect(page.locator(".tv-frame .tv-root")).toBeVisible({ timeout: 20_000 });

    for (const tab of ["עיצוב", "פריסה", "תוכן", "כלים"]) {
      await page.getByRole("tab", { name: tab }).click();
      await page.waitForTimeout(300);
      const stray = await strayLtr(page);
      expect(stray, `left-to-right in "${tab}": ${stray.slice(0, 5).join(" | ")}`).toEqual([]);
    }

    // And the panel that opens when the board itself is clicked.
    await page.getByRole("button", { name: "עריכה ישירה בלוח" }).click();
    await page.locator(".tv-frame .tv-root").first().click({ position: { x: 8, y: 8 } });
    await expect(page.getByTestId("board-background")).toBeVisible();
    const stray = await strayLtr(page);
    expect(stray, `left-to-right in the board panel: ${stray.slice(0, 5).join(" | ")}`).toEqual([]);
  });
});
