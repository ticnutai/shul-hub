import { HDate, HebrewCalendar, ParshaEvent, parshiot } from "@hebcal/core";
import {
  getLeyningForParsha,
  getLeyningForParshaHaShavua,
  getWeekdayReading,
  lookupParsha,
  type Aliyah,
} from "@hebcal/leyning";
import { toHebrewNumber } from "@/utils/hebrewNumbers";

/**
 * Aliyah divisions for a parsha, as read in shul.
 *
 * Nothing here is computed. The division is a fixed table (the Tikkun Korim;
 * see hebcal.com/home/48), and @hebcal/leyning carries it: Shabbat's seven
 * aliyot plus maftir, the three of Monday/Thursday, and the haftarah by minhag.
 * Where sources divide differently, hebcal says so in `reason`, and we show it.
 */

export type AliyahDivision = "none" | "shabbat" | "weekday";
export type HaftarahMinhag = "ashkenazi" | "sephardi" | "chabad";

export interface VerseRef {
  perek: number;
  pasuk: number;
}

export interface AliyahSpan {
  /** "1".."7", "M" for maftir */
  key: string;
  /** Name of the aliyah: כהן, לוי, שלישי … מפטיר (weekday: כהן, לוי, ישראל) */
  label: string;
  begin: VerseRef;
  end: VerseRef;
  verses: number;
  /** Where other sources divide differently, in hebcal's words */
  note?: string;
}

export interface HaftarahRange {
  book: string;
  bookHe: string;
  begin: VerseRef;
  end: VerseRef;
  /** Key into haftarot.json */
  textKey: string;
}

const SHABBAT_LABELS: Record<string, string> = {
  "1": "כהן",
  "2": "לוי",
  "3": "שלישי",
  "4": "רביעי",
  "5": "חמישי",
  "6": "שישי",
  "7": "שביעי",
  M: "מפטיר",
};

const WEEKDAY_LABELS: Record<string, string> = { "1": "כהן", "2": "לוי", "3": "ישראל" };

const BOOK_HE: Record<string, string> = {
  Genesis: "בראשית", Exodus: "שמות", Leviticus: "ויקרא", Numbers: "במדבר", Deuteronomy: "דברים",
  Joshua: "יהושע", Judges: "שופטים", "I Samuel": "שמואל א", "II Samuel": "שמואל ב",
  "I Kings": "מלכים א", "II Kings": "מלכים ב", Isaiah: "ישעיהו", Jeremiah: "ירמיהו",
  Ezekiel: "יחזקאל", Hosea: "הושע", Joel: "יואל", Amos: "עמוס", Obadiah: "עובדיה",
  Jonah: "יונה", Micah: "מיכה", Nachum: "נחום", Habakkuk: "חבקוק", Zephaniah: "צפניה",
  Haggai: "חגי", Zechariah: "זכריה", Malachi: "מלאכי",
};

const toRef = (s: string): VerseRef => {
  const [perek, pasuk] = s.split(":").map(Number);
  return { perek, pasuk };
};

const cmp = (a: VerseRef, b: VerseRef) => a.perek - b.perek || a.pasuk - b.pasuk;

export const inSpan = (v: VerseRef, span: { begin: VerseRef; end: VerseRef }) =>
  cmp(v, span.begin) >= 0 && cmp(v, span.end) <= 0;

/** Our parsha ids run 1 (Bereshit) … 54 (Vezot Haberakhah), in hebcal's order. */
export const hebcalParshaName = (parshaNum: number): string | null => parshiot[parshaNum - 1] ?? null;

const h = (s: string) => toHebrewNumber(Number(s));

// Every note hebcal carries today has this one shape; anything new falls through in English.
const REASON_HE: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^some sources use (\d+):(\d+)\s*-\s*(\d+)(?::(\d+))?$/i, (m) =>
    `יש מחלקים: ${h(m[1])} ${h(m[2])} – ${m[4] ? `${h(m[3])} ${h(m[4])}` : h(m[3])}`],
];

const translateReason = (reason?: string): string | undefined => {
  if (!reason) return undefined;
  for (const [re, fmt] of REASON_HE) {
    const m = reason.match(re);
    if (m) return fmt(m);
  }
  return reason;
};

const toSpan = (key: string, a: Aliyah, labels: Record<string, string>): AliyahSpan => {
  const begin = toRef(a.b);
  const end = toRef(a.e);
  return {
    key,
    label: labels[key] ?? key,
    begin,
    end,
    verses: a.v ?? 0,
    note: translateReason(a.reason),
  };
};

const cache = new Map<string, AliyahSpan[]>();

