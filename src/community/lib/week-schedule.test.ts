import { describe, expect, it } from "vitest";

import type { Minyan, MinyanCategory } from "./data";
import { jerusalemDateKey } from "./minyan-time";
import { nextDateFor, weekSchedule } from "./week-schedule";

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

  it("lists each day with its prayers, and leaves out a day and a prayer with nothing in them", () => {
    const week = weekSchedule({ categories: [weekday, friday, shabbat], minyanim, settings: null, today: WEDNESDAY });
    expect(week.map((d) => d.category.name)).toEqual(["ימות החול", "שבת"]);
    expect(week[0].groups.map((g) => g.label)).toEqual(["שחרית", "מנחה"]);
    expect(week[0].groups[0].rows.map((r) => r.time)).toEqual(["06:15"]);
    expect(week[1].groups.map((g) => g.label)).toEqual(["שחרית"]);
  });

  it("leaves out a special day's own tab, and a minyan out of its season on that day", () => {
    const yomKippur = category({ id: "yk", name: "יום כיפור", system_key: "event:yom_kippur", subcategories: PRAYERS });
    const seasonal = minyan({ id: "4", day_type: "friday", prayer: "mincha", fixed_time: "12:00:00", active_until: "2026-10-15" });
    const week = weekSchedule({ categories: [weekday, friday, shabbat, yomKippur], minyanim: [...minyanim, seasonal], settings: null, today: WEDNESDAY });
    expect(week.map((d) => d.category.name)).toEqual(["ימות החול", "שבת"]);
  });

  it("keeps a minyan whose prayer the tab no longer lists, at the end", () => {
    const week = weekSchedule({
      categories: [weekday],
      minyanim: [...minyanim, minyan({ id: "5", day_type: "weekday", prayer: "selichot", fixed_time: "05:30:00" })],
      settings: null,
      today: WEDNESDAY,
    });
    expect(week[0].groups.map((g) => g.label)).toEqual(["שחרית", "מנחה", "עוד"]);
  });
});
