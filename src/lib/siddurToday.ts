import { HDate, HebrewCalendar, flags, months } from "@hebcal/core";
import type { DayProfile } from "./jewishDay";
import { torahReadingOn } from "@/tv/torahReading";

/**
 * What the siddur says today, and what it leaves out - from the day's profile
 * and the nusach. Each item either points at a section of the siddur (a
 * separate prayer: הלל, מוסף, הושענות...) or is a reminder of an addition
 * inside the Amidah (יעלה ויבוא, על הניסים, משיב הרוח...), which is not a
 * section of its own.
 *
 * Where the nusachim differ it follows the nusach: הזכרת נשמות is not said by
 * עדות המזרח; Ashkenazim say no הושענות on Shabbat and others say them without
 * the circuit; אבינו מלכנו on a fast day is the Ashkenazi and Chassidic custom.
 * Sources: פניני הלכה (תפילה יח), קיצור שו"ע יט, and hebcal's own tables for
 * Hallel and Tachanun.
 */

export type Nusach = "sefard" | "ashkenaz" | "edot_hamizrach" | "chabad";

export interface TodayItem {
  id: string;
  label: string;
  /** Said today (true), or left out today (false) - both worth telling. */
  say: boolean;
  note?: string;
  /** A separate prayer in the siddur, found by its section title. */
  match?: RegExp;
  /** An addition inside the Amidah (no section of its own). */
  amidah?: boolean;
}

const WEEKDAY_SHIR = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** A Shabbat on which the coming month is blessed (not before Tishrei). */
function mevarchim(hd: HDate): boolean {
  if (hd.getDay() !== 6) return false;
  for (let i = 1; i <= 7; i++) {
    const d = hd.add(i);
    const rc = (HebrewCalendar.getHolidaysOnDate(d, true) ?? []).some((e) => e.getFlags() & flags.ROSH_CHODESH);
    if (rc) return d.getMonth() !== months.TISHREI;
  }
  return false;
}

