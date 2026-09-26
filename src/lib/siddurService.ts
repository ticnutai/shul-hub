import { months } from "@hebcal/core";
import type { DayProfile } from "./jewishDay";
import { siddurToday, type Nusach } from "./siddurToday";

/**
 * The prayer of the day, in order: a weekday Shacharit of the nusach, with
 * what the day adds put where it is said and what the day leaves out taken
 * away. On Chol HaMoed Sukkot, for instance:
 *   ... עמידה, נטילת לולב, הלל, הושענות (of that very day), שיר של יום,
 *   קריאת התורה with the day's reading, אשרי, מוסף, קוה, עלינו
 * and no תחנון, no אבינו מלכנו.
 *
 * Pure: it gets the base prayer, the "other" category of the nusach (where
 * the siddur keeps הלל, מוסף, הושענות...), the festival parts we add from
 * Sefaria, and the day's reading already turned into a section. What is said
 * and what is left out is decided by siddurToday (one set of rules for the
 * list at the top and the prayer itself).
 *
 * The order after the Amidah follows each nusach's own siddur:
 *   ספרד/חב"ד (תורת אמת):  הלל, הושענות, שיר של יום, לדוד, קריאת התורה, אשרי, מוסף, קוה, עלינו
 *   אשכנז (רמ"א תרס):      הלל, קריאת התורה, אשרי, ובא לציון, מוסף, הושענות, עלינו, שיר של יום
 *   עדות המזרח:             הלל, קריאת התורה, אשרי, ובא לציון, שיר של יום, מוסף, ברכי נפשי, קוה, עלינו
 */

export interface Section {
  title: string;
  lines: string[];
}

export interface FestivalData {
  pieces: Record<string, Section>;
  hoshanot: { opening: string[]; closing: string[]; piyutim: Record<string, string[]> };
}

export type ServiceId = "shacharit" | "mincha" | "arvit";

type Family = "sefard" | "ashkenaz" | "edot";
const familyOf = (n: Nusach): Family => (n === "ashkenaz" ? "ashkenaz" : n === "edot_hamizrach" ? "edot" : "sefard");

const PIYUT_NAMES: Record<string, string> = {
  lemaan_amitach: "למען אמתך",
  even_shetiya: "אבן שתיה",
  eerokh_shui: "אערוך שועי",
  om_ani_choma: "אום אני חומה",
  el_lemoshaot: "אל למושעות",
  adon_hamoshia: "אדון המושיע",
  om_netzura: "אום נצורה",
};

/**
 * Which Hoshana is said on each of the first six days of Sukkot, by the
 * weekday of the first day (Monday, Tuesday, Thursday or Shabbat). The table
 * printed in סידור ספרד (סדר הושענות), the same as the Ashkenazi one.
 * אום נצורה always falls on Shabbat.
 */
const HOSHANA_ORDER: Record<number, string[]> = {
  1: ["lemaan_amitach", "even_shetiya", "eerokh_shui", "om_ani_choma", "el_lemoshaot", "om_netzura"],
  2: ["lemaan_amitach", "even_shetiya", "eerokh_shui", "el_lemoshaot", "om_netzura", "adon_hamoshia"],
  4: ["lemaan_amitach", "even_shetiya", "om_netzura", "eerokh_shui", "el_lemoshaot", "adon_hamoshia"],
  6: ["om_netzura", "lemaan_amitach", "eerokh_shui", "even_shetiya", "el_lemoshaot", "adon_hamoshia"],
};

/** The Hoshana of a day of Sukkot (15..20 Tishrei), or null. */
export function hoshanaOfDay(p: DayProfile): string | null {
  if (p.hdate.getMonth() !== months.TISHREI) return null;
  const day = p.hdate.getDate();
  if (day < 15 || day > 20) return null;
  const firstWeekday = p.hdate.add(15 - day, "d").getDay();
  return HOSHANA_ORDER[firstWeekday]?.[day - 15] ?? null;
}

const idx = (list: Section[], re: RegExp, from = 0) => {
  for (let i = from; i < list.length; i++) if (re.test(list[i]!.title.trim())) return i;
  return -1;
};
const first = (list: Section[], re: RegExp, after?: RegExp): Section | undefined => {
  const start = after ? idx(list, after) : 0;
  if (start < 0) return undefined;
  const i = idx(list, re, start);
  return i >= 0 ? list[i] : undefined;
};

