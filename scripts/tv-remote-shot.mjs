/**
 * Asks a screen for a picture of itself, over the internet.
 *
 * No adb: the board listens for commands from the control centre and
 * uploads what it sees. This is the way in when the screen is online but on
 * a network this computer cannot reach - which, for a box on a shul wall,
 * is most of the time.
 */
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
  }),
);
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.MIGRATION_ADMIN_EMAIL, password: process.env.MIGRATION_ADMIN_PASSWORD }),
});
if (!auth.ok) { console.error("sign-in failed"); process.exit(1); }
const headers = { apikey: key, Authorization: `Bearer ${(await auth.json()).access_token}`, "Content-Type": "application/json" };

const devices = await (await fetch(`${url}/rest/v1/tv_devices?select=id,name,last_seen_at&approved=eq.true`, { headers })).json();
const wanted = process.argv[2];
const target = wanted ? devices.find((d) => d.name.includes(wanted)) : devices
  .slice().sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at))[0];
if (!target) { console.error("no such screen"); process.exit(1); }
console.log(`asking "${target.name}" for a picture...`);

const before = await (await fetch(`${url}/rest/v1/tv_snapshots?select=captured_at&device_id=eq.${target.id}`, { headers })).json();
const wasAt = before[0]?.captured_at ?? null;

const cmd = await fetch(`${url}/rest/v1/tv_commands`, {
  method: "POST", headers, body: JSON.stringify({ device_id: target.id, command: "snapshot", payload: {} }),
});
if (!cmd.ok) { console.error("could not send the command:", await cmd.text()); process.exit(1); }

for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 1500));
  const rows = await (await fetch(`${url}/rest/v1/tv_snapshots?select=captured_at,image&device_id=eq.${target.id}`, { headers })).json();
  const snap = rows[0];
  if (snap?.image && snap.captured_at !== wasAt) {
    const b64 = snap.image.includes(",") ? snap.image.split(",")[1] : snap.image;
    const out = "wall.png";
    fs.writeFileSync(out, Buffer.from(b64, "base64"));
    console.log(`taken ${new Date(snap.captured_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })} -> ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
    process.exit(0);
  }
}
console.error("the screen did not answer in a minute");
process.exit(1);
