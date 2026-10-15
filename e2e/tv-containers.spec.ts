import { expect, test, type Page } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { BUILTIN_DESIGNS, applyDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "../src/tv/config";

/**
 * The layers as containers: a kit made before there were any is read into
 * them (by its headings), and each container is chosen whole, renamed, moved
 * a layer, duplicated, put inside another, given a frame and a text, and
 * deleted - all saved with the board, the TV drawing the same flat parts.
 */
async function open(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  const layers = page.getByTestId("container-layers");
  await layers.scrollIntoViewIfNeeded();
  return { server, start, layers };
}
const row = (page: Page, name: string) => page.getByTestId("container-row").filter({ has: page.getByRole("checkbox", { name: `בחירת הקונטיינר ${name}`, exact: true }) }).first();

test("containers: read off a kit, chosen whole, renamed, layered, duplicated, nested, filled and deleted", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { server, start, layers } = await open(page);

  // Read off the kit, named by their headings; the main background the bottom layer.
  await expect(row(page, "זמני תפילות")).toBeVisible();
  await expect(row(page, "שיעורי תורה")).toBeVisible();
  await expect(layers.getByTestId("main-background-layer")).toBeVisible();

  // Chosen whole: every part of it ticked.
  const prayers = row(page, "זמני תפילות");
  await prayers.getByTestId("container-name").first().click();
  await expect(prayers.getByTestId("container-inside").getByRole("checkbox", { checked: true })).toHaveCount(3);

  // Renamed.
  await prayers.getByRole("button", { name: "שינוי השם של זמני תפילות", exact: true }).click();
  await page.getByLabel("שם הקונטיינר", { exact: true }).fill("התפילות שלנו");
  await page.getByLabel("שם הקונטיינר", { exact: true }).press("Enter");
  const ours = row(page, "התפילות שלנו");
  await expect(ours).toBeVisible();

  // A layer down: it now stands under the one that was under it.
  const order = async () => (await layers.getByRole("checkbox", { name: /^בחירת הקונטיינר / }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!.replace("בחירת הקונטיינר ", ""))));
  const before = await order();
  await ours.getByRole("button", { name: "התפילות שלנו שכבה למטה", exact: true }).click();
  const after = await order();
  expect(after.indexOf("התפילות שלנו")).toBeGreaterThan(before.indexOf("התפילות שלנו"));

  // Duplicated: a copy, with its own parts.
  await ours.getByRole("button", { name: "שכפול התפילות שלנו", exact: true }).click();
  await expect(row(page, "התפילות שלנו (עותק)")).toBeVisible();

  // The copy put inside the lessons: shown in it, and chosen with it.
  const copy = row(page, "התפילות שלנו (עותק)");
  await copy.getByLabel("הקונטיינר ש־התפילות שלנו (עותק) בתוכו", { exact: true }).selectOption({ label: "שיעורי תורה" });
  await expect(row(page, "שיעורי תורה").getByTestId("container-inside").getByRole("checkbox", { name: "בחירת הקונטיינר התפילות שלנו (עותק)", exact: true })).toHaveCount(1);
  await row(page, "שיעורי תורה").getByTestId("container-name").first().click();
  await expect(row(page, "שיעורי תורה").getByRole("checkbox", { name: "בחירת הקונטיינר שיעורי תורה", exact: true })).toBeChecked();

  // A new container, whole: a board, a frame, a heading.
  await layers.getByTestId("container-new").click();
  const fresh = row(page, "קונטיינר חדש");
  await expect(fresh.getByTestId("container-inside").getByRole("checkbox")).toHaveCount(3);
  // Something more inside it.
  await fresh.getByTestId("container-inside").first().getByRole("button", { name: "טקסט", exact: true }).first().click();
  await expect(fresh.getByTestId("container-inside").getByRole("checkbox")).toHaveCount(4);

  // Deleted, after asking.
  await fresh.getByRole("button", { name: "מחיקת קונטיינר חדש", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "מחיקה", exact: true }).click();
  await expect(row(page, "קונטיינר חדש")).toHaveCount(0);

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved());
  const names = saved.containers.map((c) => c.name);
  expect(names).toContain("התפילות שלנו");
  expect(names).toContain("התפילות שלנו (עותק)");
  const lessons = saved.containers.find((c) => c.name === "שיעורי תורה")!;
  expect(saved.containers.find((c) => c.name === "התפילות שלנו (עותק)")!.parent).toBe(lessons.id);
  // The board itself is still its flat parts: the kit's, and the copy's three.
  expect(saved.elements).toHaveLength(start.elements.length + 3);
  // Every part of a container carries its group.
  for (const c of saved.containers) expect(saved.elements.some((e) => e.group === c.id)).toBe(true);
  expect(errors).toEqual([]);
});

test("the library offers kits of parts only: the old ones not built of parts are gone", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  await open(page);
  const library = page.getByTestId("design-library");
  await expect(library.locator('[data-design-id="d_premium_jerusalem-stone"]').first()).toBeVisible();
  for (const id of ["d_wood", "d_curtain", "d_stone", "d_modern", "d_sapphireparts"]) await expect(library.locator(`[data-design-id="${id}"]`)).toHaveCount(0);
  await expect(page.getByTestId("older-designs")).toHaveCount(0);
});