/** The day's pieces for a nusach, wherever that nusach keeps them. */
function pieces(family: Family, other: Section[], festival: FestivalData | null) {
  const f = (k: string) => festival?.pieces[k];
  if (family === "ashkenaz") {
    return {
      lulav: f("lulav"),
      hallel: f("hallel"),
      hoshanotShabbat: undefined,
      hoshanaRabba: f("hoshana_rabba"),
      torahRc: undefined,
      torahOut: f("torah_out"),
      torahIn: f("torah_in"),
      musafRc: f("musaf_rc"),
      musafRegalim: f("musaf_regalim"),
      amidahRegalim: f("amidah_regalim"),
      yizkor: undefined,
      tal: f("tal"),
      geshem: f("geshem"),
      chanukah: f("chanukah"),
      barchiNafshi: undefined,
    };
  }
  if (family === "edot") {
    return {
      lulav: undefined,
      hallel: first(other, /^הלל לראש חודש ולמועדים/),
      hoshanotShabbat: undefined,
      hoshanaRabba: undefined,
      torahRc: undefined,
      torahOut: undefined,
      torahIn: undefined,
      musafRc: first(other, /^מוסף$/, /^סדר ראש חודש/),
      musafRegalim: first(other, /^מוסף$/, /^תפילה לשלש רגלים/),
      amidahRegalim: first(other, /^עמידה$/, /^תפילה לשלש רגלים/),
      yizkor: undefined,
      tal: undefined,
      geshem: undefined,
      chanukah: first(other, /^סדר ההדלקה/),
      barchiNafshi: first(other, /^ברכי נפשי/, /^סדר ראש חודש/),
    };
  }
  return {
    lulav: first(other, /^סדר נטילת לולב/),
    hallel: first(other, /^סדר הלל$/),
    hoshanotShabbat: first(other, /^הושענות לשבת/),
    hoshanaRabba: first(other, /^הושענות להושענא רב/),
    torahRc: first(other, /^קריאת התורה לראש חדש/),
    torahOut: undefined,
    torahIn: undefined,
    musafRc: first(other, /^מוסף לראש חודש/),
    musafRegalim: first(other, /^מוסף לג' רגלים/),
    amidahRegalim: undefined,
    yizkor: first(other, /^סדר הזכרת נשמות/),
    tal: first(other, /^תפילת טל/),
    geshem: first(other, /^תפילת גשם/),
    chanukah: first(other, /^סדר הדלקת נרות חנוכה/),
    barchiNafshi: undefined,
  };
}

/** The Hoshanot of the day, whole: the opening, the day's piyut, the closing. */
function hoshanotOfDay(p: DayProfile, family: Family, other: Section[], festival: FestivalData | null): Section | undefined {
  const P = pieces(family, other, festival);
  if (p.hoshanaRabba) return P.hoshanaRabba;
  const key = hoshanaOfDay(p);
  if (!key) return undefined;
  if (p.shabbat) return family === "ashkenaz" ? undefined : P.hoshanotShabbat;
  const h = festival?.hoshanot;
  const piyut = h?.piyutim[key];
  if (!h || !piyut) return undefined;
  return { title: `הושענות: ${PIYUT_NAMES[key]}`, lines: [...h.opening, ...piyut, ...h.closing] };
}

export interface ComposeInput {
  service: ServiceId;
  nusach: Nusach;
  profile: DayProfile;
  base: Section[];
  other: Section[];
  festival: FestivalData | null;
  /** The day's Torah reading as a section (aliyot and haftarah), when there is one. */
  reading: Section | null;
}

/**
 * Where a second run of the prayer begins, if the file carries one (נוסח
 * אשכנז keeps Shacharit of Shabbat after the weekday one).
 */
function firstRunEnd(base: Section[]): number {
  const seen = new Set<string>();
  for (let i = 0; i < base.length; i++) {
    const t = base[i]!.title.trim();
    if (seen.has(t) && /^(מודה אני|ברכות השחר|ברכו|ק"ש וברכותיה|אבות)$/.test(t)) return i;
    seen.add(t);
  }
  return base.length;
}

export function composeService(input: ComposeInput): Section[] {
  const { service, nusach, profile: p, other, festival, reading } = input;
  const family = familyOf(nusach);
  const end = firstRunEnd(input.base);
  // A file with a second run: the weekday one on a weekday, the Shabbat one on Shabbat.
  if (end < input.base.length && service === "shacharit" && p.shabbat) return input.base.slice(end);
  let list = input.base.slice(0, end);
  const rest = service === "shacharit" ? [] : input.base.slice(end);
  const items = siddurToday(p, nusach);
  const item = (id: string) => items.find((i) => i.id === id);
  const P = pieces(family, other, festival);
  const drop = (re: RegExp) => {
    list = list.filter((s) => !re.test(s.title.trim()));
  };
  const insertAfter = (re: RegExp, add: (Section | undefined)[], fallbackEnd = false) => {
    const parts = add.filter(Boolean) as Section[];
    if (!parts.length) return;
    const i = idx(list, re);
    if (i < 0) {
      if (fallbackEnd) list.push(...parts);
      return;
    }
    list.splice(i + 1, 0, ...parts);
  };
  const moveBefore = (moving: RegExp[], before: RegExp) => {
    const taken: Section[] = [];
    for (const re of moving) {
      const i = idx(list, re);
      if (i >= 0) taken.push(...list.splice(i, 1));
    }
    const j = idx(list, before);
    if (j >= 0) list.splice(j, 0, ...taken);
    else list.push(...taken);
  };

  const noTachanun = item("tachanun")?.say === false;
  const tachanunMinchaOnly = item("tachanun")?.note === "במנחה בלבד";
  const avinu = Boolean(item("avinu"));
  const musafDay = p.roshChodesh || p.cholHamoed || p.yomTov;

  if (service === "mincha") {
    const noMincha = !p.tachanun.mincha || p.shabbat || p.yomTov;
    if (noMincha) drop(/^(תחנון|וידוי|נפילת אפיים|נפילת אפים|שומר ישראל|ה אל׳ ישראל)$/);
    if (!avinu) drop(/^אבינו מלכנו$/);
    if (!p.fast) drop(/^קריאה לתענית ציבור$/);
    if (p.weekday !== 5) drop(/^מנחה לערב שבת$/);
    return [...list, ...rest];
  }

  if (service === "arvit") {
    if (!p.omerDay) drop(/^ספירת העומר$/);
    const afterShabbat = p.evening && p.weekday === 0;
    if (!afterShabbat) drop(/^ערבית למוצאי שבת$/);
    if (p.chanukahDay) insertAfter(/^עלינו$/, [P.chanukah], true);
    return [...list, ...rest];
  }

  // ---------------------------------------------------------------- Shacharit
  // What the day leaves out.
  if (noTachanun || tachanunMinchaOnly) {
    drop(/^(תחנון|וידוי|וידוי וי"ג מידות|נפילת אפיים|ה אל׳ ישראל|שומר ישראל)$/);
  }
  if (!avinu) drop(/^אבינו מלכנו$/);
  if (item("lamnatzeach")?.say === false) drop(/^למנצח$/);
  if (!p.roshChodesh) drop(/^ברכי נפשי$/);
  if (!item("ledavid")) drop(/^לדוד ה'?$/);

  // The Amidah: on Yom Tov, the festival's own where the nusach has it.
  if (p.yomTov && P.amidahRegalim) {
    if (family === "ashkenaz") {
      const from = idx(list, /^אבות$/);
      const to = idx(list, /^אלוהי נצור$/, Math.max(from, 0));
      if (from >= 0 && to >= from) list.splice(from, to - from + 1, P.amidahRegalim);
    } else {
      const i = idx(list, /^עמידה$/);
      if (i >= 0) list.splice(i, 1, P.amidahRegalim);
    }
  }
  const amidahAt = () => {
    const i = idx(list, family === "ashkenaz" ? /^אלוהי נצור$/ : /^עמידה$/);
    return i >= 0 ? i : P.amidahRegalim ? list.indexOf(P.amidahRegalim) : -1;
  };

  // After the Amidah: לולב, הלל, and (ספרד, חב"ד) הושענות.
  const hoshanot = p.sukkot ? hoshanotOfDay(p, family, other, festival) : undefined;
  const afterAmidah = [
    p.sukkot && !p.shabbat ? P.lulav : undefined,
    p.hallel ? P.hallel : undefined,
    family === "sefard" ? hoshanot : undefined,
  ].filter(Boolean) as Section[];
  const at = amidahAt();
  if (at >= 0 && afterAmidah.length) list.splice(at + 1, 0, ...afterAmidah);

  // קריאת התורה
  const torahProcedure = idx(list, /^קריאת התורה$/);
  if (family === "ashkenaz") {
    if (reading) {
      const at = idx(list, /^אשרי$/);
      const parts = [P.torahOut, reading, P.torahIn].filter(Boolean) as Section[];
      if (at >= 0) list.splice(at, 0, ...parts);
    }
  } else if (p.roshChodesh && !p.yomTov && !p.cholHamoed && !p.chanukahDay && P.torahRc && torahProcedure >= 0) {
    list.splice(torahProcedure, 1, P.torahRc);
  } else if (torahProcedure >= 0) {
    if (reading) list.splice(torahProcedure + 1, 0, reading);
    else list.splice(torahProcedure, 1);
  }

  // מוסף, and before it תפילת גשם / טל and הזכרת נשמות.
  if (musafDay) {
    const musaf = p.roshChodesh && !p.yomTov && !p.cholHamoed ? P.musafRc : P.musafRegalim ?? P.musafRc;
    const beforeMusaf: (Section | undefined)[] = [];
    if (item("yizkor")) beforeMusaf.push(P.yizkor);
    if (p.sheminiAtzeret) beforeMusaf.push(P.geshem);
    if (p.pesach && p.hdate.getDate() === 15) beforeMusaf.push(P.tal);
    const musafParts = [...beforeMusaf, musaf];
    if (family === "sefard") {
      // שיר של יום and לדוד come before the reading on these days.
      moveBefore([/^בית יעקב$/, /^שיר של יום$/, /^ברכי נפשי$/, /^לדוד ה'?$/], /^קריאת התורה/);
      insertAfter(/^אשרי$/, musafParts);
    } else if (family === "ashkenaz") {
      insertAfter(/^ובא לציון$/, [...musafParts, hoshanot]);
    } else {
      insertAfter(/^שיר של יום$/, [...musafParts, p.roshChodesh ? P.barchiNafshi : undefined]);
    }
  } else if (family === "ashkenaz" && hoshanot) {
    insertAfter(/^ובא לציון$/, [hoshanot]);
  }

  return [...list, ...rest];
}
