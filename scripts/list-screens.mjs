/** Every screen, and which synagogue it shows. */
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
  }),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.MIGRATION_ADMIN_EMAIL,
    password: process.env.MIGRATION_ADMIN_PASSWORD,
  }),
});
const jwt = (await auth.json()).access_token;
const headers = { apikey: key, Authorization: `Bearer ${jwt}` };

const get = async (p) => (await fetch(`${url}/rest/v1/${p}`, { headers })).json();
const devices = await get("tv_devices?select=name,approved,app_version,last_seen_at,community_id&order=created_at");
const comms = await get("communities?select=id,name,active");
const nameOf = (id) => comms.find((c) => c.id === id)?.name ?? "—";

const ago = (t) => (t ? `${Math.round((Date.now() - new Date(t)) / 1000)}s ago` : "never");
console.log("screen".padEnd(18), "paired".padEnd(7), "ver".padEnd(6), "seen".padEnd(10), "synagogue");
for (const d of devices) {
  console.log(
    String(d.name).padEnd(18),
    String(d.approved).padEnd(7),
    String(d.app_version ?? "-").padEnd(6),
    ago(d.last_seen_at).padEnd(10),
    nameOf(d.community_id),
  );
}
console.log("\nsynagogues:", comms.map((c) => `${c.name}${c.active ? "" : " (כבוי)"}`).join(", "));
