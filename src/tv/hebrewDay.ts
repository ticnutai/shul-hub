import { createContext, useContext } from "react";
import { civilHDate } from "@/lib/jewishDay";
import { holyDayEnd } from "@community/lib/specialDays";
import { jerusalemWeekday } from "@community/lib/minyan-time";
import { weeklyParasha } from "./learning";

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/**
 * The day as a board says it, and when each part of it turns.
 *
 * - The date, the day's name (and the daf, the amud and the zmanim, which are
 *   asked by the civil day): at midnight. By the halacha the date turns at
 *   sunset, and the board did so for a day - but people reading the wall in
 *   the evening would be confused (אפי קפיטל, 1.11.2026).
 * - The parasha: once Shabbat is out, the coming week's.
 * - The additions to the prayers ("משיב הרוח"): from sunset, the coming
 *   day's - the evening's prayer already says them. `prayerDate` asks by it.
 *
 * `z` is the day's own zmanim (its sunset); without them, the civil day alone.
 */
export function hebrewDayAt(now: Date, z: { sunset?: Date | null; tzeit: Date | null } | null | undefined, endMinutes?: number) {
  const night = Boolean(z?.sunset && now.getTime() >= z.sunset.getTime());
  const wd = jerusalemWeekday(now);
  const shabbatOut = wd === 6 && night && z ? holyDayEnd(z, endMinutes) : null;
  const afterShabbat = Boolean(shabbatOut && now.getTime() >= shabbatOut.getTime());
  const parashaDay = afterShabbat ? new Date(now.getTime() + 86_400_000) : now;
  return {
    hebrew: civilHDate(now).renderGematriya(true),
    weekday: `יום ${DAYS[wd]}`,
    parasha: weeklyParasha(parashaDay),
    prayerDate: night ? new Date(now.getTime() + 86_400_000) : now,
    /** Changes when any of the above does: for what is worked out once a day. */
    key: `${now.toDateString()}|${night ? 1 : 0}|${afterShabbat ? 1 : 0}`,
  };
}

export type HebrewDay = ReturnType<typeof hebrewDayAt>;

/** The board's Hebrew day, worked out once where its zmanim are (TvBoard), for every part of it. */
export const HebrewDayContext = createContext<HebrewDay | null>(null);

/** The Hebrew day from the board; outside one, the civil day. */
export function useHebrewDay(now: Date): HebrewDay {
  return useContext(HebrewDayContext) ?? hebrewDayAt(now, null);
}
