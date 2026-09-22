/**
 * Pairs a screen to a synagogue from here, the way the admin page does.
 *
 * The screen is never asked which synagogue it belongs to - it cannot be
 * trusted to answer, and its address and hardware say nothing useful. It
 * shows a code, and an admin who already administers a synagogue types
 * that code. The server writes the answer down. This is that, from a
 * terminal: same function, same permission check.
 *
 *   node scripts/pair-screen.mjs <6-digit code> "<name>" [slug]
 */
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
  }),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const [code, name, slug] = process.argv.slice(2);
if (!code || !name) {
  console.error('usage: node scripts/pair-screen.mjs <code> "<name>" [slug]');
  process.exit(2);
}

const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.MIGRATION_ADMIN_EMAIL,
    password: process.env.MIGRATION_ADMIN_PASSWORD,
  }),
});
if (!auth.ok) {
  console.error("could not sign in:", await auth.text());
  process.exit(1);
}
const jwt = (await auth.json()).access_token;
const headers = { apikey: key, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" };

// Which synagogue. Named explicitly rather than left to "the only one":
// this script should keep doing the right thing once there are three.
//
// Switched-on ones are not the only candidates. A screen finds its board by
// the id it was given and never asks whether the synagogue is live, so a new
// community can be set up and checked on a real screen before the public
// site offers it to anybody - which is the normal order of things.
const res = await fetch(`${url}/rest/v1/communities?select=id,slug,name,active`, { headers });
const all = await res.json();
const live = all.filter((c) => c.active);
const target = slug ? all.find((c) => c.slug === slug) : live.length === 1 ? live[0] : null;
if (!target) {
  console.error("name which synagogue:", all.map((c) => `${c.slug}${c.active ? "" : " (not live yet)"}`).join(", "));
  process.exit(1);
}

const claim = await fetch(`${url}/rest/v1/rpc/tv_claim`, {
  method: "POST",
  headers,
  body: JSON.stringify({ p_code: code, p_name: name, p_community: target.id }),
});
const body = await claim.text();
if (!claim.ok) {
  console.error("pairing failed:", body);
  process.exit(1);
}
console.log(`paired "${name}" to ${target.name}${target.active ? "" : "  (not switched on yet - the screen does not mind)"}`);
console.log(body);
