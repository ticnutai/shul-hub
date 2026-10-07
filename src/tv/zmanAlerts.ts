import type { Zmanim } from "@community/lib/zmanim";
import { ALERT_EVENT_LABELS, type AlertEvent, type AlertLook, type TvConfig } from "./config";

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
  stage?: 'highlight' | 'panel' | 'board';
}

/** Every upcoming selected time is highlighted; the nearest drives the countdown. */
export function stagedZmanAlerts(now: Date, zmanim: Zmanim, alerts: TvConfig['alerts'], isFriday: boolean): ZmanAlert[] {
  if (!alerts.enabled || alerts.mode !== 'staged') return [];
  return alerts.events.flatMap(event => {
    const at = zmanim[event];
    if (!at || !Number.isFinite(at.getTime()) || event === 'candle' && !isFriday) return [];
    const remaining = at.getTime() - now.getTime();
    // The gabbai's steps (30 / 20 / 10 until set otherwise); a step of 0 is left out.
    const { highlight, panel, board } = alerts.stages ?? { highlight: 30, panel: 20, board: 10 };
    const first = Math.max(highlight, panel, board);
    if (remaining <= 0 || remaining > first * 60_000) return [];
    const stage = board && remaining <= board * 60_000 ? 'board' : panel && remaining <= panel * 60_000 ? 'panel' : highlight && remaining <= highlight * 60_000 ? 'highlight' : null;
    if (!stage) return [];
    return [{event, label:ALERT_EVENT_LABELS[event].replace(' (בערב שבת)',''), at, secondsLeft:Math.ceil(remaining/1000), popup:stage==='board', lead:null, stage} as ZmanAlert];
  }).sort((a,b)=>a.at.getTime()-b.at.getTime());
}

export function currentZmanAlert(
  now: Date,
  zmanim: Zmanim,
  alerts: TvConfig["alerts"],
  isFriday: boolean,
): ZmanAlert | null {
  if (alerts.mode === 'staged') return stagedZmanAlerts(now,zmanim,alerts,isFriday)[0] ?? null;
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

/* ------------------------------------------------------------- the look -- */

/** The symbol at the top of the card and at the start of the small strip. */
export const ALERT_ICONS: Record<AlertLook["icon"], string> = { hourglass: "⏳", clock: "🕰️", candle: "🕯️", none: "" };

/** Colours of their own, beside the board's ("theme") and the gabbai's ("custom"). */
export const ALERT_PRESETS: Record<Exclude<AlertLook["style"], "theme" | "custom">, AlertLook["colors"]> = {
  night: { bg: "#0b1628", text: "#f5ecd7", accent: "#e3c27a" },
  gold: { bg: "#fff3d1", text: "#3b2a07", accent: "#a8741a" },
  parchment: { bg: "#f6ecd7", text: "#3e2809", accent: "#8a6a2a" },
  crimson: { bg: "#4a0e17", text: "#fff1e6", accent: "#f2c46b" },
};

const RADIUS: Record<AlertLook["shape"], string> = {
  rounded: "calc(var(--u) * 3)",
  square: "calc(var(--u) * 0.6)",
  pill: "999px",
  arch: "50% 50% calc(var(--u) * 3) calc(var(--u) * 3) / 24% 24% calc(var(--u) * 3) calc(var(--u) * 3)",
};
const SCALE: Record<AlertLook["size"], number> = { small: 0.72, medium: 0.86, large: 1 };

/**
 * The reminder's look as CSS variables on the board (tv.css reads them in the
 * card, the countdown in the prayers' place and the small strip). The board's
 * own colours leave the colour variables out, so the theme's stand.
 */
export function alertLookVars(look: AlertLook): Record<string, string> {
  const colors = look.style === "custom" ? look.colors : look.style === "theme" ? null : ALERT_PRESETS[look.style];
  return {
    ...(colors ? { "--al-bg": colors.bg, "--al-text": colors.text, "--al-accent": colors.accent } : {}),
    "--al-radius": RADIUS[look.shape],
    "--al-scale": String(SCALE[look.size]),
  };
}
