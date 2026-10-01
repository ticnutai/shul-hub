import { useEffect, useMemo, useState } from "react";
import { prayerDaysOf, type BoardPrayerDay, type BoardSlide } from "./useBoardData";

/**
 * Which of `count` items a frame shows now, turning every `seconds`. With one
 * item there is no timer at all: a board at rest stays at rest (the box pays
 * for every tick).
 */
export function useDayCycle(count: number, seconds: number): number {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    if (count <= 1) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), Math.max(5, seconds) * 1000);
    return () => window.clearInterval(timer);
  }, [count, seconds]);
  return count > 0 ? index % count : 0;
}

const NO_DAY: BoardPrayerDay = { key: "today", title: "", isToday: true, rows: [] };

/**
 * The day a one-list prayer frame shows (the medallion, the painted boards):
 * today, or - when the board shows the week (tv_config.prayerDays) - today
 * and then each following day in turn, for as long as the prayer slide's
 * seconds.
 */
export function useShownPrayerDay(slides: BoardSlide[]): BoardPrayerDay {
  const days = useMemo(() => prayerDaysOf(slides), [slides]);
  const seconds = slides.find((s) => s.kind === "prayer")?.seconds ?? 20;
  return days[useDayCycle(days.length, seconds)] ?? NO_DAY;
}
