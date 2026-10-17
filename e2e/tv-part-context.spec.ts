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

test("the main background, beside the board or at its foot, and a shape dragged onto the board", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1200 });
  const { BUILTIN_DESIGNS } = await import("../src/tv/designs");
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_sapphirelayers")!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();

  // The main background: its painted picture chosen from the containers' list, the panel on it - its background only.
  const layers = page.getByTestId("container-layers");
  await layers.scrollIntoViewIfNeeded();
  await page.getByTestId("main-background-layer").getByRole("button", { name: "עריכת הרקע" }).click();
  const panel = page.getByTestId("part-context-panel");
  await expect(panel).toContainText("נבחר: הרקע הראשי");
  await expect(panel.getByRole("tab")).toHaveText(["הרקע", "הוספת קונטיינר"]);
  await expect(panel.getByTestId("backdrop-note")).toContainText("מסתירה אותו");
  await panel.getByTestId("board-background-gallery").getByRole("button", { name: "ירוק עמוק", exact: true }).click();
  await expect(panel.getByRole("button", { name: "החזרת הרקע המצויר" })).toBeVisible();

  // At the board's foot side by side; beside it when the board is above.
  const place = await panel.getAttribute("data-place");
  await page.getByRole("button", { name: "תצוגה למעלה" }).first().click();
  await expect(panel).toHaveAttribute("data-place", "side");
  expect(["side", "strip"]).toContain(place);

  // A shape dragged onto the board: a container where it fell.
  await panel.getByRole("tab", { name: "הוספת קונטיינר" }).click();
  const root = page.locator("[data-board-preview] .tv-frame .tv-root").first();
  const box = (await root.boundingBox())!;
  await panel.getByRole("button", { name: "קונטיינר חדש: כיפה" }).dragTo(root, { targetPosition: { x: box.width * 0.2, y: box.height * 0.5 } });
  await expect(panel).toContainText("נבחר: קונטיינר חדש");

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved());
  expect(saved.backgroundGradient).toBe("linear-gradient(180deg, #0f2a1d, #0f2a1d)");
  expect(saved.elements.find((e) => e.name.startsWith("רקע המקור"))?.hidden).toBe(true);
  const dome = saved.elements.find((e) => e.kind === "box" && e.shape === "dome" && e.name === "לוח הקונטיינר")!;
  expect(dome.x).toBeLessThan(15);
  expect(dome.y).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});
