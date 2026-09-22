/**
 * The board's own safety cut-out.
 *
 * A wall display has nobody watching it and nobody to press reload. A bug
 * that spins - a measurement that triggers the observer that called it, an
 * animation that never settles - does not show up as a crash: the board
 * keeps looking correct while the box heats up and the picture stutters.
 * That happened here once already, with the notice-fitting loop.
 *
 * So two things watch over the board:
 *
 *   1. A breaker around any mechanism that might run away. It counts how
 *      often the mechanism runs inside a short window, and if that passes
 *      what the mechanism could honestly need, it trips: the mechanism is
 *      switched off for good, once, and reported. The board loses one small
 *      nicety and keeps everything else.
 *
 *   2. A watch on the main thread itself. The browser reports every task
 *      that blocks it for over 50 ms; when those add up to most of a ten
 *      second window, twice in a row, something is spinning that no breaker
 *      caught. That is reported, and - at most once an hour - the board
 *      reloads itself, which is what a person would do.
 *
 * Both report through the device link, so a screen that protected itself
 * says so in the admin's screen list instead of failing silently.
 */

export type WatchdogReport = (
  level: "info" | "warn" | "error",
  kind: string,
  message: string,
  details?: Record<string, unknown>,
) => void;

/* ------------------------------------------------------------- report -- */

let sink: WatchdogReport | null = null;

/** The board's link to the admin, once it exists. Set once, by TvApp. */
export function setWatchdogReport(report: WatchdogReport | null): void {
  sink = report;
}

/**
 * Says what the watchdog did. It reaches the admin's screen list when the
 * board is linked, and the console either way - a screen that switched
 * something off must never do it quietly.
 */
export function reportWatchdog(
  level: "info" | "warn" | "error",
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    sink?.(level, "watchdog", message, details);
  } catch {
    /* a broken link must not break the board it is watching */
  }
  console.warn(`[watchdog] ${message}`, details ?? "");
}

/* ------------------------------------------------------------ breaker -- */

export interface Breaker {
  /** Records a run and says whether it may go ahead. False once tripped. */
  allow: () => boolean;
  readonly tripped: boolean;
}

export function createBreaker({
  name,
  limit,
  windowMs,
  onTrip,
  now = () => Date.now(),
}: {
  /** What this protects, for the report. */
  name: string;
  /** Runs allowed inside the window before it trips. */
  limit: number;
  windowMs: number;
  /** Defaults to reporting the trip; pass your own to add to it. */
  onTrip?: (info: { name: string; runs: number; windowMs: number }) => void;
  now?: () => number;
}): Breaker {
  const runs: number[] = [];
  let tripped = false;

  return {
    get tripped() {
      return tripped;
    },
    allow() {
      if (tripped) return false;
      const t = now();
      runs.push(t);
      while (runs.length && runs[0] <= t - windowMs) runs.shift();
      if (runs.length > limit) {
        tripped = true;
        const info = { name, runs: runs.length, windowMs };
        reportWatchdog("error", `המנגנון "${name}" נכבה: ${info.runs} ריצות ב-${Math.round(windowMs / 1000)} שניות`, info);
        onTrip?.(info);
        return false;
      }
      return true;
    },
  };
}

/* ------------------------------------------------------- the main thread -- */

/** How much of a window the main thread spent blocked, 0..1. */
export function blockedRatio(blockedMs: number, windowMs: number): number {
  if (windowMs <= 0) return 0;
  return Math.min(1, Math.max(0, blockedMs / windowMs));
}

export interface RunawayWatch {
  /** Feeds one window's blocked time in. Returns true when it is a runaway. */
  sample: (blockedMs: number, windowMs: number) => boolean;
}

/**
 * Two windows in a row spent mostly blocked is a spin, not a busy moment:
 * a slide change, a font load or a screenshot each take one window at most.
 */
export function createRunawayWatch(threshold = 0.7, needed = 2): RunawayWatch {
  let inARow = 0;
  return {
    sample(blockedMs, windowMs) {
      inARow = blockedRatio(blockedMs, windowMs) >= threshold ? inARow + 1 : 0;
      if (inARow >= needed) {
        inARow = 0;
        return true;
      }
      return false;
    },
  };
}

/* --------------------------------------------------------- the watcher -- */

const RELOAD_KEY = "tv-watchdog-reload";
const RELOAD_COOLDOWN_MS = 60 * 60_000;
const WINDOW_MS = 10_000;

/**
 * Starts watching the main thread. Returns a function that stops it.
 * Does nothing in a browser without long-task reporting (then the breakers
 * are the whole protection, which is the important half).
 */
export function watchMainThread({
  reload = () => window.location.reload(),
  windowMs = WINDOW_MS,
}: {
  reload?: () => void;
  windowMs?: number;
} = {}): () => void {
  if (typeof PerformanceObserver === "undefined") return () => {};
  if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) return () => {};

  const watch = createRunawayWatch();
  let blocked = 0;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) blocked += entry.duration;
  });
  try {
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    return () => {};
  }

  const timer = window.setInterval(() => {
    const spent = blocked;
    blocked = 0;
    if (!watch.sample(spent, windowMs)) return;

    const percent = Math.round(blockedRatio(spent, windowMs) * 100);
    reportWatchdog("error", `הלוח נתקע: ${percent}% מהזמן בעיבוד רצוף`, {
      blockedMs: Math.round(spent),
      windowMs,
    });

    // A reload is the last resort, and at most once an hour: a board that
    // reloads in a circle is worse than a board that is merely slow.
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    } catch {
      /* private mode; treat as never */
    }
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
    try {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      /* not fatal */
    }
    reportWatchdog("warn", "הלוח נטען מחדש כדי להשתחרר");
    reload();
  }, windowMs);

  return () => {
    observer.disconnect();
    window.clearInterval(timer);
  };
}
