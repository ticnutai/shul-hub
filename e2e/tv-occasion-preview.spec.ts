import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";
import { readOccasions } from "../src/tv/occasions";

/**
 * Under the board, one button for every occasion: Shabbat, a festival, Rosh
 * Chodesh - each on its next day, as the screens will show it - and back to
 * the real day. The button says which is shown.
 */
test("any occasion previewed from one button under the board", async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (!isMobile) await page.setViewportSize({ width: 1600, height: 1000 });
  const start = JSON.parse(JSON.stringify(DEFAULT_TV_CONFIG));
  await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");

  const menu = page.getByTestId("occasion-preview-menu");
  await expect(menu).toContainText("מועד");
  const other = readOccasions(start).find((o) => o.id !== "shabbat" && o.enabled)!;
  await menu.click();
  await page.getByRole("menuitemradio", { name: `תצוגת ${other.name}` }).click();
  await expect(menu).toContainText(other.name);
  await expect(page.getByRole("button", { name: /חזרה לזמן אמת/ })).toBeVisible();

  await menu.click();
  await page.getByRole("menuitemradio", { name: "תצוגת מסך שבת" }).click();
  await expect(menu).toContainText("שבת");

  await menu.click();
  await page.getByRole("menuitemradio", { name: "היום - זמן אמת" }).click();
  await expect(menu).toContainText("מועד");
  await expect(page.getByRole("button", { name: /חזרה לזמן אמת/ })).toHaveCount(0);

  // The round ⚙ beside an occasion: straight to editing it - its day, its screen, its design.
  await menu.click();
  await page.getByTestId(`occasion-edit-${other.id}`).click();
  await expect(page.getByTestId("occasion-design-banner")).toBeVisible();
  await expect(page.getByTestId("occasion-design-banner")).toContainText(other.name);
  await expect(menu).toContainText(other.name);
  expect(errors).toEqual([]);
});
