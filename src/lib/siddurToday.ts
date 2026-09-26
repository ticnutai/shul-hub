import { months } from "@hebcal/core";
import { profileOf, type DayProfile } from "./jewishDay";
import { torahReadingOn } from "@/tv/torahReading";

/**
 * What the siddur says today, and what it leaves out - from the day's profile
 * (lib/jewishDay) and the nusach. Each item either points at a section of the
 * siddur (a separate prayer: הלל, מוסף, הושענות...) or is a reminder of an
 * addition inside a prayer (יעלה ויבוא, על הניסים, רצה בברכת המזון...),
 * which is not a section of its own.
 *
 * Where the nusachim differ it follows the nusach:
 *   - הזכרת נשמות and אב הרחמים are not said by עדות המזרח.
 *   - Ashkenazim say no הושענות on Shabbat; the others say them without the circuit.
 *   - אבינו מלכנו on a fast day is the Ashkenazi and Chassidic custom.
 *   - למנצח (יענך): Ashkenazim leave it out on a fixed list of days (ראש חודש,
 *     חול המועד, חנוכה, פורים, ערב פסח, ערב יום כיפור, תשעה באב); the others
 *     on every day without Tachanun.
 *   - לדוד ה' אורי: to Shemini Atzeret (אשכנז, ספרד); to Hoshana Rabba (עדות המזרח, חב"ד).
 *   - נחם on Tisha B'Av: in every Amidah (שו"ע) or at Mincha only (רמ"א).
 *   - סליחות: from Rosh Chodesh Elul (עדות המזרח) or from the Sunday of the
 *     week before Rosh Hashana, at least four days (אשכנז, ספרד, חב"ד).
 *   - מגדיל / מגדול in ברכת המזון: עדות המזרח always מגדול; the others מגדול on
 *     days with Musaf.
 * Sources: פניני הלכה (תפילה, ברכות, זמנים), שו"ע ורמ"א או"ח קלא, רפד, תכט, תצג, תקנז, תקפא, תרצז,
 * קיצור שו"ע, and hebcal's own tables (corrected in jewishDay).
 */

export type Nusach = "sefard" | "ashkenaz" | "edot_hamizrach" | "chabad";

export interface TodayItem {
  id: string;
  label: string;
  /** Said today (true), or left out today (false) - both worth telling. */
  say: boolean;
  note?: string;
  /** A separate prayer in the siddur, found by its section title (a list: in order of preference). */
  match?: RegExp | RegExp[];
  /** An addition inside the Amidah (no section of its own). */
  amidah?: boolean;
  /** An addition in Birkat HaMazon or Me'ein Shalosh. */
  meal?: boolean;
}

const WEEKDAY_SHIR = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** The festival's name as Me'ein Shalosh and Ya'aleh VeYavo say it. */
function festivalName(p: DayProfile): string | null {
  if (p.roshHashana) return "הזכרון";
  if (p.sukkot) return "חג הסוכות";
  if (p.sheminiAtzeret) return "שמיני חג העצרת";
  if (p.pesach) return "חג המצות";
  if (p.shavuot) return "חג השבועות";
  return null;
}