/** The aliyot of one parsha, read on its own (not doubled). */
export function getParshaAliyot(parshaNum: number, division: Exclude<AliyahDivision, "none">): AliyahSpan[] {
  const cacheKey = `${parshaNum}:${division}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const name = hebcalParshaName(parshaNum);
  if (!name) return [];

  let spans: AliyahSpan[] = [];
  try {
    if (division === "weekday") {
      const map = getWeekdayReading(name);
      spans = ["1", "2", "3"].filter((k) => map?.[k]).map((k) => toSpan(k, map[k], WEEKDAY_LABELS));
    } else {
      const full = getLeyningForParsha(name).fullkriyah ?? {};
      spans = ["1", "2", "3", "4", "5", "6", "7", "M"]
        .filter((k) => full[k])
        .map((k) => toSpan(k, full[k], SHABBAT_LABELS));
    }
  } catch {
    spans = [];
  }
  cache.set(cacheKey, spans);
  return spans;
}

/**
 * Haftarah of the parsha by minhag. Ranges, because some haftarot skip verses
 * (e.g. Chabad's for Vayeshev) and are read as more than one piece.
 */
export function getParshaHaftarah(parshaNum: number, minhag: HaftarahMinhag): HaftarahRange[] {
  const name = hebcalParshaName(parshaNum);
  if (!name) return [];
  try {
    const meta = lookupParsha(name);
    return toRanges((minhag === "sephardi" && meta.seph) || (minhag === "chabad" && meta.chabad) || meta.haft);
  } catch {
    return [];
  }
}

const toRanges = (h: Aliyah | Aliyah[] | undefined): HaftarahRange[] =>
  (Array.isArray(h) ? h : h ? [h] : []).map((a) => ({
    book: a.k,
    bookHe: BOOK_HE[a.k] ?? a.k,
    begin: toRef(a.b),
    end: toRef(a.e),
    textKey: `${a.k}|${a.b}|${a.e}`,
  }));

const SPECIAL_HE: Array<[RegExp, string]> = [
  [/Machar Chodesh/i, "שבת מחר חודש"],
  [/Rosh Chodesh/i, "שבת ראש חודש"],
  [/Shekalim/i, "פרשת שקלים"],
  [/Zachor/i, "פרשת זכור"],
  [/Parah/i, "פרשת פרה"],
  [/HaChodesh/i, "פרשת החודש"],
  [/HaGadol/i, "שבת הגדול"],
  [/Shuva/i, "שבת שובה"],
  [/Chanukah/i, "שבת חנוכה"],
  [/Chazon/i, "שבת חזון"],
  [/Nachamu/i, "שבת נחמו"],
];

const specialHe = (reason?: string) => {
  if (!reason) return undefined;
  return SPECIAL_HE.filter(([re]) => re.test(reason)).map(([, he]) => he).join(" + ") || reason;
};

export interface ShabbatReading {
  /** Our parsha ids read this Shabbat — two when doubled */
  parshaNums: number[];
  /** Gregorian date of that Shabbat */
  date: Date;
  /** Maftir when it isn't the end of the parsha (Rosh Chodesh, the four parshiyot…) */
  specialMaftir?: { label: string; bookHe: string; begin: VerseRef; end: VerseRef };
  /** Haftarah that replaces the parsha's own, by minhag, with why */
  specialHaftarah?: { label: string; ranges: Record<HaftarahMinhag, HaftarahRange[]> };
}

/**
 * What is actually read this coming Shabbat. Needed because the calendar
 * overrides the parsha: a doubled parsha divides its aliyot differently, and
 * a special Shabbat brings its own maftir and haftarah.
 */
export function getUpcomingShabbatReading(il: boolean, from: Date = new Date()): ShabbatReading | null {
  try {
    const today = new HDate(from);
    const shabbat = today.getDay() === 6 ? today : today.onOrAfter(6);
    const ev = HebrewCalendar.calendar({ start: shabbat.greg(), end: shabbat.greg(), sedrot: true, il })
      .find((e) => e instanceof ParshaEvent) as ParshaEvent | undefined;
    if (!ev) return null;

    const parshaNums = ev.parsha.map((p) => parshiot.indexOf(p) + 1).filter((n) => n > 0);
    const l = getLeyningForParshaHaShavua(ev, il) as {
      fullkriyah?: Record<string, Aliyah>;
      haft?: Aliyah | Aliyah[];
      seph?: Aliyah | Aliyah[];
      chabad?: Aliyah | Aliyah[];
      reason?: Record<string, string>;
    };
    const reading: ShabbatReading = { parshaNums, date: shabbat.greg() };

    const m = l.fullkriyah?.M;
    if (m && l.reason?.M) {
      reading.specialMaftir = {
        label: specialHe(l.reason.M) ?? "",
        bookHe: BOOK_HE[m.k] ?? m.k,
        begin: toRef(m.b),
        end: toRef(m.e),
      };
    }
    if (l.reason?.haftara) {
      const ashkenazi = toRanges(l.haft);
      reading.specialHaftarah = {
        label: specialHe(l.reason.haftara) ?? "",
        ranges: {
          ashkenazi,
          sephardi: l.seph ? toRanges(l.seph) : ashkenazi,
          chabad: l.chabad ? toRanges(l.chabad) : ashkenazi,
        },
      };
    }
    return reading;
  } catch {
    return null;
  }
}

/**
 * Where each aliyah starts, keyed "perek:pasuk". Maftir begins inside
 * Shevi'i, so one verse can open two aliyot.
 */
export function aliyahStartMarkers(spans: AliyahSpan[]): Map<string, AliyahSpan[]> {
  const map = new Map<string, AliyahSpan[]>();
  for (const s of spans) {
    const k = `${s.begin.perek}:${s.begin.pasuk}`;
    map.set(k, [...(map.get(k) ?? []), s]);
  }
  return map;
}

export type HaftarahVerse = [perek: number, pasuk: number, text: string];

let haftarotPromise: Promise<Record<string, HaftarahVerse[]>> | null = null;

/** Haftarah text is 0.5MB, so it loads only when a haftarah is opened. */
export function loadHaftarahTexts(): Promise<Record<string, HaftarahVerse[]>> {
  haftarotPromise ??= import("@/data/haftarot.json")
    .then((m) => (m.default as unknown as { texts: Record<string, HaftarahVerse[]> }).texts)
    .catch((e) => {
      haftarotPromise = null;
      throw e;
    });
  return haftarotPromise;
}

export const ALIYAH_DIVISION_KEY = "torah-aliyah-division";
export const HAFTARAH_MINHAG_KEY = "torah-haftarah-minhag";

export function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode — the choice just won't be remembered */
  }
}
