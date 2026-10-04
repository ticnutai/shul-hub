import type { Minyan, MinyanCategory, Settings, Shiur } from "./data";
import {
  dayTypeFor,
  jerusalemDateKey,
  jerusalemWeekday,
  overridesFor,
  resolveCategoryDay,
  resolveDay,
  zmanimFor,
  type MinyanOverride,
  type ResolvedMinyan,
} from "./minyan-time";
import { holyEndMinutesFor, holyWindow, todaysCategories } from "./specialDays";

/**
 * What a member asked to be reminded of, and how (the bell in the header).
 * Kept on the device; the same shape in the browser and in the app.
 */
export interface ReminderPrefs {
  enabled: boolean;
  minyanim: boolean;
  shiurim: boolean;
  announcements: boolean;
  chavrutot: boolean;
  /** Empty: every minyan the gabbai offers reminders for. */
  selectedMinyanIds: string[];
  selectedShiurIds: string[];
  /** A short chime with every reminder and new notice. */
  sound: boolean;
  /** In the app: a minyan rings like an alarm clock, on the whole screen. */
  alarm: boolean;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  enabled: false,
  minyanim: true,
  shiurim: true,
  announcements: true,
  chavrutot: false,
  selectedMinyanIds: [],
  selectedShiurIds: [],
  sound: true,
  alarm: false,
};

export function normalizeReminderPrefs(raw: unknown): ReminderPrefs {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const bool = (k: keyof ReminderPrefs) => (typeof r[k] === "boolean" ? (r[k] as boolean) : (DEFAULT_REMINDER_PREFS[k] as boolean));
  const ids = (k: "selectedMinyanIds" | "selectedShiurIds") =>
    Array.isArray(r[k]) ? (r[k] as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 200) : [];
  return {
    enabled: bool("enabled"),
    minyanim: bool("minyanim"),
    shiurim: bool("shiurim"),
    announcements: bool("announcements"),
    chavrutot: bool("chavrutot"),
    selectedMinyanIds: ids("selectedMinyanIds"),
    selectedShiurIds: ids("selectedShiurIds"),
    sound: bool("sound"),
    alarm: bool("alarm"),
  };
}

export interface PlannedReminder {
  /** One per minyan or shiur per day: what was already shown is known by it. */
  key: string;
  kind: "minyan" | "shiur";
  /** When to remind. */
  at: Date;
  /** When it starts. */
  starts: Date;
  title: string;
  body: string;
}

const DAY = 86_400_000;

/** A day's zmanim, worked out once per Jerusalem date. */
function zmanimByDay(settings: Settings | null | undefined) {
  const seen = new Map<string, ReturnType<typeof zmanimFor>>();
  return (date: Date) => {
    const key = jerusalemDateKey(date);
    let z = seen.get(key);
    if (!z) seen.set(key, (z = zmanimFor(date, settings)));
    return z;
  };
}

/** How far Jerusalem's clock is ahead of UTC at that moment, in minutes. */
function jerusalemOffset(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/**
 * The moment a time on a Jerusalem day falls: `minutes` from that day's
 * midnight, past 24:00 for the end of the prayer day (an arvit at 00:15).
 */
export function jerusalemMoment(dateKey: string, minutes: number): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  let at = wall - jerusalemOffset(new Date(wall)) * 60_000;
  // Across a clock change the first guess is an hour off: once more from it.
  const again = wall - jerusalemOffset(new Date(at)) * 60_000;
  if (again !== at) at = again;
  return new Date(at);
}

