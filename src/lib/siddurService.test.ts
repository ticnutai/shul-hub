import { describe, expect, it } from "vitest";
import { dayProfile } from "./jewishDay";
import { composeService, hoshanaOfDay, type FestivalData, type Section } from "./siddurService";
import type { Nusach } from "./siddurToday";
import sefardShacharit from "@/data/siddur/siddur_sefard_shacharit.json";
import sefardOther from "@/data/siddur/siddur_sefard_other.json";
import sefardMincha from "@/data/siddur/siddur_sefard_mincha.json";
import ashkShacharit from "@/data/siddur/siddur_ashkenaz_shacharit.json";
import edotShacharit from "@/data/siddur/siddur_edot_hamizrach_shacharit.json";
import edotOther from "@/data/siddur/siddur_edot_hamizrach_other.json";
import festSefard from "@/data/siddur/festival_sefard.json";
import festAshk from "@/data/siddur/festival_ashkenaz.json";

const READING: Section = { title: "קריאת התורה: היום", lines: ["..."] };
const at = (iso: string) => dayProfile(new Date(`${iso}T09:00:00Z`));

function titles(iso: string, nusach: Nusach, service: "shacharit" | "mincha" = "shacharit", reading: Section | null = READING) {
  const data = {
    sefard: { shacharit: sefardShacharit, mincha: sefardMincha, other: sefardOther, fest: festSefard },
    ashkenaz: { shacharit: ashkShacharit, mincha: sefardMincha, other: { sections: [] }, fest: festAshk },
    edot_hamizrach: { shacharit: edotShacharit, mincha: sefardMincha, other: edotOther, fest: null },
    chabad: { shacharit: sefardShacharit, mincha: sefardMincha, other: sefardOther, fest: festSefard },
  }[nusach];
  return composeService({
    service,
    nusach,
    profile: at(iso),
    base: data[service].sections as Section[],
    other: data.other.sections as Section[],
    festival: data.fest as unknown as FestivalData | null,
    reading,
  }).map((s) => s.title.trim());
}

const order = (list: string[], ...names: string[]) => names.map((n) => list.indexOf(n));
const increasing = (xs: number[]) => xs.every((x, i) => x >= 0 && (i === 0 || x > xs[i - 1]!));

describe("the Hoshana of each day", () => {
  it("follows the table by the weekday Sukkot began (5787: Shabbat)", () => {
    expect(hoshanaOfDay(at("2026-09-26"))).toBe("om_netzura"); // Shabbat, the first day
    expect(hoshanaOfDay(at("2026-09-27"))).toBe("lemaan_amitach");
    expect(hoshanaOfDay(at("2026-09-28"))).toBe("eerokh_shui");
    expect(hoshanaOfDay(at("2026-10-01"))).toBe("adon_hamoshia");
    expect(hoshanaOfDay(at("2026-10-02"))).toBeNull(); // Hoshana Rabba: all of them
  });
});

describe("Shacharit of Chol HaMoed Sukkot, as said", () => {
  it("Sefard: Lulav, Hallel, the day's Hoshana, Shir shel Yom, the reading, Ashrei, Musaf", () => {
    const t = titles("2026-09-27", "sefard");
    expect(increasing(order(t, "עמידה", "סדר נטילת לולב", "סדר הלל", "הושענות: למען אמתך", "שיר של יום", "קריאת התורה", "קריאת התורה: היום", "אשרי", "מוסף לג' רגלים", "עלינו"))).toBe(true);
    expect(t).not.toContain("תחנון");
    expect(t).not.toContain("אבינו מלכנו");
    expect(t).not.toContain("ברכי נפשי");
  });

  it("Ashkenaz: the Torah after Hallel, Musaf, then the Hoshanot", () => {
    const t = titles("2026-09-27", "ashkenaz");
    expect(increasing(order(t, "אלוהי נצור", "נטילת לולב", "הלל", "הוצאת ספר תורה", "קריאת התורה: היום", "אשרי", "ובא לציון", "מוסף לשלוש רגלים", "הושענות: למען אמתך"))).toBe(true);
    expect(t.slice(0, t.indexOf("עלינו"))).not.toContain("נפילת אפיים");
    expect(t.slice(0, t.indexOf("עלינו"))).not.toContain("למנצח");
  });

  it("Edot HaMizrach: Hallel, the reading, Musaf after Shir shel Yom", () => {
    const t = titles("2026-09-27", "edot_hamizrach");
    expect(increasing(order(t, "עמידה", "הלל לראש חודש ולמועדים", "קריאת התורה", "קריאת התורה: היום", "שיר של יום", "מוסף"))).toBe(true);
    expect(t).not.toContain("וידוי");
  });
});

describe("other days", () => {
  it("an ordinary Tuesday: Tachanun, no Torah, no Hallel", () => {
    const t = titles("2026-11-17", "sefard", "shacharit", null);
    expect(t).toContain("תחנון");
    expect(t).not.toContain("קריאת התורה");
    expect(t).not.toContain("סדר הלל");
  });

  it("Rosh Chodesh: half Hallel, the Rosh Chodesh reading and Musaf, Barchi Nafshi", () => {
    const t = titles("2026-10-12", "sefard", "shacharit", null);
    expect(increasing(order(t, "סדר הלל", "ברכי נפשי", "קריאת התורה לראש חדש", "אשרי", "מוסף לראש חודש"))).toBe(true);
    expect(t).not.toContain("תחנון");
  });

  it("Mincha on a fast: the reading and Avinu Malkeinu; not on an ordinary day", () => {
    expect(titles("2026-12-20", "sefard", "mincha")).toEqual(expect.arrayContaining(["קריאה לתענית ציבור", "אבינו מלכנו", "תחנון"]));
    const plain = titles("2026-11-17", "sefard", "mincha");
    expect(plain).not.toContain("קריאה לתענית ציבור");
    expect(plain).not.toContain("אבינו מלכנו");
  });
});

describe("Hoshana Rabba and Shabbat", () => {
  it("Hoshana Rabba: all the Hoshanot, with the seven circuits", () => {
    const t = titles("2026-10-02", "sefard");
    expect(t).toContain("הושענות להושענא רבא");
    expect(t.some((x) => x.startsWith("הושענות: "))).toBe(false);
  });

  it("Ashkenaz on a weekday: the weekday run only; on Shabbat the Shabbat run", () => {
    const weekday = titles("2026-11-17", "ashkenaz", "shacharit", null);
    expect(weekday).not.toContain("יקום פרקן");
    const shabbat = titles("2026-11-21", "ashkenaz", "shacharit", null);
    expect(shabbat).toContain("יקום פרקן");
    expect(shabbat).not.toContain("נפילת אפיים");
  });
});
