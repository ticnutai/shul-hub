import type { Zmanim } from "@community/lib/zmanim";
import { ALERT_EVENT_LABELS, type AlertEvent, type TvConfig } from "./config";

/**
 * Countdown reminders before the day's deadlines (sof zman shma, sof zman
 * tefila, sunset, candle lighting on Friday).
 *
 * Two levels, so the board neither shouts constantly nor stays silent:
 *   - a small countdown chip in the footer from the largest lead onward;
 *   - a full reminder card for `popupSeconds` at each lead (e.g. 30/15/5 min).
 * Everything is derived from the clock on every tick; there is no timer state
 * to go stale after a sleep, a reload or a clock correction.
 */

export interface ZmanAlert {
  event: AlertEvent;
  label: string;
  at: Date;
  secondsLeft: number;
  /** True while the big reminder card should be on screen. */
  popup: boolean;
  /** The lead that triggered the current popup, in minutes. */
  lead: number | null;
}

export function currentZmanAlert(
  now: Date,
  zmanim: Zmanim,
  alerts: TvConfig["alerts"],
  isFriday: boolean,
): ZmanAlert | null {
  if (!alerts.enabled || alerts.events.length === 0 || alerts.leadMinutes.length === 0) return null;
  const maxLead = Math.max(...alerts.leadMinutes);

  let best: ZmanAlert | null = null;
  for (const event of alerts.events) {
    // Candle lighting only matters on Friday; every other day it is noise.
    if (event === "candle" && !isFriday) continue;
    const at = zmanim[event];
    if (!at) continue;
    const secondsLeft = Math.floor((at.getTime() - now.getTime()) / 1000);
    if (secondsLeft <= 0 || secondsLeft > maxLead * 60) continue;

    const lead =
      alerts.leadMinutes.find((m) => secondsLeft <= m * 60 && secondsLeft > m * 60 - alerts.popupSeconds) ?? null;
    const candidate: ZmanAlert = {
      event,
      label: ALERT_EVENT_LABELS[event].replace(" (בערב שבת)", ""),
      at,
      secondsLeft,
      popup: lead !== null,
      lead,
    };
    // Closest deadline wins; a popping reminder beats a quiet one.
    if (
      !best ||
      (candidate.popup && !best.popup) ||
      (candidate.popup === best.popup && candidate.secondsLeft < best.secondsLeft)
    )
      best = candidate;
  }
  return best;
}

/** "14:05" for the countdown, "1:02:30" past an hour. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** "בעוד 14 דקות" / "בעוד דקה" for the headline. */
export function describeMinutes(totalSeconds: number): string {
  const minutes = Math.ceil(totalSeconds / 60);
  if (minutes <= 1) return "בעוד פחות מדקה";
  if (minutes === 2) return "בעוד שתי דקות";
  return `בעוד ${minutes} דקות`;
}
