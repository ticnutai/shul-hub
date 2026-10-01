import { describe, expect, it } from "vitest";

import type { Minyan, MinyanCategory } from "./data";
import { jerusalemDateKey } from "./minyan-time";
import { nextDateFor, planWeek, weekSchedule } from "./week-schedule";

const category = (over: Partial<MinyanCategory>): MinyanCategory =>
  ({
    id: "c", name: "", system_key: null, active: true, display_mode: "tabs", sort_order: 0,
    subcategories: [], visible_from: null, visible_until: null, community_id: "x",
    created_at: "", updated_at: "",
    ...over,
  }) as MinyanCategory;

const minyan = (over: Partial<Minyan>): Minyan =>
  ({
    id: "m", label: "מניין", prayer: "shacharit", day_type: "weekday", category_id: null,
    time_mode: "fixed", fixed_time: "07:00:00", relative_to: null,
    offset_minutes: 0, active: true, room: "", note: "", sort_order: 0,
    active_from: null, active_until: null,
    ...over,
  }) as Minyan;

const PRAYERS = [
  { id: "shacharit", label: "שחרית" },
  { id: "mincha", label: "מנחה" },
  { id: "arvit", label: "ערבית" },
];
const weekday = category({ id: "wd", name: "ימות החול", system_key: "weekday", subcategories: PRAYERS });
const friday = category({ id: "fr", name: "יום שישי", system_key: "friday", subcategories: PRAYERS });
const shabbat = category({ id: "sh", name: "שבת", system_key: "shabbat", subcategories: PRAYERS });

// Wednesday 14 October 2026, in Jerusalem.
const WEDNESDAY = new Date("2026-10-14T09:00:00+03:00");

describe("the date each day tab stands for", () => {
  it("from a Wednesday: the weekday is today, Friday and Shabbat the coming ones", () => {
    expect(jerusalemDateKey(nextDateFor("weekday", WEDNESDAY))).toBe("2026-10-14");
    expect(jerusalemDateKey(nextDateFor("friday", WEDNESDAY))).toBe("2026-10-16");
    expect(jerusalemDateKey(nextDateFor("shabbat", WEDNESDAY))).toBe("2026-10-17");
  });

  it("from a Shabbat: the weekday is the Sunday after it, and Shabbat is today", () => {
    const saturday = new Date("2026-10-17T22:30:00+03:00");
    expect(jerusalemDateKey(nextDateFor("weekday", saturday))).toBe("2026-10-18");
    expect(jerusalemDateKey(nextDateFor("shabbat", saturday))).toBe("2026-10-17");
    expect(jerusalemDateKey(nextDateFor("friday", saturday))).toBe("2026-10-23");
  });
});

describe("the whole week", () => {
  const minyanim = [
    minyan({ id: "1", day_type: "weekday", prayer: "shacharit", fixed_time: "06:15:00" }),
    minyan({ id: "2", day_type: "weekday", prayer: "mincha", fixed_time: "13:30:00" }),
    minyan({ id: "3", category_id: "sh", day_type: "shabbat", prayer: "shacharit", fixed_time: "08:30:00" }),
  ];
  const all = [weekday, friday, shabbat];
  const names = (days: { category: { name: string } }[]) => days.map((d) => d.category.name);

  it("lists each day with its minyanim, and leaves out a day with nothing in it", () => {
    const week = weekSchedule({ categories: all, minyanim, settings: null, today: WEDNESDAY, order: "fixed" });
    expect(names(week)).toEqual(["ימות החול", "שבת"]);
    expect(week[0].rows.map((r) => r.time)).toEqual(["06:15", "13:30"]);
    expect(week[0].isToday).toBe(true);
    expect(week[1].isToday).toBe(false);
  });

  it("today on top: from a Friday, Friday, then Shabbat, then the weekdays", () => {
    const friday_ = new Date("2026-10-16T09:00:00+03:00");
    const plan = planWeek(all, friday_, "today_first");
    expect(names(plan)).toEqual(["יום שישי", "שבת", "ימות החול"]);
    expect(plan.map((d) => d.isToday)).toEqual([true, false, false]);
    expect(jerusalemDateKey(plan[2].date)).toBe("2026-10-18");
  });

  it("today on top: on Shabbat, Shabbat first; in a fixed order it stays where it is, marked", () => {
    const saturday = new Date("2026-10-17T10:00:00+03:00");
    expect(names(planWeek(all, saturday, "today_first"))).toEqual(["שבת", "ימות החול", "יום שישי"]);
    const fixed = planWeek(all, saturday, "fixed");
    expect(names(fixed)).toEqual(["ימות החול", "יום שישי", "שבת"]);
    expect(fixed.map((d) => d.isToday)).toEqual([false, false, true]);
  });

  it("a Shabbat with no שבת tab marks nothing as today", () => {
    const saturday = new Date("2026-10-17T10:00:00+03:00");
    const plan = planWeek([weekday, friday], saturday, "today_first");
    expect(plan.some((d) => d.isToday)).toBe(false);
    expect(names(plan)).toEqual(["ימות החול", "יום שישי"]);
  });

  it("a tab the gabbai made stands beside today's, as in the day view", () => {
    const selichot = category({ id: "se", name: "סליחות", system_key: null, sort_order: -1 });
    const plan = planWeek([selichot, ...all], WEDNESDAY, "today_first");
    expect(names(plan)).toEqual(["ימות החול", "סליחות", "יום שישי", "שבת"]);
    expect(plan.map((d) => d.isToday)).toEqual([true, true, false, false]);
  });

  it("on a special day with its own tab, that tab is today's and the weekday moves on", () => {
    const yomKippur = category({ id: "yk", name: "יום כיפור", system_key: "event:yom_kippur", subcategories: PRAYERS });
    // יום כיפור תשפ״ז: Monday 21 September 2026.
    const day = new Date("2026-09-21T10:00:00+03:00");
    const plan = planWeek([...all, yomKippur], day, "today_first");
    expect(plan[0].category.name).toBe("יום כיפור");
    expect(plan[0].isToday).toBe(true);
    const wd = plan.find((d) => d.category.system_key === "weekday")!;
    expect(jerusalemDateKey(wd.date)).toBe("2026-09-22");
    expect(wd.isToday).toBe(false);
  });

  it("leaves out a special day's own tab on an ordinary day, and a minyan out of its season on that day", () => {
    const yomKippur = category({ id: "yk", name: "יום כיפור", system_key: "event:yom_kippur", subcategories: PRAYERS });
    const seasonal = minyan({ id: "4", day_type: "friday", prayer: "mincha", fixed_time: "12:00:00", active_until: "2026-10-15" });
    const week = weekSchedule({ categories: [...all, yomKippur], minyanim: [...minyanim, seasonal], settings: null, today: WEDNESDAY, order: "fixed" });
    expect(names(week)).toEqual(["ימות החול", "שבת"]);
  });

  it("today's one-day exceptions reach today's tab only", () => {
    const overrides = new Map([["1", { id: "o", minyan_id: "1", date: "2026-10-14", at_time: "06:45", cancelled: false, note: "" } as never]]);
    const week = weekSchedule({ categories: all, minyanim, settings: null, today: WEDNESDAY, order: "fixed", todayOverrides: overrides });
    expect(week[0].rows[0].time).toBe("06:45");
  });
});
