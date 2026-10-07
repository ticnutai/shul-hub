import { expect, test } from "@playwright/test";
import { expectNotFrozen, serveEditor, pickColour } from "./support/tvEditor";

/**
 * Backgrounds in one place: a colour, a gradient and a picture were three
 * screens; now they are one gallery - the ready-made ones and the shul's own -
 * with what is on the board edited under it, a picture with a colour or a
 * gradient over it, and whatever is on kept back into the gallery.
 */
const HARNESS = "/e2e/harness/editor.html";

test("a picture with a layer over it, kept in the gallery, changed, and removed from it", async ({ page }) => {
  await serveEditor(page);
  const res = await page.goto(HARNESS).catch(() => null);
  test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
  const root = page.locator(".tv-frame .tv-root").first();
  await expect(root).toBeVisible({ timeout: 20_000 });

  const gallery = page.getByTestId("background-gallery");
  await gallery.scrollIntoViewIfNeeded();
  // One gallery: colours, gradients and pictures, each filter showing its own.
  const tile = (name: string) => gallery.getByRole("button", { name, exact: true });
  for (const [filter, has, hasNot] of [
    ["צבעים", "כחול לילה", "לילה כחול"],
    ["מעברי צבע", "לילה כחול", "שמיים בערב"],
    ["תמונות", "שמיים בערב", "כחול לילה"],
  ] as const) {
    await gallery.getByRole("button", { name: filter, exact: true }).click();
    await expect(tile(has)).toBeVisible();
    await expect(tile(hasNot)).toHaveCount(0);
  }
  await gallery.getByRole("button", { name: "הכול", exact: true }).click();

  // A ready picture with a gradient over it.
  await gallery.getByRole("button", { name: "שמיים בערב", exact: true }).click();
  await expect(root).toHaveClass(/has-bg-image/);
  await expect(root).toHaveClass(/has-bg-overlay/);
  await expect(gallery.getByRole("button", { name: "שמיים בערב", exact: true })).toHaveAttribute("aria-pressed", "true");

  // Its layer made a colour of its own: the board follows, and offers to keep it.
  const layer = page.getByTestId("picture-layer");
  await layer.getByRole("radio", { name: "צבע", exact: true }).click();
  await pickColour(layer, "צבע השכבה", "#7a1020");
  await expect.poll(() => root.evaluate((el) => getComputedStyle(el).getPropertyValue("--tv-bg-overlay").trim())).toBe("#7a1020");
  const keep = page.getByTestId("background-keep");
  await expect(keep).toContainText("לא שמור בגלריה");
  await keep.getByLabel("שם לרקע בגלריה").fill("שמיים בבורדו");
  await keep.getByRole("button", { name: "שמירה כרקע חדש" }).click();
  await expect(keep).toHaveCount(0);

  await gallery.getByRole("button", { name: /^שלי/ }).click();
  const mine = gallery.getByRole("button", { name: "שמיים בבורדו", exact: true });
  await expect(mine).toHaveAttribute("aria-pressed", "true");

  // Changed after it was kept: it can be written back into it.
  await layer.getByLabel("עוצמת השכבה").fill("0.3");
  await expect(keep).toContainText('שונה מ"שמיים בבורדו"');
  await keep.getByRole("button", { name: 'עדכון "שמיים בבורדו"' }).click();
  await expect(keep).toHaveCount(0);

  // Removed from the gallery: the board keeps wearing it.
  await gallery.getByRole("button", { name: "מחיקת שמיים בבורדו" }).click();
  await expect(mine).toHaveCount(0);
  await expect(root).toHaveClass(/has-bg-overlay/);
  await expectNotFrozen(page, "backgrounds");
});

test("whatever can be added can be removed: a ready background and a ready design hidden and brought back, a design copied", async ({
  page,
}) => {
  await serveEditor(page);
  const res = await page.goto(HARNESS).catch(() => null);
  test.skip(!res || res.status() >= 400, "the editor harness is served by the dev server");
  await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 20_000 });

  // A ready background: hidden from the list, not lost - and back.
  const gallery = page.getByTestId("background-gallery");
  await gallery.getByRole("button", { name: "הסתרת שחר", exact: true }).click();
  await expect(gallery.getByRole("button", { name: "שחר", exact: true })).toHaveCount(0);
  const shelf = page.getByTestId("background-hidden");
  await shelf.locator("summary").click();
  await shelf.getByRole("button", { name: "החזרת שחר" }).click();
  await expect(gallery.getByRole("button", { name: "שחר", exact: true })).toBeVisible();

  // A ready design: hidden and brought back, and copied into one's own to edit.
  const designs = page.getByTestId("builtin-designs");
  await designs.getByRole("button", { name: "הסתרת לוחות הברית מאבן" }).click();
  await expect(designs.getByText("לוחות הברית מאבן")).toHaveCount(0);
  const designShelf = page.getByTestId("designs-hidden");
  await designShelf.locator("summary").click();
  await designShelf.getByRole("button", { name: "החזרת לוחות הברית מאבן" }).click();
  await expect(designs.getByText("לוחות הברית מאבן")).toBeVisible();
  await designs.locator("div", { hasText: "וילון כחול וזהב" }).getByRole("button", { name: "שכפול לעריכה" }).first().click();
  await expect(page.getByTestId("design-library").getByText("וילון כחול וזהב (שלי)")).toBeVisible();
  await expectNotFrozen(page, "ready items");
});
