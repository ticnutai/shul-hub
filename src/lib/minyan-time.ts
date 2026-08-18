import type { Minyan, Settings } from "./data";
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

export function dayTypeFor(date: Date): DayType {
  const d = jerusalemWeekday(date);
  if (d === 6) return "shabbat";
  if (d === 5) return "friday";
  return "weekday";
}

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  weekday: "ימות החול",
  friday: "ערב שבת",
  shabbat: "שבת קודש",
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
}

function minutesFromHHMM(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

function minutesInJerusalem(d: Date): number {
  return minutesFromHHMM(formatTime(d));
}

export function resolveMinyan(minyan: Minyan, zmanim: Zmanim): ResolvedMinyan | null {
  if (minyan.time_mode === "fixed") {
    if (!minyan.fixed_time) return null;
    const hhmm = minyan.fixed_time.slice(0, 5);
    return {
      minyan,
      time: hhmm,
      minutes: minutesFromHHMM(hhmm),
      source: "שעה קבועה",
    };
  }
  const base = zmanim[(minyan.relative_to ?? "sunset") as SolarEvent];
  if (!base) return null;
  const d = new Date(base.getTime() + minyan.offset_minutes * 60000);
  const off = minyan.offset_minutes;
  const relLabel = RELATIVE_LABELS[(minyan.relative_to ?? "sunset") as SolarEvent];
  const source =
    off === 0
      ? relLabel
      : off > 0
        ? `${off} דק׳ אחרי ${relLabel}`
        : `${Math.abs(off)} דק׳ לפני ${relLabel}`;
  return { minyan, time: formatTime(d), minutes: minutesInJerusalem(d), source };
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

export function resolveDay(minyanim: Minyan[], dayType: DayType, zmanim: Zmanim): ResolvedMinyan[] {
  return minyanim
    .filter((m) => m.active && m.day_type === dayType)
    .map((m) => resolveMinyan(m, zmanim))
    .filter((r): r is ResolvedMinyan => r !== null)
    .sort((a, b) => a.minutes - b.minutes);
}
