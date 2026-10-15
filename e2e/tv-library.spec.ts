import { expect, test, type Page } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";
import { normalizeLibrary } from "../src/tv/library";
import { READY_PARTS } from "../src/tv/readyParts";

/**
 * The kits in folders: by topic and the gabbai's own, opened and closed (and
 * remembered), searched, tagged, starred, and moved - dragged with a label
 * saying what goes where, by the menu under a kit, or several together.
 */
async function open(page: Page, folders: string[]) {
  // As a gabbai meets it: only these folders open.
  await page.addInitScript((f) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("tv-library-open:kits", JSON.stringify(f)); sessionStorage.setItem("seeded", "1"); } }, folders);
  await page.setViewportSize({ width: 1600, height: 1100 });
  const server = await serveEditor(page, JSON.parse(JSON.stringify(DEFAULT_TV_CONFIG)), { designView: "switch" });
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  const lib = page.getByTestId("kit-folders");
  await lib.scrollIntoViewIfNeeded();
  return { server, lib };
}
const folder = (page: Page, id: string) => page.locator(`[data-library-folder="${id}"]`);
const kit = (page: Page, folderId: string, kitId: string) => folder(page, folderId).locator(`[data-library-item="${kitId}"]`);
const MOON = "d_premium_rc_night-moon";

test("folders: closed and opened, remembered; a search across them", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  const { lib } = await open(page, ["mine"]);
  // Closed: its name and count, no kits.
  const rc = folder(page, "topic:ראש חודש");
  await expect(rc.getByRole("button", { name: "פתיחת התיקייה ראש חודש" })).toBeVisible();
  await expect(rc.locator("[data-library-item]")).toHaveCount(0);
  await rc.getByRole("button", { name: "פתיחת התיקייה ראש חודש" }).click();
  await expect(rc.locator(`[data-library-item="${MOON}"]`)).toBeVisible();
  // Remembered on this computer.
  await page.reload();
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  await expect(folder(page, "topic:ראש חודש").locator(`[data-library-item="${MOON}"]`)).toBeVisible();
  await lib.getByRole("button", { name: "סגירת הכול", exact: true }).click();
  await expect(lib.locator("[data-library-item]")).toHaveCount(0);
  // A search finds through closed folders, and shows only the folders with what it found.
  await lib.getByLabel("חיפוש ערכה", { exact: true }).fill("לבנה בשמי לילה");
  await expect(lib.locator(`[data-library-item="${MOON}"]`)).toBeVisible();
  await expect(lib.locator("[data-library-folder]")).toHaveCount(1);
  await lib.getByLabel("חיפוש ערכה", { exact: true }).fill("אין ערכה כזו");
  await expect(lib.getByText("לא נמצאו ערכות", { exact: false })).toBeVisible();
});

