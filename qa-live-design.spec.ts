import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";

async function enable(page: Page) {
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "ערכת נושא" }).click();
  await page.getByRole("menuitem", { name: "עריכת עיצוב בתצוגה חיה" }).click();
  await expect(page.getByRole("dialog", { name: "עורך עיצוב חי" })).toBeVisible();
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
  await expect(page.getByRole("dialog", { name: "עורך עיצוב חי" })).toBeVisible();

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
  await page.getByRole("button", { name: "סגירת בחירה" }).click();
  await expect
    .poll(() => heading.evaluate((node) => getComputedStyle(node).fontSize))
    .toBe(originalSize);

  for (const scope of ["element", "component", "global"] as const) {
    await heading.click();
    await page.getByLabel("גודל גופן").fill("31px");
    await page.getByRole("combobox", { name: "היקף שמירה" }).selectOption(scope);
    await page.getByRole("button", { name: "שמירה", exact: true }).click();
  }
  const savedScopes = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("shul-live-design-overrides-v1") ?? "[]").map(
      (item: { scope: string }) => item.scope,
    ),
  );
  expect(savedScopes).toEqual(["element", "component", "global"]);

  await page.getByRole("button", { name: "ביטול פעולה" }).click();
  await page.getByRole("button", { name: "ביצוע חוזר" }).click();
  await expect.poll(() => heading.evaluate((node) => getComputedStyle(node).fontSize)).toBe("31px");
  await page.reload();
  await expect.poll(() => heading.evaluate((node) => getComputedStyle(node).fontSize)).toBe("31px");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "איפוס הכול" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("shul-live-design-overrides-v1") ?? "[]").length,
      ),
    )
    .toBe(0);
});

test("large editor position and outer size survive reload", async ({ page }) => {
  await page.goto(`${baseUrl}/`);
  await enable(page);
  const editor = page.getByTestId("live-design-editor");
  const initial = await editor.boundingBox();
  expect(initial).not.toBeNull();
  expect(initial!.width).toBeGreaterThanOrEqual(480);
  expect(initial!.height).toBeGreaterThanOrEqual(300);

  await editor.evaluate((node) => {
    (node as HTMLElement).style.width = "620px";
    (node as HTMLElement).style.height = "500px";
  });
  await page.waitForTimeout(200);
  const handle = editor.getByText("עורך עיצוב חי", { exact: true }).locator("..");
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + 80, handleBox!.y + 20);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 160, handleBox!.y + 65, { steps: 5 });
  await page.mouse.up();
  const moved = await editor.boundingBox();
  expect(moved).not.toBeNull();
  expect(moved!.x).toBeGreaterThan(initial!.x + 50);
  expect(moved!.y).toBeGreaterThan(initial!.y + 20);
  await page.reload();
  const restored = await editor.boundingBox();
  expect(restored).not.toBeNull();
  expect(restored!.width).toBeGreaterThanOrEqual(615);
  expect(restored!.height).toBeGreaterThanOrEqual(495);
  expect(restored!.x).toBeGreaterThan(initial!.x + 50);
  expect(restored!.y).toBeGreaterThan(initial!.y + 20);
});

test("mobile color picker stays above the live editor and inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/`);
  await enable(page);

  const target = page.locator("header").getByText("בית הכנסת אושר של יהודי", { exact: true });
  await target.click();

  const editor = page.getByTestId("live-design-editor");
  const editorBox = await editor.boundingBox();
  expect(editorBox).not.toBeNull();
  expect(editorBox!.x).toBeGreaterThanOrEqual(0);
  expect(editorBox!.x + editorBox!.width).toBeLessThanOrEqual(390);
  expect(editorBox!.y + editorBox!.height).toBeLessThanOrEqual(844);
  expect(editorBox!.height).toBeGreaterThanOrEqual(360);

  await editor.getByRole("button", { name: "בחירת צבע טקסט" }).click();
  const picker = page.getByTestId("visual-color-picker");
  await expect(picker).toBeVisible();

  const pickerBox = await picker.boundingBox();
  expect(pickerBox).not.toBeNull();
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

  await picker.getByRole("button", { name: "בחירת הצבע #dc2626" }).click();
  await expect
    .poll(() => target.evaluate((node) => getComputedStyle(node).color))
    .toBe("rgb(220, 38, 38)");
});
