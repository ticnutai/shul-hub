/**
 * The reminder's simulation in the editor: a time of the day, and the
 * preview's clock run up to it - played, paused, faster, or jumped to a step.
 *
 * It moves the same moment as "תצוגה בתאריך" and the Shabbat preview (the
 * editor's one simulated clock), so whichever is used last wins: those stop
 * it (halt), and "סיום" goes back to the real time.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Settings } from "@community/lib/data";
import { jerusalemDateKey, jerusalemWeekday, zmanimFor } from "@community/lib/minyan-time";
import type { AlertEvent, TvConfig } from "@/tv/config";
import { alertTimeline, simulationDay, simulationTimes, type SimSpeed } from "@/tv/alertDemo";

/** How often the running clock moves on the preview. */
const TICK_MS = 200;
/** How long after the time a run goes on, to show the reminder leaving. */
const AFTER_MS = 60_000;

export interface AlertSimulation {
  /** The times it can run up to, with their hour on the day it uses. */
  times: { event: AlertEvent; at: Date }[];
  /** Today, or "ביום ראשון" when it is Friday or Saturday. */
  dayNote: string;
  event: AlertEvent | null;
  at: Date | null;
  /** The preview's moment while it runs; null when it does not. */
  moment: Date | null;
  playing: boolean;
  speed: SimSpeed;
  setEvent: (e: AlertEvent) => void;
  setSpeed: (s: SimSpeed) => void;
  play: () => void;
  pause: () => void;
  /** Back to the real time. */
  stop: () => void;
  /** To a moment a few seconds into a step, given in minutes before the time. */
  jump: (minutesBefore: number) => void;
  /** Stopped by another control that has moved the preview's clock itself. */
  halt: () => void;
}

export function useAlertSimulation(
  alerts: TvConfig["alerts"],
  settings: Settings | null | undefined,
  /** Moves the preview's clock (null - the real time). */
  show: (at: Date | null) => void,
): AlertSimulation {
  const today = jerusalemDateKey(new Date());
  const weekday = jerusalemWeekday(new Date());
  const times = useMemo(
    () => simulationTimes(alerts, zmanimFor(simulationDay(weekday), settings)),
    // A new day, other times or another place: other hours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alerts.events, settings, today],
  );
  const [chosen, setChosen] = useState<AlertEvent | null>(null);
  const current = times.find((t) => t.event === chosen) ?? times[0] ?? null;
  const [moment, setMoment] = useState<Date | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<SimSpeed>(1);
  const showRef = useRef(show);
  showRef.current = show;

  const move = (at: Date | null) => {
    setMoment(at);
    showRef.current(at);
  };

  // The clock runs: on to a minute after the time, and there it waits.
  useEffect(() => {
    if (!playing || !moment || !current) return;
    const id = window.setTimeout(() => {
      const end = current.at.getTime() + AFTER_MS;
      const next = Math.min(moment.getTime() + TICK_MS * speed, end);
      move(new Date(next));
      if (next >= end) setPlaying(false);
    }, TICK_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, moment, speed, current]);

  const startOf = () => (current ? new Date(current.at.getTime() - alertTimeline(alerts, current.event).from * 60_000) : null);
  const halt = () => {
    setPlaying(false);
    setMoment(null);
  };
  return {
    times,
    dayNote: weekday >= 5 ? "ביום ראשון" : "היום",
    event: current?.event ?? null,
    at: current?.at ?? null,
    moment,
    playing,
    speed,
    setEvent: (e) => {
      if (e === current?.event) return;
      setChosen(e);
      // Another time: the run starts over, from the real time.
      if (moment) {
        halt();
        showRef.current(null);
      }
    },
    setSpeed,
    play: () => {
      if (!current) return;
      const over = !moment || moment.getTime() >= current.at.getTime() + AFTER_MS;
      if (over) move(startOf());
      setPlaying(true);
    },
    pause: () => setPlaying(false),
    stop: () => {
      halt();
      showRef.current(null);
    },
    jump: (minutesBefore) => {
      if (!current) return;
      // A few seconds into the step, so it is on; the time itself a few seconds after it.
      move(new Date(current.at.getTime() - minutesBefore * 60_000 + (minutesBefore ? 3_000 : 2_000)));
    },
    halt,
  };
}
