// The "עוזר חכם" prompt and answer schema, shared by the ai-intake edge
// function and the admin page (which calls Claude directly when the admin
// entered a key of their own). No imports: it runs in Deno and in the browser.

export const AI_INTAKE_MODEL = "claude-opus-5-5";

const RELATIVE = ["alot", "misheyakir", "sunrise", "chatzot", "mincha_gedola", "plag", "candle", "sunset", "tzeit"];
/**
 * The special days a new tab can stand for (specialDays.ts SPECIAL_DAYS, less
 * the state's days). Written out, not imported - this file runs in Deno too;
 * a test keeps the two lists the same.
 */
export const AI_INTAKE_EVENT_KEYS = [
  "yom_kippur", "erev_yom_kippur", "rosh_hashana", "erev_rosh_hashana", "shabbat_shuva", "tisha_bav", "erev_tisha_bav",
  "tzom_gedaliah", "asara_btevet", "taanit_esther", "shiva_asar_btamuz", "taanit_bechorot", "sukkot", "erev_sukkot",
  "hoshana_raba", "chol_hamoed_sukkot", "shmini_atzeret", "pesach", "shvii_shel_pesach", "erev_pesach", "chol_hamoed_pesach",
  "shavuot", "erev_shavuot", "purim", "erev_purim", "shushan_purim", "chanukah", "purim_katan", "shabbat_hagadol",
  "shabbat_zachor", "shabbat_parah", "shabbat_hachodesh", "shabbat_shekalim", "shabbat_chazon", "shabbat_nachamu",
  "shabbat_shirah", "lag_baomer", "tu_bishvat", "tu_bav", "pesach_sheni", "rosh_chodesh",
];

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

/** What the model answers with. Every field is required; "none" is null or an empty list. */
export const AI_INTAKE_SCHEMA = obj({
  summary: { type: "string", description: "Hebrew, one or two sentences: what was understood." },
  questions: { type: "array", items: { type: "string" }, description: "Hebrew questions about anything unclear." },
  minyanim: {
    type: "array",
    items: obj({
      action: { type: "string", enum: ["create", "update"] },
      existing_id: nullable({ type: "string" }),
      category_id: nullable({ type: "string" }),
      new_category_name: nullable({ type: "string" }),
      new_category_event: nullable({ type: "string", enum: AI_INTAKE_EVENT_KEYS }),
      new_category_from: nullable({ type: "string", format: "date" }),
      new_category_until: nullable({ type: "string", format: "date" }),
      prayer: { type: "string" },
      label: { type: "string" },
      time_mode: { type: "string", enum: ["fixed", "relative"] },
      fixed_time: nullable({ type: "string", description: "HH:MM, 24h" }),
      relative_to: nullable({ type: "string", enum: RELATIVE }),
      offset_minutes: { type: "integer", description: "negative = before, positive = after" },
      room: { type: "string" },
      note: { type: "string" },
      confidence: { type: "string", enum: ["high", "low"] },
      reason: { type: "string", description: "Hebrew: where in the input this came from." },
    }),
  },
  overrides: {
    type: "array",
    items: obj({
      minyan_id: { type: "string" },
      on_date: { type: "string", format: "date" },
      at_time: nullable({ type: "string", description: "HH:MM, 24h; null when cancelled" }),
      cancelled: { type: "boolean" },
      note: { type: "string" },
      reason: { type: "string" },
    }),
  },
  announcements: {
    type: "array",
    items: obj({
      kind: { type: "string", enum: ["mazal_tov", "general", "memorial"] },
      title: { type: "string" },
      body: { type: "string" },
      expires_at: nullable({ type: "string", format: "date" }),
      pinned: { type: "boolean" },
      reason: { type: "string" },
    }),
  },
  shiurim: {
    type: "array",
    items: obj({
      title: { type: "string" },
      teacher: { type: "string" },
      description: { type: "string" },
      location: { type: "string" },
      schedule_type: { type: "string", enum: ["weekly", "daily"] },
      day_of_week: { type: "integer", description: "0 = ראשון ... 6 = שבת; ignored when daily" },
      time_text: { type: "string" },
      reason: { type: "string" },
    }),
  },
});

export const AI_INTAKE_SYSTEM = `You help the gabbai of a synagogue keep its website and wall board up to date.
The input is a photo (a printed timetable, a notice, a WhatsApp screenshot), a sentence the gabbai
dictated, or a pasted message - in Hebrew. Turn it into proposed changes to the synagogue's data.
The gabbai reviews every proposal before anything is saved, so propose what the input says and flag
what you are unsure of; never invent times, names or dates that are not in the input.

The data:
- Minyanim belong to a category (a tab such as ימות החול / יום שישי / שבת). Use the category ids you
  are given. If no category fits (for example the input is about Shabbat and there is no Shabbat
  category), set category_id to null and new_category_name to the tab to create ("שבת").
  A timetable for a festival, a fast or particular dates is not an everyday tab: give its new tab
  new_category_from / new_category_until (the dates it is for), and new_category_event when the tab
  is a special day's own (shmini_atzeret, yom_kippur ...) - on that day it then stands in place of
  the ordinary tabs. A day's prayers belong to the date they are said on, by the clock: the eve's
  mincha and the evening's arvit go on the eve's date (a tab of its own, dated to that day, with no
  new_category_event), and the morning onwards goes on the festival's date. Leave all three null for
  an ordinary tab. Do not list candle lighting or other zmanim as minyanim - the site works them out.
  "prayer" is one of the category's subcategory ids when it has them, otherwise one of
  shacharit / mincha / arvit / other. "label" is the name shown ("שחרית א'", "מנחה גדולה").
  A time is either fixed (HH:MM, 24-hour) or relative to a zman: alot, misheyakir, sunrise, chatzot,
  mincha_gedola, plag, candle (הדלקת נרות), sunset (שקיעה), tzeit (צאת הכוכבים), with
  offset_minutes negative for before and positive for after ("10 דקות לפני השקיעה" = sunset, -10).
  When the input changes a minyan that already exists (same category and prayer/label), propose
  action "update" with its existing_id rather than a new one. Use confidence "low" when the time,
  day or prayer is a guess.
- A one-day change to an existing minyan ("מחר שחרית ב-7", "אין מנחה ביום חמישי") is an override:
  the minyan's id, the date (YYYY-MM-DD), the new time or cancelled.
- Announcements: mazal_tov (שמחות, מזל טוב), memorial (אבל, אזכרה, ניחום אבלים), general (the rest).
  Keep the wording of the notice; title short, body complete. expires_at when the notice has an
  end date (an event date, the end of shiva).
- Shiurim: title, teacher, weekly (day_of_week 0 = ראשון … 6 = שבת) or daily, time as written.

Write summary, questions and reason in Hebrew. Empty lists for what the input does not contain.`;

/** The text sent with the input: today's date, the shul's current data, and what the gabbai wrote. */
export function aiIntakeText(opts: { today: string; weekday: string; context: unknown; text: string }): string {
  return (
    `Today (Israel): ${opts.today} (${opts.weekday}).\n` +
    `The synagogue's current data:\n${JSON.stringify(opts.context)}\n\n` +
    (opts.text ? `The gabbai wrote or said:\n${opts.text}` : "Read the attached image(s).")
  );
}
