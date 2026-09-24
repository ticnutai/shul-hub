/**
 * חישוב זמני היום ההלכתיים.
 *
 * The astronomy is @hebcal/core's Zmanim, which implements the NOAA solar
 * algorithm and is the same engine behind hebcal.com. Everything else here -
 * the proportional hours, and the two offsets that are customs rather than
 * calculations - is derived from its sunrise and sunset.
 *
 * It did not used to be. The header of this file claimed NOAA while the code
 * below it was the simplified sunrise equation, which is a different and much
 * rougher thing. Measured against the reference across 2026 in Bnei Brak, it
 * put every zman an average of 1.31 minutes late and as much as 2.39 - sunset
 * on 211 days of the year was wrong by more than a minute, and wrong in the
 * lenient direction, which is the wrong way for a board in a shul to be wrong.
 * A gabbai noticed, by comparing the board against a search engine.
 *
 * Sea level, deliberately: Zmanim is constructed with useElevation false, so
 * sunset is computed for the town's coordinates at the horizon. That is what
 * the luachot in Israel publish, and a board that quietly disagreed with the
 * luach hanging beside it would be a problem and not a feature.
 *
 * כל הזמנים מוחזרים כאובייקטי Date (UTC-based Date).
 */
import { GeoLocation, Zmanim as HebcalZmanim } from "@hebcal/core";

export type SolarEvent =
  | "alot"
  | "misheyakir"
  | "sunrise"
  | "sof_zman_shma"
  | "sof_zman_tefila"
  | "chatzot"
  | "mincha_gedola"
  | "plag"
  | "candle"
  | "sunset"
  | "tzeit";

export interface ZmanimOptions {
  latitude: number;
  longitude: number;
  /** דקות הדלקת נרות לפני השקיעה */
  candleOffsetMinutes: number;
  /** דקות צאת הכוכבים אחרי השקיעה */
  tzeitOffsetMinutes: number;
}

export type Zmanim = Record<SolarEvent, Date | null>;
/** The same type (kept for the signature below; hebcal's class is imported as HebcalZmanim). */
type Zmanim2 = Zmanim;

const addMinutes = (d: Date | null, m: number): Date | null =>
  d ? new Date(d.getTime() + m * 60000) : null;

export function calcZmanim(date: Date, opts: ZmanimOptions): Zmanim2 {
  const { latitude: lat, longitude: lng } = opts;

  // The name is only ever shown back to us in errors; the timezone is what
  // Zmanim uses to decide which civil day this is.
  const geo = new GeoLocation("", lat, lng, 0, "Asia/Jerusalem");
  const z = new HebcalZmanim(geo, date, false);

  const ok = (d: Date | undefined | null): Date | null =>
    d instanceof Date && Number.isFinite(d.getTime()) ? d : null;

  const sunrise = ok(z.sunrise());
  const sunset = ok(z.sunset());
  const chatzot = ok(z.chatzot());
  const alot = ok(z.alotHaShachar());
  const misheyakir = ok(z.misheyakir());

  let sofShma: Date | null = null;
  let sofTefila: Date | null = null;
  let minchaGedola: Date | null = null;
  let plag: Date | null = null;

  if (sunrise && sunset) {
    // The GRA proportional hour: the day from sunrise to sunset in twelve.
    const shaa = (sunset.getTime() - sunrise.getTime()) / 12;
    sofShma = new Date(sunrise.getTime() + shaa * 3);
    sofTefila = new Date(sunrise.getTime() + shaa * 4);
    minchaGedola = new Date(sunrise.getTime() + shaa * 6.5);
    plag = new Date(sunset.getTime() - shaa * 1.25);
  }

  return {
    alot,
    misheyakir,
    sunrise,
    sof_zman_shma: sofShma,
    sof_zman_tefila: sofTefila,
    chatzot,
    mincha_gedola: minchaGedola,
    plag,
    // Both of these are minhag, not astronomy: how long before sunset this
    // town lights, and how long after it this shul counts the stars.
    candle: addMinutes(sunset, -opts.candleOffsetMinutes),
    sunset,
    tzeit: addMinutes(sunset, opts.tzeitOffsetMinutes),
  };
}

export const ZMAN_LABELS: Record<SolarEvent, string> = {
  alot: "עלות השחר",
  misheyakir: "משיכיר",
  sunrise: "נץ החמה",
  sof_zman_shma: "סוף זמן ק״ש",
  sof_zman_tefila: "סוף זמן תפילה",
  chatzot: "חצות היום",
  mincha_gedola: "מנחה גדולה",
  plag: "פלג המנחה",
  candle: "הדלקת נרות",
  sunset: "שקיעה",
  tzeit: "צאת הכוכבים",
};

/** רשימת הזמנים שניתן להיצמד אליהם בהגדרת מניין */
export const RELATIVE_OPTIONS: SolarEvent[] = [
  "alot",
  "misheyakir",
  "sunrise",
  "chatzot",
  "mincha_gedola",
  "plag",
  "candle",
  "sunset",
  "tzeit",
];

export function formatTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

/** מעגל את הזמן לדקה שלמה כלפי מטה */
export function roundToMinute(d: Date | null): Date | null {
  if (!d) return null;
  const r = new Date(d);
  r.setSeconds(0, 0);
  return r;
}
