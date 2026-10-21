import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { BUILTIN_DESIGNS, applyDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "../src/tv/config";

/**
 * A live list chosen - the lessons - opens the panel by the board on
 * "התוכן": rows to a page, what happens when they do not fit, how long each
 * page stays, and the way to where its words are written. The panel is sized
 * from its sides and corners, and keeps its size.
 */
test("the lessons' content from the panel: rows, pages and their seconds; the panel resized and kept", async ({ page, isMobile }) => {
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

  // The lessons' list, chosen in the list of parts: the panel opens on its content.
  const lessons = (start.elements as { id: string; binding?: string; name: string }[]).find((e) => e.binding === "lessons")!;
  await page.getByLabel("שכבות החלקים", { exact: true }).getByRole("button", { name: lessons.name, exact: true }).first().click();
  const panel = page.getByTestId("part-context-panel");
  const content = panel.getByTestId("ctx-content");
  await expect(content).toBeVisible();
  await content.getByRole("radio", { name: "30 שניות" }).click();
  await content.getByRole("button", { name: /הגדלת שורות בעמוד/ }).click();
  await expect(content.getByTestId("ctx-source-lessons")).toHaveAttribute("href", "/community/admin?tab=shiurim");
  // The same settings are not offered in the list of parts as well.
  await expect(page.getByTestId("content-in-panel")).toBeVisible();

  // Resized from its corner: it floats where it was, bigger, and is so next time.
  const before = (await panel.boundingBox())!;
  const corner = panel.locator('[data-resize-panel="sw"]');
  const c = (await corner.boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x - 120, c.y + 100, { steps: 6 });
  await page.mouse.up();
  await expect(panel).toHaveAttribute("data-place", "float");
  const after = (await panel.boundingBox())!;
  expect(after.width).toBeGreaterThan(before.width + 60);

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved()).elements.find((e) => e.id === lessons.id)!;
  expect(saved.pageSeconds).toBe(30);
  expect(saved.rowsPerPage).toBe(((start.elements as { id: string; rowsPerPage?: number }[]).find((e) => e.id === lessons.id)!.rowsPerPage ?? 3) + 1);

  await page.reload();
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  await page.getByLabel("שכבות החלקים", { exact: true }).getByRole("button", { name: lessons.name, exact: true }).first().click();
  await expect.poll(async () => Math.round((await page.getByTestId("part-context-panel").boundingBox())!.width)).toBe(Math.round(after.width));
  expect(errors).toEqual([]);
});
