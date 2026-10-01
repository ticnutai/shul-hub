import { minyanSubcategories, type Minyan, type MinyanCategory, type Settings } from "./data";
import { heldOn, jerusalemDateKey, jerusalemWeekday, resolveMinyan, zmanimFor, type ResolvedMinyan } from "./minyan-time";
import { isEventCategory } from "./specialDays";

/**
 * "כל השבוע": every day tab of the timetable at once - ימות החול, יום שישי,
 * שבת, and any tab the gabbai made - each with its prayers, and none of what
 * is empty: a day with no minyan is left out, and so is a prayer with none.
 *
 * Each tab is worked out for the next day it stands for (ימות החול today, or
 * Sunday after a weekend; יום שישי the coming Friday; שבת the coming
 * Saturday): times tied to the sun move with the date, and a minyan of a
 * season (בין הזמנים) is in or out by it.
 *
 * The regular timetable only. A one-day exception (minyan_overrides) belongs
 * to its date and says "היום בלבד" / "מבוטל היום"; it stays in the day view,
 * where "היום" is true.
 */
export interface WeekGroup {
  id: string;
  /** The prayer ("שחרית"); empty for a tab with no prayers of its own. */
  label: string;
  rows: ResolvedMinyan[];
}

export interface WeekDay {
  category: MinyanCategory;
  date: Date;
  groups: WeekGroup[];
}

const DAY = 24 * 60 * 60 * 1000;

/** Midday of a Jerusalem date - far from midnight, so adding whole days never slips a date. */
function middayOf(date: Date): Date {
  const [y, m, d] = jerusalemDateKey(date).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 10));
}

/** The next day a tab stands for, from `today` (today itself when it is one). */
export function nextDateFor(systemKey: string | null | undefined, today: Date): Date {
  const base = middayOf(today);
  const wd = jerusalemWeekday(base);
  const ahead = (target: number) => (target - wd + 7) % 7;
  if (systemKey === "weekday") return wd <= 4 ? base : new Date(base.getTime() + ahead(0) * DAY);
  if (systemKey === "friday") return new Date(base.getTime() + ahead(5) * DAY);
  if (systemKey === "shabbat") return new Date(base.getTime() + ahead(6) * DAY);
  return base;
}

export function weekSchedule({
  categories,
  minyanim,
  settings,
  today,
}: {
  categories: MinyanCategory[];
  minyanim: Minyan[];
  settings: Settings | null | undefined;
  today: Date;
}): WeekDay[] {
  const todayKey = jerusalemDateKey(today);
  const tabs = categories.filter(
    (c) =>
      c.active &&
      !isEventCategory(c) &&
      (!c.visible_from || c.visible_from <= todayKey) &&
      (!c.visible_until || c.visible_until >= todayKey),
  );

  const days: WeekDay[] = [];
  for (const category of tabs) {
    const date = nextDateFor(category.system_key, today);
    const zmanim = zmanimFor(date, settings);
    const rows = minyanim
      .filter(
        (m) =>
          m.active &&
          heldOn(m, date) &&
          (m.category_id === category.id || (!m.category_id && m.day_type === category.system_key)),
      )
      .map((m) => resolveMinyan(m, zmanim))
      .filter((r): r is ResolvedMinyan => r !== null)
      .sort((a, b) => a.minutes - b.minutes);
    if (!rows.length) continue;

    const prayers = minyanSubcategories(category);
    let groups: WeekGroup[];
    if (!prayers.length) {
      groups = [{ id: "all", label: "", rows }];
    } else {
      groups = prayers
        .map((p) => ({ id: p.id, label: p.label, rows: rows.filter((r) => r.minyan.prayer === p.id) }))
        .filter((g) => g.rows.length > 0);
      // A minyan whose prayer the tab no longer lists is still a minyan: kept, last.
      const known = new Set(prayers.map((p) => p.id));
      const rest = rows.filter((r) => !known.has(r.minyan.prayer));
      if (rest.length) groups.push({ id: "other", label: "עוד", rows: rest });
    }
    days.push({ category, date, groups });
  }
  return days;
}
