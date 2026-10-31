import { useMemo } from "react";
import type { Settings } from "@community/lib/data";
import { zmanimFor } from "@community/lib/minyan-time";
import { nextCandleLighting } from "./shabbat";
import { specialZmanim } from "@community/lib/specialDays";
import type { Zmanim } from "@community/lib/zmanim";
import { SHOWN_ZMANIM } from "./boardEdit";
import { hebrewDayAt } from "./hebrewDay";

export const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/**
 * What a board that draws its own header says about the day: the weekday,
 * the Hebrew date, the parasha, and when Shabbat comes in and goes out.
 * Worked out once a day, not once a minute - it is the date that moves it.
 * Shared by the boards that have no TvHeader (the painted and the medallion).
 */
export function useBoardDay(now: Date, settings: Settings | null, shabbatEndMinutes: number) {
  const dayKey = now.toDateString();
  // The Hebrew day turns at sunset (hebrewDay.ts): its date, its name and the parasha, checked each minute.
  const minuteKey = Math.floor(now.getTime() / 60_000);
  const hebrewDay = useMemo(
    () => hebrewDayAt(now, zmanimFor(new Date(dayKey), settings), shabbatEndMinutes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minuteKey, dayKey, settings, shabbatEndMinutes],
  );
  const day = useMemo(() => {
    const date = new Date(dayKey);
    const candle = nextCandleLighting(date, settings);
    const saturday = candle ? zmanimFor(new Date(candle.getTime() + 86_400_000), settings) : null;
    const out = saturday?.sunset ? new Date(saturday.sunset.getTime() + shabbatEndMinutes * 60_000) : null;
    return {
      candle,
      out,
    };
  }, [dayKey, settings, shabbatEndMinutes]);
  return { ...day, hebrew: hebrewDay.hebrew, parasha: hebrewDay.parasha, weekday: hebrewDay.weekday };
}

/** What a full frame of zmanim gives up first, so dawn, sunrise and nightfall always stay. */
const ZMAN_DROP_ORDER = ["misheyakir", "mincha_gedola", "plag", "sof_zman_tefila", "candle", "chatzot"];

/**
 * The zmanim a frame of `max` lines shows: the day's own times first (a
 * fast's start and end, צאת החג), then the ordinary ones the admin has not
 * hidden, giving up the least needed first.
 */
export function frameZmanim(
  now: Date,
  zmanim: Zmanim,
  holyEndMinutes: number,
  hidden: (key: string) => boolean,
  max: number,
): { special: ReturnType<typeof specialZmanim>; shown: (typeof SHOWN_ZMANIM)[number][] } {
  const special = specialZmanim(now, zmanim, holyEndMinutes).slice(0, max);
  const room = max - special.length;
  let shown = SHOWN_ZMANIM.filter((e) => !hidden(`zman.${e}`));
  for (const drop of ZMAN_DROP_ORDER) {
    if (shown.length <= room) break;
    shown = shown.filter((e) => e !== drop);
  }
  return { special, shown: shown.slice(0, room) };
}
