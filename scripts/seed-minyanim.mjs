/**
 * Puts a starting timetable into a synagogue that has none.
 *
 *   node scripts/seed-minyanim.mjs "<synagogue>" [--replace]
 *
 * A newly created community has no minyanim, so its board reads "לא הוגדרו
 * מניינים להיום" - which is correct, and tells you nothing about whether the
 * board works. This fills it with a plausible weekday and erev-Shabbat
 * timetable so the screen can be looked at, and so the gabbai has something
 * to correct rather than a blank page to fill.
 *
 * These are example times. They are nobody's real schedule, and the whole
 * point is that they get edited from the app.
 *
 * Both kinds of time are represented on purpose: fixed clock times, and
 * times that hang off a zman and therefore move every day. A board that
 * shows only fixed times will look fine for a week and then be wrong about
 * the one thing it exists to get right.
 *
 * It refuses a synagogue that already has minyanim. --replace deactivates
 * the existing ones first rather than deleting them: a timetable somebody
 * typed in is not this script's to throw away.
 */
import { url, signIn, rows } from "./lib/admin.mjs";

const args = process.argv.slice(2);
const replace = args.includes("--replace");
const wanted = args.find((a) => !a.startsWith("--"));
if (!wanted) {
  console.error('usage: node scripts/seed-minyanim.mjs "<synagogue>" [--replace]');
  process.exit(2);
}

const headers = await signIn({ json: true });

const shuls = await rows(headers, "communities?select=id,name,slug,active");
const shul = shuls.find((c) => c.slug === wanted || c.name === wanted || c.name.includes(wanted));
if (!shul) {
  console.error("name which synagogue:", shuls.map((c) => `${c.slug} (${c.name})`).join(", "));
  process.exit(1);
}

const existing = await rows(headers, `minyanim?select=id,label,active&community_id=eq.${shul.id}`);
const live = existing.filter((m) => m.active);
if (live.length && !replace) {
  console.error(`${shul.name} already has ${live.length} minyanim. --replace to set them aside first.`);
  process.exit(1);
}

async function send(table, body, method = "POST", query = "") {
  const res = await fetch(`${url}/rest/v1/${table}${query}`, {
    method,
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`${table}: ${res.status} ${text}`);
    process.exit(1);
  }
  return text ? JSON.parse(text) : [];
}

if (live.length) {
  await send("minyanim", { active: false }, "PATCH", `?community_id=eq.${shul.id}&active=eq.true`);
  console.log(`set aside ${live.length} existing minyanim (still there, switched off)`);
}

const PRAYERS = [
  { id: "shacharit", label: "שחרית" },
  { id: "mincha", label: "מנחה" },
  { id: "arvit", label: "ערבית" },
];

const [weekday] = await send("minyan_categories", {
  community_id: shul.id,
  name: "ימות החול",
  system_key: "weekday",
  sort_order: 10,
  display_mode: "list",
  subcategories: PRAYERS,
});
const [friday] = await send("minyan_categories", {
  community_id: shul.id,
  name: "יום שישי",
  system_key: "friday",
  sort_order: 20,
  display_mode: "list",
  subcategories: PRAYERS,
});

/** [prayer, label, time-or-anchor, offset, room] */
const TIMETABLE = [
  // ימות החול
  [weekday, "shacharit", "שחרית כוותיקין", "sunrise", -20, "בית מדרש"],
  [weekday, "shacharit", "שחרית א׳", "06:20", 0, ""],
  [weekday, "shacharit", "שחרית ב׳", "07:00", 0, "אולם מרכזי"],
  [weekday, "shacharit", "שחרית ג׳", "08:00", 0, ""],
  [weekday, "mincha", "מנחה גדולה", "13:15", 0, "בית מדרש"],
  [weekday, "mincha", "מנחה", "17:00", 0, ""],
  [weekday, "mincha", "מנחה לפני השקיעה", "sunset", -15, "אולם מרכזי"],
  [weekday, "arvit", "ערבית א׳", "tzeit", 0, ""],
  [weekday, "arvit", "ערבית ב׳", "20:30", 0, ""],
  [weekday, "arvit", "ערבית אחרונה", "22:15", 0, "בית מדרש"],
  // יום שישי
  [friday, "shacharit", "שחרית א׳", "06:30", 0, ""],
  [friday, "shacharit", "שחרית ב׳", "07:45", 0, "אולם מרכזי"],
  [friday, "mincha", "מנחה ערב שבת", "candle", -10, "אולם מרכזי"],
  [friday, "arvit", "ערבית ליל שבת", "sunset", 15, "אולם מרכזי"],
];

const fixed = /^\d{2}:\d{2}$/;
const made = await send(
  "minyanim",
  TIMETABLE.map(([category, prayer, label, when, offset, room], i) => ({
    community_id: shul.id,
    category_id: category.id,
    day_type: category.system_key,
    prayer,
    label,
    room,
    note: "",
    sort_order: (i + 1) * 10,
    active: true,
    notification_enabled: false,
    reminder_minutes: 15,
    ...(fixed.test(when)
      ? { time_mode: "fixed", fixed_time: `${when}:00`, relative_to: null, offset_minutes: 0 }
      : { time_mode: "relative", fixed_time: null, relative_to: when, offset_minutes: offset }),
  })),
);

console.log(`\n${shul.name}${shul.active ? "" : " (כבוי)"} - ${made.length} מניינים:`);
for (const [category, , label, when, offset] of TIMETABLE) {
  const at = fixed.test(when) ? when : `${when}${offset ? ` ${offset > 0 ? "+" : ""}${offset}` : ""}`;
  console.log(`  ${category.name.padEnd(10)} ${label.padEnd(22)} ${at}`);
}
console.log("\nexample times - they are meant to be edited from the app.");
