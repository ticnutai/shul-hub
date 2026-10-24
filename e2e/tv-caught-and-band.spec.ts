import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { applyDesign } from "../src/tv/designs";
import { ROOM_DESIGNS } from "../src/tv/roomDesigns";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";

/**
 * "נבחר" opens the list of every part caught - those chosen and their
 * container's - and one is chosen alone from it. And a box drawn with the
 * mouse from the main background chooses every part it touches, as files are
 * chosen on a desktop.
 */
test("the parts caught listed under 'נבחר', and a box drawn to choose several", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  const kit = ROOM_DESIGNS.find((d) => d.id === "d_room_woodarches")!;
  await serveEditor(page, JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit))));
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("button", { name: /עריכה ישירה בלוח/ }).first().click();

  // A container chosen on the board: its parts caught.
  const board = page.locator('[data-board-preview] [data-edit-board], [data-board-preview] .tv-frame').first();
  const prayers = page.locator('[data-board-preview] [data-content-binding="prayers"]').first();
  await prayers.click();
  const panel = page.getByTestId("part-context-panel");
  await expect(panel).toBeVisible();
  // Opened by itself, the choice made on the board.
  const list = page.getByTestId("ctx-caught-list");
  await expect(list).toBeVisible();
  await expect(list).toBeInViewport({ ratio: 0.9 });
  const names = await list.getByRole("option").allTextContents();
  expect(names.length).toBeGreaterThanOrEqual(3);
  expect(names.some((n) => n.includes("מסגרת זמני תפילות"))).toBe(true);
  // One of them alone.
  await list.getByRole("option").filter({ hasText: "מסגרת זמני תפילות" }).click();
  await expect(list).toHaveCount(0);
  // Not opened again by the choice made in it; the button opens it.
  await page.waitForTimeout(300);
  await expect(list).toHaveCount(0);
  // Chosen alone: marked so in the list (the panel's title stays its container's name).
  await panel.getByTestId("ctx-caught-toggle").click();
  await expect(page.getByTestId("ctx-caught-list").getByRole("option", { selected: true })).toContainText("מסגרת זמני תפילות");
  await panel.getByTestId("ctx-caught-toggle").click();

  // A box drawn on the floor of the room (the main background), over the three wooden panels.
  await page.keyboard.press("Escape");
  const frame = (await page.locator("[data-board-preview] .tv-frame").first().boundingBox())!;
  const at = (x: number, y: number) => [frame.x + frame.width * x, frame.y + frame.height * y] as const;
  const [x0, y0] = at(0.08, 0.95), [x1, y1] = at(0.92, 0.66);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 5 });
  await expect(page.getByTestId("selection-band")).toBeVisible();
  await page.mouse.move(x1, y1, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId("selection-band")).toHaveCount(0);
  await expect(page.getByTestId("ctx-caught-list")).toBeVisible();
  const picked = await page.getByTestId("ctx-caught-list").getByRole("option").allTextContents();
  // The three panels under the arches (parasha, notices, daf yomi) - each with its board and frame.
  for (const n of ["פרשת השבוע", "הודעות", "דף יומי"]) expect(picked.some((p) => p.includes(n)), n).toBe(true);
  void board;
  expect(errors).toEqual([]);
});
