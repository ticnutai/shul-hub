import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { BUILTIN_DESIGNS, applyDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";

/**
 * The design tab's topics: one at a time by default - a click swaps what is
 * shown, without scrolling down the page - or all down the page, a click
 * scrolling to it. Nothing typed in a topic is lost on the way, the choice
 * is remembered, and a button elsewhere ("עריכה בחלקים") opens its topic.
 */
const TOPICS = [
  ["ערכות", "design-sets"],
  ["רקע", "design-background"],
  ["תיבות", "design-boxes"],
  ["מסגרות", "design-frames"],
  ["טקסט", "design-text"],
  ["חלקים", "design-elements"],
] as const;

test("the design topics: one at a time, or all down the page", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
  // As a gabbai meets it: nothing chosen yet - the page's own default.
  await serveEditor(page, JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit))), { designView: "switch" });
  const res = await page.goto("/e2e/harness/editor.html").catch(() => null);
  test.skip(!res, "the dev server is not running (npm run dev)");
  await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "עיצוב" }).click();
  const topics = page.getByTestId("design-topics");
  const view = page.getByRole("radiogroup", { name: "הצגת הנושאים" });

  // By default one at a time: each topic alone, and the page does not run down to it.
  await expect(view.getByRole("radio", { name: "נושא אחד" })).toHaveAttribute("aria-checked", "true");
  for (const [label, id] of TOPICS) {
    const before = await page.evaluate(() => window.scrollY);
    await topics.getByRole("button", { name: label, exact: true }).click();
    await expect(topics.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-current", "true");
    for (const [, other] of TOPICS) await expect(page.locator(`#${other}`)).toBeVisible({ visible: other === id });
    expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(before + 1);
  }

  // What was typed in one topic waits there while another is shown.
  await topics.getByRole("button", { name: "חלקים", exact: true }).click();
  const add = page.getByTestId("elements-editor").getByTestId("add-content");
  await add.getByLabel("איזה תוכן להוסיף").selectOption("amudYomi");
  await topics.getByRole("button", { name: "רקע", exact: true }).click();
  await topics.getByRole("button", { name: "חלקים", exact: true }).click();
  await expect(add.getByLabel("איזה תוכן להוסיף")).toHaveValue("amudYomi");

  // A button elsewhere opens its topic: "עריכה בחלקים" on a kit, shown from the kits.
  await topics.getByRole("button", { name: "ערכות", exact: true }).click();
  await page.getByRole("button", { name: /^עריכה בחלקים/ }).first().click();
  await expect(page.locator("#design-elements")).toBeVisible();
  await expect(page.locator("#design-sets")).toBeHidden();
  await expect(topics.getByRole("button", { name: "חלקים", exact: true })).toHaveAttribute("aria-current", "true");

  // All down the page: every topic shown, and a click scrolls to it - remembered after a reload.
  await view.getByRole("radio", { name: "הכול ברצף" }).click();
  for (const [, id] of TOPICS) await expect(page.locator(`#${id}`)).toBeVisible();
  await page.reload();
  await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "עיצוב" }).click();
  await expect(view.getByRole("radio", { name: "הכול ברצף" })).toHaveAttribute("aria-checked", "true");
  await topics.getByRole("button", { name: "חלקים", exact: true }).click();
  await expect(page.locator("#design-elements")).toBeInViewport();
  await expect(page.locator("#design-sets")).toBeVisible();
  expect(errors).toEqual([]);
});
