import { describe, expect, it } from "vitest";
import { HDate } from "@hebcal/core";
import { hebrewDayAt } from "./hebrewDay";

// Israel, winter time (UTC+2). Saturday 31.10.2026 - כ׳ חשון, פרשת וירא; sunset about 16:52.
const at = (iso: string) => new Date(iso);
const day = (d: string) => ({ sunset: at(`${d}T14:52:00Z`), tzeit: at(`${d}T15:10:00Z`) });

describe("the Hebrew day on the board turns at sunset", () => {
  it("by day: the day's own date, its name and its parasha", () => {
    const h = hebrewDayAt(at("2026-10-31T10:00:00Z"), day("2026-10-31"), 40);
    expect(h.hebrew).toBe(new HDate(at("2026-10-31T10:00:00Z")).renderGematriya(true));
    expect(h.weekday).toBe("יום שבת");
    expect(h.parasha).toBe("פרשת וירא");
  });

  it("Shabbat after sunset, before it is out: tomorrow's date, still Shabbat and still its parasha", () => {
    const h = hebrewDayAt(at("2026-10-31T15:00:00Z"), day("2026-10-31"), 40);
    expect(h.hebrew).toBe(new HDate(at("2026-11-01T10:00:00Z")).renderGematriya(true));
    expect(h.weekday).toBe("יום שבת");
    expect(h.parasha).toBe("פרשת וירא");
  });

  it("מוצאי שבת: tomorrow's date, and the coming week's parasha", () => {
    const h = hebrewDayAt(at("2026-10-31T19:21:00Z"), day("2026-10-31"), 40);
    expect(h.hebrew).toBe(new HDate(at("2026-11-01T10:00:00Z")).renderGematriya(true));
    expect(h.weekday).toBe("מוצאי שבת");
    expect(h.parasha).toBe("פרשת חיי שרה");
  });

  it("Friday night is ליל שבת, a weekday night is the eve of the next day", () => {
    expect(hebrewDayAt(at("2026-10-30T17:00:00Z"), day("2026-10-30"), 40).weekday).toBe("ליל שבת");
    const monday = hebrewDayAt(at("2026-11-02T17:00:00Z"), day("2026-11-02"), 40);
    expect(monday.weekday).toBe("אור ליום שלישי");
    expect(monday.hebrew).toBe(new HDate(at("2026-11-03T10:00:00Z")).renderGematriya(true));
    expect(hebrewDayAt(at("2026-11-02T10:00:00Z"), day("2026-11-02"), 40).weekday).toBe("יום שני");
  });

  it("without the day's zmanim: the civil day, as before", () => {
    expect(hebrewDayAt(at("2026-10-31T19:21:00Z"), null).weekday).toBe("יום שבת");
  });
});
