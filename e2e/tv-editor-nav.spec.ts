import { expect, test } from "@playwright/test";
import { editorLayout, serveEditor } from "./support/tvEditor";
import { BUILTIN_DESIGNS, applyDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";

/**
 * Around the board editor three ways, chosen in its one menu "פריסה ותצוגה":
 * the tabs, a menu of all of it down the side, or a search - one at a time,
 * never the row of tabs as well.
 */
test("the editor gone around by a menu of all of it, and by a search", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
  await serveEditor(page, JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit))));
  await page.goto("/e2e/harness/editor.html");
  const tabs = page.getByRole("tablist").filter({ has: page.getByRole("tab", { name: "מועדים", exact: true }) });
  await expect(tabs).toBeVisible();

  // The menu: the row of tabs and of topics gone; a tab and a section in it from the menu.
  await editorLayout(page, "תפריט נושאים בצד");
  const menu = page.getByTestId("editor-menu");
  await expect(menu).toBeVisible();
  await expect(tabs).toBeHidden();
  await expect(page.getByTestId("design-topics")).toHaveCount(0);
  await menu.getByRole("button", { name: "רקע", exact: true }).click();
  await expect(page.locator("#design-background")).toBeInViewport();
  await expect(menu.getByRole("button", { name: "רקע", exact: true })).toHaveAttribute("aria-current", "true");
  await menu.getByRole("button", { name: "כלים", exact: true }).click();
  await expect(menu.getByRole("button", { name: "כלים", exact: true })).toHaveAttribute("aria-current", "true");
  await menu.getByRole("button", { name: "ייבוא וייצוא", exact: true }).click();
  await expect(page.locator("#tools-transfer")).toBeInViewport();

  // The search: a word finds the section, and where one is stands above.
  await editorLayout(page, "חיפוש");
  await expect(menu).toHaveCount(0);
  const box = page.getByLabel("מה לשנות בלוח?", { exact: true });
  await box.fill("גופן");
  await page.getByTestId("editor-search-results").getByRole("button", { name: /^טקסט/ }).click();
  await expect(page.getByTestId("editor-where")).toContainText("עיצוב › טקסט");
  await box.fill("שבת");
  await box.press("Enter");
  await expect(page.locator("#occasions")).toBeVisible();

  // Back to the tabs, as it was.
  await editorLayout(page, "לשוניות");
  await expect(tabs).toBeVisible();
  await expect(page.getByTestId("editor-search")).toHaveCount(0);
  expect(errors).toEqual([]);
});
