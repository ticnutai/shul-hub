import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";

/**
 * The reminder's example on a connected screen too: the screen chosen beside
 * the example buttons gets it, as a message (an older app shows its text),
 * with the moment and the reminders as the editor has them - unsaved too.
 * Nothing leaves this machine: the screens and their commands answer here.
 */
const SCREEN = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "מסך בית הכנסת",
  approved: true,
  approved_at: "2026-10-01T10:00:00Z",
  created_at: "2026-10-01T10:00:00Z",
  last_boot_at: "2026-10-16T06:00:00Z",
  app_version: "1.40",
  info: {},
};

test("the reminder's example goes to the connected screen chosen, with the editor's own settings", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is for a desktop screen");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1100 });
  await serveEditor(page, structuredClone(DEFAULT_TV_CONFIG));
  const commands: { device_id: string | null; command: string; payload: Record<string, any> }[] = [];
  await page.route("**/rest/v1/tv_devices**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ ...SCREEN, last_seen_at: new Date().toISOString(), state: { app: { version: "1.40", code: 41, silent: true, canInstall: true, ready: null, error: null, result: null } } }]),
    }),
  );
  await page.route("**/rest/v1/tv_commands**", (route) => {
    commands.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
  });
  await page.goto("/e2e/harness/editor.html");
  await page.getByRole("tab", { name: "תוכן", exact: true }).click();
  const settings = page.getByTestId("alerts-settings");
  await settings.scrollIntoViewIfNeeded();

  // Only the preview, until a screen is chosen.
  await settings.getByRole("button", { name: /דוגמת תזכורת על הלוח/ }).click();
  await expect(page.getByText(/מציג איך תיראה התזכורת/)).toBeVisible();
  expect(commands).toHaveLength(0);

  // A change not saved yet goes with it.
  await settings.getByRole("radio", { name: /בשלבים/ }).click();
  await settings.getByLabel("מסך מחובר לדוגמה", { exact: true }).selectOption({ label: "מסך בית הכנסת" });
  await expect(page.getByTestId("alert-example-screen")).toContainText("עם הכיתוב \"דוגמה\"");
  await settings.getByRole("button", { name: /דוגמת תזכורת על הלוח/ }).click();
  await expect.poll(() => commands.length).toBe(1);
  const [sent] = commands;
  expect(sent.device_id).toBe(SCREEN.id);
  expect(sent.command).toBe("message");
  expect(sent.payload.text).toContain("1.40");
  expect(sent.payload.alertDemo.alerts.mode).toBe("staged");
  expect(Date.parse(sent.payload.alertDemo.at)).not.toBeNaN();
  await expect(page.getByText(/נשלחה למסך בית הכנסת/)).toBeVisible();
  expect(errors).toEqual([]);
});
