/**
 * חישוב זמני היום ההלכתיים (NOAA solar algorithm).
 * כל הזמנים מוחזרים כאובייקטי Date באזור הזמן של הדפדפן/השרת (UTC-based Date).
 */

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

const DEG = Math.PI / 180;

function toJulian(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function fromJulian(j: number): Date {
  return new Date((j - 2440587.5) * 86400000);
}

/** זמן שמש עבור זווית גובה נתונה. angle במעלות מתחת לאופק (חיובי = מתחת). */
function solarTime(
  date: Date,
  lat: number,
  lng: number,
  angle: number,
  rising: boolean,
): Date | null {
  const jDate = Math.floor(toJulian(date) - 0.5) + 0.5;
  const n = Math.round(jDate - 2451545.0 + 0.0008 - -lng / 360);
  const jStar = 2451545.0 + 0.0009 + -lng / 360 + n;
  const M = (357.5291 + 0.98560028 * (jStar - 2451545)) % 360;
  const C =
    1.9148 * Math.sin(M * DEG) +
    0.02 * Math.sin(2 * M * DEG) +
    0.0003 * Math.sin(3 * M * DEG);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit =
    jStar + 0.0053 * Math.sin(M * DEG) - 0.0069 * Math.sin(2 * lambda * DEG);
  const delta = Math.asin(Math.sin(lambda * DEG) * Math.sin(23.44 * DEG));
  const cosOmega =
    (Math.sin(-angle * DEG) - Math.sin(lat * DEG) * Math.sin(delta)) /
    (Math.cos(lat * DEG) * Math.cos(delta));
  if (cosOmega > 1 || cosOmega < -1) return null;
  const omega = Math.acos(cosOmega) / DEG;
  const j = rising ? jTransit - omega / 360 : jTransit + omega / 360;
  return fromJulian(j);
}

function solarNoon(date: Date, lng: number): Date {
  const jDate = Math.floor(toJulian(date) - 0.5) + 0.5;
  const n = Math.round(jDate - 2451545.0 + 0.0008 - -lng / 360);
  const jStar = 2451545.0 + 0.0009 + -lng / 360 + n;
  const M = (357.5291 + 0.98560028 * (jStar - 2451545)) % 360;
  const C =
    1.9148 * Math.sin(M * DEG) +
    0.02 * Math.sin(2 * M * DEG) +
    0.0003 * Math.sin(3 * M * DEG);
  const lambda = (M + C + 180 + 102.9372) % 360;
  return fromJulian(
    jStar + 0.0053 * Math.sin(M * DEG) - 0.0069 * Math.sin(2 * lambda * DEG),
  );
}

export interface ZmanimOptions {
  latitude: number;
  longitude: number;
  /** דקות הדלקת נרות לפני השקיעה */
  candleOffsetMinutes: number;
  /** דקות צאת הכוכבים אחרי השקיעה */
  tzeitOffsetMinutes: number;
}

export type Zmanim = Record<SolarEvent, Date | null>;

const addMinutes = (d: Date | null, m: number): Date | null =>
  d ? new Date(d.getTime() + m * 60000) : null;

export function calcZmanim(date: Date, opts: ZmanimOptions): Zmanim {
  const { latitude: lat, longitude: lng } = opts;
  const sunrise = solarTime(date, lat, lng, 0.833, true);
  const sunset = solarTime(date, lat, lng, 0.833, false);
  const alot = solarTime(date, lat, lng, 16.1, true);
  const misheyakir = solarTime(date, lat, lng, 11.5, true);
  const chatzot = solarNoon(date, lng);

  let sofShma: Date | null = null;
  let sofTefila: Date | null = null;
  let minchaGedola: Date | null = null;
  let plag: Date | null = null;

  if (sunrise && sunset) {
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
