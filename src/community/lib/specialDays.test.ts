import { describe, expect, it } from "vitest";
import { nextDatesOf, specialDaysOn, specialZmanim, todaysCategories, eventSystemKey } from "./specialDays";
import type { Zmanim } from "./zmanim";

/** Noon in Israel on a calendar day. */
const il = (day: string) => new Date(`${day}T09:00:00Z`);
const keys = (day: string) => specialDaysOn(il(day)).map((d) => d.key);

const z = (): Zmanim => {
  const at = (h: number) => new Date(Date.UTC(2026, 0, 1, h));
  return {
    alot: at(2), misheyakir: at(3), sunrise: at(4), sof_zman_shma: at(6), sof_zman_tefila: at(7),
    chatzot: at(9), mincha_gedola: at(10), plag: at(13), candle: at(14), sunset: at(15), tzeit: at(16),
  };
};

const cat = (id: string, system_key: string | null, extra: Partial<{ active: boolean; visible_from: string | null; visible_until: string | null }> = {}) => ({
  id, system_key, active: true, visible_from: null, visible_until: null, ...extra,
});

describe("special days (Israel calendar)", () => {
  it("knows the festivals, fasts and Shabbatot of 5787", () => {
    expect(keys("2026-09-21")).toEqual(["yom_kippur"]);
    expect(keys("2026-09-20")).toEqual(["erev_yom_kippur"]);
    expect(keys("2026-09-12")).toContain("rosh_hashana");
    expect(keys("2026-09-13")).toContain("rosh_hashana");
    expect(keys("2026-09-14")).toEqual(["tzom_gedaliah"]);
    expect(keys("2026-09-19")).toEqual(["shabbat_shuva"]);
    expect(keys("2026-09-28")).toEqual(["chol_hamoed_sukkot"]);
    expect(keys("2026-10-02")).toEqual(["hoshana_raba"]);
    expect(keys("2026-10-03")).toEqual(["shmini_atzeret"]);
    expect(keys("2026-12-10")).toEqual(expect.arrayContaining(["chanukah", "rosh_chodesh"]));
    expect(keys("2027-03-22")).toEqual(["taanit_esther", "erev_purim"]);
    expect(keys("2027-08-12")).toEqual(["tisha_bav"]);
    expect(keys("2027-05-12")).toEqual(["yom_haatzmaut"]);
    expect(keys("2026-10-20")).toEqual([]);
  });

  it("finds the next date of a day, every year again", () => {
    expect(nextDatesOf("yom_kippur", il("2026-09-25"))).toEqual(["2027-10-11"]);
    expect(nextDatesOf("tzom_gedaliah", il("2026-09-01"))).toEqual(["2026-09-14"]);
    expect(nextDatesOf("chanukah", il("2026-11-01"), 8)).toHaveLength(8);
  });
});

describe("today's timetable tabs", () => {
  const weekday = cat("w", "weekday");
  const friday = cat("f", "friday");
  const shabbat = cat("s", "shabbat");
  const selichot = cat("x", null);
  const yk = cat("yk", eventSystemKey("yom_kippur"));
  const gedaliah = cat("g", eventSystemKey("tzom_gedaliah"));
  const all = [weekday, friday, shabbat, selichot, yk, gedaliah];

  it("replaces the ordinary tab on a day that has its own", () => {
    const t = todaysCategories(all, il("2026-09-14"));
    expect(t.event?.key).toBe("tzom_gedaliah");
    expect(t.categories.map((c) => c.id)).toEqual(["g", "x"]);
    expect(t.preferred?.id).toBe("g");
  });

  it("keeps the ordinary tabs, and never an event's, on any other day", () => {
    const t = todaysCategories(all, il("2026-10-20"));
    expect(t.event).toBeNull();
    expect(t.categories.map((c) => c.id)).toEqual(["w", "f", "s", "x"]);
    expect(t.preferred?.id).toBe("w");
  });

  it("uses the Shabbat tab on Saturday when there is one, and the weekday one when not", () => {
    expect(todaysCategories(all, il("2026-10-24")).preferred?.id).toBe("s");
    expect(todaysCategories([weekday, friday], il("2026-10-24")).preferred?.id).toBe("w");
  });

  it("ignores a special day whose tab is switched off", () => {
    const off = [weekday, cat("g", eventSystemKey("tzom_gedaliah"), { active: false })];
    expect(todaysCategories(off, il("2026-09-14")).event).toBeNull();
  });

  it("never lets a national day replace the timetable", () => {
    const t = todaysCategories([weekday, cat("n", eventSystemKey("yom_haatzmaut"))], il("2027-05-12"));
    expect(t.event).toBeNull();
    expect(t.preferred?.id).toBe("w");
  });
});

describe("the day's own times", () => {
  const labels = (day: string) => specialZmanim(il(day), z()).map((r) => [r.label, r.time?.getUTCHours()]);

  it("gives a minor fast its start and end", () => {
    expect(labels("2026-09-14")).toEqual([["תחילת הצום", 2], ["סוף הצום", 16]]);
  });

  it("gives Yom Kippur candle lighting on the eve and the end of the fast on the day", () => {
    expect(labels("2026-09-20")).toEqual([["הדלקת נרות · תחילת הצום", 14]]);
    expect(labels("2026-09-21")).toEqual([["צאת החג וסוף הצום", 16]]);
  });

  it("gives a festival its end, and its eve candle lighting", () => {
    expect(labels("2026-10-03")).toEqual([["צאת החג", 16]]);
    expect(labels("2027-04-27")).toEqual([["הדלקת נרות", 14]]); // ערב שביעי של פסח, יום שלישי
    expect(labels("2026-10-02")).toEqual([]); // הושענא רבה ביום שישי: הדלקת נרות היא של שבת
  });

  it("has nothing extra on an ordinary day or a national one", () => {
    expect(labels("2026-10-20")).toEqual([]);
    expect(labels("2027-05-12")).toEqual([]);
  });
});

describe("next dates of all special days", () => {
  it("agrees with the one-by-one lookup", async () => {
    const { nextDatesAll } = await import("./specialDays");
    const all = nextDatesAll(il("2026-09-25"));
    expect(all.yom_kippur).toBe("2027-10-11");
    expect(all.chol_hamoed_sukkot).toBe("2026-09-27");
    expect(all.chanukah).toBe("2026-12-04");
    expect(all.tisha_bav).toBe(nextDatesOf("tisha_bav", il("2026-09-25"))[0]);
  });
});
