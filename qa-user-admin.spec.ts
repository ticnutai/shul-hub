import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

function projectEnv() {
  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(path.resolve(".env"), "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const env = projectEnv();
const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:8080";
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

test("admin creates a regular user that can sign in, while anonymous creation is blocked", async ({
  page,
  request,
}) => {
  test.skip(!adminEmail || !adminPassword, "ADMIN_EMAIL and ADMIN_PASSWORD are required");
  const unique = Date.now();
  const testEmail = `codex-user-admin-${unique}@example.com`;
  const testPassword = `Codex-${unique}!`;
  let testUserId: string | undefined;

  const loginResponse = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    data: { email: adminEmail, password: adminPassword },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const adminToken = (await loginResponse.json()).access_token as string;
  const authHeaders = { apikey: anonKey, Authorization: `Bearer ${adminToken}` };

  try {
    await page.goto(`${baseUrl}/auth`);
    await page.getByLabel("אימייל").fill(adminEmail!);
    await page.getByLabel("סיסמה").fill(adminPassword!);
    await page.getByRole("button", { name: "כניסה", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.getByRole("tab", { name: "משתמשים" }).click();
    await expect(page.getByRole("heading", { name: "הוספת משתמש" })).toBeVisible();

    await page.getByLabel("שם").fill("משתמש בדיקה");
    await page.getByLabel("אימייל").fill(testEmail);
    await page.getByLabel("סיסמה זמנית").fill(testPassword);
    await page.getByRole("button", { name: "הוספת משתמש" }).click();
    await expect(page.getByText("המשתמש נוסף בהצלחה")).toBeVisible();
    await expect(page.getByText(testEmail)).toBeVisible();

    const usersResponse = await request.post(`${supabaseUrl}/rest/v1/rpc/admin_list_users`, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: {},
    });
    expect(usersResponse.ok()).toBeTruthy();
    const created = (await usersResponse.json()).find(
      (user: { email: string }) => user.email === testEmail,
    );
    expect(created?.role).toBe("user");
    testUserId = created.id;

    const userLogin = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      data: { email: testEmail, password: testPassword },
    });
    expect(userLogin.ok()).toBeTruthy();

    const anonymousCreate = await request.post(`${supabaseUrl}/rest/v1/rpc/admin_create_user`, {
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      data: {
        p_email: `blocked-${unique}@example.com`,
        p_name: "Blocked",
        p_password: testPassword,
        p_role: "user",
      },
    });
    expect(anonymousCreate.ok()).toBeFalsy();
  } finally {
    if (testUserId) {
      const cleanup = await request.post(`${supabaseUrl}/rest/v1/rpc/admin_delete_user`, {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: { p_user_id: testUserId },
      });
      expect(cleanup.ok()).toBeTruthy();
    }
  }
});
