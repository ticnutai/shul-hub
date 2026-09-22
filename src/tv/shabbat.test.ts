import { describe, expect, it } from "vitest";

import { buildSlides } from "./useBoardData";
import { DEFAULT_TV_CONFIG } from "./config";
import { forgetServerTime, noteServerTime } from "./clock";
import { shabbatNow, nextCandleLighting } from "./shabbat";
import { jerusalemWeekday } from "@community/lib/minyan-time";

/**
 * The Shabbat screen takes the whole board: no times, no notices, just
 * "שבת שלום" until Shabbat is out. On the right evening that is the point
 * of it, and on any other evening it is the worst thing the board can do -
 * the shul loses its times and nobody in the building can put them back.
 *
 * So the question this file answers is not "does it come up on Friday" but
 * "is it down every other hour of the week".
 */
const settings = {
  latitude: 32.0807,
  longitude: 34.8338,
  candle_offset_minutes: 20,
  tzeit_offset_minutes: 20,
} as never;

const up = (t: Date) => shabbatNow(t, settings, 20) !== null;

describe("the Shabbat screen", () => {
  it("is down every hour of a week that is not Shabbat", () => {
    const wrong: string[] = [];
    // Sunday 20 September 2026 through Thursday, hour by hour.
    for (let day = 20; day <= 24; day++) {
      for (let h = 0; h < 24; h++) {
        const t = new Date(2026, 8, day, h, 0, 0);
        const wd = jerusalemWeekday(t);
        if (wd === 5 || wd === 6) continue;
        if (up(t)) wrong.push(t.toString());
      }
    }
    expect(wrong).toEqual([]);
  });

  it("comes up on Friday at candle lighting and not before", () => {
    // Friday 25 September 2026. Candles in Bnei Brak are 20 min before sunset.
    const before = new Date(2026, 8, 25, 17, 0, 0);
    const after = new Date(2026, 8, 25, 19, 0, 0);
    expect(up(before)).toBe(false);
    expect(up(after)).toBe(true);
  });

  it("stays up through Shabbat and goes down when it is out", () => {
    expect(up(new Date(2026, 8, 26, 9, 0, 0))).toBe(true); // Shabbat morning
    expect(up(new Date(2026, 8, 26, 17, 0, 0))).toBe(true); // Shabbat afternoon
    // Sunset Saturday is about 18:35; plus 20 minutes it is out.
    expect(up(new Date(2026, 8, 26, 23, 0, 0))).toBe(false);
    expect(up(new Date(2026, 8, 27, 9, 0, 0))).toBe(false); // Sunday
  });

  it("does not come up for Yom Kippur or a weekday Yom Tov", () => {
    // Yom Kippur 5787 was Monday 21 September 2026. Whatever else the board
    // should do that day, taking the times off the wall is not it.
    for (let h = 0; h < 24; h++) {
      expect(up(new Date(2026, 8, 21, h, 0, 0)), `Yom Kippur ${h}:00`).toBe(false);
    }
  });

  it("knows when the next candle lighting is, from any day", () => {
    const from = new Date(2026, 8, 22, 12, 0, 0); // Tuesday
    const next = nextCandleLighting(from, settings);
    expect(next).not.toBeNull();
    expect(jerusalemWeekday(next!)).toBe(5);
    expect(next!.getTime()).toBeGreaterThan(from.getTime());
  });
});

/**
 * The board refusing to take itself over on a clock it cannot believe.
 *
 * This is the case a gabbai actually reported: the screen was offline, and
 * the Shabbat screen was up. A box that loses power while the router is
 * down comes back with whatever clock it has, and on the wrong day of the
 * week that hides every time in the building.
 */
describe("the Shabbat screen and a clock that cannot be trusted", () => {
  const data = {
    settings, minyanim: [], categories: [], announcements: [], shiurim: [],
    stale: false, sync: { status: "idle" },
  } as never;
  const config = {
    ...structuredClone(DEFAULT_TV_CONFIG),
    shabbat: { ...structuredClone(DEFAULT_TV_CONFIG).shabbat, enabled: true },
  };
  const zmanim = {} as never;
  const isShabbat = (now: Date) =>
    buildSlides(data, config, now, zmanim).some((s) => s.kind === "shabbat");

  beforeEach(() => forgetServerTime());

  it("comes up on Friday evening when the clock is sound", () => {
    expect(isShabbat(new Date(2026, 8, 25, 19, 0, 0))).toBe(true);
  });

  it("stays down when the clock reads before the software existed", () => {
    // 2 January 1970 was a Friday. The old code would have obliged.
    expect(isShabbat(new Date(1970, 0, 2, 19, 0, 0))).toBe(false);
  });

  it("stays down when the clock has gone backwards since the server last spoke", () => {
    noteServerTime(new Date(2026, 8, 25, 20, 0).getTime());
    // The box came back believing it is the Friday a week earlier.
    expect(isShabbat(new Date(2026, 8, 18, 19, 0, 0))).toBe(false);
  });

  it("comes up again once the clock is back where it should be", () => {
    noteServerTime(new Date(2026, 8, 25, 18, 0).getTime());
    expect(isShabbat(new Date(2026, 8, 25, 19, 0, 0))).toBe(true);
  });
});
