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
import { url, signIn, rows } from "./lib/admin.mjs";

const [screenName, shulName] = process.argv.slice(2);
if (!screenName || !shulName) {
  console.error('usage: node scripts/tv-move.mjs "<screen>" "<synagogue>"');
  process.exit(2);
}

const headers = await signIn({ json: true });

const [devices, shuls] = await Promise.all([
  rows(headers, "tv_devices?select=id,name,community_id"),
  rows(headers, "communities?select=id,name,active"),
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
