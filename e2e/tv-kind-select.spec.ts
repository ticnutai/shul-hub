import { expect, test } from "@playwright/test";
import { movePanelAside, serveEditor } from "./support/tvEditor";
import { BUILTIN_DESIGNS, applyDesign } from "../src/tv/designs";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "../src/tv/config";

/**
 * All the parts of one kind at once - asked for after a red background: every
 * text another colour, in one go. "כל הטקסטים" chooses them all, the colour
 * is set once, and only the texts change.
 */
test("all the texts chosen at once, and coloured together", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();

  const byKind = page.getByTestId("elements-by-kind");
  const texts = (start.elements as { id: string; kind: string; hidden?: boolean }[]).filter((e) => e.kind === "text" && !e.hidden);
  const all = byKind.getByRole("button", { name: `כל הטקסטים (${texts.length})` });
  await all.scrollIntoViewIfNeeded();
  await all.click();
  await expect(all).toHaveAttribute("aria-pressed", "true");
  const layers = page.getByLabel("שכבות החלקים", { exact: true });
  await expect(layers.getByRole("checkbox", { checked: true })).toHaveCount(texts.length);

  // Shift adds a kind: the frames of pictures join, and the note says their colour is not painted.
  await page.keyboard.down("Shift");
  await byKind.getByRole("button", { name: /^כל התמונות/ }).click();
  await page.keyboard.up("Shift");
  await expect(page.getByTestId("elements-by-kind-note")).toContainText("עשויים מתמונה");
  await all.click();
  await expect(layers.getByRole("checkbox", { checked: true })).toHaveCount(texts.length);
  // The list now shows the texts alone - each with its box - and what each shows is not offered for all of them.
  await expect(page.getByTestId("elements-list-kind")).toContainText("טקסטים בלבד");
  const allTexts = (start.elements as { kind: string }[]).filter((e) => e.kind === "text").length;
  await expect(layers.getByRole("checkbox")).toHaveCount(allTexts);
  await expect(page.getByLabel("מקור התוכן של החלק", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("content-source-one")).toBeVisible();
  // Clear, choose all again, then take one off.
  await page.getByRole("button", { name: "ניקוי הבחירה", exact: true }).click();
  await expect(layers.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await page.getByLabel("בחירת כל החלקים", { exact: true }).check();
  await expect(layers.getByRole("checkbox", { checked: true })).toHaveCount(allTexts);
  const left = (start.elements as { id: string; kind: string; name: string }[]).filter((e) => e.kind === "text").at(-1)!;
  await layers.getByRole("checkbox", { name: `בחירת ${left.name}`, exact: true }).uncheck();
  await expect(layers.getByRole("checkbox", { checked: true })).toHaveCount(allTexts - 1);

  // One colour for them all.
  await page.getByRole("button", { name: "צבע החלק", exact: true }).click();
  await page.getByTestId("color-panel").getByLabel("קוד הצבע", { exact: true }).fill("#c0392b");
  await page.getByLabel("סגירת בחירת הצבע", { exact: true }).click();

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved()).elements;
  for (const t of (start.elements as { id: string; kind: string }[]).filter((e) => e.kind === "text" && e.id !== left.id))
    expect(saved.find((e) => e.id === t.id)!.color).toBe("#c0392b");
  // The one taken off kept its colour.
  expect(saved.find((e) => e.id === left.id)!.color).not.toBe("#c0392b");
  // Nothing but texts took the colour.
  for (const e of saved.filter((x) => x.kind !== "text")) expect(e.color).not.toBe("#c0392b");
  expect(errors).toEqual([]);
});

test("under the preview too: all the texts of the board edited directly, some taken off", async ({ page, isMobile }) => {
  // Asked for where the board is edited directly - not only down in the list of parts.
  test.skip(isMobile, "the editor is for a desktop screen");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
  const start = JSON.parse(JSON.stringify(applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit)));
  const server = await serveEditor(page, start);
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "עיצוב", exact: true }).click();
  await page.getByRole("button", { name: "עריכה ישירה בלוח" }).click();

  const tools = page.getByTestId("preview-kind-tools");
  const textsAll = (start.elements as { id: string; kind: string; name: string; hidden?: boolean }[]).filter((e) => e.kind === "text");
  await tools.getByRole("button", { name: /^כל הטקסטים/ }).click();
  const list = tools.getByTestId("kind-checklist");
  await expect(list.getByRole("checkbox")).toHaveCount(textsAll.length);
  await expect(list.getByRole("checkbox", { checked: true })).toHaveCount(textsAll.filter((e) => !e.hidden).length);
  // The text bar under the preview speaks for all of them.
  await expect(page.getByTestId("preview-text-tools")).toBeVisible();

  // Clear, all again, one taken off.
  await list.getByRole("button", { name: "ניקוי הבחירה", exact: true }).click();
  await expect(list.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await list.getByRole("button", { name: "בחירת כל הטקסטים", exact: true }).click();
  await expect(list.getByRole("checkbox", { checked: true })).toHaveCount(textsAll.length);
  const left = textsAll.at(-1)!;
  await list.getByRole("checkbox", { name: `סימון ${left.name}`, exact: true }).uncheck();

  await page.getByTestId("preview-text-tools").getByRole("button", { name: "צבע הטקסט", exact: true }).click();
  await page.getByTestId("color-panel").getByLabel("קוד הצבע", { exact: true }).fill("#1d6f42");
  await page.getByLabel("סגירת בחירת הצבע", { exact: true }).click();

  await page.getByRole("button", { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved()).elements;
  for (const t of textsAll.filter((e) => e.id !== left.id)) expect(saved.find((e) => e.id === t.id)!.color).toBe("#1d6f42");
  expect(saved.find((e) => e.id === left.id)!.color).not.toBe("#1d6f42");
  for (const e of saved.filter((x) => x.kind !== "text")) expect(e.color).not.toBe("#1d6f42");

  // Closing the list leaves the kinds' buttons.
  await movePanelAside(page);
  await list.getByRole("button", { name: "סגירת הרשימה", exact: true }).click();
  await expect(tools.getByTestId("kind-checklist")).toHaveCount(0);
  expect(errors).toEqual([]);
});
