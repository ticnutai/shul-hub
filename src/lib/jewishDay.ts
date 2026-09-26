import { HDate, HebrewCalendar, Locale, ParshaEvent, flags, months, type Event } from "@hebcal/core";

/**
 * The Jewish day: the one place the app asks the Hebrew calendar what kind of
 * day it is. The siddur (what is said today), the times (candle lighting, the
 * end of Shabbat and Yom Tov), the board (a Shabbat or festival screen and its
 * look), the Omer page and the website all read their answer from here, so
 * they cannot disagree with each other.
 *
 * The Hebrew day begins at nightfall. From nightfall on, maariv and the
 * evening belong to tomorrow's date, so the profile is of tomorrow - which is
 * how a siddur is read in shul. Callers that live by the civil day (a board
 * that changes its dress at midnight, a timetable) ask by the civil date.
 *
 * The calendar itself is @hebcal/core's. Where hebcal's own tables are wrong
 * for us they are corrected here, once, with the reason:
 *   - Hallel: hebcal says whole Hallel on 24 Kislev (the eve of Chanukah, no
 *     Hallel), half Hallel on Pesach Sheni ("Pesach..." by name), and none on
 *     Shemini Atzeret in Israel (it only knows "Sukkot..." by name). And it
 *     counts Yom HaAtzma'ut and Yom Yerushalayim as whole Hallel, which is a
 *     custom of some communities - kept apart as nationalHallel.
 *   - Tachanun: none on Shushan Purim Katan (שו"ע תרצז) nor on Pesach Sheni
 *     (the custom of most communities); hebcal says it is said.
 * Israel's calendar unless told otherwise.
 */

/* ----------------------------------------------------------- the lookups -- */

const eventCache = new Map<string, Event[]>();

/** hebcal's events on a Hebrew date. Cached: a board asks many times a minute. */
export function eventsOn(hd: HDate, il = true): Event[] {
  const key = `${hd.abs()}:${il ? 1 : 0}`;
  let events = eventCache.get(key);
  if (!events) {
    if (eventCache.size > 1500) eventCache.clear();
    events = HebrewCalendar.getHolidaysOnDate(hd, il) ?? [];
    eventCache.set(key, events);
  }
  return events;
}

const jerusalemDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The Hebrew date of Jerusalem's civil day of `date` (midnight to midnight),
 * whatever timezone the device is set to.
 */
export function civilHDate(date: Date): HDate {
  const [y, m, d] = jerusalemDay.format(date).split("-").map(Number);
  return new HDate(new Date(y!, m! - 1, d!, 12));
}

/** hebcal's events on Jerusalem's civil day of `date`. */
export function eventsOnCivil(date: Date, il = true): Event[] {
  return eventsOn(civilHDate(date), il);
}

const parshaCache = new Map<string, ParshaEvent | null>();

/**
 * The weekly parasha read on the Shabbat of `date` (the coming one; on
 * Shabbat, that day's), or null when a festival displaces it.
 */
export function parshaOfWeek(date: Date | HDate, il = true): { event: ParshaEvent | null; shabbat: HDate } {
  const hd = date instanceof HDate ? date : new HDate(date);
  const shabbat = hd.getDay() === 6 ? hd : hd.onOrAfter(6);
  const key = `${shabbat.abs()}:${il ? 1 : 0}`;
  if (!parshaCache.has(key)) {
    if (parshaCache.size > 500) parshaCache.clear();
    const events = HebrewCalendar.calendar({ start: shabbat, end: shabbat, sedrot: true, il, noHolidays: true });
    parshaCache.set(key, (events.find((e) => e instanceof ParshaEvent) as ParshaEvent | undefined) ?? null);
  }
  return { event: parshaCache.get(key) ?? null, shabbat };
}

/* ---------------------------------------------------------- the profile -- */

