import { HDate, months } from "@hebcal/core";
import type { Minyan, MinyanCategory, Settings } from "./data";
import { calcZmanim, formatTime, type SolarEvent, type Zmanim } from "./zmanim";

export type DayType = "weekday" | "friday" | "shabbat";

/** מספר היום בשבוע לפי שעון ישראל (0 = ראשון) */
export function jerusalemWeekday(date: Date): number {
  const name = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Asia/Jerusalem",
  }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/**
 * The kind of day, for its minyanim. Shabbat is its own: it fell to "weekday",
 * so a synagogue with no Shabbat minyanim showed its weekday ones on the board
 * on Shabbat - שחרית א׳ 06:15 on Shabbat morning (אפי קפיטל, 1.11.2026).
 */
export function dayTypeFor(date: Date): DayType {
  const d = jerusalemWeekday(date);
  if (d === 5) return "friday";
  if (d === 6) return "shabbat";
  return "weekday";
}

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  weekday: "ימות החול",
  friday: "יום שישי",
  shabbat: "שבת",
};

export function zmanimFor(date: Date, settings: Settings | null | undefined): Zmanim {
  return calcZmanim(date, {
    latitude: settings?.latitude ?? 32.0853,
    longitude: settings?.longitude ?? 34.8338,
    candleOffsetMinutes: settings?.candle_offset_minutes ?? 40,
    tzeitOffsetMinutes: settings?.tzeit_offset_minutes ?? 20,
  });
}

export interface ResolvedMinyan {
  minyan: Minyan;
  time: string;
  minutes: number;
  source: string;
  /** Called off for this one day. The row stays, so the wall can say so. */
  cancelled?: boolean;
  /** The time came from a one-day exception, not from the timetable. */
  overridden?: boolean;
  /** A word from the gabbai about today only ("היום בעזרת הנשים"). */
  note?: string;
}

/**
 * A minyan that is different on one day, without changing the minyan.
 *
 * Optional everywhere, and absent by default: a caller that passes no
 * overrides gets exactly the timetable it got before this existed. That is
 * the whole design - the regular week stays the truth, and an exception is a
 * single row that expires by having a date on it.
 */
export interface MinyanOverride {
  minyan_id: string;
  /** yyyy-mm-dd, as the day is counted in Jerusalem. */
  on_date: string;
  /** "13:00" - or null when the override only cancels, or only says something. */
  at_time: string | null;
  cancelled: boolean;
  note: string;
}

/** The exceptions for one day, by minyan. */
export function overridesFor(
  overrides: MinyanOverride[] | null | undefined,
  date: Date,
): Map<string, MinyanOverride> {
  const key = jerusalemDateKey(date);
  const map = new Map<string, MinyanOverride>();
  for (const o of overrides ?? []) if (o.on_date === key) map.set(o.minyan_id, o);
  return map;
}

/** The date in Jerusalem as yyyy-mm-dd - the day the override is written for. */
export function jerusalemDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Held on this day (Israel): inside the minyan's season, when it has one (בין הזמנים...) - and סליחות only in their days. */
export function heldOn(m: { active_from?: string | null; active_until?: string | null; label?: string | null }, date: Date): boolean {
  const key = jerusalemDateKey(date);
  if (m.active_from && m.active_from > key) return false;
  if (m.active_until && m.active_until < key) return false;
  return !isSelichot(m.label) || selichotDay(key);
}

/** A minyan of סליחות, by its name. */
export const isSelichot = (label: string | null | undefined) => /סליחות/.test(label ?? "");

/**
 * Whether סליחות are said on this day (yyyy-mm-dd, Israel): from ראש חודש אלול
 * to ערב יום כיפור - never on Shabbat, nor on ראש השנה. A minyan of סליחות left
 * on all year showed on the board on an ordinary Shabbat in חשון. A synagogue
 * that begins later (as Ashkenazim do, before ראש השנה) sets its own season
 * within these days.
 */
export function selichotDay(key: string): boolean {
  const [y, mo, d] = key.split("-").map(Number);
  const civil = new Date(Date.UTC(y, mo - 1, d, 12));
  if (civil.getUTCDay() === 6) return false;
  const h = new HDate(new Date(y, mo - 1, d));
  if (h.getMonth() === months.ELUL) return true;
  return h.getMonth() === months.TISHREI && h.getDate() >= 3 && h.getDate() <= 9;
}

