import { createContext, useContext } from "react";
import { HDate } from "@hebcal/core";
import { holyDayEnd } from "@community/lib/specialDays";
import { jerusalemWeekday } from "@community/lib/minyan-time";
import { weeklyParasha } from "./learning";

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/**
 * The day as a board says it: the Hebrew date turns at sunset, not at
 * midnight. At 21:21 on מוצאי שבת a board still said "כ׳ חשון · יום שבת" and
 * "פרשת וירא", the day and the week that had gone out (אפי קפיטל, 31.10.2026).
 *
 * - The date: from sunset, tomorrow's.
 * - The day's name: by day "יום שני"; from sunset the night of the next -
 *   "אור ליום שלישי", Friday "ליל שבת", and on Saturday, once Shabbat is
 *   out, "מוצאי שבת" (until then "יום שבת").
 * - The parasha: once Shabbat is out, the coming week's.
 * - The day's learning and prayers (the daf, the amud, "משיב הרוח"): from
 *   sunset, tomorrow's - `date` is a moment of the Hebrew day, to ask them by.
 *
 * `z` is the day's own zmanim (its sunset); without them, the civil day as before.
 */
export function hebrewDayAt(now: Date, z: { sunset?: Date | null; tzeit: Date | null } | null | undefined, endMinutes?: number) {
  const night = Boolean(z?.sunset && now.getTime() >= z.sunset.getTime());
  const wd = jerusalemWeekday(now);
  const shabbatOut = wd === 6 && night && z ? holyDayEnd(z, endMinutes) : null;
  const afterShabbat = Boolean(shabbatOut && now.getTime() >= shabbatOut.getTime());
  const day = new HDate(now);
  const weekday = !night
    ? `יום ${DAYS[wd]}`
    : wd === 5
      ? "ליל שבת"
      : wd === 6
        ? afterShabbat ? "מוצאי שבת" : "יום שבת"
        : `אור ליום ${DAYS[(wd + 1) % 7]}`;
  const parashaDay = afterShabbat ? new Date(now.getTime() + 86_400_000) : now;
  return {
    hebrew: (night ? day.next() : day).renderGematriya(true),
    weekday,
    parasha: weeklyParasha(parashaDay),
    date: night ? new Date(now.getTime() + 86_400_000) : now,
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
