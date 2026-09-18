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
  if (parsha) return stripNiqqud(parsha.render("he"));
  // A festival Shabbat has no weekly parasha; name the festival instead.
  const holiday = events.find((ev) => ev.getFlags() & flags.CHAG);
  return holiday ? stripNiqqud(holiday.render("he")) : null;
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
        title: stripNiqqud(ev.render("he")),
        inDays: dayNumber(d) - dayNumber(start),
        major: Boolean(ev.getFlags() & (flags.CHAG | flags.MAJOR_FAST)),
      };
    })
    .slice(0, limit);
}
