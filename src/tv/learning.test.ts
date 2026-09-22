import { describe, expect, it } from "vitest";
import { amudYomi, dafYomi, stripNiqqud, upcomingDays, weeklyParasha } from "./learning";

// Golden values produced by @hebcal/learning 6.11 (the reference implementation).
// The full comparison ran over every day 1990-2045 with zero differences; these
// are the points most likely to regress: cycle starts, the last day of a cycle,
// and the Kinnim/Tamid/Middot pages printed inside Meilah's numbering.
const GOLDEN: Array<[number, number, number, string, number]> = [
  [2020, 1, 5, "ברכות", 2], // cycle 14 begins
  [2020, 1, 4, "נדה", 73], // cycle 13 ends
  [2012, 8, 3, "ברכות", 2], // cycle 13 begins
  [2027, 6, 7, "נדה", 73], // cycle 14 ends
  [2019, 10, 17, "תמיד", 30],
  [2019, 10, 20, "תמיד", 33], // last day of Tamid
  [2019, 10, 21, "מידות", 34], // Middot starts at 34, not 35
  [2019, 10, 24, "מידות", 37],
  [2019, 10, 25, "נדה", 2],
  [2027, 3, 24, "מידות", 34],
  [2027, 3, 27, "מידות", 37],
  [2027, 3, 28, "נדה", 2],
  [2022, 10, 2, "כתובות", 88],
  [2026, 9, 18, "חולין", 141],
  [1995, 6, 1, "סנהדרין", 52],
  [2034, 2, 15, "חולין", 137],
  [2040, 12, 31, "מנחות", 46],
  [2023, 5, 20, "גיטין", 4],
  [2025, 1, 1, "סנהדרין", 15],
  [2031, 7, 4, "בבא קמא", 90],
];

describe("dafYomi", () => {
  it.each(GOLDEN)("%i-%i-%i is %s %i", (y, m, d, tractate, daf) => {
    const result = dafYomi(new Date(y, m - 1, d));
    expect(result?.tractate).toBe(tractate);
    expect(result?.daf).toBe(daf);
  });

  it("renders the daf in Hebrew numerals", () => {
    expect(dafYomi(new Date(2026, 8, 18))?.label).toBe("חולין קמ״א");
  });

  it("returns null before the first cycle", () => {
    expect(dafYomi(new Date(1920, 0, 1))).toBeNull();
  });
});

describe("weeklyParasha", () => {
  it("names the coming Shabbat's parasha without niqqud", () => {
    // Friday 18 Sep 2026 -> Shabbat Shuva, Haazinu.
    expect(weeklyParasha(new Date(2026, 8, 18))).toBe("פרשת האזינו");
  });

  it("on a weekday whose Shabbat is a festival, keeps naming the parasha we are in", () => {
    // The Shabbat of 26 Sep 2026 is Sukkot I - a festival reading, not a
    // parasha. On the weekdays around it the board should still answer
    // "which parasha are we in?" with the last one read, Haazinu.
    expect(weeklyParasha(new Date(2026, 8, 20))).toBe("פרשת האזינו"); // Sunday before
    expect(weeklyParasha(new Date(2026, 8, 24))).toBe("פרשת האזינו"); // Thursday before
    expect(weeklyParasha(new Date(2026, 8, 27))).toBe("פרשת האזינו"); // chol hamoed
  });

  it("on the festival Shabbat itself, names what is actually read", () => {
    expect(weeklyParasha(new Date(2026, 8, 26))).toBe("סוכות א׳"); // full spelling, not "סכות"
    expect(weeklyParasha(new Date(2026, 9, 3))).toBe("שמיני עצרת");
  });

  it("returns to the regular cycle as soon as it resumes", () => {
    expect(weeklyParasha(new Date(2026, 9, 10))).toBe("פרשת בראשית");
    expect(weeklyParasha(new Date(2026, 9, 14))).toBe("פרשת נח");
  });
});

describe("upcomingDays", () => {
  it("lists Yom Kippur three days ahead of 18 Sep 2026", () => {
    const days = upcomingDays(new Date(2026, 8, 18));
    const yk = days.find((d) => d.title === "יום כיפור");
    expect(yk?.inDays).toBe(3);
    expect(yk?.major).toBe(true);
  });
});

describe("stripNiqqud", () => {
  it("removes vowel points and cantillation", () => {
    expect(stripNiqqud("פָּרָשַׁת הַאֲזִינוּ")).toBe("פרשת האזינו");
  });
});

/**
 * Amud Yomi. The anchor is the only fact here that came from outside: the
 * shul was on שבת דף ז׳ ע״א on 22 September 2026. Everything else follows
 * from counting, so what these check is that the counting is right - in
 * both directions, across the seam between tractates, and through the
 * Hebrew numerals that are easy to get wrong.
 */
describe("amud yomi", () => {
  const on = (iso: string) => amudYomi(new Date(`${iso}T09:00:00`)).label;

  it("is where the shul actually was on the day it was anchored", () => {
    expect(on("2026-09-22")).toBe("שבת דף ז׳ ע״א");
  });

  it("turns the page one side at a time", () => {
    expect(on("2026-09-23")).toBe("שבת דף ז׳ ע״ב");
    expect(on("2026-09-24")).toBe("שבת דף ח׳ ע״א");
    expect(on("2026-09-25")).toBe("שבת דף ח׳ ע״ב");
    expect(on("2026-09-26")).toBe("שבת דף ט׳ ע״א");
  });

  it("counts backwards from the anchor just as correctly", () => {
    expect(on("2026-09-21")).toBe("שבת דף ו׳ ע״ב");
    expect(on("2026-09-20")).toBe("שבת דף ו׳ ע״א");
  });

  it("writes fifteen and sixteen the way they are written, not as a Name", () => {
    // ט״ו and ט״ז, never י״ה / י״ו.
    const fifteen = amudYomi(new Date("2026-09-22T09:00:00"));
    expect(fifteen.daf).toBe(7);
    expect(on("2026-10-08")).toBe("שבת דף ט״ו ע״א");
    expect(on("2026-10-10")).toBe("שבת דף ט״ז ע״א");
  });

  it("carries on into the next tractate instead of stopping", () => {
    // שבת ends at קנז ע״ב, 301 days after the anchor.
    const end = new Date("2026-09-22T09:00:00");
    end.setDate(end.getDate() + 301);
    expect(amudYomi(end).label).toBe("שבת דף קנ״ז ע״ב");

    const next = new Date(end);
    next.setDate(next.getDate() + 1);
    expect(amudYomi(next).label).toBe("עירובין דף ב׳ ע״א");
  });

  it("never runs out: it wraps back to the start of the Shas", () => {
    const far = new Date("2026-09-22T09:00:00");
    far.setDate(far.getDate() + 20_000);
    const a = amudYomi(far);
    expect(a.label).toMatch(/^[^ ]+( [^ ]+)* דף .+ ע״[אב]$/);
    expect(a.daf).toBeGreaterThanOrEqual(2);
    expect([0, 1]).toContain(a.side);
  });
});
