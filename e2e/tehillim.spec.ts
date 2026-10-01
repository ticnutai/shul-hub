import { expect, test } from "@playwright/test";
import { rememberShul } from "./support/chooseShul";

/**
 * Tehillim with a door of its own in the top row: the Siddur, opened on its
 * Tehillim tab. A link to a chapter and verse opens there (that is how a
 * bookmark comes back); the last place read is offered again; and "סידור"
 * goes back to the prayers.
 */
test.beforeEach(async ({ page }) => {
  await rememberShul(page);
});

test("the Tehillim tab opens Tehillim, remembers the place, and gives the Siddur back", async ({ page }) => {
  await page.goto("/siddur");
  const nav = page.getByRole("navigation", { name: "מדורים ראשיים" });
  await nav.getByRole("link", { name: "תהילים" }).click();
  await expect(page).toHaveURL(/\/siddur\?tab=tehillim/);
  await expect(nav.locator('[aria-current="page"]')).toHaveText("תהילים");
  await expect(page.locator('button[title="פרק 1"]')).toBeVisible({ timeout: 20_000 });

  // A link to a chapter and verse - a bookmark's - opens there.
  await page.goto("/siddur?tab=tehillim&perek=23&pasuk=4");
  const bookmark = page.getByTestId("tehillim-bookmark");
  await expect(bookmark).toBeVisible({ timeout: 20_000 });
  await expect(bookmark).toHaveText("סימניה לפסוק");
  await expect(page.getByText("פרק כג (23)")).toBeVisible();

  // Back to the chapters: the place just read is offered first.
  await page.getByRole("button", { name: "כל הפרקים" }).click();
  await expect(page.getByTestId("tehillim-return")).toContainText("המשך מפרק כג, פסוק ד");

  // A guest's bookmark asks them to sign in rather than vanishing.
  await page.getByTestId("tehillim-return").getByRole("button", { name: /המשך מפרק/ }).click();
  await page.getByTestId("tehillim-bookmark").click();
  await expect(page.getByText("יש להתחבר כדי להוסיף סימניות")).toBeVisible();

  // "סידור" goes back to the prayers.
  await nav.getByRole("link", { name: "סידור", exact: true }).click();
  await expect(page).toHaveURL(/\/siddur$/);
  await expect(nav.locator('[aria-current="page"]')).toHaveText("סידור");
});
