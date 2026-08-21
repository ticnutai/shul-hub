import { expect, test } from "@playwright/test";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173";

test("home widgets load from Supabase in their configured order", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const response = await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);

  const headings = ["זמני התפילות", "זמני היום", "מודעות לציבור"];
  const positions: number[] = [];
  for (const name of headings) {
    const heading = page.getByRole("heading", { name, exact: true });
    await expect(heading).toBeVisible();
    positions.push((await heading.boundingBox())!.y);
  }

  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(errors).toEqual([]);
});
