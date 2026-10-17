import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { BUILTIN_DESIGNS, applyDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "../src/tv/config";

/**
 * One system: on a board of parts the topics "תיבות" and "מסגרות" dress the
 * parts chosen on the board - with every shape of the board - and with
 * nothing chosen a tile adds a new part. A frame keeps its board's shape: a
 * picture frame goes on a straight one only.
 */
test("the boxes and frames topics dress the parts of a board of parts", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  const preview = page.locator("[data-board-preview] .tv-frame").first();

  // The top of the tab chooses parts, not an ordinary board's boxes.
  await expect(page.getByTestId("parts-scope-kinds")).toBeVisible();
  await expect(page.getByLabel("התיבות, המסגרות והטקסט של", { exact: true })).toHaveCount(0);

  // Nothing chosen: a shape adds a box in it, chosen at once.
  const shapes = page.getByTestId("part-shape-tiles");
  await shapes.scrollIntoViewIfNeeded();
  await expect(page.getByTestId("box-shape").getByTestId("parts-board-note")).toContainText("אין תיבה בחורה");
  await shapes.getByRole("button", { name: /^כיפה/ }).click();
  await expect(preview.locator('[data-geometric-shape="dome"]')).toHaveCount(1);
  // Chosen: another shape goes on it.
  await shapes.getByRole("button", { name: /^מדורג/ }).click();
  await expect(preview.locator('[data-geometric-shape="notch"]')).toHaveCount(1);
  await expect(preview.locator('[data-geometric-shape="dome"]')).toHaveCount(0);

  // A box chosen, no frame: its container gets the picture frame around it, along its outline - whatever the shape.
  const pictures = page.getByTestId("frame-pictures");
  await pictures.scrollIntoViewIfNeeded();
  await pictures.getByRole("button", { name: /^כסף ואבני ספיר/ }).click();
  await expect(preview.locator('[data-shaped-picture-frame][data-geometric-shape="notch"]')).toHaveCount(1);

  // The container cut to a bevel: its board and its frame together, the frame keeping its picture.
  await shapes.scrollIntoViewIfNeeded();
  await shapes.getByRole("button", { name: /^קטום/ }).click();
  await expect(preview.locator('[data-shaped-picture-frame][data-geometric-shape="bevel"]')).toHaveCount(1);
  // Another picture frame: it replaces this one - never a second frame.
  await pictures.scrollIntoViewIfNeeded();
  await pictures.getByRole("button", { name: /^זהב מסולסל/ }).click();
  await expect(preview.locator("[data-shaped-picture-frame]")).toHaveCount(1);

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const added = normalizeTvConfig(server.saved()).elements.slice(start.elements.length);
  expect(added.map((e) => [e.kind, e.shape ?? null, e.image])).toEqual([
    ["box", "bevel", ""],
    ["frame", "bevel", "frame:emerald-gold"],
  ]);
  expect(errors).toEqual([]);
});
