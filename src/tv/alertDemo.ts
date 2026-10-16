/**
 * An example of the countdown reminder, at a step chosen: shown on the
 * editor's preview and, when asked, on a connected screen - the same moment
 * on both, worked out here once.
 *
 * On a screen it is the board itself, its clock moved to a few minutes before
 * a time of the day for a little while, so the countdown runs as it will -
 * marked "דוגמה" so nobody in the hall takes it for a real one. It goes as a
 * "message" command: an app older than 1.40 shows its text, which says so.
 */
import type { Zmanim } from "@community/lib/zmanim";
import { normalizeTvConfig, type AlertEvent, type TvConfig } from "./config";

export type AlertExample = "board" | "panel" | "chip";

/** How long the example stays on a connected screen. */
export const SCREEN_EXAMPLE_SECONDS = 20;
/** The first app that shows the example itself (versionCode 41 = 1.40). */
export const ALERT_DEMO_APP_CODE = 41;
/** What an older app shows instead (a "message" command's text). */
export const ALERT_DEMO_OLD_APP_TEXT = "דוגמת תזכורת נשלחה למסך הזה - כדי לראות אותה כאן צריך לעדכן את אפליקציית המסך לגרסה 1.40";

/**
 * The moment the example shows: a few seconds into the step asked for, before
 * the first time of the day the reminders are on for (not candle lighting).
 * On Friday and Saturday the moment could fall inside Shabbat, where the
 * board shows the Shabbat screen and no reminders - so the coming Sunday.
 */
export function alertExampleMoment(
  alerts: TvConfig["alerts"],
  what: AlertExample,
  zmanimOn: (day: Date) => Zmanim,
  weekday: number,
  now = new Date(),
): { at: Date; event: AlertEvent; seconds: number } | null {
  const day = zmanimOn(weekday >= 5 ? new Date(now.getTime() + (7 - weekday) * 86_400_000) : now);
  const event = alerts.events.find((e) => e !== "candle" && day[e]) ?? "sunset";
  const time = day[event];
  if (!time) return null;
  const { stages, leadMinutes, mode, popupSeconds } = alerts;
  const lead = leadMinutes[leadMinutes.length - 1] ?? 15;
  const seconds =
    mode === "staged"
      ? what === "panel" ? stages.panel * 60 - 5 : (stages.board || stages.panel || stages.highlight) * 60 - 5
      : what === "chip" ? Math.max(lead * 60 - popupSeconds - 30, 30) : lead * 60 - 2;
  return { at: new Date(time.getTime() - seconds * 1000), event, seconds };
}

/** The "message" command's payload that carries the example to a screen. */
export function alertDemoPayload(alerts: TvConfig["alerts"], at: Date, seconds = SCREEN_EXAMPLE_SECONDS) {
  return { text: ALERT_DEMO_OLD_APP_TEXT, seconds: 10, alertDemo: { at: at.toISOString(), seconds, alerts } };
}

export interface AlertDemo {
  /** Added to the clock while it is on: the board's moment minus the real one. */
  offset: number;
  /** Until when (the real clock). */
  until: number;
  /** The reminders as the editor has them - unsaved changes too. */
  alerts: TvConfig["alerts"];
}

/** The example in a command's payload, or null when there is none (or it is broken). */
export function readAlertDemo(payload: Record<string, unknown>, realNow = Date.now()): AlertDemo | null {
  const d = payload.alertDemo;
  if (!d || typeof d !== "object") return null;
  const raw = d as Record<string, unknown>;
  const at = typeof raw.at === "string" ? Date.parse(raw.at) : NaN;
  if (!Number.isFinite(at)) return null;
  const seconds = Math.min(60, Math.max(5, Number(raw.seconds) || SCREEN_EXAMPLE_SECONDS));
  return {
    offset: at - realNow,
    until: realNow + seconds * 1000,
    alerts: { ...normalizeTvConfig({ alerts: raw.alerts }).alerts, enabled: true },
  };
}
