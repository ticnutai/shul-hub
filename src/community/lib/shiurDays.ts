import { DAYS_HE } from "./data";

/**
 * When a shiur is given: every day, every weekday (not on Shabbat), or one
 * day of the week. "בכל יום" put the daf yomi on the board on Shabbat at
 * אפי קפיטל, where it is not given then.
 */
export type ShiurSchedule = "daily" | "weekdays" | "weekly";

/** Given on this weekday (0 = Sunday, 6 = Shabbat). */
export function shiurOn(s: { schedule_type?: string | null; day_of_week?: number | null }, weekday: number): boolean {
  if (s.schedule_type === "daily") return true;
  if (s.schedule_type === "weekdays") return weekday !== 6;
  return s.day_of_week === weekday;
}

/** Its days in words: "בכל יום", "בימי חול", "יום שני". */
export function shiurDaysLabel(s: { schedule_type?: string | null; day_of_week?: number | null }): string {
  if (s.schedule_type === "daily") return "בכל יום";
  if (s.schedule_type === "weekdays") return "בימי חול";
  return `יום ${DAYS_HE[s.day_of_week ?? 0] ?? ""}`;
}
