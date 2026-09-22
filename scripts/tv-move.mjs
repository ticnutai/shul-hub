/**
 * Moves a screen to another synagogue.
 *
 *   node scripts/tv-move.mjs "<screen name>" "<synagogue name>"
 *
 * Pairing is how a screen normally learns where it belongs, and it happens
 * once, with a code typed by an admin. This is the same decision made again
 * later - a box carried from one shul to another, or one being set up for a
 * second community - without making somebody unpair and re-pair it.
 *
 * The synagogue does not have to be switched on. A screen finds its board by
 * the id it was given, and nothing on that path asks whether the synagogue
 * is live yet, so a new community can be set up and looked at on a real
 * screen before the public site offers it to anybody.
 */
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
  }),
);
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const [screenName, shulName] = process.argv.slice(2);
if (!screenName || !shulName) {
  console.error('usage: node scripts/tv-move.mjs "<screen>" "<synagogue>"');
  process.exit(2);
}

const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.MIGRATION_ADMIN_EMAIL, password: process.env.MIGRATION_ADMIN_PASSWORD }),
});
if (!auth.ok) { console.error("sign-in failed"); process.exit(1); }
const headers = { apikey: key, Authorization: `Bearer ${(await auth.json()).access_token}`, "Content-Type": "application/json" };

const [devices, shuls] = await Promise.all([
  (await fetch(`${url}/rest/v1/tv_devices?select=id,name,community_id`, { headers })).json(),
  (await fetch(`${url}/rest/v1/communities?select=id,name,active`, { headers })).json(),
]);
const screen = devices.find((d) => d.name.includes(screenName));
const shul = shuls.find((c) => c.name.includes(shulName));
if (!screen) { console.error(`no screen matching "${screenName}". have: ${devices.map((d) => d.name).join(", ")}`); process.exit(1); }
if (!shul) { console.error(`no synagogue matching "${shulName}". have: ${shuls.map((c) => c.name).join(", ")}`); process.exit(1); }

const wasIn = shuls.find((c) => c.id === screen.community_id)?.name ?? "(none)";
const res = await fetch(`${url}/rest/v1/tv_devices?id=eq.${screen.id}`, {
  method: "PATCH", headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify({ community_id: shul.id }),
});
if (!res.ok) { console.error("the move was refused:", await res.text()); process.exit(1); }
const [after] = await res.json();
if (after.community_id !== shul.id) { console.error("it did not stick"); process.exit(1); }

console.log(`"${screen.name}": ${wasIn} -> ${shul.name}${shul.active ? "" : "  (not switched on yet, which is fine for a screen)"}`);
console.log("the screen picks it up on its next boot, or straight away on a reload.");
