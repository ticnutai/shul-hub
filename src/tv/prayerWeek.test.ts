/**
 * The board's own choice of days for the prayer times (tv_config.prayerDays),
 * separate from the website's: today alone, as every board was until now, or
 * the whole week - today first, or in the tabs' order. Held down here: today
 * stays exactly as it was; the week comes in planWeek's order with each day's
 * own minyanim; and only today's minyanim are ever "הבא" or over.
 */
import { describe, expect, it } from "vitest";
import type { Minyan, MinyanCategory } from "@community/lib/data";
import { zmanimFor } from "@community/lib/minyan-time";

import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "./config";
import { buildSlides, minyanNow, prayerDaysOf, type BoardData } from "./useBoardData";

const PRAYERS = [
  { id: "shacharit", label: "שחרית" },
  { id: "mincha", label: "מנחה" },
];
const category = (over: Partial<MinyanCategory>): MinyanCategory =>
  ({
    id: "c", name: "", system_key: null, active: true, display_mode: "tabs", sort_order: 0,
    subcategories: PRAYERS, visible_from: null, visible_until: null, community_id: "x",
    created_at: "", updated_at: "",
    ...over,
  }) as MinyanCategory;
const minyan = (over: Partial<Minyan>): Minyan =>
  ({
    id: "m", label: "מניין", prayer: "shacharit", day_type: "weekday", category_id: null,
    time_mode: "fixed", fixed_time: "07:00:00", relative_to: null, offset_minutes: 0,
    active: true, room: "", note: "", sort_order: 0, active_from: null, active_until: null,
    community_id: "x",
    ...over,
  }) as Minyan;

const data: BoardData = {
  settings: null,
  minyanim: [
    minyan({ id: "w1", day_type: "weekday", fixed_time: "06:15:00" }),
    minyan({ id: "w2", day_type: "weekday", prayer: "mincha", fixed_time: "13:30:00" }),
    minyan({ id: "f1", day_type: "friday", fixed_time: "07:00:00" }),
    minyan({ id: "s1", day_type: "shabbat", fixed_time: "08:30:00" }),
  ],
  categories: [
    category({ id: "wd", name: "ימות החול", system_key: "weekday", sort_order: 1 }),
    category({ id: "fr", name: "יום שישי", system_key: "friday", sort_order: 2 }),
    category({ id: "sh", name: "שבת", system_key: "shabbat", sort_order: 3 }),
  ],
  announcements: [],
  shiurim: [],
  overrides: [],
  stale: false,
  anyLoaded: true,
  sync: { status: "live", lastSyncedAt: null },
};

// Friday 16 October 2026, 10:00 - after Friday's shacharit.
const FRIDAY = new Date("2026-10-16T10:00:00+03:00");
const z = zmanimFor(FRIDAY, null);
const withDays = (prayerDays: TvConfig["prayerDays"]): TvConfig => ({ ...structuredClone(DEFAULT_TV_CONFIG), prayerDays });
const prayerSlides = (config: TvConfig) =>
  buildSlides(data, config, FRIDAY, z).filter((s): s is Extract<typeof s, { kind: "prayer" }> => s.kind === "prayer");

describe("the board's days of prayer times", () => {
  it("is today alone unless the board was set otherwise, and a stored value is kept only when known", () => {
    expect(DEFAULT_TV_CONFIG.prayerDays).toBe("today");
    expect(normalizeTvConfig({ prayerDays: "week_today" }).prayerDays).toBe("week_today");
    expect(normalizeTvConfig({ prayerDays: "someday" }).prayerDays).toBe("today");
    const slides = prayerSlides(withDays("today"));
    expect(slides.map((s) => s.title)).toEqual(["יום שישי"]);
    expect(slides[0].isToday).toBe(true);
  });

  it("the week, today first: Friday, then Shabbat, then the weekdays, each with its own minyanim", () => {
    const slides = prayerSlides(withDays("week_today"));
    expect(slides.map((s) => s.title)).toEqual(["יום שישי · היום", "שבת", "ימות החול"]);
    expect(slides.map((s) => s.isToday)).toEqual([true, false, false]);
    expect(slides[2].rows.map((r) => r.time)).toEqual(["06:15", "13:30"]);
  });

  it("the week in a fixed order keeps the tabs' order, today still marked", () => {
    const slides = prayerSlides(withDays("week_fixed"));
    expect(slides.map((s) => s.title)).toEqual(["ימות החול", "יום שישי · היום", "שבת"]);
  });

  it("only today's minyanim are next or over", () => {
    const [today, shabbat] = prayerSlides(withDays("week_today"));
    // Friday 10:00: the 07:00 is over and there is nothing next today.
    const t = minyanNow(today.rows, FRIDAY, today.isToday);
    expect(t.next).toBe(-1);
    expect(t.past(0)).toBe(true);
    // Shabbat's 08:30 is earlier in the day than now, and still neither.
    const s = minyanNow(shabbat.rows, FRIDAY, shabbat.isToday);
    expect(s.next).toBe(-1);
    expect(s.past(0)).toBe(false);
  });

  it("a one-list frame (the medallion) gets today, then each other day - not one list of the whole week", () => {
    const days = prayerDaysOf(buildSlides(data, withDays("week_today"), FRIDAY, z));
    expect(days.map((d) => [d.isToday, d.title, d.rows.length])).toEqual([
      [true, "", 1],
      [false, "שבת", 1],
      [false, "ימות החול", 2],
    ]);
    // Today only: one day, as the medallion always showed it.
    expect(prayerDaysOf(buildSlides(data, withDays("today"), FRIDAY, z)).length).toBe(1);
  });
});
