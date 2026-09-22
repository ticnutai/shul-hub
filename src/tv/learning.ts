import { flags, gematriya, HDate, HebrewCalendar, ParshaEvent } from "@hebcal/core";

/**
 * Daily-learning facts for the board: Daf Yomi, the weekly parasha and the
 * next few holidays.
 *
 * Daf Yomi is computed here rather than read from a table or a library.
 * @hebcal/core 6 dropped its DafYomi class (it moved to @hebcal/learning, which
 * needs core ^6.9 - adding it would upgrade hebcal for the whole site). The
 * schedule itself is fully deterministic, so it needs no data, no maintenance
 * and works offline. Checked day by day against @hebcal/learning 6.11 for
 * every date 2018-2035 (two full cycles' worth of boundaries); golden values
 * from that run are locked in src/tv/learning.test.ts.
 */

/** [Hebrew name, last daf]. Every tractate starts at daf 2. */
const SHAS: Array<[string, number]> = [
  ["ברכות", 64], ["שבת", 157], ["עירובין", 105], ["פסחים", 121], ["שקלים", 22],
  ["יומא", 88], ["סוכה", 56], ["ביצה", 40], ["ראש השנה", 35], ["תענית", 31],
  ["מגילה", 32], ["מועד קטן", 29], ["חגיגה", 27], ["יבמות", 122], ["כתובות", 112],
  ["נדרים", 91], ["נזיר", 66], ["סוטה", 49], ["גיטין", 90], ["קידושין", 82],
  ["בבא קמא", 119], ["בבא מציעא", 119], ["בבא בתרא", 176], ["סנהדרין", 113], ["מכות", 24],
  ["שבועות", 49], ["עבודה זרה", 76], ["הוריות", 14], ["זבחים", 120], ["מנחות", 110],
  ["חולין", 142], ["בכורות", 61], ["ערכין", 34], ["תמורה", 34], ["כריתות", 28],
  // Kinnim, Tamid and Middot are numbered inside Meilah's pagination (offsets
  // below): Kinnim 23-25, Tamid 26-33, Middot 34-37. An earlier transcription
  // of this table used Tamid 10 / Middot 4, which shifted their boundary by a
  // day - caught by comparing all 6,574 days of 2018-2035 against hebcal.
  ["מעילה", 22], ["קינים", 4], ["תמיד", 9], ["מידות", 5], ["נדה", 73],
];

const DAY_MS = 86_400_000;

/** Whole days since 1970-01-01 for the calendar date as seen locally. */
function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

// Cycle 1 began 11 Sep 1923. From cycle 8 (24 Jun 1975) Shekalim follows the
// Jerusalem Talmud's 22 dafim, making every cycle 2711 days instead of 2702.
const OLD_CYCLE_START = dayNumber(new Date(1923, 8, 11));
const NEW_CYCLE_START = dayNumber(new Date(1975, 5, 24));

export interface DafYomi {
  tractate: string;
  daf: number;
  /** e.g. "מנחות מ״ב" */
  label: string;
}

export function dafYomi(date: Date): DafYomi | null {
  const day = dayNumber(date);
  if (day < OLD_CYCLE_START) return null;

  const newCycle = day >= NEW_CYCLE_START;
  const cycleNo = newCycle
    ? 8 + Math.floor((day - NEW_CYCLE_START) / 2711)
    : 1 + Math.floor((day - OLD_CYCLE_START) / 2702);
  const dayInCycle = newCycle ? (day - NEW_CYCLE_START) % 2711 : (day - OLD_CYCLE_START) % 2702;

  let total = 0;
  for (let i = 0; i < SHAS.length; i += 1) {
    const last = i === 4 && cycleNo <= 7 ? 13 : SHAS[i][1];
    total += last - 1;
    if (dayInCycle < total) {
      let daf = last + 1 - (total - dayInCycle);
      // Kinnim, Tamid and Middot are printed inside Meilah's pagination.
      if (i === 36) daf += 21;
      else if (i === 37) daf += 24;
      else if (i === 38) daf += 32;
      const tractate = SHAS[i][0];
      return { tractate, daf, label: `${tractate} ${gematriya(daf)}` };
    }
  }
  return null;
}

