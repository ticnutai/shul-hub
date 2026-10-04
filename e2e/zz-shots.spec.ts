import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
const OUT = "C:/Users/jj121/AppData/Local/Temp/claude/C--Users-jj121-smart-downloader/6d03667c-26fc-4cc0-9160-8fdbd4f92924/scratchpad/shots/audit-";
test.use({ viewport: { width: 1500, height: 1000 } });
test("audit", async ({ page }) => {
  test.setTimeout(120_000);
  await serveEditor(page);
  await page.goto("/e2e/harness/editor.html");
  await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 20_000 });
  for (const id of ["design-sets", "design-background", "design-boxes", "design-frames", "design-text"]) {
    const el = page.locator(`#${id}`);
    await el.scrollIntoViewIfNeeded();
    await el.screenshot({ path: `${OUT}${id}.png` });
  }
  await page.locator("[data-testid=parts-scope]").screenshot({ path: `${OUT}scope.png` });
  for (const tab of ["פריסה", "תוכן", "כלים"]) {
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}tab-${tab}.png`, fullPage: true });
  }
});
