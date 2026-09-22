/**
 * A copy of everything the board and the website show, in one file.
 *
 * Read with the public key, which is all the board itself uses: if a table
 * is readable here, it is readable by anyone, so nothing secret passes
 * through. Run it before any migration that touches these tables - it is
 * the difference between "we can put it back" and "we hope it worked".
 */
import fs from "node:fs";
import path from "node:path";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
  }),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Two of these tables are admin-only, and rightly so. When the migration
// admin's credentials are in the environment the backup signs in and takes
// them too; without them it still takes everything the public can read, and
// says which tables it could not reach.
async function adminToken() {
  const email = process.env.MIGRATION_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const password = process.env.MIGRATION_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  return (await res.json()).access_token ?? null;
}

const TABLES = [
  "settings", "minyan_categories", "minyanim", "announcements",
  "shiur_categories", "shiurim", "chavrutot", "chavruta_requests",
  "admin_messages", "home_widgets", "app_themes", "tv_config", "tv_devices",
];

const token = await adminToken();
console.log(token ? "signed in as the migration admin" : "public tables only (no credentials in this shell)");

const out = { takenAt: new Date().toISOString(), project: env.VITE_SUPABASE_PROJECT_ID, tables: {} };
for (const t of TABLES) {
  const res = await fetch(`${url}/rest/v1/${t}?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${token ?? key}` },
  });
  if (!res.ok) {
    out.tables[t] = { error: `${res.status} ${await res.text()}` };
    console.log(`${t.padEnd(20)} — ${res.status}`);
    continue;
  }
  const rows = await res.json();
  out.tables[t] = rows;
  console.log(`${t.padEnd(20)} ${rows.length} rows`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const file = path.join("backups", `content-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`\n→ ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
