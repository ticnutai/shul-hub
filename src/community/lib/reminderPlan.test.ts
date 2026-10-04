import { describe, expect, it } from "vitest";
import type { Minyan, Shiur } from "./data";
import { DEFAULT_REMINDER_PREFS, holyWindows, jerusalemMoment, normalizeReminderPrefs, planReminders } from "./reminderPlan";

const minyan = (over: Partial<Minyan>): Minyan =>
  ({
    id: "m1",
    label: "שחרית",
    active: true,
    notification_enabled: true,
    reminder_minutes: 10,
    time_mode: "fixed",
    fixed_time: "07:00",
    relative_to: null,
    offset_minutes: 0,
    day_type: "weekday",
    category_id: null,
    active_from: null,
    active_until: null,
    room: "",
    note: "",
    ...over,
  }) as Minyan;

const shiur = (over: Partial<Shiur>): Shiur =>
  ({
    id: "s1",
    title: "דף יומי",
    active: true,
    notification_enabled: true,
    reminder_minutes: 15,
    schedule_type: "daily",
    day_of_week: 0,
    time_text: "20:30",
    location: "בית המדרש",
    ...over,
  }) as Shiur;

const on = { ...DEFAULT_REMINDER_PREFS, enabled: true };
// Sunday 4 October 2026, 06:00 in Jerusalem (03:00 UTC).
const sunday = new Date("2026-10-04T03:00:00Z");
const hm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", weekday: "short" }).format(d);

describe("the moment of a time in Jerusalem", () => {
  it("is right in summer and in winter, and after midnight", () => {
    expect(jerusalemMoment("2026-10-04", 7 * 60).toISOString()).toBe("2026-10-04T04:00:00.000Z");
    expect(jerusalemMoment("2026-12-01", 7 * 60).toISOString()).toBe("2026-12-01T05:00:00.000Z");
    // An arvit at 00:15 ends the day it is listed in.
    expect(jerusalemMoment("2026-10-04", 24 * 60 + 15).toISOString()).toBe("2026-10-04T21:15:00.000Z");
  });
});

describe("planning the reminders", () => {
  it("reminds of a weekday minyan its minutes before, on weekdays only, and never on Shabbat", () => {
    const plan = planReminders({ minyanim: [minyan({})], categories: [], shiurim: [], settings: null, prefs: on, from: sunday, days: 7 });
    expect(plan.map((p) => hm(p.at))).toEqual(["Sun 06:50", "Mon 06:50", "Tue 06:50", "Wed 06:50", "Thu 06:50"]);
    expect(plan[0]).toMatchObject({ kind: "minyan", title: "שחרית 07:00", body: "בעוד 10 דקות" });
  });

  it("says nothing when switched off, for a minyan the gabbai did not offer, or one not chosen", () => {
    const args = { categories: [], shiurim: [], settings: null, from: sunday, days: 2 };
    expect(planReminders({ ...args, minyanim: [minyan({})], prefs: DEFAULT_REMINDER_PREFS })).toEqual([]);
    expect(planReminders({ ...args, minyanim: [minyan({ notification_enabled: false })], prefs: on })).toEqual([]);
    expect(planReminders({ ...args, minyanim: [minyan({})], prefs: { ...on, selectedMinyanIds: ["other"] } })).toEqual([]);
    expect(planReminders({ ...args, minyanim: [minyan({})], prefs: { ...on, minyanim: false } })).toEqual([]);
  });

  it("follows a one-day change: a new time, or called off", () => {
    const args = { minyanim: [minyan({})], categories: [], shiurim: [], settings: null, prefs: on, from: sunday, days: 2 };
    const moved = planReminders({ ...args, overrides: [{ minyan_id: "m1", on_date: "2026-10-04", at_time: "07:30", cancelled: false, note: "" }] });
    expect(hm(moved[0].at)).toBe("Sun 07:20");
    const off = planReminders({ ...args, overrides: [{ minyan_id: "m1", on_date: "2026-10-04", at_time: null, cancelled: true, note: "" }] });
    expect(off.map((p) => hm(p.at))).toEqual(["Mon 06:50"]);
  });

  it("does not remind of what has passed", () => {
    const late = new Date("2026-10-04T05:00:00Z"); // 08:00
    const plan = planReminders({ minyanim: [minyan({})], categories: [], shiurim: [], settings: null, prefs: on, from: late, days: 1 });
    expect(plan).toEqual([]);
  });

  it("a Friday minyan before candle lighting is reminded; one after it is not", () => {
    const friday = [
      minyan({ id: "f1", day_type: "friday", fixed_time: "08:30", label: "שחרית" }),
      minyan({ id: "f2", day_type: "friday", fixed_time: "18:30", label: "קבלת שבת" }),
    ];
    const plan = planReminders({ minyanim: friday, categories: [], shiurim: [], settings: null, prefs: on, from: sunday, days: 7 });
    expect(plan.map((p) => `${hm(p.at)} ${p.title}`)).toEqual(["Fri 08:20 שחרית 08:30"]);
  });

  it("reminds of shiurim by their day, and not on Shabbat", () => {
    const plan = planReminders({
      minyanim: [],
      categories: [],
      shiurim: [shiur({}), shiur({ id: "s2", title: "גמרא", schedule_type: "weekly", day_of_week: 2, time_text: "21:00" })],
      settings: null,
      prefs: on,
      from: sunday,
      days: 7,
    });
    const days = plan.map((p) => hm(p.at).slice(0, 3));
    expect(days.filter((d) => d === "Tue")).toHaveLength(2);
    expect(days).not.toContain("Fri"); // 20:15 on Friday is already Shabbat
    expect(days).toContain("Sat"); // and on Saturday night it is over
    // In the middle of Shabbat: not a sound.
    const morning = planReminders({ minyanim: [], categories: [], shiurim: [shiur({ time_text: "10:00" })], settings: null, prefs: on, from: sunday, days: 7 });
    expect(morning.map((p) => hm(p.at).slice(0, 3))).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(plan[0]).toMatchObject({ kind: "shiur", title: "שיעור: דף יומי", body: "20:30 · בעוד 15 דקות · בית המדרש" });
  });
});

describe("Shabbat on the calendar", () => {
  it("is one window from Friday's candle lighting to Saturday night", () => {
    const w = holyWindows(sunday, 7, null);
    expect(w).toHaveLength(1);
    expect(hm(new Date(w[0].start)).slice(0, 3)).toBe("Fri");
    expect(hm(new Date(w[0].end)).slice(0, 3)).toBe("Sat");
  });
});

describe("the member's choices", () => {
  it("keeps what is sound and fills in the rest", () => {
    expect(normalizeReminderPrefs({ enabled: true, selectedMinyanIds: ["a", 3], sound: "loud" })).toMatchObject({
      enabled: true,
      selectedMinyanIds: ["a"],
      sound: true,
      alarm: false,
    });
    expect(normalizeReminderPrefs(null)).toEqual(DEFAULT_REMINDER_PREFS);
  });
});
