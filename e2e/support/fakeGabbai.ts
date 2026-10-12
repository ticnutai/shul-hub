import fs from "node:fs";
import type { Page, Route } from "@playwright/test";

/**
 * The gabbai's area as a gabbai sees it, without a gabbai's password and
 * without writing anything anywhere.
 *
 * A made-up signed-in session is put where the site keeps one; the server is
 * asked "is this a gabbai?" and answered yes here; everything the page reads
 * is read for real, as a visitor (the public key), so the synagogue's own
 * minyanim and categories are on the screen; everything it would write is
 * answered here and goes nowhere. Good for looking and clicking, not for
 * checking that a save reached the database.
 */
function env(): Record<string, string> {
  try {
    return Object.fromEntries(
      fs.readFileSync(".env", "utf8").split(/\r?\n/)
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

const e = env();
const URL_ = e.VITE_SUPABASE_URL ?? "";
const KEY = e.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
export const canFakeGabbai = Boolean(URL_ && KEY);

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const USER = { id: "00000000-0000-4000-8000-0000000000aa", aud: "authenticated", role: "authenticated", email: "gabbai@test.local", app_metadata: {}, user_metadata: {} };

export async function fakeGabbai(page: Page, slug = "main") {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ ...USER, sub: USER.id, exp })}.fake`;
  const ref = new URL(URL_).hostname.split(".")[0];
  const session = { access_token: token, refresh_token: "fake", token_type: "bearer", expires_in: 86400, expires_at: exp, user: USER };
  await page.addInitScript(([key, value, shul]) => {
    localStorage.setItem(key, value);
    localStorage.setItem("shul-hub.community", shul);
  }, [`sb-${ref}-auth-token`, JSON.stringify(session), slug] as const);

  const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route(`${URL_}/auth/v1/**`, (route) => json(route, USER));
  await page.route(`${URL_}/functions/v1/**`, (route) => json(route, {}));
  await page.route(`${URL_}/rest/v1/**`, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path.endsWith("/rpc/is_admin")) return json(route, true);
    if (path.endsWith("/rpc/is_platform_admin") || path.endsWith("/rpc/claim_admin")) return json(route, false);
    // The gabbai's own rows (their display settings, their synagogues): none - the defaults.
    if (path.includes("/profiles") || path.includes("/user_settings") || path.includes("/community_admins")) {
      return json(route, req.method() === "GET" ? [] : []);
    }
    if (req.method() !== "GET" && !path.includes("/rpc/")) return json(route, []);
    // Read for real, as a visitor.
    const headers = { ...req.headers(), apikey: KEY, authorization: `Bearer ${KEY}` };
    return route.continue({ headers });
  });
}
