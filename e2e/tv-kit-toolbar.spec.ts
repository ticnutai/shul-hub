import { expect, test } from "@playwright/test";
import { expectNotFrozen, serveEditor } from "./support/tvEditor";
import { PREMIUM_DESIGNS } from "../src/tv/premiumDesigns";
import { normalizeTvConfig } from "../src/tv/config";

/**
 * "שמירה כערכה חדשה" beside the preview's device menu: what is on the board
 * kept as a kit without scrolling to "ערכות" - the same form and the same save
 * as in "הערכות שלי". A kit of parts stays a kit of parts: put back on, each of
 * its parts is chosen and moved by itself.
 */
const HARNESS = "/e2e/harness/editor.html";

test("a kit saved from the toolbar comes back with every part editable on its own", async ({ page, isMobile }) => {
  test.skip(isMobile, "the toolbar beside the device menu is a desktop row");
  const kit = PREMIUM_DESIGNS[0];
  const other = PREMIUM_DESIGNS.find((d) => d.id !== kit.id && d.values.elements?.length)!;
  const server = await serveEditor(page, structuredClone(kit.values) as Record<string, unknown>);
  const res = await page.goto(HARNESS).catch(() => null);
  test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
  await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 30_000 });

  // Saved from the toolbar: on a board of parts its parts and layout are always kept.
  await page.getByTestId("toolbar-save-kit").first().click();
  const form = page.getByTestId("toolbar-kit-form");
  await expect(form.getByRole("checkbox", { name: "מסגרות" })).toBeDisabled();
  await expect(form.getByRole("checkbox", { name: "פריסה" })).toBeChecked();
  await form.getByLabel("שם הערכה").fill("הלוח שלי בחלקים");
  await form.getByRole("button", { name: "שמירת הערכה" }).click();
  const library = page.getByTestId("design-library");
  await expect(library.getByRole("button", { name: /^החלת ערכה הלוח שלי בחלקים/ })).toBeVisible();

  // Another kit on, then the saved one back.
  await page.getByTestId("builtin-designs").locator(`[data-design-id="${other.id}"] button[title^="ממלא"]`).click();
  await library.getByRole("button", { name: /^החלת ערכה הלוח שלי בחלקים/ }).click();
  await expectNotFrozen(page, "kit back on");

  // One part, chosen in the list of layers, moved: it moves alone.
  await page.getByRole("switch", { name: "מסגרת, תיבה וטקסט יחד" }).evaluate((el) => {
    if (el.getAttribute("aria-checked") === "true") (el as HTMLElement).click();
  });
  const part = kit.values.elements!.find((e) => !e.locked && !e.group && !e.hidden && e.width < 40 && e.x > 10)!;
  await page.getByLabel("שכבות החלקים", { exact: true }).getByRole("button", { name: part.name, exact: true }).first().click();
  const across = page.getByRole("spinbutton", { name: "מיקום אופקי", exact: true });
  const x = Math.max(0, Math.min(100 - part.width, part.x > 50 ? part.x - 7 : part.x + 7));
  await across.fill(String(x));
  await across.press("Enter");

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes(), { timeout: 10_000 }).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved());
  const moved = saved.elements.filter((e) => {
    const was = kit.values.elements!.find((k) => k.id === e.id);
    return was && Math.abs(was.x - e.x) > 0.01;
  });
  expect(moved.map((e) => e.id)).toEqual([part.id]);
  expect(saved.designs.some((d) => d.name === "הלוח שלי בחלקים" && d.parts.includes("frames") && d.parts.includes("layout"))).toBe(true);
});
