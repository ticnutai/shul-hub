/** Any screenshots the screens have stored, and when. */
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
const headers = { apikey: key, Authorization: `Bearer ${(await auth.json()).access_token}` };
const rows = await (await fetch(`${url}/rest/v1/tv_snapshots?select=device_id,captured_at,image`, { headers })).json();
if (!Array.isArray(rows)) { console.error("the server refused:", JSON.stringify(rows).slice(0, 200)); process.exit(1); }
if (rows.length === 0) { console.log("no stored screenshots"); process.exit(0); }
for (const r of rows) {
  const when = new Date(r.captured_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  const bytes = (r.image ?? "").length;
  console.log(`${when}  ${bytes} chars`);
  if (r.image?.startsWith("data:image")) {
    const f = `snap-${r.device_id.slice(0, 8)}.png`;
    fs.writeFileSync(f, Buffer.from(r.image.split(",")[1], "base64"));
    console.log(`  saved ${f}`);
  }
}
