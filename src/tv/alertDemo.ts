/**
 * The reminder's simulation: a time of the day, the steps before it on a
 * line, and the board's clock run through them - on the editor's preview and,
 * when asked, on a connected screen. Worked out here once for both.
 *
 * On a screen it is the board itself, its clock moved to the simulation's
 * moment and run at its speed for a little while, marked "דוגמה" so nobody in
 * the hall takes it for a real one. It goes as a "message" command: an app
 * older than 1.40 shows its text, which says so.
 */
import type { Zmanim } from "@community/lib/zmanim";
import { normalizeTvConfig, type AlertEvent, type TvConfig } from "./config";
import { currentZmanAlert, minutesFor } from "./zmanAlerts";

/** The first app that shows the example itself (versionCode 41 = 1.40). */
export const ALERT_DEMO_APP_CODE = 41;
/** What an older app shows instead (a "message" command's text). */
export const ALERT_DEMO_OLD_APP_TEXT = "דוגמת תזכורת נשלחה למסך הזה - כדי לראות אותה כאן צריך לעדכן את אפליקציית המסך לגרסה 1.40";

export type SimSpeed = 1 | 10 | 60;

/**
 * The day the simulation takes its times from: today - or, on Friday and
 * Saturday, the coming Sunday, since a moment inside Shabbat shows the Shabbat
 * screen and no reminders.
 */
export function simulationDay(weekday: number, now = new Date()): Date {
  return weekday >= 5 ? new Date(now.getTime() + (7 - weekday) * 86_400_000) : now;
}

/** The times the reminders are on for, with their hour that day (candle lighting is Friday's alone). */
export function simulationTimes(alerts: TvConfig["alerts"], zmanim: Zmanim): { event: AlertEvent; at: Date }[] {
  return alerts.events.flatMap((event) => {
    const at = event === "candle" ? null : zmanim[event];
    return at && Number.isFinite(at.getTime()) ? [{ event, at }] : [];
  });
}

export interface TimelineMark {
  /** Minutes before the time; 0 is the time itself. */
  minutes: number;
  label: string;
}

/** The steps before a time, latest last, and where a run begins (a minute before the first). */
export function alertTimeline(alerts: TvConfig["alerts"], event: AlertEvent): { marks: TimelineMark[]; from: number } {
  const own = minutesFor(alerts, event);
  const steps: TimelineMark[] =
    alerts.mode === "staged"
      ? [
          { minutes: own.stages.highlight, label: "הזמן מסומן ברשימה" },
          { minutes: own.stages.panel, label: "ספירה במקום התפילות" },
          { minutes: own.stages.board, label: "ספירה על כל הלוח" },
        ]
      : own.leadMinutes.map((minutes, i) => ({ minutes, label: i === 0 ? "פס קטן וכרטיס קופץ" : "כרטיס קופץ" }));
  // Two steps at the same minute are one mark.
  const byMinute = new Map<number, string>();
  for (const s of steps.filter((s) => s.minutes > 0).sort((a, b) => b.minutes - a.minutes))
    byMinute.set(s.minutes, byMinute.has(s.minutes) ? `${byMinute.get(s.minutes)} + ${s.label}` : s.label);
  const marks = [...byMinute].map(([minutes, label]) => ({ minutes, label }));
  return { marks: [...marks, { minutes: 0, label: "הזמן עצמו" }], from: (marks[0]?.minutes ?? 0) + 1 };
}

/** What the board shows at a moment of the run, in a few words - read off the board's own reckoning. */
export function whatShows(alerts: TvConfig["alerts"], event: AlertEvent, at: Date, moment: Date): string {
  if (moment.getTime() >= at.getTime()) return "הזמן הגיע - התזכורת יורדת מהלוח";
  const shown = currentZmanAlert(moment, { [event]: at } as unknown as Zmanim, { ...alerts, enabled: true, events: [event] }, event === "candle");
  if (!shown) return "עוד אין תזכורת על הלוח";
  if (shown.stage === "highlight") return "הזמן מסומן ברשימה";
  if (shown.stage === "panel") return "ספירה במקום התפילות";
  if (shown.stage === "board") return "ספירה על כל הלוח";
  return shown.popup ? "כרטיס קופץ" : "פס קטן בתחתית הלוח";
}

/** How long a run stays on a screen: until a little after the time, between 10 seconds and a minute. */
export function screenSeconds(secondsLeft: number, speed: SimSpeed): number {
  return Math.min(60, Math.max(10, Math.ceil((secondsLeft + 30) / speed)));
}

/** The "message" command's payload that carries the run to a screen. */
export function alertDemoPayload(alerts: TvConfig["alerts"], from: Date, speed: SimSpeed, seconds: number) {
  return { text: ALERT_DEMO_OLD_APP_TEXT, seconds: 10, alertDemo: { at: from.toISOString(), speed, seconds, alerts } };
}

export interface AlertDemo {
  /** The board's moment when the run began. */
  from: number;
  /** The real moment it began. */
  start: number;
  speed: SimSpeed;
  /** Until when (the real clock). */
  until: number;
  /** The reminders as the editor has them - unsaved changes too. */
  alerts: TvConfig["alerts"];
}

/** The run in a command's payload, or null when there is none (or it is broken). */
export function readAlertDemo(payload: Record<string, unknown>, realNow = Date.now()): AlertDemo | null {
  const d = payload.alertDemo;
  if (!d || typeof d !== "object") return null;
  const raw = d as Record<string, unknown>;
  const from = typeof raw.at === "string" ? Date.parse(raw.at) : NaN;
  if (!Number.isFinite(from)) return null;
  const seconds = Math.min(60, Math.max(5, Number(raw.seconds) || 20));
  const speed: SimSpeed = raw.speed === 60 ? 60 : raw.speed === 10 ? 10 : 1;
  return {
    from,
    start: realNow,
    speed,
    until: realNow + seconds * 1000,
    alerts: { ...normalizeTvConfig({ alerts: raw.alerts }).alerts, enabled: true },
  };
}

/** The board's clock during a run. */
export function demoNow(demo: AlertDemo, realNow: number): Date {
  return new Date(demo.from + (realNow - demo.start) * demo.speed);
}