test("a folder of one's own: kits dragged into it with a label, moved by the menu and several together; starred, tagged; deleted", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { server, lib } = await open(page, ["mine", "topic:ראש חודש"]);

  // A new folder.
  await lib.getByRole("button", { name: "תיקייה חדשה", exact: true }).click();
  await page.getByLabel("שם התיקייה", { exact: true }).fill("ראשי חודשים שלי");
  await page.getByRole("button", { name: "יצירה", exact: true }).click();
  const mineFolder = page.locator("[data-library-folder^='f_']").first();
  await expect(mineFolder).toContainText("ראשי חודשים שלי");
  const ownId = (await mineFolder.getAttribute("data-library-folder"))!;

  // Dragged there: a label follows the hand, saying what goes where.
  const tile = kit(page, "topic:ראש חודש", MOON);
  // Both in sight: the folder, and the kit under it (the shared and one's own folders, closed, between them).
  await page.setViewportSize({ width: 1600, height: 2000 });
  for (const f of ["mine", "shared"]) {
    const close = folder(page, f).getByRole("button", { name: /^סגירת התיקייה/ });
    if (await close.count()) await close.click();
  }
  await mineFolder.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const from = (await tile.boundingBox())!, to = (await mineFolder.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await expect(page.getByTestId("library-drag-label")).toContainText('אל "ראשי חודשים שלי"');
  await page.mouse.up();
  await expect(kit(page, ownId, MOON)).toBeVisible();
  await expect(kit(page, "topic:ראש חודש", MOON)).toHaveCount(0);

  // By the menu under a kit - the way on a phone.
  const twilight = "d_premium_rc_twilight";
  await kit(page, "topic:ראש חודש", twilight).getByLabel(/^העברת .* לתיקייה$/).selectOption({ label: "ראשי חודשים שלי" });
  await expect(kit(page, ownId, twilight)).toBeVisible();

  // Several together.
  await lib.getByRole("button", { name: "בחירה מרובה", exact: true }).click();
  for (const id of ["d_premium_rc_great-moon", "d_premium_rc_teal-dawn"]) await kit(page, "topic:ראש חודש", id).getByRole("checkbox").check();
  await page.getByLabel("העברת הנבחרות לתיקייה", { exact: true }).selectOption({ label: "ראשי חודשים שלי" });
  await expect(folder(page, ownId).locator("[data-library-item]")).toHaveCount(4);
  await lib.getByRole("button", { name: "בחירה מרובה", exact: true }).click();

  // Starred: first of all; tagged, and the tag filters.
  await kit(page, ownId, MOON).getByRole("button", { name: /^הוספה למועדפים/ }).click();
  await expect(kit(page, "favorites", MOON)).toBeVisible();
  await kit(page, ownId, twilight).getByRole("button", { name: /^הוספת תגית ל/ }).click();
  await page.getByLabel(/^תגית חדשה ל/).fill("כחול");
  await page.getByLabel(/^תגית חדשה ל/).press("Enter");
  await lib.getByRole("group", { name: "סינון לפי תגית" }).getByRole("button", { name: "כחול", exact: true }).click();
  await expect(lib.locator("[data-library-item]")).toHaveCount(1);
  await lib.getByRole("group", { name: "סינון לפי תגית" }).getByRole("button", { name: "כחול", exact: true }).click();

  // Kept at once, as the gabbai's own order - the same on every board they edit, without "שמור ושדר".
  await expect.poll(() => normalizeLibrary(server.library().order).favorites).toEqual([MOON]);
  expect(server.writes()).toBe(0);
  const saved = normalizeLibrary(server.library().order);
  expect(saved.folders.map((f) => f.name)).toEqual(["ראשי חודשים שלי"]);
  expect(saved.place[MOON]).toBe(ownId);
  expect(saved.favorites).toEqual([MOON]);
  expect(saved.tags[twilight]).toEqual(["כחול"]);

  // The folder deleted: its kits go back to their topic, none deleted.
  await folder(page, ownId).getByRole("button", { name: "מחיקת התיקייה ראשי חודשים שלי" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "מחיקת התיקייה" }).click();
  await expect(kit(page, "topic:ראש חודש", MOON)).toBeVisible();
  await expect(kit(page, "topic:ראש חודש", twilight)).toBeVisible();
  expect(errors).toEqual([]);
});

