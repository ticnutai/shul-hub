import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { BUILTIN_DESIGNS, applyDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "../src/tv/config";
import { readOccasions } from "../src/tv/occasions";

/**
 * "קבע לשבת ופתח": a kit of the "שבת" folder made Shabbat's - the same setting
 * as "בחירת ערכה" in "מועדים" - and the Shabbat page opened on it, saying which
 * kit it wears, with the kit changed or taken off there too. The board itself
 * keeps its own look.
 */
test("a Shabbat kit from its folder: made Shabbat's, its page opened, marked, taken off", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1100 });
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();

  const folder = page.locator('[data-library-folder="topic:שבת"]');
  await folder.scrollIntoViewIfNeeded();
  const tile = folder.locator('[data-library-item]').filter({ hasText: "שבת של שלום" }).first();
  await tile.getByRole("button", { name: "קבע לשבת ופתח" }).click();

  // Its page, saying which kit it wears.
  const banner = page.getByTestId("occasion-design-banner");
  await expect(banner).toContainText("שבת");
  await expect(banner).toContainText("«שבת של שלום");
  // The tile says so.
  await expect(folder.locator('[data-library-item]').filter({ hasText: "שבת של שלום" }).first().getByTestId("kit-worn-by")).toHaveText("ערכת השבת");

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved());
  const shabbat = readOccasions(saved).find((o) => o.name === "שבת")!;
  const own = saved.designs.find((d) => d.id === shabbat.design)!;
  expect(own).toMatchObject({ from: "d_shabbatpeace", occasion: shabbat.id });
  // The board itself keeps its own look.
  expect(saved.backgroundImage).toBe(start.backgroundImage);

  // Taken off, from its page.
  await banner.getByRole("button", { name: "בלי ערכה" }).click();
  await expect(banner).toContainText("בלי ערכה - כמו הלוח");
  expect(errors).toEqual([]);
});

test("the kit the board wears, made Shabbat's: its page is the kit of parts - chosen and changed there - not the card", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1100 });
  const { readFileSync } = await import("node:fs");
  const catalog = JSON.parse(readFileSync("public/new-shul-catalog.json", "utf8")) as { designs: import("../src/tv/designs").SavedDesign[] };
  const kit = catalog.designs.find((d) => d.id === "d_shabbatpeace")!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();

  const folder = page.locator('[data-library-folder="topic:שבת"]');
  await folder.scrollIntoViewIfNeeded();
  await folder.locator("[data-library-item]").filter({ hasText: "שבת של שלום" }).first().getByRole("button", { name: "קבע לשבת ופתח" }).click();
  await expect(page.getByTestId("occasion-design-banner")).toContainText("«שבת של שלום");

  // The kit of parts, not the Shabbat card over it.
  const preview = page.locator("[data-board-preview] .tv-frame").first();
  await expect(preview.locator(".tv-occasion")).toHaveCount(0);
  // Its parts are chosen and changed, on Shabbat's page.
  const layers = page.getByTestId("container-layers");
  await layers.scrollIntoViewIfNeeded();
  const row = page.getByTestId("container-row").filter({ has: page.getByRole("checkbox", { name: "בחירת הקונטיינר זמני תפילות", exact: true }) }).first();
  await row.getByTestId("container-name").first().click();
  const panel = page.getByTestId("part-context-panel");
  await panel.getByRole("tab", { name: "הלוח" }).click();
  await panel.getByTestId("ctx-board-gallery").getByRole("button", { name: "עננים בזהב" }).click();

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved());
  const shabbat = readOccasions(saved).find((o) => o.name === "שבת")!;
  const own = saved.designs.find((d) => d.id === shabbat.design)!;
  expect(own).toMatchObject({ from: "d_shabbatpeace", occasion: shabbat.id });
  // The change is Shabbat's: in its kit, the board of every day as it was.
  expect(own.values.elements?.some((e) => e.paint?.picture === "backdrop:clouds")).toBe(true);
  expect(saved.elements.some((e) => e.paint)).toBe(false);

  // "תצוגת מסך שבת" from the board: the Shabbat kit, as the screens show it - not the card.
  await page.getByTestId("occasion-design-banner").getByRole("button", { name: "חזרה לעיצוב הלוח" }).click();
  await page.getByTestId("occasion-preview-menu").click();
  await page.getByRole("menuitemradio", { name: "תצוגת מסך שבת" }).click();
  await expect(preview.locator(".tv-occasion")).toHaveCount(0);
  await expect(preview.locator("[data-part-paint]").first()).toBeVisible();
  expect(errors).toEqual([]);
});