export function siddurToday(p: DayProfile, nusach: Nusach): TodayItem[] {
  const out: TodayItem[] = [];
  const add = (i: TodayItem) => out.push(i);
  const edot = nusach === "edot_hamizrach";
  const ashkenaz = nusach === "ashkenaz";
  const month = p.hdate.getMonth();
  const day = p.hdate.getDate();
  const holyDay = p.shabbat || p.yomTov;
  const weekdayService = !holyDay;
  const festival = festivalName(p);

  // ---- Evening: after Shabbat or Yom Tov, and the moon
  if (p.evening) {
    const prev = profileOf(p.hdate.prev());
    if (prev.shabbat && p.yomTov) {
      add({ id: "havdala", label: "ותודיענו", say: true, amidah: true, note: "הבדלה בעמידה של ליל יום טוב במוצאי שבת" });
    } else if ((prev.shabbat || prev.yomTov) && !holyDay) {
      add({ id: "havdala", label: "אתה חוננתנו", say: true, amidah: true, note: "הבדלה בעמידה של ערבית" });
    }
    if (prev.shabbat && !holyDay) {
      // ויהי נועם is left out when a Yom Tov or Chol HaMoed falls on a weekday of the coming week.
      let festivalThisWeek = false;
      for (let i = 0; i < 6; i++) {
        const d = profileOf(p.hdate.add(i, "d"));
        if (d.yomTov || d.cholHamoed) festivalThisWeek = true;
      }
      add({
        id: "vihinoam",
        label: "ויהי נועם",
        say: !festivalThisWeek,
        note: festivalThisWeek ? "לא אומרים: חג או חול המועד השבוע" : "במוצאי שבת",
        match: /ויהי נועם/,
      });
    }
    // קידוש לבנה: from the third night (the seventh, by the Kabbalah, as עדות המזרח do) to the 15th.
    const first = edot ? 7 : 3;
    const afterFast = !(month === months.AV && day <= 9) && !(month === months.TISHREI && day <= 10);
    if (day >= first && day <= 15 && afterFast && !p.shabbat && !p.yomTov) {
      add({ id: "levana", label: "קידוש לבנה", say: true, note: "עד ליל ט״ו בחודש", match: /קידוש לבנה|ברכת הלבנה/ });
    }
  }

  // ---- Hallel
  if (p.hallel === 2) add({ id: "hallel", label: "הלל שלם", say: true, match: /^(סדר )?הלל( |$)/ });
  if (p.hallel === 1) {
    add({
      id: "hallel",
      label: "חצי הלל",
      say: true,
      note: edot ? (p.roshChodesh ? "בראש חודש בלי ברכה" : "בדילוג") : "בדילוג",
      match: /^(סדר )?הלל( |$)/,
    });
  }
  if (!p.hallel && p.nationalHallel && nusach !== "chabad") {
    add({
      id: "hallel",
      label: "הלל",
      say: true,
      note: edot ? "בקהילות הנוהגות, בלי ברכה" : "בקהילות הנוהגות",
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
  if (p.shushanPurim) {
    add({ id: "alhanisim", label: "על הניסים", say: false, amidah: true, note: "בשושן פורים רק בירושלים" });
  }
  if (p.aseretYemeiTeshuva) {
    add({ id: "aseret", label: "המלך הקדוש · המלך המשפט · זכרנו לחיים", say: true, amidah: true });
  }
  if (p.fast) {
    add({
      id: "aneinu",
      label: "עננו",
      say: true,
      amidah: true,
      note: `${p.fast}. ${ashkenaz ? "היחיד במנחה בשומע תפילה" : "היחיד בשומע תפילה"}, השליח ציבור בחזרה בין גואל לרופא`,
    });
  }
  if (p.tishaBav) {
    add({
      id: "nachem",
      label: "נחם",
      say: true,
      amidah: true,
      note: edot ? "בבונה ירושלים, בכל תפילות היום" : "בבונה ירושלים, במנחה",
    });
  }
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
  if (weekdayService) {
    add({
      id: "barech",
      label: p.talUmatar ? (edot ? "ברך עלינו" : "ותן טל ומטר לברכה") : edot ? "ברכנו" : "ותן ברכה",
      say: true,
      amidah: true,
      note: "בברכת השנים",
    });
  }

  // ---- Birkat HaMazon and Me'ein Shalosh
  const mazon: string[] = [];
  if (p.shabbat) mazon.push("רצה והחליצנו");
  if (p.roshChodesh || p.cholHamoed || p.yomTov) mazon.push("יעלה ויבוא");
  if (p.chanukahDay || p.purim) mazon.push("על הניסים");
  const harachaman: string[] = [];
  if (p.shabbat) harachaman.push("שכולו שבת");
  if (p.yomTov || p.cholHamoed) harachaman.push("שכולו טוב");
  if (p.roshHashana) harachaman.push("יחדש עלינו את השנה הזאת");
  else if (p.roshChodesh) harachaman.push("יחדש עלינו את החודש הזה");
  if (p.sukkot) harachaman.push("יקים לנו את סוכת דוד הנופלת");
  const musafDay = p.shabbat || p.roshChodesh || p.yomTov || p.cholHamoed;
  if (mazon.length || harachaman.length) {
    add({
      id: "mazon",
      label: `ברכת המזון: ${mazon.join(" · ") || "הרחמן"}`,
      say: true,
      meal: true,
      note: [
        harachaman.length ? `הרחמן: ${harachaman.join(", ")}` : null,
        !edot && musafDay ? "מגדול ישועות" : null,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
      match: /^ברכת המזון/,
    });
  }
  const meein: string[] = [];
  if (p.shabbat) meein.push("ורצה והחליצנו ביום השבת הזה");
  if (p.roshChodesh) meein.push("וזכרנו לטובה ביום ראש החודש הזה");
  if (festival) meein.push(`ושמחנו ביום ${festival} הזה`);
  if (meein.length) {
    add({ id: "meein", label: `מעין שלוש: ${meein.join(" · ")}`, say: true, meal: true, match: /מעין שלוש|על המחיה/ });
  }

  // ---- Musaf
  if (musafDay) {
    const match = p.roshChodesh && !p.shabbat && !p.yomTov && !p.cholHamoed
      ? [/^מוסף לראש חודש/, /^מוסף/]
      : p.yomTov || p.cholHamoed
        ? [/^מוסף לג' רגלים|^מוסף לשלוש רגלים/, /^מוסף/]
        : [/^מוסף/];
    add({
      id: "musaf",
      label: "מוסף",
      say: true,
      note: p.shabbat && p.roshChodesh ? "לשבת וראש חודש: אתה יצרת" : undefined,
      match,
    });
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
      if (ashkenaz) add({ id: "hoshanot", label: "הושענות", say: false, note: "בשבת לא אומרים" });
      else add({ id: "hoshanot", label: "הושענות לשבת", say: true, note: "בלי הקפה, לפי המנהג", match: /הושענות לשבת/ });
    } else {
      add({ id: "hoshanot", label: "הושענות", say: true, match: /^הושענות: |סדר הושענות|^הושענות$/ });
    }
  }

  // ---- The weekday service: what is left out
  if (weekdayService) {
    const t = p.tachanun;
    if (!t.shacharit && !t.mincha) add({ id: "tachanun", label: "תחנון", say: false, note: "לא אומרים היום", match: /תחנון|נפילת אפ/ });
    else if (!t.mincha) add({ id: "tachanun", label: "תחנון", say: true, note: "בשחרית בלבד, לא במנחה", match: /תחנון|נפילת אפ/ });
    else if (!t.shacharit) add({ id: "tachanun", label: "תחנון", say: true, note: "במנחה בלבד", match: /תחנון|נפילת אפ/ });

    // מזמור לתודה: not on Erev Pesach, Chol HaMoed Pesach, Erev Yom Kippur (the thanks-offering was not brought).
    const erevPesach = month === months.NISAN && day === 14;
    const erevYk = month === months.TISHREI && day === 9;
    if (erevPesach || erevYk || (p.cholHamoed && p.pesach)) {
      add({ id: "letoda", label: "מזמור לתודה", say: false, note: "לא אומרים היום", match: /מזמור לתודה/ });
    }

    // למנצח (יענך)
    const noLamnatzeach = ashkenaz
      ? p.roshChodesh || p.cholHamoed || p.chanukahDay > 0 || p.purim || p.shushanPurim || p.purimKatan ||
        erevPesach || erevYk || p.tishaBav
      : !t.shacharit;
    if (noLamnatzeach) add({ id: "lamnatzeach", label: "למנצח (יענך)", say: false, note: "לא אומרים היום", match: /יענך/ });
  }

  // ---- Shabbat: what changes
  if (p.shabbat && !p.yomTov) {
    // אב הרחמים (not said by עדות המזרח): left out on the Shabbatot on which
    // Tachanun would not be said, on Shabbat Rosh Chodesh, and on Shabbat
    // Mevarchim - except before Iyar and Sivan, in the Omer.
    if (!edot) {
      const blessIyarSivan = p.mevarchim && (p.mevarchim.month === months.IYYAR || p.mevarchim.month === months.SIVAN);
      const skip = !p.tachanun.mincha || p.roshChodesh || (p.mevarchim && !blessIyarSivan);
      if (skip) add({ id: "avharachamim", label: "אב הרחמים", say: false, note: "לא אומרים השבת", match: /אב הרחמים/ });
    }
    if (!p.tachanun.mincha) {
      add({ id: "tzidkatcha", label: "צדקתך", say: false, note: "במנחה של שבת לא אומרים היום", match: /צדקתך/ });
    }
  }
  if (p.mevarchim) {
    add({ id: "mevarchim", label: `ברכת החודש: ${p.mevarchim.name}`, say: true, match: /ברכת החודש/ });
  }
  if (p.specialShabbat) add({ id: "specialshabbat", label: p.specialShabbat, say: true });

  // ---- Seasons and days
  if ((p.aseretYemeiTeshuva && !p.shabbat) || (p.fast && !p.tishaBav && !edot)) {
    add({ id: "avinu", label: "אבינו מלכנו", say: true, match: /אבינו מלכנו/ });
  }
  const selichotFrom = edot ? elulSelichot(p) : ashkenazSelichot(p);
  if ((selichotFrom || (p.fast && !p.tishaBav)) && !holyDay && !p.yomKippur) {
    add({ id: "selichot", label: p.fast ? "סליחות לתענית" : "סליחות", say: true, match: /סליחות/ });
  }
  if (p.tishaBav) add({ id: "kinot", label: "קינות", say: true, note: "ומגילת איכה", match: /קינות/ });
  const ledavidToday = p.ledavidSeason && !(p.sheminiAtzeret && (edot || nusach === "chabad"));
  if (ledavidToday) {
    add({
      id: "ledavid",
      label: "לדוד ה׳ אורי",
      say: true,
      note: nusach === "ashkenaz" ? "בשחרית ובערבית" : "בשחרית ובמנחה",
      match: /לדוד ה/,
    });
  }
  if (p.omerDay) {
    add({
      id: "omer",
      label: `ספירת העומר: היום ${p.omerDay} ${p.omerDay === 1 ? "יום" : "ימים"}`,
      say: true,
      note: p.evening ? "הלילה בערבית" : "נספר אמש. מי ששכח סופר היום בלי ברכה",
      match: /ספירת העומר/,
    });
  }
  if (p.chanukahDay) add({ id: "chanukah", label: `נרות חנוכה: נר ${p.chanukahDay}`, say: true, match: /הדלקת נרות חנוכה|נרות חנוכה/ });
  if (p.purim) add({ id: "megillah", label: "קריאת המגילה", say: true, match: /קריאת המגילה|מגילה/ });

  const yizkorDay =
    p.yomKippur || p.sheminiAtzeret || (month === months.NISAN && day === 21) || (month === months.SIVAN && day === 6);
  if (yizkorDay && !edot) add({ id: "yizkor", label: "הזכרת נשמות", say: true, note: "לפני מוסף", match: /הזכרת נשמות|יזכור/ });

  add({
    id: "shir",
    label: `שיר של יום: יום ${WEEKDAY_SHIR[p.weekday]}`,
    say: true,
    note: p.roshChodesh ? "ובראש חודש גם ברכי נפשי" : undefined,
    match: /שיר של יום/,
  });

  const torah = torahReadingOn(
    p.hdate.greg(),
    true,
    edot ? "sephardi" : nusach === "chabad" ? "chabad" : "ashkenazi",
  );
  if (torah) {
    add({
      id: "torah",
      label: torah.parasha ? `קריאת התורה: ${torah.parasha}` : "קריאת התורה",
      say: true,
      note: [torah.reading, torah.maftir && `מפטיר: ${torah.maftir}`, torah.haftarah && `הפטרה: ${torah.haftarah}`]
        .filter(Boolean)
        .join(" · "),
      match: [/^קריאת התורה: /, /^קריאת התורה/],
    });
  }
  return out;
}

/** Selichot from the day after Rosh Chodesh Elul to Erev Yom Kippur (עדות המזרח). */
function elulSelichot(p: DayProfile): boolean {
  const m = p.hdate.getMonth();
  const d = p.hdate.getDate();
  return (m === months.ELUL && d >= 2) || (m === months.TISHREI && d <= 9);
}

/**
 * Ashkenazim: from the Sunday before Rosh Hashana, or the one before that
 * when Rosh Hashana falls on Monday or Tuesday (at least four days), to Erev
 * Yom Kippur.
 */
function ashkenazSelichot(p: DayProfile): boolean {
  const m = p.hdate.getMonth();
  const d = p.hdate.getDate();
  if (m === months.TISHREI) return d <= 9;
  if (m !== months.ELUL) return false;
  const rh = p.hdate.add(30 - d, "d"); // 1 Tishrei (Elul has 29 days)
  let start = rh.onOrBefore(0); // Rosh Hashana is never on a Sunday
  if (rh.abs() - start.abs() < 4) start = start.add(-7, "d");
  return p.hdate.abs() >= start.abs();
}
