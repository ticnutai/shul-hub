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
import { signIn, rows } from "./lib/admin.mjs";

const headers = await signIn();

const events = await rows(headers, "tv_events?select=occurred_at,received_at,kind,message&order=occurred_at.desc&limit=300");
const he = (d) => new Date(d).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });

let worst = null;
const bad = [];
for (const r of events) {
  const skew = (new Date(r.occurred_at) - new Date(r.received_at)) / 60000; // minutes
  if (!worst || Math.abs(skew) > Math.abs(worst.skew)) worst = { ...r, skew };
  // Ahead of the server at all, or more than a day behind, is a broken clock
  // rather than a buffered event.
  if (skew > 2 || skew < -60 * 24) bad.push({ ...r, skew });
}
console.log(`${events.length} events examined`);
console.log(`worst skew: ${worst.skew.toFixed(1)} min   (${worst.kind}) device said ${he(worst.occurred_at)}, server got it ${he(worst.received_at)}`);
if (bad.length === 0) console.log("no event shows a clock that had drifted or reset.");
else {
  console.log(`\n${bad.length} events where the screen did not know the time:`);
  for (const r of bad.slice(0, 12)) {
    console.log(`  device said ${he(r.occurred_at)}  |  server got it ${he(r.received_at)}  |  off by ${(r.skew / 60).toFixed(1)} h  |  ${r.kind}`);
  }
}
