import { expect, test, type Page } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { BUILTIN_DESIGNS, applyDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "../src/tv/config";

/**
 * Pictures of one's own: uploaded into a container (taking its place under
 * its frame), as a new container with a picture, kept in "התמונות שלי" and
 * put on the board again from there; cut to a shape, filling it or whole,
 * and keeping their proportions. Nothing leaves this machine: the storage
 * answers here, with a small picture.
 */
// An 8×4 picture (wider than tall), red.
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

test("pictures: into a container, a container with a picture, kept and put on again; shaped, filling, in proportion", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1300 });
  await storage(page);
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  const layers = page.getByTestId("container-layers");
  await layers.scrollIntoViewIfNeeded();
  const row = (name: string) => page.getByTestId("container-row").filter({ has: page.getByRole("checkbox", { name: `בחירת הקונטיינר ${name}`, exact: true }) }).first();

  // Into a container: uploaded, in it, and kept in "התמונות שלי".
  const prayers = row("זמני תפילות");
  const before = await prayers.getByTestId("container-inside").first().getByRole("checkbox").count();
  await prayers.getByLabel("העלאת תמונה לתוך זמני תפילות", { exact: true }).setInputFiles({ name: "בית הכנסת.png", mimeType: "image/png", buffer: PNG });
  await expect(prayers.getByTestId("container-inside").first().getByRole("checkbox")).toHaveCount(before + 1);
  await expect.poll(() => server.library().items.filter((i) => i.kind === "image").length).toBe(1);

  // The picture's own tools: a shape, filling it, its proportions.
  const tools = page.getByTestId("own-image-tools");
  await expect(tools).toBeVisible();
  await tools.getByLabel("צורת התמונה", { exact: true }).selectOption({ label: "כיפה" });
  const preview = page.locator("[data-board-preview] .tv-frame").first();
  await expect(preview.locator('[data-geometric-shape="dome"] img')).toHaveCount(1);
  await tools.getByRole("radio", { name: "מילוי התבנית" }).click();
  await expect(preview.locator('[data-geometric-shape="dome"] img')).toHaveCSS("object-fit", "cover");
  await tools.getByRole("switch", { name: "שמירת יחס" }).click();
  const width = page.getByRole("spinbutton", { name: "רוחב החלק", exact: true });
  const height = page.getByRole("spinbutton", { name: "גובה החלק", exact: true });
  const [w0, h0] = [parseFloat(await width.inputValue()), parseFloat(await height.inputValue())];
  await width.fill(String(Math.round(w0 / 2)));
  await width.press("Enter");
  await expect.poll(async () => Math.abs(parseFloat(await height.inputValue()) - h0 * Math.round(w0 / 2) / w0)).toBeLessThan(0.2);

  // A new container with a picture: a board, the picture, a frame.
  await layers.getByLabel("העלאת תמונה לקונטיינר חדש", { exact: true }).setInputFiles({ name: "פרוכת.png", mimeType: "image/png", buffer: PNG });
  await expect(row("פרוכת").getByTestId("container-inside").first().getByRole("checkbox")).toHaveCount(3);
  await expect.poll(() => server.library().items.filter((i) => i.kind === "image").length).toBe(2);

  // Kept: in "התמונות שלי", and put on the board again from there.
  const parts = page.getByTestId("part-folders");
  await parts.scrollIntoViewIfNeeded();
  const mine = parts.locator('[data-library-folder="parts-images"] [data-library-item]');
  await expect(mine).toHaveCount(2);
  const count = start.elements.length;
  await parts.getByRole("button", { name: "הוספת התמונה בית הכנסת" }).click();

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved()).elements;
  const pictures = saved.filter((e) => e.kind === "image" && e.image.includes("community-media"));
  expect(pictures).toHaveLength(3);
  expect(pictures.some((e) => e.shape === "dome" && e.fit === "cover" && e.ratio)).toBe(true);
  expect(saved.length).toBe(count + 5);
  expect(errors).toEqual([]);
});
