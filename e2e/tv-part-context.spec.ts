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
  expect(["side", "float"]).toContain(place);

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

test("the panel floats where there is no room beside the board: dragged, kept there, put back, folded", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1500, height: 950 });
  const kit = catalog.designs.find((d) => d.id === "d_shabbatpeace")!;
  await serveEditor(page, JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit))));
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("button", { name: "זה לצד זה" }).first().click();
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  const pick = async () => {
    await page.getByTestId("container-layers").scrollIntoViewIfNeeded();
    await page.getByTestId("container-row").filter({ has: page.getByRole("checkbox", { name: "בחירת הקונטיינר זמני תפילות", exact: true }) }).first().getByTestId("container-name").first().click();
  };
  await pick();
  const panel = page.getByTestId("part-context-panel");
  await expect(panel).toHaveAttribute("data-place", "float");
  // Dragged by its title: it goes where it is put.
  const handle = panel.getByTestId("part-context-handle");
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(700, 200, { steps: 8 });
  await page.mouse.up();
  const at = (await panel.boundingBox())!;
  expect(Math.abs(at.y - (200 - box.height / 2))).toBeLessThan(30);
  // Kept for next time.
  await panel.getByRole("button", { name: "סגירת החלון" }).click();
  await pick();
  const again = (await panel.boundingBox())!;
  expect(Math.abs(again.y - at.y)).toBeLessThan(5);
  // Folded to its title, and open again.
  await panel.getByRole("button", { name: "מזעור החלון" }).click();
  await expect(panel.getByTestId("ctx-board")).toHaveCount(0);
  await panel.getByRole("button", { name: "פתיחת החלון" }).click();
  // A double click on the title: back to its own corner.
  await handle.dblclick({ position: { x: 10, y: 10 } });
  const home = (await panel.boundingBox())!;
  expect(home.y).toBeGreaterThan(at.y + 100);
  // Never off the screen.
  const b2 = (await handle.boundingBox())!;
  await page.mouse.move(b2.x + 20, b2.y + 8);
  await page.mouse.down();
  await page.mouse.move(-500, -500, { steps: 5 });
  await page.mouse.up();
  const edge = (await panel.boundingBox())!;
  expect(edge.x).toBeGreaterThanOrEqual(0);
  expect(edge.y).toBeGreaterThanOrEqual(0);
});
