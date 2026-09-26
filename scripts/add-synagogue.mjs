/**
 * Adds a synagogue with its real timetable, from a spec file.
 *
 *   node scripts/add-synagogue.mjs scripts/synagogues/<name>.json [--dry]
 *
 * The spec is what was read off the synagogue's own notices (the sources are
 * listed in it): its details, its timetable tabs with their minyanim, and any
 * announcements. Each minyan is [prayer, label, time, offset, room, note]:
 * a time "HH:MM" is fixed; a zman name (sunset, mincha_gedola, tzeit...) with
 * an offset in minutes is a time that moves with the day.
 *
 * It creates the synagogue (the database adds its settings and its board),
 * then fills it. It refuses a name that already exists, so running it twice
 * does not make two synagogues or double the minyanim. It checks the spec
 * for doubled minyanim (the same prayer at the same time) before writing.
 */
import fs from "node:fs";
import { url, signIn, rows } from "./lib/admin.mjs";

const file = process.argv[2];
const dry = process.argv.includes("--dry");
if (!file) {
  console.error("usage: node scripts/add-synagogue.mjs <spec.json> [--dry]");
  process.exit(2);
}
const spec = JSON.parse(fs.readFileSync(file, "utf8"));
const fixed = /^\d{2}:\d{2}$/;
const ZMANIM = ["alot", "misheyakir", "sunrise", "chatzot", "mincha_gedola", "plag", "candle", "sunset", "tzeit"];

// ---- the spec, checked before anything is written
const problems = [];
for (const cat of spec.categories) {
  const seen = new Map();
  const labels = new Set();
  for (const [prayer, label, when, offset] of cat.minyanim) {
    if (!["shacharit", "mincha", "arvit", "other"].includes(prayer)) problems.push(`${label}: prayer ${prayer}`);
    if (!fixed.test(when) && !ZMANIM.includes(when)) problems.push(`${label}: time ${when}`);
    const key = `${prayer} ${when} ${offset}`;
    if (seen.has(key)) problems.push(`doubled: ${label} = ${seen.get(key)} (${key})`);
    seen.set(key, label);
    if (labels.has(label)) problems.push(`label used twice: ${label}`);
    labels.add(label);
  }
}
if (problems.length) {
  console.error("the spec has problems:\n  " + problems.join("\n  "));
  process.exit(1);
}

const headers = await signIn({ json: true });
async function send(table, body, method = "POST", query = "") {
  const res = await fetch(`${url}/rest/v1/${table}${query}`, {
    method,
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${table}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : [];
}

const shuls = await rows(headers, "communities?select=id,name,slug");
if (shuls.some((c) => c.name === spec.name || c.slug === spec.slug)) {
  console.error(`"${spec.name}" already exists. Nothing written.`);
  process.exit(1);
}
if (dry) {
  console.log("dry run: the spec is sound;", spec.categories.map((c) => `${c.name}: ${c.minyanim.length}`).join(", "));
  process.exit(0);
}

// ---- the synagogue (the database scaffolds its settings and board)
const res = await fetch(`${url}/rest/v1/rpc/create_community`, {
  method: "POST",
  headers,
  body: JSON.stringify({ p_name: spec.name, p_slug: spec.slug }),
});
if (!res.ok) throw new Error(`create_community: ${res.status} ${await res.text()}`);
const id = JSON.parse(await res.text());
await send("settings", spec.settings, "PATCH", `?community_id=eq.${id}`);

const PRAYERS = [
  { id: "shacharit", label: "שחרית" },
  { id: "mincha", label: "מנחה" },
  { id: "arvit", label: "ערבית" },
];
let count = 0;
for (const cat of spec.categories) {
  const [row] = await send("minyan_categories", {
    community_id: id,
    name: cat.name,
    system_key: cat.system_key ?? null,
    sort_order: cat.sort_order ?? 10,
    display_mode: "list",
    subcategories: PRAYERS,
    active: true,
  });
  const made = await send(
    "minyanim",
    cat.minyanim.map(([prayer, label, when, offset, room, note], i) => ({
      community_id: id,
      category_id: row.id,
      day_type: cat.system_key ?? "weekday",
      prayer,
      label,
      room: room ?? "",
      note: note ?? "",
      sort_order: (i + 1) * 10,
      active: true,
      notification_enabled: false,
      reminder_minutes: 15,
      ...(fixed.test(when)
        ? { time_mode: "fixed", fixed_time: `${when}:00`, relative_to: null, offset_minutes: 0 }
        : { time_mode: "relative", fixed_time: null, relative_to: when, offset_minutes: offset }),
    })),
  );
  count += made.length;
}
for (const a of spec.announcements ?? []) {
  await send("announcements", {
    community_id: id,
    kind: a.kind,
    title: a.title,
    body: a.body,
    expires_at: a.expires_at ?? null,
    pinned: Boolean(a.pinned),
    notification_enabled: false,
    show_on_home: true,
    home_width: "half",
    sort_order: 5,
  });
}
console.log(`${spec.name} (${spec.slug}, ${id}): ${count} minyanim, ${spec.announcements?.length ?? 0} announcements`);
