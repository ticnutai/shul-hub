import { describe, expect, it } from "vitest";
import { civilHDate } from "@/lib/jewishDay";
import { hebrewDayAt } from "./hebrewDay";

// Israel, winter time (UTC+2). Saturday 31.10.2026 - כ׳ חשון, פרשת וירא; sunset about 16:52.
const at = (iso: string) => new Date(iso);
const day = (d: string) => ({ sunset: at(`${d}T14:52:00Z`), tzeit: at(`${d}T15:10:00Z`) });

describe("the day on the board: each part turns at its own time", () => {
  it("the date and the day's name stay until midnight, after sunset too", () => {
    const evening = hebrewDayAt(at("2026-11-02T19:00:00Z"), day("2026-11-02"), 40); // Monday, 21:00
    expect(evening.hebrew).toBe(civilHDate(at("2026-11-02T10:00:00Z")).renderGematriya(true));
    expect(evening.weekday).toBe("יום שני");
    // A minute past midnight in Israel: the next day's.
    const after = hebrewDayAt(at("2026-11-02T22:01:00Z"), day("2026-11-03"), 40);
    expect(after.hebrew).toBe(civilHDate(at("2026-11-03T10:00:00Z")).renderGematriya(true));
    expect(after.weekday).toBe("יום שלישי");
  });

  it("the parasha turns when Shabbat is out, not before", () => {
    expect(hebrewDayAt(at("2026-10-31T10:00:00Z"), day("2026-10-31"), 40).parasha).toBe("פרשת וירא");
    expect(hebrewDayAt(at("2026-10-31T15:00:00Z"), day("2026-10-31"), 40).parasha).toBe("פרשת וירא");
    const out = hebrewDayAt(at("2026-10-31T19:21:00Z"), day("2026-10-31"), 40);
    expect(out.parasha).toBe("פרשת חיי שרה");
    expect(out.weekday).toBe("יום שבת");
  });

  it("the additions to the prayers go by the coming day from sunset", () => {
    expect(hebrewDayAt(at("2026-11-02T10:00:00Z"), day("2026-11-02"), 40).prayerDate.getTime()).toBe(at("2026-11-02T10:00:00Z").getTime());
    expect(hebrewDayAt(at("2026-11-02T17:00:00Z"), day("2026-11-02"), 40).prayerDate.getTime()).toBe(at("2026-11-03T17:00:00Z").getTime());
  });

  it("without the day's zmanim: the civil day", () => {
    expect(hebrewDayAt(at("2026-10-31T19:21:00Z"), null).weekday).toBe("יום שבת");
  });
});
