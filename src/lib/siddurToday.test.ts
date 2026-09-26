import { describe, expect, it } from "vitest";
import { dayProfile } from "./jewishDay";
import { siddurToday, type Nusach } from "./siddurToday";

/** Noon in Jerusalem on a civil date of 5787, Israel's calendar. */
const at = (iso: string, nusach: Nusach = "sefard") => {
  const p = dayProfile(new Date(`${iso}T09:00:00Z`));
  const items = siddurToday(p, nusach);
  const get = (id: string) => items.find((i) => i.id === id);
  return { p, items, get };
};

describe("the day's profile", () => {
  it("knows Chol HaMoed Sukkot", () => {
    const { p } = at("2026-09-27");
    expect(p).toMatchObject({ cholHamoed: true, sukkot: true, hallel: 2, shabbat: false, rainSeason: false });
    expect(p.tachanun).toEqual({ shacharit: false, mincha: false });
  });

  it("moves to tomorrow at nightfall", () => {
    const friday = new Date("2026-09-25T17:00:00Z"); // 20:00 in Jerusalem, Friday
    const nightfall = new Date("2026-09-25T15:55:00Z");
    expect(dayProfile(friday).shabbat).toBe(false);
    expect(dayProfile(friday, nightfall)).toMatchObject({ shabbat: true, yomTov: true, sukkot: true });
  });

  it("counts Chanukah from the first day, not the eve", () => {
    expect(at("2026-12-04").p.chanukahDay).toBe(0); // 24 Kislev, the eve
    expect(at("2026-12-05").p.chanukahDay).toBe(1);
    expect(at("2026-12-12").p.chanukahDay).toBe(8);
  });

  it("knows the seasons of rain in Israel", () => {
    expect(at("2026-10-04").p.rainSeason).toBe(true); // after Shemini Atzeret
    expect(at("2026-10-04").p.talUmatar).toBe(false); // before 7 Cheshvan
    expect(at("2026-10-18").p.talUmatar).toBe(true); // 7 Cheshvan
    expect(at("2027-05-01").p.rainSeason).toBe(false); // after Pesach
  });

  it("counts the Omer", () => {
    expect(at("2027-04-23").p.omerDay).toBe(1); // 16 Nisan 5787
    expect(at("2027-06-10").p.omerDay).toBe(49); // 5 Sivan
    expect(at("2027-06-11").p.omerDay).toBe(0); // Shavuot
  });
});

describe("what the siddur says today", () => {
  it("Chol HaMoed Sukkot: whole Hallel, Yaaleh VeYavo, Musaf, lulav, hoshanot, no Tachanun", () => {
    const { get } = at("2026-09-27");
    expect(get("hallel")?.label).toBe("הלל שלם");
    expect(get("yaaleh")?.say).toBe(true);
    expect(get("musaf")?.say).toBe(true);
    expect(get("lulav")?.say).toBe(true);
    expect(get("hoshanot")?.say).toBe(true);
    expect(get("tachanun")).toMatchObject({ say: false });
    expect(get("rain")?.label).toBe("מוריד הטל");
    expect(get("ledavid")?.say).toBe(true);
  });

  it("Sukkot on Shabbat: no lulav; hoshanot by the nusach", () => {
    expect(at("2026-09-26").get("lulav")).toMatchObject({ say: false });
    expect(at("2026-09-26", "ashkenaz").get("hoshanot")).toMatchObject({ say: false });
    expect(at("2026-09-26", "sefard").get("hoshanot")).toMatchObject({ say: true, label: "הושענות לשבת" });
  });

  it("Hoshana Rabba and Shemini Atzeret", () => {
    expect(at("2026-10-02").get("hoshanot")?.label).toBe("הושענות להושענא רבה");
    const sa = at("2026-10-03");
    expect(sa.get("geshem")?.say).toBe(true);
    expect(sa.get("yizkor")?.say).toBe(true);
    expect(at("2026-10-03", "edot_hamizrach").get("yizkor")).toBeUndefined();
  });

  it("Chanukah: Al HaNisim, whole Hallel, the candle of the night", () => {
    const { get } = at("2026-12-07");
    expect(get("alhanisim")?.say).toBe(true);
    expect(get("hallel")?.label).toBe("הלל שלם");
    expect(get("chanukah")?.label).toBe("נרות חנוכה: נר 3");
  });

  it("Rosh Chodesh: half Hallel and its own Musaf", () => {
    const { get } = at("2026-10-12");
    expect(get("hallel")?.label).toBe("חצי הלל");
    expect(get("musaf")?.match?.test("מוסף לראש חודש")).toBe(true);
  });

  it("an ordinary weekday: Tachanun is said, nothing festive", () => {
    const { get } = at("2026-11-17");
    expect(get("tachanun")).toBeUndefined(); // said as usual - nothing to flag
    expect(get("hallel")).toBeUndefined();
    expect(get("musaf")).toBeUndefined();
    expect(get("barech")?.label).toBe("ותן טל ומטר לברכה");
  });

  it("a fast day: Aneinu, and Avinu Malkeinu by the nusach", () => {
    const tzom = at("2026-12-20"); // עשרה בטבת תשפ"ז
    expect(tzom.p.fast).toBeTruthy();
    expect(tzom.get("aneinu")?.say).toBe(true);
    expect(tzom.get("avinu")?.say).toBe(true);
    expect(at("2026-12-20", "edot_hamizrach").get("avinu")).toBeUndefined();
  });

  it("the Ten Days: HaMelech HaKadosh and Avinu Malkeinu", () => {
    const { get } = at("2026-09-15"); // 4 Tishrei (the day after Tzom Gedalia)
    expect(get("aseret")?.say).toBe(true);
    expect(get("avinu")?.say).toBe(true);
  });
});
