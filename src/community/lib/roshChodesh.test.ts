import { HDate, months } from "@hebcal/core";
import { describe, expect, it } from "vitest";
import { dayTitleOn, roshChodeshOn } from "./specialDays";

/** Noon in Jerusalem on the civil day of a Hebrew date. */
const at = (day: number, month: number, year: number) => {
  const g = new HDate(day, month, year).greg();
  return new Date(Date.UTC(g.getFullYear(), g.getMonth(), g.getDate(), 9));
};

describe("Rosh Chodesh: one day or two, by the month that ends", () => {
  it("is two days after a month of 30: the first on the 30th (30 Tishrei 5787), the second on the 1st", () => {
    expect(roshChodeshOn(at(30, months.TISHREI, 5787))).toEqual({ month: "חשון", day: 1, title: "ראש חודש חשון · היום הראשון" });
    expect(roshChodeshOn(at(1, months.CHESHVAN, 5787))).toEqual({ month: "חשון", day: 2, title: "ראש חודש חשון · היום השני" });
    expect(dayTitleOn(at(30, months.TISHREI, 5787))).toBe("ראש חודש חשון · היום הראשון");
  });

  it("is one day after a month of 29 (Adar has 29: Rosh Chodesh Nisan)", () => {
    const nisan = roshChodeshOn(at(1, months.NISAN, 5786))!;
    expect(nisan.day).toBeNull();
    expect(nisan.title).toBe("ראש חודש ניסן");
  });

  it("follows the calendar of each year: every month, its days by the month before", () => {
    for (const year of [5786, 5787]) {
      const count = HDate.monthsInYear(year);
      for (let m = 1; m <= count; m++) {
        if (m === months.TISHREI) continue; // 1 Tishrei is Rosh Hashana, not Rosh Chodesh
        const prev = m === 1 ? count : m - 1; // Nisan follows the year's last month (Adar or Adar II)
        const prevYear = m === months.TISHREI ? year - 1 : year;
        const long = HDate.daysInMonth(prev, prevYear) === 30;
        const first = roshChodeshOn(at(1, m, year));
        expect(first, `1st of month ${m}/${year}`).not.toBeNull();
        expect(first!.day, `1st of month ${m}/${year}`).toBe(long ? 2 : null);
        if (long) expect(roshChodeshOn(at(30, prev, prevYear))!.day).toBe(1);
      }
    }
  });

  it("names Adar I and Adar II in a leap year (5787)", () => {
    expect(HDate.isLeapYear(5787)).toBe(true);
    expect(roshChodeshOn(at(1, months.ADAR_II, 5787))!.title).toMatch(/^ראש חודש אדר ב/);
    expect(roshChodeshOn(at(1, months.ADAR_I, 5787))!.title).toMatch(/^ראש חודש אדר א/);
  });

  it("says nothing on an ordinary day", () => {
    expect(roshChodeshOn(at(3, months.CHESHVAN, 5787))).toBeNull();
    expect(dayTitleOn(at(3, months.CHESHVAN, 5787))).toBe("");
  });
});
