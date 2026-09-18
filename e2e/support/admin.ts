import fs from "node:fs";
import { test as base, type Page } from "@playwright/test";

/**
 * An administrator page without typing a password into the login form.
 *
 * The session is requested once per worker from Supabase Auth (the same
 * credentials the other admin specs use: QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD,
 * never stored in the repo) and placed where supabase-js keeps it, so the app
 * starts already signed in. Specs that need it are skipped when the
 * credentials are not configured.
 */

function readEnvFile(file: string): Record<string, string> {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(file, "utf8")
        .split(/\r?\n/)
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}

const env = { ...readEnvFile(".env"), ...process.env } as Record<string, string | undefined>;
export const SUPABASE_URL = env.VITE_SUPABASE_URL ?? "";
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
export const hasAdmin = Boolean(env.QA_ADMIN_EMAIL && env.QA_ADMIN_PASSWORD && SUPABASE_URL && KEY);

async function adminSession(): Promise<Record<string, unknown>> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.QA_ADMIN_EMAIL, password: env.QA_ADMIN_PASSWORD }),
  });
  const session = (await r.json()) as Record<string, unknown>;
  if (!r.ok || !session.access_token) throw new Error(`admin sign-in failed: ${r.status}`);
  return session;
}

/** Signs the page's origin in as the admin before any app code runs. */
export async function signIn(page: Page, session: Record<string, unknown>) {
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  await page.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    [`sb-${ref}-auth-token`, JSON.stringify(session)] as const,
  );
}

export const test = base.extend<{ adminPage: Page }, { session: Record<string, unknown> }>({
  session: [
    async ({}, use) => {
      await use(hasAdmin ? await adminSession() : {});
    },
    { scope: "worker" },
  ],
  adminPage: async ({ page, session }, use) => {
    await signIn(page, session);
    await use(page);
  },
});

export { expect } from "@playwright/test";
