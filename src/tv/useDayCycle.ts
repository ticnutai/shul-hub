import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { prayerDaysOf, type BoardPrayerDay, type BoardSlide } from "./useBoardData";

/**
 * The board drawn in the editor's preview, not on a screen. There the days of
 * the week can be picked by hand, and choosing the week shows the next day at
 * once - the gabbai sees his change now, not a turn later. A screen, and the
 * "מסכים מחוברים" tab that shows what a screen shows, keep turning on their own.
 */
export const BoardPreviewContext = createContext(false);

/**
 * Which of `count` items a frame shows now, turning every `seconds`. With one
 * item there is no timer at all: a board at rest stays at rest (the box pays
 * for every tick). `pick` shows one at once and starts its full turn from there.
 */
export function useDayCycle(count: number, seconds: number, startAt = 0): [number, (i: number) => void] {
  const [index, setIndex] = useState(startAt);
  const [restart, setRestart] = useState(0);
  useEffect(() => {
    if (count <= 1) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), Math.max(5, seconds) * 1000);
    return () => window.clearInterval(timer);
  }, [count, seconds, restart]);
  const pick = useCallback((i: number) => {
    setIndex(i);
    setRestart((r) => r + 1);
  }, []);
  return [count > 0 ? index % count : 0, pick];
}

const NO_DAY: BoardPrayerDay = { key: "today", title: "", isToday: true, rows: [] };

export interface ShownPrayerDay {
  day: BoardPrayerDay;
  days: BoardPrayerDay[];
  index: number;
  /** In the editor's preview only: show this day now. */
  pick?: (i: number) => void;
}

/**
 * The day a one-list prayer frame shows (the medallion, the painted boards):
 * today, or - when the board shows the week (tv_config.prayerDays) - today
 * and then each following day in turn, for as long as the prayer slide's
 * seconds.
 */
export function useShownPrayerDay(slides: BoardSlide[]): ShownPrayerDay {
  const preview = useContext(BoardPreviewContext);
  const days = useMemo(() => prayerDaysOf(slides), [slides]);
  const seconds = slides.find((s) => s.kind === "prayer")?.seconds ?? 20;
  const [index, pick] = useDayCycle(days.length, seconds);

  // In the preview, the week just switched on (one day became several): show
  // the next day at once, so the change is seen. Not on first drawing, and
  // never on a screen.
  const before = useRef(days.length);
  useEffect(() => {
    if (preview && before.current === 1 && days.length > 1) pick(1);
    else if (days.length <= 1 && index !== 0) pick(0);
    before.current = days.length;
  }, [preview, days.length, index, pick]);

  return { day: days[index] ?? NO_DAY, days, index, pick: preview ? pick : undefined };
}
