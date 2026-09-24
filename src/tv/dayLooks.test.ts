import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "./config";
import { applyDayLook, dayKindAt } from "./dayLooks";

/** An hour in Israel (UTC+3 in these months), whatever the machine's timezone. */
const il = (iso: string, hour: number) => new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00+03:00`);

describe("what kind of day it is", () => {
  it("knows the kinds, highest first", () => {
    expect(dayKindAt(il("2026-09-23", 12), null, 20)).toBeNull(); // Wednesday
    expect(dayKindAt(il("2026-09-25", 10), null, 20)).toBe("friday"); // Friday morning
    expect(dayKindAt(il("2026-09-25", 20), null, 20)).toBe("shabbat"); // after candles
    expect(dayKindAt(il("2026-09-28", 12), null, 20)).toBe("festival"); // Chol HaMoed Sukkot
    expect(dayKindAt(il("2026-10-11", 12), null, 20)).toBe("roshChodesh"); // Rosh Chodesh Cheshvan
    expect(dayKindAt(il("2026-12-06", 12), null, 20)).toBe("festival"); // Chanukah
    expect(dayKindAt(new Date("2027-03-23T12:00:00+02:00"), null, 20)).toBe("festival"); // Purim
  });

  it("a Yom Tov that is also Shabbat is Shabbat", () => {
    // Sukkot I, 26 September 2026, is a Saturday.
    expect(dayKindAt(il("2026-09-26", 10), null, 20)).toBe("shabbat");
  });
});

describe("wearing the day's look", () => {
  const config = normalizeTvConfig({
    ...DEFAULT_TV_CONFIG,
    screenLayout: "dashboard",
    dayLooks: {
      festival: { screenLayout: "illustrated", illustration: "stone", theme: "royal" },
      friday: { theme: "shabbat" },
      roshChodesh: { screenLayout: "grid", illustration: "nowhere", theme: "no-such-theme" },
    },
  });

  it("keeps only what exists", () => {
    expect(config.dayLooks.festival).toEqual({ screenLayout: "illustrated", illustration: "stone", theme: "royal" });
    expect(config.dayLooks.roshChodesh).toBeUndefined();
  });

  it("changes what the look names, and nothing else", () => {
    const sukkot = applyDayLook(config, il("2026-09-28", 12), null);
    expect([sukkot.screenLayout, sukkot.illustration, sukkot.theme]).toEqual(["illustrated", "stone", "royal"]);
    const weekday = applyDayLook(config, il("2026-09-23", 12), null);
    expect(weekday).toBe(config);
    const friday = applyDayLook(config, il("2026-10-16", 9), null); // an ordinary Friday (2 Oct is Hoshana Rabba: festival wins)
    expect([friday.screenLayout, friday.theme]).toEqual(["dashboard", "shabbat"]);
  });
});