function minutesFromHHMM(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

function minutesInJerusalem(d: Date): number {
  return minutesFromHHMM(formatTime(d));
}

/**
 * Where a minyan falls in the day, for ordering and for "what is next".
 *
 * A day of prayer does not end at midnight: an arvit at 00:00 is the last
 * minyan of the evening, not the first of the morning. Counted from midnight
 * it sorted before shacharit - the wall at אהל אברהם listed "ערבית 00:00,
 * 18:54, 19:30..." - and at 23:40 it counted as already over. Anything before
 * 03:00 belongs to the end of the day it is listed in.
 */
export const PRAYER_DAY_STARTS = 3 * 60;
function onPrayerDay(minutes: number): number {
  return minutes < PRAYER_DAY_STARTS ? minutes + 24 * 60 : minutes;
}

/**
 * Where now falls in a day's minyanim: which one is "הבא" (-1: none) and which
 * are over. The one answer the website and the board both use. A minyan
 * called off today is never "הבא"; on a day that is not today ("כל השבוע")
 * nothing is next and nothing is over.
 */
export function minyanNow(
  rows: ResolvedMinyan[],
  now: Date,
  isToday = true,
): { next: number; past: (i: number) => boolean } {
  if (!isToday) return { next: -1, past: () => false };
  const nowMin = minutesInJerusalem(now);
  const next = rows.findIndex((r) => r.minutes >= nowMin && !r.cancelled);
  return { next, past: (i) => next === -1 || i < next };
}

export function resolveMinyan(
  minyan: Minyan,
  zmanim: Zmanim,
  override?: MinyanOverride | null,
): ResolvedMinyan | null {
  // An exception for today, laid over the regular answer rather than
  // replacing the row: the minyan is still the minyan, and tomorrow it is
  // back to normal without anybody having to remember anything.
  if (override) {
    const base = resolveMinyan(minyan, zmanim);
    if (override.at_time) {
      const hhmm = override.at_time.slice(0, 5);
      return {
        minyan,
        time: hhmm,
        minutes: onPrayerDay(minutesFromHHMM(hhmm)),
        source: override.cancelled ? "מבוטל היום" : "היום בלבד",
        cancelled: override.cancelled,
        overridden: true,
        note: override.note || undefined,
      };
    }
    // No time of its own: keep the timetable's, and say what is different.
    if (!base) return null;
    return {
      ...base,
      source: override.cancelled ? "מבוטל היום" : base.source,
      cancelled: override.cancelled,
      note: override.note || undefined,
    };
  }

  if (minyan.time_mode === "fixed") {
    if (!minyan.fixed_time) return null;
    const hhmm = minyan.fixed_time.slice(0, 5);
    return {
      minyan,
      time: hhmm,
      minutes: onPrayerDay(minutesFromHHMM(hhmm)),
      source: "שעה קבועה",
    };
  }
  const base = zmanim[(minyan.relative_to ?? "sunset") as SolarEvent];
  if (!base) return null;
  const d = new Date(base.getTime() + minyan.offset_minutes * 60000);
  // A row with a missing or damaged offset used to produce an invalid Date,
  // and formatting it threw - taking the whole board down, on a screen with
  // nobody to press reload. One bad row is simply not shown.
  if (!Number.isFinite(d.getTime())) return null;
  const off = minyan.offset_minutes;
  const relLabel = RELATIVE_LABELS[(minyan.relative_to ?? "sunset") as SolarEvent];
  const source =
    off === 0
      ? relLabel
      : off > 0
        ? `${off} דק׳ אחרי ${relLabel}`
        : `${Math.abs(off)} דק׳ לפני ${relLabel}`;
  return { minyan, time: formatTime(d), minutes: onPrayerDay(minutesInJerusalem(d)), source };
}

export const RELATIVE_LABELS: Record<SolarEvent, string> = {
  alot: "עלות השחר",
  misheyakir: "משיכיר",
  sunrise: "הנץ החמה",
  sof_zman_shma: "סוף זמן ק״ש",
  sof_zman_tefila: "סוף זמן תפילה",
  chatzot: "חצות",
  mincha_gedola: "מנחה גדולה",
  plag: "פלג המנחה",
  candle: "הדלקת נרות",
  sunset: "השקיעה",
  tzeit: "צאת הכוכבים",
};

/**
 * A tab's minyanim on a date, in the order of the day. The one place this is
 * worked out: the day tabs, "כל השבוע" and the board all ask it, so the phone
 * and the wall cannot list a different timetable. `overrides` are the one-day
 * exceptions of that date - pass them only for today.
 */
export function resolveCategoryDay(
  minyanim: Minyan[],
  category: Pick<MinyanCategory, "id" | "system_key">,
  date: Date,
  zmanim: Zmanim,
  overrides?: Map<string, MinyanOverride>,
): ResolvedMinyan[] {
  return minyanim
    .filter(
      (m) =>
        m.active &&
        heldOn(m, date) &&
        (m.category_id === category.id || (!m.category_id && m.day_type === category.system_key)),
    )
    .map((m) => resolveMinyan(m, zmanim, overrides?.get(m.id)))
    .filter((r): r is ResolvedMinyan => r !== null)
    .sort((a, b) => a.minutes - b.minutes);
}

export function resolveDay(
  minyanim: Minyan[],
  dayType: DayType,
  zmanim: Zmanim,
  overrides?: Map<string, MinyanOverride>,
  date: Date = new Date(),
): ResolvedMinyan[] {
  return minyanim
    .filter((m) => m.active && m.day_type === dayType && heldOn(m, date))
    .map((m) => resolveMinyan(m, zmanim, overrides?.get(m.id)))
    .filter((r): r is ResolvedMinyan => r !== null)
    .sort((a, b) => a.minutes - b.minutes);
}