export interface DayProfile {
  /** The Hebrew date the liturgy follows (tomorrow's, after nightfall). */
  hdate: HDate;
  /** E.g. "ט״ז תשרי תשפ״ז" */
  hebrewDate: string;
  /** 0 = Sunday .. 6 = Shabbat, of the Hebrew day */
  weekday: number;
  /** The evening of this Hebrew day (after nightfall of the civil day before it). */
  evening: boolean;
  shabbat: boolean;
  /** A day of Yom Tov (incl. Rosh Hashana and Yom Kippur), work forbidden. */
  yomTov: boolean;
  cholHamoed: boolean;
  roshChodesh: boolean;
  /** The eve of a Yom Tov (ערב ראש השנה, ערב יום כיפור, ערב פסח, ערב שבועות, ערב סוכות, ערב שביעי של פסח). */
  erevYomTov: boolean;
  /** The day after a festival (אסרו חג). */
  isruChag: boolean;
  /** 1..8 (the eve is 0) */
  chanukahDay: number;
  /** 14 Adar (Adar II in a leap year) */
  purim: boolean;
  /** 15 Adar: Purim in Jerusalem, a day without Tachanun elsewhere */
  shushanPurim: boolean;
  /** 14-15 Adar I in a leap year */
  purimKatan: boolean;
  /** "צום גדליה", "תשעה באב"... or null (Yom Kippur is not listed here) */
  fast: string | null;
  tishaBav: boolean;
  roshHashana: boolean;
  yomKippur: boolean;
  /** 1..10 Tishrei */
  aseretYemeiTeshuva: boolean;
  /** Sukkot (15..21 Tishrei): the days of lulav and hoshanot */
  sukkot: boolean;
  hoshanaRabba: boolean;
  /** Shemini Atzeret / Simchat Torah (22 Tishrei in Israel) */
  sheminiAtzeret: boolean;
  pesach: boolean;
  shavuot: boolean;
  /** 1..49 on the days of the Omer (counted the evening that begins the day) */
  omerDay: number;
  /** 1 Elul .. Shemini Atzeret: לדוד ה' אורי (some end at Hoshana Rabba) */
  ledavidSeason: boolean;
  /**
   * Winter: משיב הרוח ומוריד הגשם, from Musaf of Shemini Atzeret to Musaf of the
   * 1st of Pesach. Each boundary day is counted as it is after Musaf (Shemini
   * Atzeret in, the 1st of Pesach out); the siddur notes Shacharit of those days.
   */
  rainSeason: boolean;
  /** Asking for rain in Israel: from 7 Cheshvan to Pesach */
  talUmatar: boolean;
  /** 0 none, 1 half, 2 whole */
  hallel: 0 | 1 | 2;
  /** Yom HaAtzma'ut / Yom Yerushalayim: Hallel in the communities that say it */
  nationalHallel: boolean;
  tachanun: { shacharit: boolean; mincha: boolean };
  /** "שבת שקלים", "שבת שובה"... */
  specialShabbat: string | null;
  /** A Shabbat on which the coming month is blessed, and that month (not before Tishrei) */
  mevarchim: { month: number; name: string } | null;
  /** National days (יום העצמאות...), in Hebrew */
  national: string[];
  /** Board's festival look: Yom Tov, Chol HaMoed, Chanukah, Purim, Shushan Purim */
  festival: boolean;
  /** The holidays' own names, in Hebrew */
  holidays: string[];
  /** One line for the day, e.g. "שבת · חול המועד סוכות" */
  title: string;
}

const HE = (e: Event) => e.render("he").replace(/[֑-ׇ]/g, "");

const profileCache = new Map<string, DayProfile>();

/**
 * @param now        the moment
 * @param nightfall  today's nightfall; from then the profile is of tomorrow.
 *                   Omit to take the civil date as is.
 */
export function dayProfile(now: Date, nightfall?: Date | null, il = true): DayProfile {
  const today = new HDate(now);
  const evening = Boolean(nightfall && now >= nightfall);
  return profileOf(evening ? today.next() : today, il, evening);
}

/** The profile of Jerusalem's civil day of `date` (midnight to midnight). */
export function civilDayProfile(date: Date, il = true): DayProfile {
  return profileOf(civilHDate(date), il, false);
}