function hhmm(text: string | null | undefined): number | null {
  const m = /(\d{1,2}):(\d{2})/.exec(text ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** "בעוד 10 דקות" - or nothing, for a reminder at the time itself. */
function inMinutes(n: number): string {
  if (n <= 0) return "";
  if (n === 1) return "בעוד דקה";
  if (n === 60) return "בעוד שעה";
  return `בעוד ${n} דקות`;
}

type Cat = Pick<MinyanCategory, "id" | "system_key" | "active" | "visible_from" | "visible_until">;

/** A day's minyanim, as the website's "היום" lists them for that date. */
function minyanimOn(minyanim: Minyan[], categories: Cat[], date: Date, settings: Settings | null | undefined, overrides: MinyanOverride[]) {
  const zmanim = zmanimFor(date, settings);
  const exceptions = overridesFor(overrides, date);
  if (categories.length === 0) return resolveDay(minyanim, dayTypeFor(date), zmanim, exceptions, date);
  const today = todaysCategories(categories, date);
  const rows: ResolvedMinyan[] = [];
  for (const c of today.categories) {
    if (today.event === null && c.system_key && c.system_key !== today.ordinaryKey) continue;
    for (const r of resolveCategoryDay(minyanim, c, date, zmanim, exceptions)) {
      if (!rows.some((x) => x.minyan.id === r.minyan.id)) rows.push(r);
    }
  }
  return rows;
}

/**
 * Every reminder due from `from` over the next `days` days: the minyanim and
 * shiurim the member chose (or all the gabbai offers), each `reminder_minutes`
 * before it starts, by the very times the website and the board show -
 * the day's tabs, special days, one-day changes; one called off is not
 * reminded. Nothing on Shabbat or Yom Tov: from candle lighting to its end
 * no phone of the synagogue's rings.
 */
export function planReminders({
  minyanim,
  categories,
  overrides = [],
  shiurim,
  settings,
  prefs,
  from,
  days,
}: {
  minyanim: Minyan[];
  categories: Cat[];
  overrides?: MinyanOverride[];
  shiurim: Shiur[];
  settings: Settings | null | undefined;
  prefs: ReminderPrefs;
  from: Date;
  days: number;
}): PlannedReminder[] {
  if (!prefs.enabled) return [];
  const out: PlannedReminder[] = [];
  const holyEnd = holyEndMinutesFor(settings);
  const z = zmanimByDay(settings);
  const holy = (at: Date) => holyWindow(at, z(at), z, holyEnd) !== null;
  const offered = minyanim.filter(
    (m) =>
      m.active &&
      m.notification_enabled &&
      (prefs.selectedMinyanIds.length === 0 || prefs.selectedMinyanIds.includes(m.id)),
  );
  const shiurimOffered = shiurim.filter(
    (s) =>
      s.active &&
      s.notification_enabled &&
      (prefs.selectedShiurIds.length === 0 || prefs.selectedShiurIds.includes(s.id)),
  );

  for (let i = 0; i < days; i++) {
    // Midday: far from midnight, so a day is never skipped or counted twice.
    const [y, m, d] = jerusalemDateKey(from).split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 10) + i * DAY);
    const key = jerusalemDateKey(date);

    if (prefs.minyanim) {
      for (const r of minyanimOn(offered, categories, date, settings, overrides)) {
        if (r.cancelled) continue;
        const starts = jerusalemMoment(key, r.minutes);
        const before = Math.max(0, r.minyan.reminder_minutes ?? 0);
        const at = new Date(starts.getTime() - before * 60_000);
        if (at <= from || holy(at)) continue;
        out.push({
          key: `minyan:${r.minyan.id}:${key}`,
          kind: "minyan",
          at,
          starts,
          title: `${r.minyan.label} ${r.time}`,
          body: [inMinutes(before), r.minyan.room, r.note].filter(Boolean).join(" · ") || "מתחיל עכשיו",
        });
      }
    }

    if (prefs.shiurim) {
      const weekday = jerusalemWeekday(date);
      for (const s of shiurimOffered) {
        if (s.schedule_type !== "daily" && s.day_of_week !== weekday) continue;
        const minutes = hhmm(s.time_text);
        if (minutes === null) continue;
        const starts = jerusalemMoment(key, minutes);
        const before = Math.max(0, s.reminder_minutes ?? 0);
        const at = new Date(starts.getTime() - before * 60_000);
        if (at <= from || holy(at)) continue;
        out.push({
          key: `shiur:${s.id}:${key}`,
          kind: "shiur",
          at,
          starts,
          title: `שיעור: ${s.title}`,
          body: [s.time_text, inMinutes(before), s.location].filter(Boolean).join(" · "),
        });
      }
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * From candle lighting to the end of each Shabbat or Yom Tov in the coming
 * days - when nothing may sound. The app's own background check of new
 * notices is handed these, since it has no calendar of its own.
 */
export function holyWindows(from: Date, days: number, settings: Settings | null | undefined): Array<{ start: number; end: number }> {
  const holyEnd = holyEndMinutesFor(settings);
  const z = zmanimByDay(settings);
  const out: Array<{ start: number; end: number }> = [];
  // Every 15 minutes is fine enough: candle lighting and nightfall are minutes, not seconds.
  const step = 15 * 60_000;
  let open: number | null = null;
  for (let t = from.getTime(); t <= from.getTime() + days * DAY; t += step) {
    const at = new Date(t);
    const isHoly = holyWindow(at, z(at), z, holyEnd) !== null;
    if (isHoly && open === null) open = t;
    if (!isHoly && open !== null) {
      out.push({ start: open, end: t });
      open = null;
    }
  }
  if (open !== null) out.push({ start: open, end: from.getTime() + days * DAY });
  return out;
}