/** Hebrew text without niqqud, which is too small to read on a wall. */
export function stripNiqqud(text: string): string {
  return text.replace(/[֑-ׇ]/g, "");
}

/**
 * The calendar library writes Hebrew with niqqud, in the defective spelling
 * that goes with it ("סֻכּוֹת"). Stripping the niqqud alone leaves "סכות",
 * which reads wrong on a board without vowels - Israeli signage uses the full
 * spelling. So: strip, then spell out the few words where the two differ.
 */
const FULL_SPELLING: Array<[RegExp, string]> = [
  [/סכות/g, "סוכות"],
  [/יום כפור/g, "יום כיפור"],
  [/חנכה/g, "חנוכה"],
];

export function hebrewName(text: string): string {
  let out = stripNiqqud(text);
  for (const [from, to] of FULL_SPELLING) out = out.replace(from, to);
  return out;
}

/**
 * The parasha read on the coming Shabbat (or today, on Shabbat). Israel
 * schedule: the synagogue is in Bnei Brak, and the two schedules diverge
 * after some festivals.
 */
export function weeklyParasha(date: Date, il = true): string | null {
  const today = new HDate(date);
  const shabbat = today.getDay() === 6 ? today : today.onOrAfter(6);
  const events = HebrewCalendar.calendar({
    start: shabbat.greg(),
    end: shabbat.greg(),
    sedrot: true,
    il,
    locale: "he",
  });
  const parsha = events.find((ev) => ev instanceof ParshaEvent);
  if (parsha) return hebrewName(parsha.render("he"));

  // A festival Shabbat has no weekly parasha (Sukkot I, for instance, has the
  // festival reading). On the day itself, name the festival - that is what is
  // being read. On a weekday, naming next Shabbat's festival would answer a
  // question nobody asked: "which parasha are we in?" is answered by the last
  // one read, so the board keeps showing it until the cycle moves on.
  const onTheDay = today.getDay() === 6;
  if (onTheDay) {
    const holiday = events.find((ev) => ev.getFlags() & flags.CHAG);
    if (holiday) return hebrewName(holiday.render("he"));
  }
  return lastParashaRead(shabbat, il);
}

/** The most recent weekly parasha actually read, looking back up to five weeks. */
function lastParashaRead(from: HDate, il: boolean): string | null {
  for (let week = 1; week <= 5; week++) {
    const shabbat = from.subtract(week * 7, "d");
    const events = HebrewCalendar.calendar({ start: shabbat.greg(), end: shabbat.greg(), sedrot: true, il, locale: "he" });
    const parsha = events.find((ev) => ev instanceof ParshaEvent);
    if (parsha) return hebrewName(parsha.render("he"));
  }
  return null;
}

export interface UpcomingDay {
  date: Date;
  title: string;
  /** Days from today, 0 = today. */
  inDays: number;
  major: boolean;
}

const UPCOMING_MASK =
  flags.CHAG |
  flags.MAJOR_FAST |
  flags.MINOR_FAST |
  flags.ROSH_CHODESH |
  flags.SPECIAL_SHABBAT |
  flags.CHOL_HAMOED |
  flags.EREV |
  flags.MINOR_HOLIDAY |
  flags.MODERN_HOLIDAY;

/** Holidays, fasts, Rosh Chodesh and special Shabbatot in the next `days`. */
export function upcomingDays(date: Date, days = 21, limit = 6): UpcomingDay[] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start.getTime() + days * DAY_MS);
  return HebrewCalendar.calendar({ start, end, il: true, locale: "he" })
    .filter((ev) => ev.getFlags() & UPCOMING_MASK)
    .map((ev) => {
      const d = ev.getDate().greg();
      return {
        date: d,
        title: hebrewName(ev.render("he")),
        inDays: dayNumber(d) - dayNumber(start),
        major: Boolean(ev.getFlags() & (flags.CHAG | flags.MAJOR_FAST)),
      };
    })
    .slice(0, limit);
}

/* ------------------------------------------------------- Amud Yomi ---- */