export function profileOf(hd: HDate, il = true, evening = false): DayProfile {
  const key = `${hd.abs()}:${il ? 1 : 0}:${evening ? 1 : 0}`;
  let p = profileCache.get(key);
  if (!p) {
    if (profileCache.size > 800) profileCache.clear();
    p = buildProfile(hd, il, evening);
    profileCache.set(key, p);
  }
  return p;
}

function buildProfile(hd: HDate, il: boolean, evening: boolean): DayProfile {
  const events = eventsOn(hd, il);
  const religious = events.filter((e) => !(e.getFlags() & flags.MODERN_HOLIDAY));
  const has = (f: number) => religious.some((e) => e.getFlags() & f);
  const desc = (re: RegExp) => religious.some((e) => re.test(e.getDesc()));

  const month = hd.getMonth();
  const day = hd.getDate();
  const weekday = hd.getDay();
  const shabbat = weekday === 6;
  const tishrei = month === months.TISHREI;
  const leap = HDate.isLeapYear(hd.getFullYear());
  const purimMonth = leap ? months.ADAR_II : months.ADAR_I;

  // hebcal names the days by the candles lit the night before them: "Chanukah:
  // 1 Candle" is the eve (24 Kislev), "2 Candles" the first day, "8th Day" the last.
  const chanukah = religious.find((e) => /^Chanukah/.test(e.getDesc()))?.getDesc() ?? "";
  const candles = Number(/(\d+) Candles?/.exec(chanukah)?.[1] ?? 0);
  const chanukahDay = /8th Day/.test(chanukah) ? 8 : candles > 1 ? candles - 1 : 0;

  const fastEvent = religious.find((e) => e.getFlags() & (flags.MINOR_FAST | flags.MAJOR_FAST) && !/Yom Kippur/.test(e.getDesc()));

  // The Omer: from 16 Nisan, 49 days.
  const omer = hd.abs() - new HDate(16, months.NISAN, hd.getFullYear()).abs() + 1;

  // Seasons by date (Israel). A Hebrew year runs Tishrei .. Elul, so a winter
  // from Tishrei to Nisan is inside one year and a plain range will do.
  const inRange = (from: [number, number], to: [number, number]) => {
    const y = hd.getFullYear();
    const x = hd.abs();
    return x >= new HDate(from[1], from[0], y).abs() && x <= new HDate(to[1], to[0], y).abs();
  };

  const yomTov = has(flags.CHAG);
  const cholHamoed = has(flags.CHOL_HAMOED);
  const roshChodesh = has(flags.ROSH_CHODESH);
  const purim = month === purimMonth && day === 14;
  const shushanPurim = month === purimMonth && day === 15;
  const purimKatan = leap && month === months.ADAR_I && (day === 14 || day === 15);
  const sukkot = tishrei && day >= 15 && day <= 21;
  const sheminiAtzeret = tishrei && day === 22;
  const pesach = month === months.NISAN && day >= 15 && day <= (il ? 21 : 22);
  const shavuot = month === months.SIVAN && (day === 6 || (!il && day === 7));
  const yomKippur = tishrei && day === 10;

  // Hallel, by the date (see the note at the top about hebcal's table).
  let hallel: 0 | 1 | 2 = 0;
  if (
    (tishrei && day >= 15 && day <= (il ? 22 : 23)) ||
    chanukahDay > 0 ||
    (month === months.NISAN && (day === 15 || (!il && day === 16))) ||
    shavuot
  ) {
    hallel = 2;
  } else if (roshChodesh || pesach) {
    hallel = 1;
  }
  const nationalHallel = events.some((e) => /^Yom (HaAtzma'ut|Yerushalayim)$/.test(e.getDesc()));

  const tach = HebrewCalendar.tachanun(hd, il);
  const tachanun = { shacharit: tach.shacharit, mincha: tach.mincha };
  if (purimKatan || (month === months.IYYAR && day === 14)) tachanun.shacharit = tachanun.mincha = false;

  const next = eventsOn(hd.next(), il);
  const erevYomTov = !yomTov && next.some((e) => e.getFlags() & flags.CHAG && !(e.getFlags() & flags.MODERN_HOLIDAY));
  const prev = eventsOn(hd.prev(), il);
  const isruChag =
    !yomTov && !cholHamoed && prev.some((e) => /^(Shmini Atzeret|Pesach VII|Shavuot( II)?|Simchat Torah)$/.test(e.getDesc()));

  const specialShabbatEvent = religious.find((e) => e.getFlags() & flags.SPECIAL_SHABBAT);

  // Shabbat Mevarchim: the Shabbat before a Rosh Chodesh, except Tishrei's.
  let mevarchim: DayProfile["mevarchim"] = null;
  if (shabbat) {
    for (let i = 1; i <= 7; i++) {
      const d = hd.add(i, "d");
      if (eventsOn(d, il).some((e) => e.getFlags() & flags.ROSH_CHODESH)) {
        // The first day of a two-day Rosh Chodesh is the 30th of the month before.
        const m = d.getDate() === 30 ? d.add(1, "d") : d;
        if (m.getMonth() !== months.TISHREI) {
          mevarchim = { month: m.getMonth(), name: Locale.gettext(m.getMonthName(), "he").replace(/[֑-ׇ]/g, "") };
        }
        break;
      }
    }
  }

  const holidays = religious.map(HE);
  const national = events.filter((e) => e.getFlags() & flags.MODERN_HOLIDAY).map(HE);
  const parts = [shabbat ? "שבת" : null, ...holidays].filter(Boolean) as string[];

  return {
    hdate: hd,
    hebrewDate: hd.renderGematriya(true),
    weekday,
    evening,
    shabbat,
    yomTov,
    cholHamoed,
    roshChodesh,
    erevYomTov,
    isruChag,
    chanukahDay,
    purim,
    shushanPurim,
    purimKatan,
    fast: fastEvent ? HE(fastEvent) : null,
    tishaBav: desc(/^Tish'a B'Av$/),
    roshHashana: tishrei && (day === 1 || day === 2),
    yomKippur,
    aseretYemeiTeshuva: tishrei && day <= 10,
    sukkot,
    hoshanaRabba: tishrei && day === 21,
    sheminiAtzeret,
    pesach,
    shavuot,
    omerDay: omer >= 1 && omer <= 49 ? omer : 0,
    ledavidSeason: month === months.ELUL || (tishrei && day <= 22),
    rainSeason: inRange([months.TISHREI, 22], [months.NISAN, 14]),
    talUmatar: inRange([months.CHESHVAN, 7], [months.NISAN, 14]),
    hallel,
    nationalHallel,
    tachanun,
    specialShabbat: specialShabbatEvent ? HE(specialShabbatEvent) : null,
    mevarchim,
    national,
    festival: yomTov || cholHamoed || chanukahDay > 0 || purim || shushanPurim,
    holidays,
    title: [...new Set(parts)].join(" · ") || "יום חול",
  };
}

/** Shabbat, or a day on which work is forbidden (Yom Tov, Yom Kippur), on Jerusalem's civil day. */
export function isHolyCivilDay(date: Date): boolean {
  const p = civilDayProfile(date);
  return p.shabbat || p.yomTov;
}

/**
 * What the season adds to the davening in Eretz Yisrael, in one line for the
 * board: לדוד ה' אורי (Elul to Shemini Atzeret), משיב הרוח / מוריד הטל, and
 * ותן טל ומטר / ותן ברכה.
 */
export function seasonalLine(p: DayProfile): string {
  return [
    p.ledavidSeason && "לדוד ה' אורי וישעי",
    p.rainSeason ? "משיב הרוח ומוריד הגשם" : "מוריד הטל",
    p.talUmatar ? "ותן טל ומטר לברכה" : "ותן ברכה",
  ]
    .filter(Boolean)
    .join(" · ");
}