export function siddurToday(p: DayProfile, nusach: Nusach): TodayItem[] {
  const out: TodayItem[] = [];
  const add = (i: TodayItem) => out.push(i);
  const edot = nusach === "edot_hamizrach";
  const month = p.hdate.getMonth();
  const day = p.hdate.getDate();
  const holyDay = p.shabbat || p.yomTov;

  // ---- Hallel
  if (p.hallel === 2) add({ id: "hallel", label: "הלל שלם", say: true, match: /^(סדר )?הלל( |$)/ });
  if (p.hallel === 1) {
    add({
      id: "hallel",
      label: "חצי הלל",
      say: true,
      note: edot ? "בראש חודש בלי ברכה" : "בדילוג",
      match: /^(סדר )?הלל( |$)/,
    });
  }

  // ---- Amidah additions
  if (p.roshChodesh || p.cholHamoed || p.yomTov) {
    add({ id: "yaaleh", label: "יעלה ויבוא", say: true, amidah: true, note: "בעמידה ובברכת המזון" });
  }
  if (p.chanukahDay || p.purim) {
    add({ id: "alhanisim", label: "על הניסים", say: true, amidah: true, note: "בעמידה ובברכת המזון" });
  }
  if (p.aseretYemeiTeshuva) {
    add({ id: "aseret", label: "המלך הקדוש · המלך המשפט · זכרנו לחיים", say: true, amidah: true });
  }
  if (p.fast) add({ id: "aneinu", label: "עננו", say: true, amidah: true, note: p.fast });
  add({
    id: "rain",
    label: p.rainSeason ? "משיב הרוח ומוריד הגשם" : "מוריד הטל",
    say: true,
    amidah: true,
    note:
      month === months.TISHREI && day === 22
        ? "ממוסף של היום. בשחרית עוד מוריד הטל"
        : month === months.NISAN && day === 15
          ? "ממוסף של היום מוריד הטל. בשחרית עוד משיב הרוח"
          : undefined,
  });
  if (!holyDay) {
    add({
      id: "barech",
      label: p.talUmatar ? (edot ? "ברך עלינו" : "ותן טל ומטר לברכה") : edot ? "ברכנו" : "ותן ברכה",
      say: true,
      amidah: true,
      note: "בברכת השנים",
    });
  }

  // ---- Musaf
  if (p.shabbat || p.roshChodesh || p.yomTov || p.cholHamoed) {
    const match = p.roshChodesh && !p.shabbat && !p.yomTov
      ? /מוסף לראש חודש|^מוסף/
      : p.yomTov || p.cholHamoed
        ? /מוסף לג' רגלים|^מוסף/
        : /^מוסף/;
    add({ id: "musaf", label: "מוסף", say: true, match });
  }
  if (p.sheminiAtzeret) add({ id: "geshem", label: "תפילת גשם", say: true, match: /תפילת גשם/ });
  if (month === months.NISAN && day === 15) add({ id: "tal", label: "תפילת טל", say: true, match: /תפילת טל/ });

  // ---- Sukkot
  if (p.sukkot) {
    if (p.shabbat) {
      add({ id: "lulav", label: "נטילת לולב", say: false, note: "בשבת לא נוטלים לולב", match: /לולב/ });
    } else {
      add({ id: "lulav", label: "נטילת לולב", say: true, match: /לולב/ });
    }
    if (p.hoshanaRabba) {
      add({ id: "hoshanot", label: "הושענות להושענא רבה", say: true, note: "שבע הקפות", match: /הושענא רב|הושענות להושענא/ });
    } else if (p.shabbat) {
      if (nusach === "ashkenaz") add({ id: "hoshanot", label: "הושענות", say: false, note: "בשבת לא אומרים" });
      else add({ id: "hoshanot", label: "הושענות לשבת", say: true, note: "בלי הקפה, לפי המנהג", match: /הושענות לשבת/ });
    } else {
      add({ id: "hoshanot", label: "הושענות", say: true, match: /סדר הושענות|^הושענות$/ });
    }
  }

  // ---- Tachanun, on the days it could be said
  if (!holyDay) {
    const t = p.tachanun;
    if (!t.shacharit && !t.mincha) add({ id: "tachanun", label: "תחנון", say: false, note: "לא אומרים היום", match: /תחנון|נפילת אפ/ });
    else if (!t.mincha) add({ id: "tachanun", label: "תחנון", say: true, note: "בשחרית בלבד, לא במנחה", match: /תחנון|נפילת אפ/ });
  }

  // ---- Seasons and days
  const tishaBav = p.fast != null && /באב/.test(p.fast);
  if ((p.aseretYemeiTeshuva && !p.shabbat) || (p.fast && !tishaBav && !edot)) {
    add({ id: "avinu", label: "אבינו מלכנו", say: true, match: /אבינו מלכנו/ });
  }
  if (p.ledavidSeason) add({ id: "ledavid", label: "לדוד ה׳ אורי", say: true, note: "מראש חודש אלול עד הושענא רבה", match: /לדוד ה/ });
  if (p.omerDay) add({ id: "omer", label: `ספירת העומר: היום ${p.omerDay} ${p.omerDay === 1 ? "יום" : "ימים"}`, say: true, note: "בערבית", match: /ספירת העומר/ });
  if (p.chanukahDay) add({ id: "chanukah", label: `נרות חנוכה: נר ${p.chanukahDay}`, say: true, match: /הדלקת נרות חנוכה|נרות חנוכה/ });
  if (p.purim) add({ id: "megillah", label: "קריאת המגילה", say: true, match: /קריאת המגילה|מגילה/ });

  const yizkorDay =
    p.yomKippur || p.sheminiAtzeret || (month === months.NISAN && day === 21) || (month === months.SIVAN && day === 6);
  if (yizkorDay && !edot) add({ id: "yizkor", label: "הזכרת נשמות", say: true, note: "לפני מוסף", match: /הזכרת נשמות|יזכור/ });

  if (mevarchim(p.hdate)) add({ id: "mevarchim", label: "ברכת החודש", say: true, match: /ברכת החודש/ });

  add({
    id: "shir",
    label: `שיר של יום: יום ${WEEKDAY_SHIR[p.weekday]}`,
    say: true,
    note: p.roshChodesh ? "ובראש חודש גם ברכי נפשי" : undefined,
    match: /שיר של יום/,
  });

  const torah = torahReadingOn(p.hdate.greg());
  if (torah) {
    add({
      id: "torah",
      label: torah.parasha ? `קריאת התורה: ${torah.parasha}` : "קריאת התורה",
      say: true,
      note: [torah.reading, torah.maftir && `מפטיר: ${torah.maftir}`, torah.haftarah && `הפטרה: ${torah.haftarah}`]
        .filter(Boolean)
        .join(" · "),
      match: /קריאת התורה/,
    });
  }
  return out;
}
