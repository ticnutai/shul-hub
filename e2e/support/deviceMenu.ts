import type { Page } from "@playwright/test";

/**
 * The editor's device picker is one button with a menu (DeviceToolbar): it
 * was a strip of six buttons, which wrapped to three lines on a narrow window
 * and took the height the board was meant to have.
 */
export async function openDeviceMenu(page: Page) {
  const group = page.getByRole("radiogroup", { name: "מכשיר לתצוגה" });
  if (!(await group.isVisible())) await page.getByTestId("device-menu").first().click();
  return group;
}

/** Look at one device (or "כל המסכים"), the way the gabbai does it. */
export async function chooseDevice(page: Page, name: string) {
  const group = await openDeviceMenu(page);
  await group.getByRole("radio", { name, exact: true }).click();
}
