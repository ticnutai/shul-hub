import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { BUILTIN_DESIGNS, applyDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";

/**
 * Content added to a board of parts where the gabbai wants it - a frame of
 * its own, or into a frame already there - in the kit's own look; and the
 * board then kept as a kit of one's own, seen among one's kits.
 */
test("content added where it is wanted, and the board kept as a kit", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
  const server = await serveEditor(page, JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit))));
  const res = await page.goto("/e2e/harness/editor.html").catch(() => null);
  test.skip(!res, "the dev server is not running (npm run dev)");
  await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 30_000 });
  const board = page.locator(".tv-frame").first();
  await page.getByRole("tab", { name: "פריסה" }).click();
  const add = page.getByTestId("parts-content").getByTestId("add-content");

  // The daf yomi into the parasha's frame, under it.
  await add.getByLabel("איזה תוכן להוסיף").selectOption("dafYomi");
  await add.getByRole("radio", { name: /בתוך מסגרת קיימת/ }).check();
  await add.getByLabel("איזו מסגרת").selectOption({ label: "פרשת השבוע (אמצע)" });
  await add.getByRole("button", { name: "הוספה" }).click();
  await expect(board.locator('[data-content-binding="dafYomi"]')).toHaveCount(1);
  // The amud yomi in a frame of its own: the kit's arch, nothing behind its words.
  await add.getByLabel("איזה תוכן להוסיף").selectOption("amudYomi");
  await add.getByRole("radio", { name: /במסגרת חדשה/ }).check();
  await add.getByRole("button", { name: "הוספה" }).click();
  const amud = board.locator('[data-content-binding="amudYomi"]');
  await expect(amud).toHaveCount(1);
  const behind = await amud.evaluate((el) => getComputedStyle(el.closest("[data-element-id]")!).backgroundColor);
  expect(behind).toBe("rgba(0, 0, 0, 0)");
  // Swapped with the parasha: the amud in the middle's wide frame, the parasha in the arch.
  const parts = page.getByTestId("parts-content");
  await parts.getByLabel("להחליף תוכן של עמוד יומי עם").selectOption({ label: "פרשת השבוע" });
  const middle = (await board.locator('[data-content-binding="amudYomi"]').boundingBox())!;
  const frame = (await board.boundingBox())!;
  expect(Math.abs(middle.x + middle.width / 2 - (frame.x + frame.width / 2))).toBeLessThan(frame.width * 0.05);
  expect(middle.width).toBeGreaterThan(frame.width * 0.3);

  // Kept as a kit of one's own.
  await page.getByTestId("parts-save-kit").click();
  await page.getByLabel("שם הערכה החדשה").fill("אבן ירושלים - שלי");
  await page.getByTestId("parts-kit-form").getByRole("button", { name: "שמירת הערכה" }).click();
  await page.getByRole("tab", { name: "עיצוב" }).click();
  const mine = page.getByText("אבן ירושלים - שלי", { exact: true });
  await mine.scrollIntoViewIfNeeded();
  await expect(mine).toBeVisible();
  await expect(page.getByTestId("kit-thumb").first()).toBeVisible();
  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = server.saved() as { designs: { name: string; parts: string[]; values: { screenLayout?: string; elements?: { binding?: string }[] } }[] };
  const own = saved.designs.find((d) => d.name === "אבן ירושלים - שלי")!;
  expect(own.parts).toContain("layout");
  expect(own.values.screenLayout).toBe("composition");
  expect(own.values.elements!.some((e) => e.binding === "dafYomi")).toBe(true);
  expect(errors).toEqual([]);
});
