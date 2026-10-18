import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { BUILTIN_DESIGNS, applyDesign, captureDesign, DESIGN_PARTS } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "../src/tv/config";

/**
 * A kit copied into folders - Shabbat, Rosh Chodesh - each copy a kit of its
 * own, with every part: the one it came from deleted, the copies stay; one
 * copy renamed, the other as it was. Saved to the cloud (the board, the
 * library's order) and the same after the page is loaded again.
 */
test("a kit copied to Shabbat and to Rosh Chodesh: copies of their own, kept after the original goes and after a reload", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1100 });
  const base = applyDesign(structuredClone(DEFAULT_TV_CONFIG), BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!);
  const mine = { ...captureDesign(base, "הערכה שלי", [...DESIGN_PARTS], "d_mineorig"), id: "d_mineorig" };
  const start = JSON.parse(JSON.stringify({ ...base, designs: [mine] }));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  const library = page.getByTestId("design-library");
  const item = (id: string) => library.locator(`[data-library-item="${id}"]`).first();
  const copyTo = async (folder: string) => item("d_mineorig").getByLabel("העתקת הערכה שלי לתיקייה", { exact: true }).selectOption({ label: folder });
  await item("d_mineorig").scrollIntoViewIfNeeded();

  await copyTo("שבת");
  await copyTo("ראש חודש");
  const inFolder = (folder: string) => library.locator(`[data-library-folder="${folder}"] [data-library-item]`).filter({ hasText: "הערכה שלי (שלי)" });
  await expect(inFolder("topic:שבת")).toHaveCount(1);
  await expect(inFolder("topic:ראש חודש")).toHaveCount(1);

  // The original deleted: the copies stay.
  await item("d_mineorig").getByRole("button", { name: /^הסרת|^מחיקת/ }).first().click();
  await page.getByRole("alertdialog").getByRole("button", { name: "מחיקה" }).click();
  await expect(library.locator('[data-library-item="d_mineorig"]')).toHaveCount(0);
  await expect(inFolder("topic:שבת")).toHaveCount(1);
  await expect(inFolder("topic:ראש חודש")).toHaveCount(1);

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved());
  const copies = saved.designs.filter((d) => d.name === "הערכה שלי (שלי)");
  expect(copies).toHaveLength(2);
  expect(new Set(copies.map((d) => d.id)).size).toBe(2);
  expect(saved.designs.some((d) => d.id === "d_mineorig")).toBe(false);
  // Every part, in each.
  for (const c of copies) expect(c.values.elements?.length).toBe(base.elements.length);
  // Their folders, in the cloud (the library's order).
  const places = Object.entries(server.library().order?.place ?? {}).filter(([id]) => copies.some((c) => c.id === id)).map(([, f]) => f).sort();
  expect(places).toEqual(["topic:ראש חודש", "topic:שבת"]);

  // Loaded again: the same.
  await page.reload();
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  await expect(inFolder("topic:שבת")).toHaveCount(1);
  await expect(inFolder("topic:ראש חודש")).toHaveCount(1);
  expect(errors).toEqual([]);
});