test("the parts in the same folders: a ready part moved, a part of the shared collection starred and put in a folder", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1300 });
  const server = await serveEditor(page, JSON.parse(JSON.stringify({ ...DEFAULT_TV_CONFIG, library: { folders: [{ id: "f_gold", name: "זהב" }], place: {}, tags: {}, favorites: [] } })), { designView: "switch" });
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  await page.getByTestId("design-topics").getByRole("button", { name: "חלקים", exact: true }).click();
  const parts = page.getByTestId("part-folders");
  await parts.scrollIntoViewIfNeeded();
  // The gabbai's folder is the kits' and the parts' alike.
  await expect(parts.locator('[data-library-folder="f_gold"]')).toBeVisible();

  // A ready part of a kit, put in it by the menu.
  const ready = parts.locator('[data-library-folder="parts-ready"] [data-library-item]').first();
  const readyId = (await ready.getAttribute("data-library-item"))!;
  await ready.getByLabel(/^העברת .* לתיקייה$/).selectOption({ label: "זהב" });
  await expect(parts.locator(`[data-library-folder="f_gold"] [data-library-item="${readyId}"]`)).toBeVisible();

  // A part of the shared collection: starred, and put in the folder - then it stands among the parts.
  const shared = page.getByTestId("shared-catalog-parts");
  await shared.scrollIntoViewIfNeeded();
  await expect(shared.getByTestId("shared-count")).toBeVisible({ timeout: 20_000 });
  const first = shared.getByLabel(/^העברת .* לתיקייה$/).first();
  const partName = ((await first.getAttribute("aria-label"))!).replace(/^העברת /, "").replace(/ לתיקייה$/, "");
  await first.selectOption({ label: "זהב" });
  await shared.getByRole("button", { name: `הוספה למועדפים ${partName}`, exact: true }).click();
  await parts.scrollIntoViewIfNeeded();
  await expect(parts.locator('[data-library-folder="f_gold"] [data-library-item^="catalog:"]')).toHaveCount(1);
  await expect(parts.locator('[data-library-folder="favorites"] [data-library-item^="catalog:"]')).toHaveCount(1);

  await expect.poll(() => normalizeLibrary(server.library().order).favorites.length).toBe(1);
  const lib = normalizeLibrary(server.library().order);
  expect(lib.place[readyId]).toBe("f_gold");
  expect(Object.entries(lib.place).filter(([k, v]) => k.startsWith("catalog:") && v === "f_gold")).toHaveLength(1);
  expect(lib.favorites.filter((f) => f.startsWith("catalog:"))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("kept for every board: a kit and a part of one's own shared, worn from the shared folder, taken out again", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1300 });
  const own = { ...structuredClone(READY_PARTS[0]), id: "own_columns", name: "העמודים שלי" };
  const kit = { id: "d_mineblue", name: "הכחול שלי", parts: ["background"], theme: "navy", colours: {}, values: { backgroundGradient: "linear-gradient(#123, #456)" } };
  const server = await serveEditor(page, JSON.parse(JSON.stringify({ ...DEFAULT_TV_CONFIG, designs: [kit], elementLibrary: [own] })), { designView: "switch" });
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();

  // The kit of one's own, shared: in the shared folder, for every board.
  const kits = page.getByTestId("kit-folders");
  await kits.scrollIntoViewIfNeeded();
  await kits.locator('[data-library-folder="mine"] [data-design-id="d_mineblue"]').getByRole("button", { name: "שיתוף לכל הלוחות" }).click();
  await expect.poll(() => server.library().items.length).toBe(1);
  const sharedKit = kits.locator('[data-library-folder="shared"] [data-design-id="d_mineblue"]');
  await expect(sharedKit).toBeVisible();
  expect(server.library().items[0]).toMatchObject({ kind: "kit", name: "הכחול שלי" });
  // Worn from there.
  await sharedKit.getByRole("button", { name: /^החלת ערכה הכחול שלי/ }).click();
  await expect(page.locator(".tv-frame .tv-root").first()).toHaveClass(/has-bg-gradient/);

  // The part of one's own, shared too.
  await page.getByTestId("design-topics").getByRole("button", { name: "חלקים", exact: true }).click();
  const parts = page.getByTestId("part-folders");
  await parts.scrollIntoViewIfNeeded();
  await parts.locator('[data-library-folder="parts-mine"] [data-library-item="part:own_columns"]').getByRole("button", { name: "שיתוף לכל הלוחות" }).click();
  await expect.poll(() => server.library().items.length).toBe(2);
  await expect(parts.locator('[data-library-folder="parts-shared"] [data-library-item^="lib:"]')).toHaveCount(1);
  await parts.getByRole("button", { name: "הוספת העמודים שלי מהספרייה המשותפת" }).click();

  // Taken out of the library, after asking.
  await page.getByTestId("design-topics").getByRole("button", { name: "ערכות", exact: true }).click();
  await sharedKit.getByRole("button", { name: /^הסרת|^מחיקת|^הוצאת/ }).first().click();
  await page.getByRole("alertdialog").getByRole("button", { name: "הוצאה מהספרייה" }).click();
  await expect.poll(() => server.library().items.length).toBe(1);
  await expect(sharedKit).toHaveCount(0);
  expect(errors).toEqual([]);
});
