/**
 * Did a screen's clock ever disagree with the server's?
 *
 * Every event carries two times: occurred_at, which the screen stamped from
 * its own clock, and received_at, which the server stamped when it arrived.
 * A screen buffers events while it is offline, so a gap is expected - but a
 * gap of hours, or a negative one, means the screen did not know what time
 * it was. A board that does not know the time shows the wrong zmanim, and
 * on the wrong day of the week it shows the Shabbat screen.
 */
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
  method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.MIGRATION_ADMIN_EMAIL, password: process.env.MIGRATION_ADMIN_PASSWORD }),
});
const headers = { apikey: key, Authorization: `Bearer ${(await auth.json()).access_token}` };

const rows = await (await fetch(`${url}/rest/v1/tv_events?select=occurred_at,received_at,kind,message&order=occurred_at.desc&limit=300`, { headers })).json();
const he = (d) => new Date(d).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });

let worst = null;
const bad = [];
for (const r of rows) {
  const skew = (new Date(r.occurred_at) - new Date(r.received_at)) / 60000; // minutes
  if (!worst || Math.abs(skew) > Math.abs(worst.skew)) worst = { ...r, skew };
  // Ahead of the server at all, or more than a day behind, is a broken clock
  // rather than a buffered event.
  if (skew > 2 || skew < -60 * 24) bad.push({ ...r, skew });
}
console.log(`${rows.length} events examined`);
console.log(`worst skew: ${worst.skew.toFixed(1)} min   (${worst.kind}) device said ${he(worst.occurred_at)}, server got it ${he(worst.received_at)}`);
if (bad.length === 0) console.log("no event shows a clock that had drifted or reset.");
else {
  console.log(`\n${bad.length} events where the screen did not know the time:`);
  for (const r of bad.slice(0, 12)) {
    console.log(`  device said ${he(r.occurred_at)}  |  server got it ${he(r.received_at)}  |  off by ${(r.skew / 60).toFixed(1)} h  |  ${r.kind}`);
  }
}
