import { describe, expect, it } from "vitest";
import { GeoLocation, Zmanim as HebcalZmanim } from "@hebcal/core";

import { calcZmanim, formatTime } from "./zmanim";
import { PLACES } from "./places";

const BNEI_BRAK = { latitude: 32.0807, longitude: 34.8338 };
const opts = { ...BNEI_BRAK, candleOffsetMinutes: 20, tzeitOffsetMinutes: 20 };

/**
 * The board's times, against the engine hebcal.com runs on.
 *
 * This file exists because the board was wrong and nobody could see it.
 * The astronomy under it claimed to be NOAA and was a rough approximation:
 * every zman an average of 1.31 minutes late, up to 2.39, on 211 days of
 * the year - and late is the lenient direction for sunset. It was caught by
 * a gabbai comparing the wall against a search engine, which is not a
 * quality process. This is.
 */
describe("the sun, against the reference implementation", () => {
  const geo = new GeoLocation("", BNEI_BRAK.latitude, BNEI_BRAK.longitude, 0, "Asia/Jerusalem");

  it("agrees to the second, every day of the year", () => {
    let worstSeconds = 0;
    for (let i = 0; i < 365; i++) {
      const day = new Date(2026, 0, 1 + i, 12, 0, 0);
      const ours = calcZmanim(day, opts);
      const ref = new HebcalZmanim(geo, day, false);
      for (const [mine, theirs] of [
        [ours.sunrise, ref.sunrise()],
        [ours.sunset, ref.sunset()],
        [ours.chatzot, ref.chatzot()],
        [ours.alot, ref.alotHaShachar()],
      ] as const) {
        const off = Math.abs(mine!.getTime() - theirs.getTime()) / 1000;
        worstSeconds = Math.max(worstSeconds, off);
      }
    }
    expect(worstSeconds).toBeLessThan(1);
  });

  it("agrees across the country, not only where it was checked", () => {
    for (const p of PLACES) {
      const day = new Date(2026, 5, 15, 12, 0, 0);
      const ours = calcZmanim(day, {
        latitude: p.latitude,
        longitude: p.longitude,
        candleOffsetMinutes: p.candle,
        tzeitOffsetMinutes: 20,
      });
      const ref = new HebcalZmanim(
        new GeoLocation("", p.latitude, p.longitude, 0, "Asia/Jerusalem"),
        day,
        false,
      );
      const off = Math.abs(ours.sunset!.getTime() - ref.sunset().getTime()) / 1000;
      expect(off, p.name).toBeLessThan(1);
    }
  });
});

describe("the times on the wall", () => {
  /** Checked against the luach and against a search engine, 22 Sept 2026. */
  it("gives Bnei Brak the day it actually had", () => {
    const z = calcZmanim(new Date(2026, 8, 22, 12, 0, 0), opts);
    expect(formatTime(z.sunrise)).toBe("06:28");
    expect(formatTime(z.chatzot)).toBe("12:33");
    expect(formatTime(z.sunset)).toBe("18:37");
    expect(formatTime(z.candle)).toBe("18:17");
  });

  it("is not late, which is the direction that matters for שקיעה", () => {
    // The old code was late every single day. Never again, silently.
    const geo = new GeoLocation("", BNEI_BRAK.latitude, BNEI_BRAK.longitude, 0, "Asia/Jerusalem");
    for (let i = 0; i < 60; i++) {
      const day = new Date(2026, 8, 1 + i, 12, 0, 0);
      const ours = calcZmanim(day, opts).sunset!.getTime();
      const ref = new HebcalZmanim(geo, day, false).sunset().getTime();
      expect(ours - ref, day.toDateString()).toBeLessThanOrEqual(1000);
    }
  });
});

describe("the two customs, which are not astronomy", () => {
  it("lights candles the town's number of minutes before sunset", () => {
    for (const minutes of [18, 20, 30, 40]) {
      const z = calcZmanim(new Date(2026, 8, 22, 12), { ...opts, candleOffsetMinutes: minutes });
      expect(Math.round((z.sunset!.getTime() - z.candle!.getTime()) / 60000)).toBe(minutes);
    }
  });

  it("counts the stars the shul's number of minutes after it", () => {
    for (const minutes of [13, 18, 20, 25, 40]) {
      const z = calcZmanim(new Date(2026, 8, 22, 12), { ...opts, tzeitOffsetMinutes: minutes });
      expect(Math.round((z.tzeit!.getTime() - z.sunset!.getTime()) / 60000)).toBe(minutes);
    }
  });
});
