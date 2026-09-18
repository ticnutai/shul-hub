import { describe, expect, it } from "vitest";
import { dafYomi, stripNiqqud, upcomingDays, weeklyParasha } from "./learning";

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
});

describe("upcomingDays", () => {
  it("lists Yom Kippur three days ahead of 18 Sep 2026", () => {
    const days = upcomingDays(new Date(2026, 8, 18));
    const yk = days.find((d) => d.title === "יום כפור");
    expect(yk?.inDays).toBe(3);
    expect(yk?.major).toBe(true);
  });
});

describe("stripNiqqud", () => {
  it("removes vowel points and cantillation", () => {
    expect(stripNiqqud("פָּרָשַׁת הַאֲזִינוּ")).toBe("פרשת האזינו");
  });
});
