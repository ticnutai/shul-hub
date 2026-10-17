import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { DEFAULT_TV_CONFIG } from "../src/tv/config";

/**
 * The reminder's simulation: the board's preview run up to a time through its
 * steps - played, jumped to a step, ended - and sent to the connected screen
 * chosen, as a message (an older app shows its text), from where it stands,
 * at its speed, with the reminders as the editor has them - unsaved too.
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

test("the reminder's simulation on the preview, and on the connected screen chosen", async ({ page, isMobile }) => {
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
  const simulation = page.getByTestId("alert-simulation");
  await simulation.scrollIntoViewIfNeeded();

  // A step jumped to: the card on the preview, and what is on the board said beside the preview.
  await simulation.getByRole("button", { name: "5 דקות לפני: כרטיס קופץ", exact: true }).click();
  await expect(page.locator("[data-board-preview] .tv-alert-card").first()).toBeVisible();
  await expect(page.getByTestId("simulation-status")).toContainText("כרטיס קופץ");
  await expect(page.getByTestId("simulation-readout")).toContainText("נשארו 4:5");

  // Played: the clock runs.
  await simulation.getByRole("button", { name: "המשך ההדמיה" }).click();
  const readout = await page.getByTestId("simulation-readout").textContent();
  await expect(page.getByTestId("simulation-readout")).not.toHaveText(readout!);
  await simulation.getByRole("button", { name: "השהיית ההדמיה" }).click();

  // Ended: the real time, nothing left on the board.
  await simulation.getByRole("button", { name: "סיום - חזרה לזמן אמת" }).click();
  await expect(page.getByTestId("simulation-status")).toHaveCount(0);
  await expect(page.locator("[data-board-preview] .tv-alert-card")).toHaveCount(0);
  expect(commands).toHaveLength(0);

  // A change not saved yet goes to the screen with it, at the speed chosen.
  await page.getByTestId("alerts-settings").getByRole("radio", { name: /בשלבים/ }).click();
  await simulation.getByRole("radio", { name: "פי 60" }).click();
  await simulation.getByRole("button", { name: "10 דקות לפני: ספירה על כל הלוח", exact: true }).click();
  await simulation.getByLabel("מסך מחובר להדמיה", { exact: true }).selectOption({ label: "מסך בית הכנסת" });
  await simulation.getByRole("button", { name: /שליחה למסך/ }).click();
  await expect.poll(() => commands.length).toBe(1);
  const [sent] = commands;
  expect(sent.device_id).toBe(SCREEN.id);
  expect(sent.command).toBe("message");
  expect(sent.payload.text).toContain("1.40");
  expect(sent.payload.alertDemo).toMatchObject({ speed: 60, seconds: 11, alerts: { mode: "staged" } });
  await expect(page.getByText(/נשלחה למסך בית הכנסת/)).toBeVisible();
  expect(errors).toEqual([]);
});
