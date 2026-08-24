import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";

async function enable(page: Page) {
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "ערכת נושא" }).click();
  await page.getByRole("menuitem", { name: "עריכת עיצוב בתצוגה חיה" }).click();
  await expect(page.getByRole("dialog", { name: "עורך עיצוב חי" })).toBeVisible();
}

async function currentThemeOverrides(page: Page) {
  return page.evaluate(() => {
    const theme = localStorage.getItem("beit-knesset-theme") ?? "navy";
    const all = JSON.parse(
      localStorage.getItem("shul-live-design-overrides-by-theme-v2") ?? "{}",
    ) as Record<string, { scope: string }[]>;
    return all[theme] ?? [];
  });
}

test("mode off, blocked clicks, Alt-click, pause and resume follow the interaction contract", async ({
  page,
}) => {
  await page.goto(`${baseUrl}/`);
  await page.getByRole("link", { name: "מודעות", exact: true }).click();
  await expect(page).toHaveURL(/\/announcements$/);
  await page.goto(`${baseUrl}/`);
  await enable(page);
  const announcements = page.getByRole("link", { name: "מודעות", exact: true });
  await announcements.click();
  expect(new URL(page.url()).pathname).toBe("/");
  await announcements.evaluate((node) =>
    node.addEventListener("click", () => {
      sessionStorage.setItem(
        "live-design-alt-clicks",
        String(Number(sessionStorage.getItem("live-design-alt-clicks") ?? "0") + 1),
      );
    }),
  );
  await announcements.click({ modifiers: ["Alt"] });
  await expect.poll(() => new URL(page.url()).pathname).toBe("/announcements");
  expect(await page.evaluate(() => sessionStorage.getItem("live-design-alt-clicks"))).toBe("1");
  await page.getByText("השהיה", { exact: true }).click();
  await page.getByRole("link", { name: "שיעורים", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/shiurim");
  await page.getByRole("button", { name: "המשך בחירה", exact: true }).click();
  const heading = page.getByRole("heading", { name: "שיעורי תורה", exact: true });
  await heading.click();
  await expect(heading).toHaveAttribute("data-live-design-selected", "true");
});

test("live preview, all save scopes, undo, redo and clear persist correctly", async ({ page }) => {
  await page.goto(`${baseUrl}/`);
  await enable(page);
  const heading = page.getByRole("heading", { name: "זמני התפילות", exact: true });
  const originalSize = await heading.evaluate((node) => getComputedStyle(node).fontSize);
  await heading.click();
  await page.getByLabel("גודל גופן").fill("31px");
  await expect.poll(() => heading.evaluate((node) => getComputedStyle(node).fontSize)).toBe("31px");
  await page.keyboard.press("Escape");
  await expect
    .poll(() => heading.evaluate((node) => getComputedStyle(node).fontSize))
    .toBe(originalSize);
  for (const scope of ["element", "component", "global"] as const) {
    await heading.click();
    await page.getByLabel("גודל גופן").fill("31px");
    await page.getByRole("combobox", { name: "היקף שמירה" }).selectOption(scope);
    await page.getByRole("button", { name: "שמירה", exact: true }).click();
  }
  const savedScopes = (await currentThemeOverrides(page)).map((item) => item.scope);
  expect(savedScopes).toEqual(["element", "component", "global"]);
  await page.getByRole("button", { name: "ביטול פעולה" }).click();
  await page.getByRole("button", { name: "ביצוע חוזר" }).click();
  await expect.poll(() => heading.evaluate((node) => getComputedStyle(node).fontSize)).toBe("31px");
  await page.reload();
  await expect.poll(() => heading.evaluate((node) => getComputedStyle(node).fontSize)).toBe("31px");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "איפוס הכול" }).click();
  await expect.poll(() => currentThemeOverrides(page).then((items) => items.length)).toBe(0);
});

test("the live-design entry appears once and overrides stay isolated per theme", async ({
  page,
}) => {
  await page.goto(`${baseUrl}/`);
  await expect(page.getByRole("link", { name: "עריכת עיצוב חיה" })).toHaveCount(0);
  await page.getByRole("button", { name: "ערכת נושא" }).click();
  await expect(page.getByRole("menuitem", { name: "עריכת עיצוב בתצוגה חיה" })).toHaveCount(1);
  await page.getByRole("menuitem", { name: "עריכת עיצוב בתצוגה חיה" }).click();
  await expect(page.getByRole("dialog", { name: "עורך עיצוב חי" })).toBeVisible();

  const heading = page.getByRole("heading", { name: "זמני התפילות", exact: true });
  await heading.click();
  await page.getByLabel("גודל גופן").fill("31px");
  await page.getByRole("button", { name: "שמירה", exact: true }).click();
  await page.getByRole("button", { name: "יציאה ממצב עיצוב" }).click();
  await expect.poll(() => heading.evaluate((node) => getComputedStyle(node).fontSize)).toBe("31px");

  await page.getByRole("button", { name: "ערכת נושא" }).click();
  await page.getByRole("menuitem", { name: "אבן ירושלמית" }).click();
  await expect
    .poll(() => heading.evaluate((node) => getComputedStyle(node).fontSize))
    .not.toBe("31px");

  await page.getByRole("button", { name: "ערכת נושא" }).click();
  await page.getByRole("menuitem", { name: "נייבי וזהב" }).click();
  await expect.poll(() => heading.evaluate((node) => getComputedStyle(node).fontSize)).toBe("31px");
});

