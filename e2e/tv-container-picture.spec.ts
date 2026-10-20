import { expect, test, type Page } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { BUILTIN_DESIGNS, applyDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "../src/tv/config";

/**
 * From the panel by the board, in one place: a container with a picture, a
 * box and a text put inside it, the whole of it kept in "החלקים שלי"; and a
 * picture on its own, kept too. The storage answers here.
 */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAIAAAA8r+mnAAAAEUlEQVR4nGM4YKmNFTFQTwIANG0kgXSMqj4AAAAASUVORK5CYII=", "base64");

async function storage(page: Page) {
  let n = 0;
  await page.route("**/storage/v1/**", async (route) => {
    const req = route.request();
    if (req.method() === "GET") return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    n += 1;
    const path = new URL(req.url()).pathname.split("/object/")[1] ?? `community-media/test-${n}.png`;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: path, Id: `id-${n}` }) });
  });
}

test("a container with a picture, things put inside it, kept in my parts; a picture alone kept too", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1200 });
  await storage(page);
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  const row = (name: string) => page.getByTestId("container-row").filter({ has: page.getByRole("checkbox", { name: `בחירת הקונטיינר ${name}`, exact: true }) }).first();

  // Something chosen opens the panel; its "הוספה".
  await row("זמני תפילות").getByTestId("container-name").first().click();
  const panel = page.getByTestId("part-context-panel");
  await panel.getByRole("tab", { name: "הוספה", exact: true }).click();
  await expect(panel.getByTestId("ctx-add-inside")).toContainText("זמני תפילות");

  // A container with a picture, from the panel.
  await panel.getByLabel("העלאת תמונה לקונטיינר חדש", { exact: true }).setInputFiles({ name: "פרוכת.png", mimeType: "image/png", buffer: PNG });
  await expect(panel).toContainText("נבחר: פרוכת");
  await expect(row("פרוכת").getByTestId("container-inside").first().getByRole("checkbox")).toHaveCount(3);
  await expect.poll(() => server.library().items.filter((i) => i.kind === "image").length).toBe(1);

  // Inside it: a box, then a text - each the container's own.
  await panel.getByRole("tab", { name: "הוספה", exact: true }).click();
  await panel.getByRole("button", { name: "תיבה לתוך פרוכת", exact: true }).click();
  await panel.getByRole("tab", { name: "הוספה", exact: true }).click();
  await panel.getByRole("button", { name: "טקסט לתוך פרוכת", exact: true }).click();
  await expect(row("פרוכת").getByTestId("container-inside").first().getByRole("checkbox")).toHaveCount(5);
  // It has a frame already: none offered again.
  await panel.getByRole("tab", { name: "הוספה", exact: true }).click();
  await expect(panel.getByRole("button", { name: "מסגרת לתוך פרוכת", exact: true })).toHaveCount(0);

  // The whole container kept in "החלקים שלי", under its own name.
  await row("פרוכת").getByTestId("container-name").first().click();
  await panel.getByTestId("save-to-parts").click();
  await expect(panel.getByLabel("שם החלק", { exact: true })).toHaveValue("פרוכת");
  await panel.getByRole("button", { name: "שמירה", exact: true }).click();

  // A picture alone, from "התמונות שלי": no board and no frame round it - and kept too.
  await panel.getByRole("tab", { name: "הוספה", exact: true }).click();
  await panel.getByLabel("תמונה מהתמונות שלי לתמונה לבד", { exact: true }).selectOption({ label: "פרוכת" });
  await expect(panel).toContainText("נבחר: פרוכת");
  await panel.getByTestId("save-to-parts").click();
  await panel.getByLabel("שם החלק", { exact: true }).fill("פרוכת לבד");
  await panel.getByRole("button", { name: "שמירה", exact: true }).click();

  const mine = page.getByTestId("part-folders").locator('[data-library-folder="parts-mine"] [data-library-item]');
  await expect(mine).toHaveCount(2);

  // The notices close once the mouse is off them (a mouse resting on one keeps it open, over the save button).
  await page.mouse.move(5, 900);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved());
  const kept = Object.fromEntries(saved.elementLibrary.map((x) => [x.name, x.elements]));
  expect(kept["פרוכת"].map((e) => e.kind).sort()).toEqual(["box", "box", "frame", "image", "text"]);
  expect(kept["פרוכת לבד"].map((e) => e.kind)).toEqual(["image"]);
  expect(saved.elements.length).toBe(start.elements.length + 6);
  expect(errors).toEqual([]);
});

test("a picture standing alone put into a container: it fills it, in its shape, and is its own", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1200 });
  await storage(page);
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  const row = (name: string) => page.getByTestId("container-row").filter({ has: page.getByRole("checkbox", { name: `בחירת הקונטיינר ${name}`, exact: true }) }).first();

  // A picture alone, as the gabbai put one over the board.
  await row("זמני תפילות").getByTestId("container-name").first().click();
  const panel = page.getByTestId("part-context-panel");
  await panel.getByRole("tab", { name: "הוספה", exact: true }).click();
  await panel.getByLabel("העלאת תמונה לתמונה לבד", { exact: true }).setInputFiles({ name: "תפילין.png", mimeType: "image/png", buffer: PNG });
  await expect(panel).toContainText("נבחר: תפילין");

  // Into a container: it fills it and is its own.
  const box = panel.getByTestId("ctx-into-container");
  await box.getByLabel("הכנסה לקונטיינר", { exact: true }).selectOption({ label: "שיעורי תורה" });
  await expect(box.getByRole("button", { name: "התאמה מחדש לקונטיינר", exact: true })).toBeVisible();
  await expect(row("שיעורי תורה").getByTestId("container-inside").first().getByRole("checkbox", { name: "בחירת תפילין", exact: true })).toHaveCount(1);
  // The picture its content now: the words under it hidden, and shown again from here.
  const words = box.getByRole("button", { name: "הצגת מה שהיה בקונטיינר", exact: true });
  await expect(words).toBeVisible();
  await words.click();
  await expect(box.getByRole("button", { name: "הסתרת מה שהיה בקונטיינר", exact: true })).toBeVisible();
  // Its layer, from the same window: to the bottom of its container, then one step up again.
  const layers = panel.getByTestId("ctx-layers");
  await layers.getByRole("button", { name: "לתחתית השכבות - מתחת לכולם", exact: true }).click();
  await layers.getByRole("button", { name: "שכבה למעלה - מעל השכן", exact: true }).click();

  // The notices close once the mouse is off them (a mouse resting on one keeps it open, over the save button).
  await page.mouse.move(5, 900);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved());
  const p = saved.elements.find((e) => e.name === "תפילין")!;
  const lessons = saved.containers.find((c) => c.name === "שיעורי תורה")!;
  expect(p.group).toBe(lessons.id);
  expect(p.fit).toBe("cover");
  expect(saved.elements.filter((e) => e.group === lessons.id && e.id !== p.id && e.kind === "text").every((e) => !e.hidden)).toBe(true);
  const others = saved.elements.filter((e) => e.group === lessons.id && e.id !== p.id);
  // Second of its container's parts: under all of them, then one step up.
  const order = saved.elements.filter((e) => e.group === lessons.id).map((e) => e.id);
  expect(order.indexOf(p.id)).toBe(1);
  const left = Math.min(...others.map((e) => e.x)), right = Math.max(...others.map((e) => e.x + e.width));
  expect(p.x).toBeGreaterThanOrEqual(left - 0.01);
  expect(p.x + p.width).toBeLessThanOrEqual(right + 0.01);
  expect(errors).toEqual([]);
});
