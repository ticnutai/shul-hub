/**
 * Whether the board can believe its own clock.
 *
 * Everything on a synagogue board is a time, and all of it comes from the
 * box's clock. These boxes keep time over a power cut with a capacitor and
 * not much else, and they correct themselves from the network - so the one
 * moment the clock is least trustworthy is a power cut that takes the
 * router down with it, which is the same moment nobody is there to notice.
 *
 * A wrong clock does not look wrong. The board goes on showing times, in
 * the right font, neatly laid out, and they are the times of some other
 * day. And on the wrong day of the week it shows the Shabbat screen, which
 * takes the whole board and leaves the shul with no times at all.
 *
 * So: two checks, both of which only ever say "this cannot be right".
 *
 *   Time does not go backwards. Every time the board reaches the server it
 *   writes down what the server said the time was. A clock that now reads
 *   earlier than that has been reset, and is wrong.
 *
 *   Nor does it precede the software running it. A box that boots with no
 *   network and no memory falls back to whatever its firmware was built
 *   with, which is always in the past.
 *
 * Neither can catch a clock that jumped forwards into plausible territory.
 * Nothing local can. What they catch is the case that actually happens.
 */

const KEY = "shul-tv-last-server-time";

/**
 * Older than any board running this code, and comfortably after the dates
 * these boxes fall back to. Not a build stamp: a build stamp would make
 * every rebuild claim that older clocks are broken.
 */
const FLOOR_MS = Date.UTC(2026, 0, 1);

/** Clocks disagree by seconds all the time; only a real gap is a reset. */
const SLACK_MS = 5 * 60_000;

function read(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

/**
 * Records what the server said the time is.
 *
 * Called with the Date header of any answered request - every request
 * carries one, so this costs nothing and happens constantly while the board
 * is online.
 */
export function noteServerTime(serverMs: number): void {
  if (!Number.isFinite(serverMs) || serverMs < FLOOR_MS) return;
  if (serverMs <= read()) return;
  try {
    localStorage.setItem(KEY, String(serverMs));
  } catch {
    /* private mode: the check falls back to the floor, which still helps */
  }
}

export interface ClockCheck {
  trusted: boolean;
  /** Why not, for the log. Empty when it is trusted. */
  reason: string;
}

export function checkClock(now: Date = new Date()): ClockCheck {
  const ms = now.getTime();
  if (!Number.isFinite(ms)) return { trusted: false, reason: "השעון לא תקין" };
  if (ms < FLOOR_MS) {
    return { trusted: false, reason: "השעון מראה תאריך מלפני התוכנה עצמה" };
  }
  const last = read();
  if (last && ms < last - SLACK_MS) {
    const hours = Math.round((last - ms) / 3_600_000);
    return { trusted: false, reason: `השעון אחורה ב-${hours} שעות ממה שהשרת אמר לאחרונה` };
  }
  return { trusted: true, reason: "" };
}

/** For the tests, and for a screen that is handed to another shul. */
export function forgetServerTime(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to forget */
  }
}
