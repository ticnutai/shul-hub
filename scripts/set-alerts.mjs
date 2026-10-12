/**
 * Sets a synagogue's countdown reminders before the day's deadlines, in its
 * stored board (tv_config.config.alerts) - the database, not the code: what
 * the board shows is read from there by every screen and by the editor.
 *
 *   node scripts/set-alerts.mjs "<synagogue name or id>" [--events a,b] [--panel 10] [--board 5] [--highlight 10] [--write]
 *
 * The staged reminder (zmanAlerts.ts): from `highlight` minutes before, the
 * time is marked among the day's times; from `panel`, a countdown stands in
 * the prayers' box; from `board`, the countdown takes the whole board. A step
 * of 0 is left out. Defaults: קריאת שמע and תפילה (the Gra's and the Magen
 * Avraham's), 10 minutes in the box, 5 over the board.
 *
 * Safe to run again and again: the events are written once each (a list read
 * with a time twice is cleaned), the steps in order (board ≤ panel ≤
 * highlight), nothing else in the board is touched, and it writes only over
 * the board it read - if somebody saved in between, it stops and says so.
 * Without --write it only shows what it would change.
 */
import { url, signIn, rows } from "./lib/admin.mjs";

const args = process.argv.slice(2);
const target = args[0]?.startsWith("--") ? undefined : args[0];
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
if (!target) {
  console.error('usage: node scripts/set-alerts.mjs "<synagogue>" [--events a,b] [--panel 10] [--board 5] [--highlight 10] [--write]');
  process.exit(2);
}

/** The times a reminder can count down to (config.ts ALERT_EVENT_LABELS). */
const KNOWN = new Set([
  "sof_zman_shma", "sof_zman_tefila", "sof_zman_shma_mga72", "sof_zman_tefila_mga72",
  "sunset", "candle", "chatzot", "tzeit", "mincha_gedola", "plag", "alot", "sunrise", "misheyakir",
]);
const events = [...new Set(String(opt("events", "sof_zman_shma_mga72,sof_zman_shma,sof_zman_tefila_mga72,sof_zman_tefila")).split(",").map((s) => s.trim()).filter(Boolean))];
const unknown = events.filter((e) => !KNOWN.has(e));
if (unknown.length) { console.error(`unknown time(s): ${unknown.join(", ")}`); process.exit(2); }
const minutes = (name, fallback) => {
  const n = Number(opt(name, fallback));
  if (!Number.isInteger(n) || n < 0 || n > 120) { console.error(`--${name} must be 0-120 minutes`); process.exit(2); }
  return n;
};
const panel = minutes("panel", 10);
const board = minutes("board", 5);
const highlight = minutes("highlight", Math.max(panel, board));
if ((panel && panel > highlight) || (board && board > (panel || highlight))) {
  console.error("the steps must come in order: --board ≤ --panel ≤ --highlight");
  process.exit(2);
}

const headers = await signIn({ json: true });
const comms = await rows(headers, "communities?select=id,name");
const exact = comms.find((c) => c.id === target || c.name === target);
const partial = comms.filter((c) => c.name.includes(target));
const community = exact ?? (partial.length === 1 ? partial[0] : undefined);
if (!community) {
  console.error(`synagogue "${target}" not found, or more than one matches. Synagogues: ${comms.map((c) => c.name).join(" | ")}`);
  process.exit(2);
}
const [row] = await rows(headers, `tv_config?community_id=eq.${community.id}&select=config,updated_at`);
if (!row) { console.error(`no stored board for ${community.name}`); process.exit(1); }

const was = row.config.alerts ?? {};
const alerts = { ...was, enabled: true, mode: "staged", events, stages: { highlight, panel, board } };
// The database hands the fields back in its own order: compared field by field.
const st = was.stages ?? {};
const same =
  was.enabled === true && was.mode === "staged" &&
  JSON.stringify(was.events) === JSON.stringify(events) &&
  st.highlight === highlight && st.panel === panel && st.board === board;
console.log(`${community.name}:`);
console.log(`  before: ${JSON.stringify({ mode: was.mode ?? "pulse", events: was.events, stages: was.stages })}`);
console.log(`  after:  ${JSON.stringify({ mode: alerts.mode, events: alerts.events, stages: alerts.stages })}`);
if (same) { console.log("  already so - nothing to write."); process.exit(0); }
if (!args.includes("--write")) { console.log("  (dry run - add --write to save)"); process.exit(0); }

// Only over the board that was read: a save in between (the gabbai's editor) is never undone.
const res = await fetch(
  `${url}/rest/v1/tv_config?community_id=eq.${community.id}&updated_at=eq.${encodeURIComponent(row.updated_at)}`,
  {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ config: { ...row.config, alerts }, updated_at: new Date().toISOString() }),
  },
);
if (!res.ok) { console.error("update failed:", await res.text()); process.exit(1); }
const written = await res.json();
if (!written.length) { console.error("the board was saved by somebody else meanwhile - nothing written; run again."); process.exit(1); }
console.log("  saved. The screens take it up on their own within a minute.");
console.log(`  the previous reminders, to put back by hand if wanted: ${JSON.stringify(was)}`);