/**
 * The shul's Amud Yomi: one side of a daf a day, half the pace of Daf Yomi.
 *
 * Unlike Daf Yomi this has no world-wide fixed start - a shul begins where
 * it begins. This one is anchored to where ours actually was on a known
 * day, and counts from there: 22 September 2026 was שבת דף ז׳ ע״א, so the
 * next day is ע״ב, the day after that is דף ח׳ ע״א, and so on.
 *
 * It runs on through the whole Shas rather than stopping at the end of
 * שבת, using the same table Daf Yomi uses, and wraps when it gets there -
 * so the board keeps telling the truth long after anybody here has stopped
 * thinking about it.
 */
const AMUD_ANCHOR_DAY = dayNumber(new Date(2026, 8, 22));
/** שבת דף ז׳ ע״א, as an index into the Shas counted in amudim. */
const AMUD_ANCHOR_INDEX = (() => {
  let before = 0;
  for (const [name, last] of SHAS) {
    if (name === "שבת") return before + (7 - 2) * 2;
    before += (last - 1) * 2;
  }
  return 0;
})();
const AMUDIM_IN_SHAS = SHAS.reduce((n, [, last]) => n + (last - 1) * 2, 0);

export interface AmudYomi {
  tractate: string;
  daf: number;
  /** 0 for ע״א, 1 for ע״ב. */
  side: 0 | 1;
  /** e.g. "שבת דף ז׳ ע״א". */
  label: string;
}

export function amudYomi(date: Date): AmudYomi {
  // Positive modulo: a date before the anchor counts backwards correctly.
  const n =
    (((AMUD_ANCHOR_INDEX + dayNumber(date) - AMUD_ANCHOR_DAY) % AMUDIM_IN_SHAS) + AMUDIM_IN_SHAS) %
    AMUDIM_IN_SHAS;

  let left = n;
  for (const [tractate, last] of SHAS) {
    const amudim = (last - 1) * 2;
    if (left < amudim) {
      const daf = 2 + Math.floor(left / 2);
      const side = (left % 2) as 0 | 1;
      return {
        tractate,
        daf,
        side,
        label: `${tractate} דף ${gematriya(daf)} ${side === 0 ? "ע״א" : "ע״ב"}`,
      };
    }
    left -= amudim;
  }
  // Unreachable: n was reduced modulo the length of the Shas.
  const [tractate] = SHAS[0];
  return { tractate, daf: 2, side: 0, label: `${tractate} דף ${gematriya(2)} ע״א` };
}

/**
 * What the season adds to the davening, as said in Eretz Yisrael.
 *
 * Two of these are insertions in the Amidah: "משיב הרוח ומוריד הגשם" from
 * Shemini Atzeret (22 Tishrei) until the first day of Pesach, otherwise
 * "מוריד הטל"; "ותן טל ומטר לברכה" from 7 Cheshvan until Pesach,
 * otherwise "ותן ברכה".
 *
 * The third is not an insertion but a psalm said after davening: "לדוד ה'
 * אורי וישעי", from Rosh Chodesh Elul through Shemini Atzeret - which in
 * Eretz Yisrael is Simchat Torah, the same day. It is on the board for the
 * weeks it is said and gone by itself on 23 Tishrei, which is the whole
 * point of it being computed rather than typed in by the gabbai.
 */
export function seasonalPrayers(date: Date): {
  geshem: boolean;
  talUmatar: boolean;
  leDavid: boolean;
  text: string;
} {
  const h = new HDate(date);
  const m = h.getMonth();
  const d = h.getDate();
  // Hebcal months: NISAN = 1 ... ELUL = 6, TISHREI = 7, CHESHVAN = 8 ... ADAR II = 13.
  const beforePesach = m === 1 && d < 15;
  const geshem = (m === 7 && d >= 22) || m >= 8 || beforePesach;
  const talUmatar = (m === 8 && d >= 7) || m >= 9 || beforePesach;
  // All of Elul, and Tishrei up to and including Shemini Atzeret.
  const leDavid = m === 6 || (m === 7 && d <= 22);
  return {
    geshem,
    talUmatar,
    leDavid,
    text: [
      leDavid && "לדוד ה' אורי וישעי",
      geshem ? "משיב הרוח ומוריד הגשם" : "מוריד הטל",
      talUmatar ? "ותן טל ומטר לברכה" : "ותן ברכה",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
