import { describe, expect, it } from "vitest";

import { PLACES, placeAt, searchPlaces } from "./places";
import { calcZmanim, formatTime } from "./zmanim";

describe("the places a synagogue can be", () => {
  it("are all in Israel, with sane coordinates", () => {
    expect(PLACES.length).toBeGreaterThanOrEqual(35);
    for (const p of PLACES) {
      expect(p.latitude, p.name).toBeGreaterThan(29.4);
      expect(p.latitude, p.name).toBeLessThan(33.4);
      expect(p.longitude, p.name).toBeGreaterThan(34.2);
      expect(p.longitude, p.name).toBeLessThan(35.9);
      expect(p.candle, p.name).toBeGreaterThanOrEqual(15);
      expect(p.candle, p.name).toBeLessThanOrEqual(40);
    }
  });

  it("names no place twice", () => {
    const names = PLACES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("carries the customs that differ, which is the point of the list", () => {
    const by = (n: string) => PLACES.find((p) => p.name === n)!;
    expect(by("ירושלים").candle).toBe(40);
    expect(by("חיפה").candle).toBe(30);
    expect(by("צפת").candle).toBe(30);
    expect(by("בני ברק").candle).toBe(20);
  });
});

describe("finding a place", () => {
  it("finds it by name", () => {
    expect(searchPlaces("בני ברק")[0].name).toBe("בני ברק");
    expect(searchPlaces("ירוש")[0].name).toBe("ירושלים");
  });

  it("finds it by what people actually call it", () => {
    expect(searchPlaces("קרית ספר")[0].name).toBe("מודיעין עילית");
    expect(searchPlaces("נצרת עילית")[0].name).toBe("נוף הגליל");
  });

  it("is not thrown by a geresh or a maqaf", () => {
    expect(searchPlaces("תל אביב")[0].name).toContain("תל אביב");
    expect(searchPlaces("תל-אביב")[0].name).toContain("תל אביב");
  });

  it("returns nothing rather than a wrong guess", () => {
    expect(searchPlaces("לונדון")).toEqual([]);
  });
});

describe("recognising a board that was set up by hand", () => {
  it("knows its own town from its coordinates", () => {
    expect(placeAt(32.0807, 34.8338)?.name).toBe("בני ברק");
    // A shul is not at the exact point the table calls the middle of town.
    expect(placeAt(32.085, 34.838)?.name).toBe("בני ברק");
  });

  it("says nothing when the coordinates are somewhere else", () => {
    expect(placeAt(51.5074, -0.1278)).toBeNull(); // London
    expect(placeAt(32.5, 35.0)).toBeNull(); // open country
  });
});

/**
 * The reason any of this exists: the same evening is a different time in
 * two towns 35 km apart, and the board has to be right about which one.
 */
describe("the times a place actually produces", () => {
  const at = (name: string) => {
    const p = PLACES.find((x) => x.name === name)!;
    return calcZmanim(new Date("2026-09-22T12:00:00Z"), {
      latitude: p.latitude,
      longitude: p.longitude,
      candleOffsetMinutes: p.candle,
      tzeitOffsetMinutes: 20,
    });
  };

  it("puts sunset at a different minute in Jerusalem than in Bnei Brak", () => {
    const bb = at("בני ברק").sunset!;
    const yr = at("ירושלים").sunset!;
    const diff = Math.abs(bb.getTime() - yr.getTime()) / 60000;
    expect(diff).toBeGreaterThan(0.5);
    expect(diff).toBeLessThan(5);
  });

  it("and the difference in candles is far larger, because it is a custom", () => {
    const bb = at("בני ברק");
    const yr = at("ירושלים");
    const gap = (z: ReturnType<typeof at>) =>
      (z.sunset!.getTime() - z.candle!.getTime()) / 60000;
    expect(Math.round(gap(bb))).toBe(20);
    expect(Math.round(gap(yr))).toBe(40);
  });

  it("gives Bnei Brak the times it actually had", () => {
    // 22 September 2026. These were 18:39 and 18:19 when this test was
    // first written, because the astronomy underneath was a minute and a
    // half late - and writing the wrong number into a test is how a wrong
    // number stops being noticed. They are now the reference's, and
    // zmanim.test.ts holds the whole year to it.
    const z = at("בני ברק");
    expect(formatTime(z.sunset)).toBe("18:37");
    expect(formatTime(z.candle)).toBe("18:17");
  });

  it("works for every place on the list without a gap", () => {
    for (const p of PLACES) {
      const z = calcZmanim(new Date("2026-09-22T12:00:00Z"), {
        latitude: p.latitude,
        longitude: p.longitude,
        candleOffsetMinutes: p.candle,
        tzeitOffsetMinutes: 20,
      });
      for (const k of ["sunrise", "sunset", "chatzot", "plag", "tzeit", "candle"] as const) {
        expect(z[k], `${p.name}: ${k}`).not.toBeNull();
      }
    }
  });
});
