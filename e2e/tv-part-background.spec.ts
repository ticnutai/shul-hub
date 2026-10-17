import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { BUILTIN_DESIGNS, applyDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "../src/tv/config";

/**
 * One board of a board of parts in a background of its own: chosen, it takes
 * the gallery's picture and no other board does, nor the board's own
 * background; "על רקע הלוח כולו" goes back to the board's. Saved so.
 */
test("a background for the board chosen, not for the whole board", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1200 });
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_lightminimal")!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();

  // One board chosen: its container, whole.
  const layers = page.getByTestId("container-layers");
  await layers.scrollIntoViewIfNeeded();
  const row = page.getByTestId("container-row").filter({ has: page.getByRole("checkbox", { name: "בחירת הקונטיינר זמני תפילות", exact: true }) }).first();
  await row.getByTestId("container-name").first().click();

  // The background topic offers it, and the gallery dresses it alone.
  const target = page.getByTestId("layer-background-target");
  await target.scrollIntoViewIfNeeded();
  await expect(target.getByRole("radio", { name: /על החלק שנבחר/ })).toBeChecked();
  await page.getByTestId("background-gallery").getByRole("button", { name: "עננים בזהב", exact: true }).click();
  await expect(page.locator("[data-board-preview] .tv-frame [data-part-paint]")).toHaveCount(1);

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  let saved = normalizeTvConfig(server.saved());
  const boxes = saved.elements.filter((e) => e.kind === "box");
  expect(boxes.filter((e) => e.paint?.picture === "backdrop:clouds")).toHaveLength(1);
  expect(saved.backgroundImage).toBe(start.backgroundImage ?? null);

  // The whole board's, when asked: the board's own background, the board chosen as it was.
  await target.getByRole("radio", { name: "על רקע הלוח כולו" }).click();
  await page.getByTestId("background-gallery").getByRole("button", { name: "שמיים בערב", exact: true }).click();
  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => normalizeTvConfig(server.saved()).backgroundImage).toBe("backdrop:sky");
  saved = normalizeTvConfig(server.saved());
  expect(saved.elements.filter((e) => e.paint?.picture === "backdrop:clouds")).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("from the board itself: all the boards at once in a background of their own", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1200 });
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_lightminimal")!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("button", { name: "עריכה ישירה בלוח" }).click();
  await page.locator(".tv-frame .tv-root").first().click({ position: { x: 8, y: 8 } });
  const panel = page.getByTestId("board-background");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: /בחירת כל הלוחות/ }).click();
  await expect(panel.getByRole("radio", { name: /החלקים שנבחרו/ })).toBeChecked();
  await panel.getByTestId("board-background-gallery").getByRole("button", { name: "עננים בזהב", exact: true }).click();
  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved());
  const boxes = saved.elements.filter((e) => e.kind === "box");
  expect(boxes.length).toBeGreaterThan(1);
  expect(boxes.every((e) => e.paint?.picture === "backdrop:clouds")).toBe(true);
  expect(saved.backgroundImage).toBe(start.backgroundImage ?? null);
  expect(errors).toEqual([]);
});
