import { expect, test } from "@playwright/test";
import { expectNotFrozen, serveEditor } from "./support/tvEditor";

/**
 * Logos: a shared library; each board chooses from it, and each screen shows
 * them or not by its "לוגואים" switch. Nothing of anybody's is built in.
 */
const HARNESS = "/e2e/harness/editor.html";

test.describe("TV editor, logos", () => {
  test("choosing a logo from the library puts it on the board; a screen's switch takes it off", async ({ page }) => {
    await serveEditor(page, {
      screenLayout: "medallion",
      logos: [],
      screens: [{ id: "a", name: "הלוח", seconds: 20, blocks: [{ block: "header" }, { block: "logo" }, { block: "clock" }, { block: "prayers" }] }],
    });
    const res = await page.goto(HARNESS).catch(() => null);
    test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
    const frame = page.locator(".tv-frame").first();
    await expect(frame.locator(".tv-root")).toBeVisible({ timeout: 20_000 });
    // Nothing chosen: no logo at all - not even one built into the code.
    await expect(frame.locator(".tv-med-logos img")).toHaveCount(0);

    await page.getByRole("tab", { name: "פריסה" }).click();
    const library = page.getByTestId("logo-library");
    await library.getByRole("checkbox", { name: "לוגו בדיקה בלוח הזה" }).check();
    await expect(frame.locator(".tv-med-logos img")).toHaveCount(1);

    await page.getByTestId("screen-composer").locator("#block-logo").click();
    await expect(frame.locator(".tv-med-logos img")).toHaveCount(0);
    await expectNotFrozen(page, "logos");
  });
});