test("editor has eight resize handles, persists its layout and closes correctly", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${baseUrl}/`);
  await enable(page);
  const editor = page.getByTestId("live-design-editor");
  await expect(page.locator('[data-testid^="live-design-resize-"]')).toHaveCount(8);
  const initial = await editor.boundingBox();
  expect(initial).not.toBeNull();
  expect(initial!.width).toBeGreaterThanOrEqual(480);
  expect(initial!.height).toBeGreaterThanOrEqual(300);
  const eastBox = await page.getByTestId("live-design-resize-e").boundingBox();
  await page.mouse.move(eastBox!.x + eastBox!.width / 2, eastBox!.y + eastBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(eastBox!.x + 90, eastBox!.y + eastBox!.height / 2, { steps: 5 });
  await page.mouse.up();
  const wider = await editor.boundingBox();
  expect(wider!.width).toBeGreaterThanOrEqual(initial!.width + 45);
  const northBox = await page.getByTestId("live-design-resize-n").boundingBox();
  await page.mouse.move(northBox!.x + northBox!.width / 2, northBox!.y + northBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(northBox!.x + northBox!.width / 2, northBox!.y + 45, { steps: 5 });
  await page.mouse.up();
  const resized = await editor.boundingBox();
  expect(resized!.height).toBeLessThan(wider!.height - 20);
  const handleBox = await editor
    .getByText("עורך עיצוב חי", { exact: true })
    .locator("..")
    .boundingBox();
  await page.mouse.move(handleBox!.x + 80, handleBox!.y + 20);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 150, handleBox!.y + 55, { steps: 5 });
  await page.mouse.up();
  const moved = await editor.boundingBox();
  expect(moved!.x).toBeGreaterThan(resized!.x + 45);
  expect(moved!.y).toBeGreaterThan(resized!.y + 20);
  await page.reload();
  const restored = await editor.boundingBox();
  expect(restored!.width).toBeGreaterThanOrEqual(resized!.width - 5);
  expect(restored!.height).toBeGreaterThanOrEqual(resized!.height - 5);
  expect(restored!.x).toBeGreaterThan(initial!.x + 40);
  await page.getByRole("button", { name: "סגירת עורך העיצוב" }).click();
  await expect(editor).toBeHidden();
  await expect(page).not.toHaveURL(/designMode=1/);
});

test("mobile color picker stays above the editor, floats by drag and closes", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "EyeDropper", {
      configurable: true,
      value: class {
        async open() {
          return { sRGBHex: "#123456" };
        }
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/`);
  await enable(page);
  const target = page.locator("header").getByText("בית הכנסת אושר של יהודי", { exact: true });
  await target.dispatchEvent("pointerdown", { bubbles: true, cancelable: true });
  const editor = page.getByTestId("live-design-editor");
  const editorBox = await editor.boundingBox();
  expect(editorBox!.x).toBeGreaterThanOrEqual(0);
  expect(editorBox!.x + editorBox!.width).toBeLessThanOrEqual(390);
  expect(editorBox!.y + editorBox!.height).toBeLessThanOrEqual(844);
  await editor.getByRole("button", { name: "בחירת צבע טקסט" }).click();
  const picker = page.getByTestId("visual-color-picker");
  await expect(picker).toBeVisible();
  const pickerBox = await picker.boundingBox();
  expect(pickerBox!.x).toBeGreaterThanOrEqual(0);
  expect(pickerBox!.y).toBeGreaterThanOrEqual(0);
  expect(pickerBox!.x + pickerBox!.width).toBeLessThanOrEqual(390);
  expect(pickerBox!.y + pickerBox!.height).toBeLessThanOrEqual(844);
  const layers = await page.evaluate(() => ({
    editor: Number(
      getComputedStyle(document.querySelector('[data-testid="live-design-editor"]')!).zIndex,
    ),
    picker: Number(
      getComputedStyle(document.querySelector('[data-testid="visual-color-picker"]')!).zIndex,
    ),
  }));
  expect(layers.picker).toBeGreaterThan(layers.editor);
  const colorId = page.getByLabel("מזהה צבע עבור צבע טקסט");
  await expect(colorId).toHaveValue(/#[0-9a-f]{6}/i);
  await page.getByRole("button", { name: "דגימת צבע מהמסך עבור צבע טקסט" }).click();
  await expect(colorId).toHaveValue("#123456");
  await expect(page.getByRole("status")).toContainText("#123456");
  const dragBox = await page.getByTestId("visual-color-picker-drag-handle").boundingBox();
  await page.mouse.move(dragBox!.x + dragBox!.width / 2, dragBox!.y + dragBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox!.x + dragBox!.width / 2 + 35, dragBox!.y + 45, { steps: 5 });
  await page.mouse.up();
  const movedPicker = await picker.boundingBox();
  expect(
    Math.abs(movedPicker!.x - pickerBox!.x) + Math.abs(movedPicker!.y - pickerBox!.y),
  ).toBeGreaterThan(30);
  await page.getByRole("button", { name: "סגירת בחירת הצבע" }).click();
  await expect(picker).toBeHidden();
});
