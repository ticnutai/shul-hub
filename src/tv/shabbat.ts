import type { Settings } from "@community/lib/data";
import { jerusalemWeekday, zmanimFor } from "@community/lib/minyan-time";

/**
 * Shabbat on the wall: from candle lighting on Friday until the end of
 * Shabbat, the board stops rotating and shows one Shabbat screen.
 *
 * Times come from the synagogue's own settings (location, candle-lighting
 * offset), the same ones the website uses. The end of Shabbat is its own
 * setting, in minutes after sunset: the daily "צאת הכוכבים" offset (often 20)
 * is too early for motzei Shabbat, which most calendars put at ~40 minutes,
 * and some keep Rabbeinu Tam (72).
 */

export interface ShabbatTimes {
  /** Candle lighting on Friday. */
  candle: Date | null;
  /** Sunset on Friday. */
  sunset: Date | null;
  /** Latest Shema on Shabbat morning. */
  shma: Date | null;
  /** End of Shabbat (Saturday sunset + the configured minutes). */
  end: Date | null;
}

const DAY_MS = 86_400_000;

/** Noon of the calendar day `offset` days from `now` - a safe anchor for zmanim. */
function dayAt(now: Date, offsetDays: number): Date {
  const d = new Date(now.getTime() + offsetDays * DAY_MS);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
}

/**
 * The Shabbat times if `now` is inside Shabbat (candle lighting .. end),
 * otherwise null.
 */
export function shabbatNow(
  now: Date,
  settings: Settings | null | undefined,
  endMinutesAfterSunset: number,
): ShabbatTimes | null {
  const weekday = jerusalemWeekday(now);
  if (weekday !== 5 && weekday !== 6) return null;

  const friday = zmanimFor(dayAt(now, weekday === 5 ? 0 : -1), settings);
  const saturday = zmanimFor(dayAt(now, weekday === 5 ? 1 : 0), settings);
  const end = saturday.sunset
    ? new Date(saturday.sunset.getTime() + endMinutesAfterSunset * 60_000)
    : null;
  const times: ShabbatTimes = {
    candle: friday.candle,
    sunset: friday.sunset,
    shma: saturday.sof_zman_shma,
    end,
  };

  if (weekday === 5) return friday.candle && now >= friday.candle ? times : null;
  return end && now < end ? times : null;
}

/** The next candle lighting from `now` (for the editor's "show the Shabbat screen"). */
export function nextCandleLighting(now: Date, settings: Settings | null | undefined): Date | null {
  const weekday = jerusalemWeekday(now);
  const daysToFriday = (5 - weekday + 7) % 7;
  return zmanimFor(dayAt(now, daysToFriday), settings).candle;
}

/** Built-in Shabbat pictures: drawn, so they are sharp on any screen and cost no download. */
export const SHABBAT_ART = [
  { id: "classic", label: "חלות ונרות", description: "חלות קלועות תחת מפת קטיפה, נרות בפמוטי כסף" },
  { id: "kiddush", label: "כוס קידוש", description: "גביע כסף מלא יין, נרות וחלה" },
  {
    id: "jerusalem",
    label: "ירושלים בערב שבת",
    description: "חומות העיר העתיקה בשקיעה ונרות על אדן אבן",
  },
  {
    id: "candles",
    label: "נרות על מפה לבנה",
    description: "נרות דולקים על מפת שבת לבנה, 'לכבוד שבת קודש'",
  },
] as const;
export type ShabbatArtId = (typeof SHABBAT_ART)[number]["id"];
