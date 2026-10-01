import { expect, test } from "@playwright/test";
import { rememberShul } from "./support/chooseShul";

/**
 * The Siddur's instructions: gold in the default theme, hidden and shown by
 * the gold dot beside a section's title (and remembered), and the theme
 * editor on a phone showing a change where it can be seen.
 */
test.beforeEach(async ({ page }) => {
  await rememberShul(page);
  await page.setViewportSize({ width: 390, height: 844 });
});

const instructions = (page: import("@playwright/test").Page) => page.locator("p[style*='italic']");

test("instructions are gold, and the dot hides and shows them - and remembers", async ({ page }) => {
  await page.goto("/siddur");
  const dot = page.getByTestId("instructions-toggle").first();
  await expect(dot).toBeVisible({ timeout: 20_000 });
  await expect(instructions(page).first()).toHaveCSS("color", "rgb(161, 122, 40)");
  // Bold, unless a theme says otherwise.
  await expect(instructions(page).first()).toHaveCSS("font-weight", "700");
  await expect(dot).toHaveAttribute("aria-pressed", "true");

  await dot.click();
  await expect(instructions(page)).toHaveCount(0);
  await expect(dot).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(page.getByTestId("instructions-toggle").first()).toHaveAttribute("aria-pressed", "false", { timeout: 20_000 });
  await expect(instructions(page)).toHaveCount(0);

  await page.getByTestId("instructions-toggle").first().click();
  await expect(instructions(page).first()).toBeVisible();
});

test("on a phone the theme editor starts from the theme in use, shows a change, and folds away", async ({ page }) => {
  await page.goto("/siddur");
  await expect(page.getByTestId("instructions-toggle").first()).toBeVisible({ timeout: 20_000 });
  await page.getByTitle("ערכת נושא").first().click();
  const panel = page.locator("[data-siddur-theme-panel]");
  await panel.getByRole("button", { name: "עריכה מותאמת" }).click();
  // The theme in use, not an old separate draft.
  await expect(panel.getByPlaceholder("שם ערכת הנושא")).toHaveValue("חומש זהב");

  const preview = page.getByTestId("theme-mobile-preview");
  await expect(preview).toBeVisible();
  const sample = preview.locator("p.italic");
  await expect(sample).toHaveCSS("color", "rgb(161, 122, 40)");
  // The instruction colour's own text field: change it, and the sample follows at once.
  const instructionField = panel.locator("div").filter({ hasText: /^הוראות \/ רוביקה/ }).locator("input[type='text']").last();
  await instructionField.fill("#cc0000");
  await expect(sample).toHaveCSS("color", "rgb(204, 0, 0)");

  // Bold by default; the theme can make them regular.
  await expect(sample).toHaveCSS("font-weight", "700");
  await panel.getByTestId("theme-instruction-bold").uncheck();
  await expect(sample).toHaveCSS("font-weight", "400");
  await expect(instructions(page).first()).toHaveCSS("font-weight", "400");

  await page.getByTestId("theme-panel-minimize").click();
  await expect(preview).toBeHidden();
  await expect(panel.getByRole("button", { name: "עדכן" })).toBeHidden();
  await page.getByTestId("theme-panel-minimize").click();
  await expect(panel.getByRole("button", { name: "עדכן" })).toBeVisible();
  // Not an administrator here: no button to publish to everyone.
  await expect(panel.getByRole("button", { name: /פרסם לכולם/ })).toHaveCount(0);
});
