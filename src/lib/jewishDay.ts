import { HDate, HebrewCalendar, flags, months, type Event } from "@hebcal/core";

/**
 * What kind of day it is, worked out once, for everything that depends on it:
 * the siddur (what is said today), the times (candle lighting, the end of
 * Shabbat), the board (a Shabbat or festival screen), the website.
 *
 * The Hebrew day begins at nightfall. From nightfall on, maariv and the
 * evening belong to tomorrow's date, so the profile is of tomorrow - which is
 * how a siddur is read in shul.
 *
 * The calendar itself is @hebcal/core's (holidays, Hallel, Tachanun), the same
 * library the rest of the app uses. What is ours is only which of its facts a
 * page shows. Israel's calendar unless told otherwise.
 */

export interface DayProfile {
  /** The Hebrew date the liturgy follows (tomorrow's, after nightfall). */
  hdate: HDate;
  /** E.g. "ט״ז תשרי תשפ״ז" */
  hebrewDate: string;
  /** 0 = Sunday .. 6 = Shabbat, of the Hebrew day */
  weekday: number;
  shabbat: boolean;
  /** A day of Yom Tov (incl. Rosh Hashana and Yom Kippur), work forbidden. */
  yomTov: boolean;
  cholHamoed: boolean;
  roshChodesh: boolean;
  /** 1..8, or 0 */
  chanukahDay: number;
  purim: boolean;
  /** "צום גדליה", "תשעה באב"... or null */
  fast: string | null;
  roshHashana: boolean;
  yomKippur: boolean;
  /** 1..10 Tishrei */
  aseretYemeiTeshuva: boolean;
  /** Sukkot (15..21 Tishrei): the days of lulav and hoshanot */
  sukkot: boolean;
  hoshanaRabba: boolean;
  /** Shemini Atzeret / Simchat Torah (22 Tishrei in Israel) */
  sheminiAtzeret: boolean;
  /** 1..49 on the days of the Omer (the count said the evening before is the same number) */
  omerDay: number;
  /** 1 Elul .. 21 Tishrei: לדוד ה' אורי */
  ledavidSeason: boolean;
  /** Winter: משיב הרוח ומוריד הגשם (from Musaf of Shemini Atzeret to Musaf of the 1st of Pesach) */
  rainSeason: boolean;
  /** Asking for rain in Israel: from 7 Cheshvan to Pesach */
  talUmatar: boolean;
  /** 0 none, 1 half, 2 whole */
  hallel: 0 | 1 | 2;
  tachanun: { shacharit: boolean; mincha: boolean };
  /** The holidays' own names, in Hebrew */
  holidays: string[];
  /** One line for the day, e.g. "שבת · חול המועד סוכות" */
  title: string;
}

const HE = (e: Event) => e.render("he").replace(/[֑-ׇ]/g, "");

function hdateFor(now: Date, nightfall: Date | null | undefined): HDate {
  const today = new HDate(now);
  return nightfall && now >= nightfall ? today.next() : today;
}

/**
 * @param now        the moment
 * @param nightfall  today's nightfall; from then the profile is of tomorrow.
 *                   Omit to take the civil date as is.
 */
export function dayProfile(now: Date, nightfall?: Date | null, il = true): DayProfile {
  const hd = hdateFor(now, nightfall);
  const events = HebrewCalendar.getHolidaysOnDate(hd, il) ?? [];
  const has = (f: number) => events.some((e) => e.getFlags() & f);
  const desc = (re: RegExp) => events.some((e) => re.test(e.getDesc()));

  const month = hd.getMonth();
  const day = hd.getDate();
  const weekday = hd.getDay();
  const shabbat = weekday === 6;
  const tishrei = month === months.TISHREI;

  // hebcal names the days by the candles lit the night before them: "Chanukah:
  // 1 Candle" is the eve (24 Kislev), "2 Candles" the first day, "8th Day" the last.
  const chanukah = events.find((e) => /^Chanukah/.test(e.getDesc()))?.getDesc() ?? "";
  const candles = Number(/(\d+) Candles?/.exec(chanukah)?.[1] ?? 0);
  const chanukahDay = /8th Day/.test(chanukah) ? 8 : candles > 1 ? candles - 1 : 0;

  const fastEvent = events.find((e) => e.getFlags() & (flags.MINOR_FAST | flags.MAJOR_FAST) && !/Yom Kippur/.test(e.getDesc()));

  // The Omer: from 16 Nisan, 49 days.
  const pesach2 = new HDate(16, months.NISAN, hd.getFullYear());
  const omer = hd.abs() - pesach2.abs() + 1;

  const roshHashana = tishrei && (day === 1 || day === 2);
  const yomKippur = tishrei && day === 10;
  const sukkot = tishrei && day >= 15 && day <= 21;

  // Seasons by date (Israel). Rain is mentioned from Shemini Atzeret to the 1st
  // of Pesach (the day itself changes at Musaf), and asked for from 7 Cheshvan
  // until Pesach.
  // A Hebrew year runs Tishrei .. Elul, so a winter from Tishrei to Nisan is
  // inside one year and a plain range will do.
  const inRange = (from: [number, number], to: [number, number]) => {
    const y = hd.getFullYear();
    const x = hd.abs();
    return x >= new HDate(from[1], from[0], y).abs() && x <= new HDate(to[1], to[0], y).abs();
  };
  const rainSeason = inRange([months.TISHREI, 22], [months.NISAN, 15]);
  const talUmatar = inRange([months.CHESHVAN, 7], [months.NISAN, 14]);

  const yomTov = has(flags.CHAG);
  const cholHamoed = has(flags.CHOL_HAMOED);
  const roshChodesh = has(flags.ROSH_CHODESH);
  const purim = desc(/^Purim$/) || desc(/^Shushan Purim$/);

  const holidays = events.map(HE);
  const parts = [shabbat ? "שבת" : null, ...holidays].filter(Boolean) as string[];
  const tach = HebrewCalendar.tachanun(hd, il);

  return {
    hdate: hd,
    hebrewDate: hd.renderGematriya(true),
    weekday,
    shabbat,
    yomTov,
    cholHamoed,
    roshChodesh,
    chanukahDay,
    purim,
    fast: fastEvent ? HE(fastEvent) : null,
    roshHashana,
    yomKippur,
    aseretYemeiTeshuva: tishrei && day <= 10,
    sukkot,
    hoshanaRabba: tishrei && day === 21,
    sheminiAtzeret: tishrei && day === 22,
    omerDay: omer >= 1 && omer <= 49 ? omer : 0,
    ledavidSeason: month === months.ELUL || (tishrei && day <= 21),
    rainSeason,
    talUmatar,
    hallel: HebrewCalendar.hallel(hd, il) as 0 | 1 | 2,
    tachanun: { shacharit: tach.shacharit, mincha: tach.mincha },
    holidays,
    title: [...new Set(parts)].join(" · ") || "יום חול",
  };
}
