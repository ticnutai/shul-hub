/** The last events every screen reported, newest first. */
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
  body: JSON.stringify({ email: process.env.MIGRATION_ADMIN_EMAIL, password: process.env.MIGRATION_ADMIN_PASSWORD }),
});
if (!auth.ok) { console.error("sign-in failed"); process.exit(1); }
const headers = { apikey: key, Authorization: `Bearer ${(await auth.json()).access_token}` };

const limit = Number(process.argv[2] ?? 30);
const [events, devices] = await Promise.all([
  (await fetch(`${url}/rest/v1/tv_events?select=occurred_at,level,kind,message,device_id&order=occurred_at.desc&limit=${limit}`, { headers })).json(),
  (await fetch(`${url}/rest/v1/tv_devices?select=id,name`, { headers })).json(),
]);
const nameOf = (id) => devices.find((d) => d.id === id)?.name ?? "?";
for (const e of events) {
  const when = new Date(e.occurred_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  console.log(`${when}  ${String(nameOf(e.device_id)).padEnd(14)} ${e.level.padEnd(5)} ${e.kind.padEnd(10)} ${String(e.message).slice(0, 70)}`);
}
