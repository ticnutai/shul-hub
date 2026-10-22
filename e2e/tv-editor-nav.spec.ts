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

test("organized navigation opens each settings topic without duplicate navigation", async ({ page, isMobile }) => {
  await page.setViewportSize(isMobile ? { width: 360, height: 800 } : { width: 1280, height: 1800 });
  await serveEditor(page, JSON.parse(JSON.stringify(DEFAULT_TV_CONFIG)));
  await page.goto("/e2e/harness/editor.html");
  await editorLayout(page, "פריסה מסודרת · נושא אחד");
  const picker = page.getByRole("combobox", { name: "נושא לעריכה", exact: true });
  await picker.click();
  await page.getByRole("option", { name: "עיצוב · רקע", exact: true }).click();
  await expect(page.locator("#design-background")).toBeVisible();
  await expect(page.locator("#design-sets")).toBeHidden();
  await expect(page.getByTestId("design-topics")).toHaveCount(0);
  await picker.click();
  await page.getByRole("option", { name: "תוכן · סרגל הודעה רץ", exact: true }).click();
  await expect(page.locator("#content-ticker")).toBeVisible();
  await expect(page.locator("#content-slideshow")).toBeHidden();
  await picker.click();
  await page.getByRole("option", { name: "כלים · ייבוא וייצוא", exact: true }).click();
  await expect(page.locator("#tools-transfer")).toBeVisible();
  await expect(page.locator("#tools-versions")).toBeHidden();
  await page.reload();
  await expect(page.getByTestId("editor-organized")).toBeVisible();
  await expect(page.getByTestId("save-bar")).toHaveCount(1);
});
