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
    expect([get("musaf")?.match].flat()[0]?.test("מוסף לראש חודש")).toBe(true);
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

describe("hebcal's tables, corrected once in the engine", () => {
  it("Hallel: whole on Shemini Atzeret, none on the eve of Chanukah or Pesach Sheni", () => {
    expect(at("2026-10-03").p.hallel).toBe(2); // שמיני עצרת ושמחת תורה
    expect(at("2026-12-04").p.hallel).toBe(0); // כ״ד כסלו
    expect(at("2027-05-21").p.hallel).toBe(0); // פסח שני
    expect(at("2027-04-24").p.hallel).toBe(1); // חול המועד פסח
  });

  it("Tachanun: none on Pesach Sheni and on Shushan Purim Katan", async () => {
    expect(at("2027-05-21").p.tachanun).toEqual({ shacharit: false, mincha: false });
    const { nextDatesOf } = await import("@community/lib/specialDays");
    const [katan, shushanKatan] = nextDatesOf("purim_katan", new Date("2026-10-01"), 2);
    expect(at(katan!).p.purimKatan).toBe(true);
    expect(at(shushanKatan!).p.tachanun).toEqual({ shacharit: false, mincha: false });
  });

  it("Shushan Purim is not Purim outside Jerusalem", async () => {
    const { nextDatesOf } = await import("@community/lib/specialDays");
    const [purim] = nextDatesOf("purim", new Date("2026-10-01"));
    const [shushan] = nextDatesOf("shushan_purim", new Date("2026-10-01"));
    expect(at(purim!).get("alhanisim")?.say).toBe(true);
    expect(at(purim!).get("megillah")?.say).toBe(true);
    expect(at(shushan!).get("alhanisim")?.say).toBe(false);
    expect(at(shushan!).get("megillah")).toBeUndefined();
  });

  it("national days: Hallel only where it is the custom", async () => {
    const { nextDatesOf } = await import("@community/lib/specialDays");
    const [atzmaut] = nextDatesOf("yom_haatzmaut", new Date("2026-10-01"));
    expect(at(atzmaut!).p).toMatchObject({ hallel: 0, nationalHallel: true });
    expect(at(atzmaut!).get("hallel")?.note).toBe("בקהילות הנוהגות");
    expect(at(atzmaut!, "chabad").get("hallel")).toBeUndefined();
  });
});

describe("Birkat HaMazon and Me'ein Shalosh", () => {
  it("Sukkot on Shabbat: Retzeh and Ya'aleh VeYavo, the Harachaman of the day", () => {
    const { get } = at("2026-09-26");
    expect(get("mazon")?.label).toBe("ברכת המזון: רצה והחליצנו · יעלה ויבוא");
    expect(get("mazon")?.note).toContain("יקים לנו את סוכת דוד הנופלת");
    expect(get("mazon")?.note).toContain("מגדול ישועות");
    expect(get("meein")?.label).toBe("מעין שלוש: ורצה והחליצנו ביום השבת הזה · ושמחנו ביום חג הסוכות הזה");
  });

  it("Rosh Chodesh: VeZochreinu in Me'ein Shalosh; no Migdol for Edot HaMizrach (always Migdol)", () => {
    expect(at("2026-10-12").get("meein")?.label).toBe("מעין שלוש: וזכרנו לטובה ביום ראש החודש הזה");
    expect(at("2026-10-12", "edot_hamizrach").get("mazon")?.note).not.toContain("מגדול");
  });

  it("an ordinary weekday: nothing added", () => {
    expect(at("2026-11-17").get("mazon")).toBeUndefined();
    expect(at("2026-11-17").get("meein")).toBeUndefined();
  });
});

describe("what changes by the nusach", () => {
  it("Lamnatzeach: Ashkenaz by its list, the others on every day without Tachanun", () => {
    expect(at("2026-10-12", "ashkenaz").get("lamnatzeach")?.say).toBe(false); // ראש חודש
    expect(at("2027-05-25", "ashkenaz").get("lamnatzeach")).toBeUndefined(); // ל״ג בעומר
    expect(at("2027-05-25", "sefard").get("lamnatzeach")?.say).toBe(false);
  });

  it("Mizmor LeToda: not on Erev Pesach and Chol HaMoed Pesach", () => {
    expect(at("2027-04-21").get("letoda")?.say).toBe(false);
    expect(at("2027-04-25").get("letoda")?.say).toBe(false);
    expect(at("2026-11-17").get("letoda")).toBeUndefined();
  });

  it("Selichot: Edot HaMizrach from Elul, Ashkenaz from the Sunday before Rosh Hashana", () => {
    expect(at("2026-08-20", "edot_hamizrach").get("selichot")?.say).toBe(true);
    expect(at("2026-08-20", "ashkenaz").get("selichot")).toBeUndefined();
    expect(at("2026-09-06", "ashkenaz").get("selichot")?.say).toBe(true); // Rosh Hashana 5787 is on Shabbat
    expect(at("2026-09-04", "ashkenaz").get("selichot")).toBeUndefined();
  });

  it("LeDavid ends at Hoshana Rabba for Edot HaMizrach and Chabad", () => {
    expect(at("2026-10-03", "ashkenaz").get("ledavid")?.say).toBe(true);
    expect(at("2026-10-03", "edot_hamizrach").get("ledavid")).toBeUndefined();
  });

  it("Av HaRachamim: left out on Shabbat Mevarchim, not said at all by Edot HaMizrach", () => {
    const { p, get } = at("2026-10-10"); // שבת מברכים חשוון
    expect(p.mevarchim?.month).toBeGreaterThan(0);
    expect(get("mevarchim")?.say).toBe(true);
    expect(get("avharachamim")?.say).toBe(false);
    expect(at("2026-10-10", "edot_hamizrach").get("avharachamim")).toBeUndefined();
  });
});

describe("the evening after Shabbat", () => {
  const motzash = (iso: string) => {
    const now = new Date(`${iso}T18:30:00Z`); // 21:30 in Jerusalem
    const p = dayProfile(now, new Date(`${iso}T16:30:00Z`));
    return { p, get: (id: string) => siddurToday(p, "sefard").find((i) => i.id === id) };
  };

  it("Atah Chonantanu, and Vihi Noam unless a Yom Tov falls this week", () => {
    const plain = motzash("2026-10-17");
    expect(plain.p.evening).toBe(true);
    expect(plain.get("havdala")?.label).toBe("אתה חוננתנו");
    expect(plain.get("vihinoam")?.say).toBe(true);
    expect(motzash("2026-09-19").get("vihinoam")?.say).toBe(false); // יום כיפור ביום שני
  });
});

describe("Motzaei Shabbat in Chol HaMoed", () => {
  it("no Vihi Noam", () => {
    const p = dayProfile(new Date("2026-09-26T18:30:00Z"), new Date("2026-09-26T16:30:00Z"));
    expect(siddurToday(p, "ashkenaz").find((i) => i.id === "vihinoam")?.say).toBe(false);
  });
});

describe("Ta'anit Bechorot", () => {
  it("is the firstborns' fast, not the congregation's", () => {
    const { p, get } = at("2027-04-21"); // ערב פסח
    expect(p.fast).toBeNull();
    expect(get("aneinu")).toBeUndefined();
    expect(get("avinu")).toBeUndefined();
    expect(get("selichot")).toBeUndefined();
  });
});
