import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { applyDesign, type SavedDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "../src/tv/config";
import { containersOf, roleOf } from "../src/tv/containerParts";

/**
 * A kit painted from one picture ("שבת של שלום"): a container chosen on it,
 * and in the panel under the board its frame replaced - not a second one
 * added - its board given a background of the gallery, its shape changed with
 * the board and the frame together. The other containers as they were.
 */
const catalog = JSON.parse(readFileSync("public/new-shul-catalog.json", "utf8")) as { designs: SavedDesign[] };

test("a painted container: its frame replaced, its board dressed, its shape changed - in the panel of what was chosen", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1200 });
  const kit = catalog.designs.find((d) => d.id === "d_shabbatpeace")!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();

  const layers = page.getByTestId("container-layers");
  await layers.scrollIntoViewIfNeeded();
  const row = page.getByTestId("container-row").filter({ has: page.getByRole("checkbox", { name: "בחירת הקונטיינר זמני תפילות", exact: true }) }).first();
  await row.getByTestId("container-name").first().click();

  const panel = page.getByTestId("part-context-panel");
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toContainText("נבחר: זמני תפילות");

  // The frame: replaced, one frame still.
  await panel.getByRole("tab", { name: "המסגרת" }).click();
  await panel.getByTestId("ctx-frame-gallery").getByRole("button", { name: "קו מצויר" }).click();
  // The board: a background of the gallery.
  await panel.getByRole("tab", { name: "הלוח" }).click();
  await panel.getByTestId("ctx-board-gallery").getByRole("button", { name: "עננים בזהב" }).click();
  // The shape: rounded - a picture frame fits it.
  await panel.getByRole("tab", { name: "הצורה" }).click();
  await panel.getByRole("button", { name: "צורה: מעוגל" }).click();
  await panel.getByRole("tab", { name: "המסגרת" }).click();
  await panel.getByTestId("ctx-frame-gallery").getByRole("button", { name: "זהב מעוטר" }).click();

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved()).elements;
  const heading = saved.find((e) => e.name === "כותרת זמני תפילות")!;
  const [c] = containersOf(saved, [heading.id]);
  const own = saved.filter((e) => c.ids.includes(e.id));
  expect(own.filter((e) => roleOf(e) === "frame")).toHaveLength(1);
  // A picture frame on the rounded container: the picture itself (straight edges, no line of a shape).
  expect(c.frame).toMatchObject({ kind: "frame", image: "frame:gold-ornate" });
  expect(c.board).toMatchObject({ kind: "box", shape: "rounded" });
  expect(c.board?.paint?.picture).toBe("backdrop:clouds");
  // The other containers still painted, as they were.
  expect(saved.find((e) => e.name === "מסגרת זמני היום")?.kind).toBe("image");
  expect(saved.length).toBe(start.elements.length);
  expect(errors).toEqual([]);
});
