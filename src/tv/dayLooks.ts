import type { Settings } from "@community/lib/data";
import { jerusalemWeekday } from "@community/lib/minyan-time";
import { civilDayProfile } from "@/lib/jewishDay";
import type { DayKind, TvConfig } from "./config";
import { shabbatNow } from "./shabbat";

/**
 * A different look for different days, switched by the board itself.
 *
 * The admin chooses, per kind of day, a layout, a painted board and a theme
 * (each one optional: what is not chosen stays as on every other day). The
 * board works out what kind of day it is and wears that look - the curtain
 * for Shabbat, the stone tablets for Sukkot - without anyone touching it.
 *
 * Kinds, highest first when two meet (Shabbat Chol HaMoed is Shabbat):
 *   shabbat      candle lighting on Friday until Shabbat is out - the same
 *                window as the Shabbat screen (shabbat.ts)
 *   festival     Yom Tov, Chol HaMoed, Chanukah, Purim and Shushan Purim
 *   roshChodesh  Rosh Chodesh
 *   friday       the rest of Friday, before candle lighting
 * The calendar days are Jerusalem's, midnight to midnight: a board changes
 * its dress in the night, not at sunset in the middle of ma'ariv.
 */

export const DAY_KIND_LABELS: Record<DayKind, string> = {
  shabbat: "שבת (מהדלקת נרות עד צאת השבת)",
  festival: "חגים, חול המועד, חנוכה ופורים",
  roshChodesh: "ראש חודש",
  friday: "יום שישי (עד הדלקת נרות)",
};

/** What kind of day it is on the board, or null for an ordinary weekday. */
export function dayKindAt(now: Date, settings: Settings | null | undefined, shabbatEndMinutes: number): DayKind | null {
  if (shabbatNow(now, settings, shabbatEndMinutes)) return "shabbat";
  const day = civilDayProfile(now);
  if (day.festival) return "festival";
  if (day.roshChodesh) return "roshChodesh";
  if (jerusalemWeekday(now) === 5) return "friday";
  return null;
}

/**
 * The board as it should look right now: the day's look over the ordinary
 * one. A look that names a painted board or theme that no longer exists
 * keeps the ordinary one for that part (the config's own validation already
 * dropped such names when it was saved; this only guards a stale screen).
 */
export function applyDayLook(config: TvConfig, now: Date, settings: Settings | null | undefined): TvConfig {
  const kind = dayKindAt(now, settings, config.shabbat.endMinutesAfterSunset);
  const look = kind ? config.dayLooks[kind] : undefined;
  if (!look) return config;
  return {
    ...config,
    ...(look.screenLayout ? { screenLayout: look.screenLayout } : {}),
    ...(look.illustration ? { illustration: look.illustration } : {}),
    ...(look.theme ? { theme: look.theme, themeOverrides: {} } : {}),
  };
}
