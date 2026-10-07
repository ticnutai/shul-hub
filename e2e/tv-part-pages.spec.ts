import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { PREMIUM_DESIGNS } from "../src/tv/premiumDesigns";
import { BUILTIN_DESIGNS, applyDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";
import { addPage, editPage, setPage } from "../src/tv/partPages";

/**
 * The pages of a board of parts (src/tv/partPages.ts), in the real editor and
 * on the TV: a page added, made its own, saved; and the screen taking turns.
 * Same harness as tv-editor.spec.ts, its database answered from the spec.
 */
test.describe("pages of a board of parts", () => {
test.skip(({ isMobile }) => isMobile, "the editor is for a desktop screen");
test("pages in the editor", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  const server = await serveEditor(page, structuredClone(PREMIUM_DESIGNS[0].values) as Record<string, unknown>);
  const res = await page.goto("/e2e/harness/editor.html").catch(() => null);
  test.skip(!res, "the dev server is not running (npm run dev)");
  await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 30_000 });
  const bar = page.getByTestId("part-pages");
  await expect(bar).toContainText("עמוד אחד");
  const board = page.locator(".tv-frame").first();
  const art = () => board.locator("[data-element-id] img").first().getAttribute("src");
  expect(await art()).toContain("heritage-wood");

  // A new page: a copy, open for editing.
  await bar.getByRole("button", { name: "עמוד חדש" }).click();
  await expect(bar.getByRole("tab", { name: /עמוד 2/ })).toHaveAttribute("aria-selected", "true");
  await expect(bar.getByTestId("part-page-editing")).toContainText("עמוד 2");
  await bar.getByLabel("שם העמוד").fill("זמנים והודעות");
  await bar.getByLabel("כמה שניות על המסך").fill("20");
  // Its own content: the prayers' arch shows the day's times - on this page only.
  await page.getByRole("tab", { name: "פריסה" }).click();
  await page.getByTestId("parts-content").getByLabel("מה מציגה זמני תפילות").selectOption("zmanim");
  await expect(board.locator('[data-content-binding="zmanim"]')).toHaveCount(1);
  // Page 1 as it was.
  await bar.getByRole("tab", { name: /עמוד 1/ }).click();
  await expect(board.locator('[data-content-binding="zmanim"]')).toHaveCount(0);
  await expect(board.locator('[data-content-binding="prayers"]')).toHaveCount(1);
  // Undo, on a Hebrew keyboard, takes the last change of the pages back.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ז", code: "KeyZ", ctrlKey: true, bubbles: true })));
  await bar.getByRole("tab", { name: /זמנים והודעות/ }).click();
  await expect(board.locator('[data-content-binding="prayers"]')).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ט", code: "KeyY", ctrlKey: true, bubbles: true })));
  await expect(board.locator('[data-content-binding="zmanim"]')).toHaveCount(1);
  // No second list of turns: the slides of the ordinary board are not offered here.
  await expect(page.getByTestId("slide-strip")).toHaveCount(0);
  // Saved: two pages, page 2 with its own content, page 1 with the prayers.
  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = server.saved() as { partPages: { name: string; seconds: number; look?: { elements: { binding?: string }[] } }[]; elements: { binding?: string }[] };
  expect(saved.partPages.map((p) => [p.name, p.seconds, Boolean(p.look)])).toEqual([["עמוד 1", 30, false], ["זמנים והודעות", 20, true]]);
  expect(saved.elements.some((e) => e.binding === "prayers")).toBe(true);
  expect(saved.partPages[1].look?.elements.some((e) => e.binding === "zmanim")).toBe(true);
  expect(errors).toEqual([]);
});

test("pages on the TV, taking turns", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 960, height: 540 });
  let c = applyDesign(structuredClone(DEFAULT_TV_CONFIG), PREMIUM_DESIGNS[0]);
  c = editPage(addPage(c, 0).config, 1, (x) => applyDesign(x, BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone") ?? BUILTIN_DESIGNS.filter((d) => d.values.elements?.length)[2]));
  c = setPage(setPage(c, 0, { seconds: 5 }), 1, { seconds: 5 });
  await serveEditor(page, JSON.parse(JSON.stringify(c)));
  await page.addInitScript(() => localStorage.setItem("shul-tv-community", JSON.stringify({ id: "community-1", slug: "main", name: "בית הכנסת" })));
  const res = await page.goto("/index-tv.html").catch(() => null);
  test.skip(!res, "the dev server is not running (npm run dev)");
  const art = () => page.locator("[data-element-id] img").first().getAttribute("src").catch(() => null);
  await expect.poll(art, { timeout: 30_000 }).toBeTruthy();
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) { seen.add((await art()) ?? ""); await page.waitForTimeout(1000); }
  // Both pages, each in its own kit, within two turns of five seconds.
  expect([...seen].map((s) => s.split("/").pop()).sort()).toEqual(["heritage-wood.webp", "jerusalem-stone.webp"]);
  expect(errors).toEqual([]);
});
});
