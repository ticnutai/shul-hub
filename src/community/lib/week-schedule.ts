import type { Minyan, MinyanCategory, Settings } from "./data";
import {
  jerusalemDateKey,
  jerusalemWeekday,
  resolveCategoryDay,
  zmanimFor,
  type MinyanOverride,
  type ResolvedMinyan,
} from "./minyan-time";
import { isEventCategory, todaysCategories } from "./specialDays";

/**
 * "כל השבוע": every day tab of the timetable at once - ימות החול, יום שישי,
 * שבת, and any tab the gabbai made - and none of what is empty.
 *
 * Two orders, chosen separately for the website (settings.minyan_days) and for
 * the board (tv_config.prayerDays), both worked out here so the two never
 * disagree on which day is which:
 *   - "today_first": today's tab on top, marked, then the days as they come
 *     (on a Friday: שישי, שבת, ימות החול);
 *   - "fixed": the tabs in their own order, today's still marked.
 *
 * Each tab is worked out for the next day it stands for (ימות החול today, or
 * Sunday after a weekend; יום שישי the coming Friday; שבת the coming
 * Saturday): times tied to the sun move with the date, and a minyan of a
 * season (בין הזמנים) is in or out by it. On a special day with a timetable of
 * its own (יום כיפור) that tab is today's, and the ordinary tab of the same
 * weekday moves to its next date.
 */
export type WeekOrder = "today_first" | "fixed";

export interface PlannedDay<C> {
  category: C;
  date: Date;
  isToday: boolean;
}

export interface WeekDay extends PlannedDay<MinyanCategory> {
  rows: ResolvedMinyan[];
}

const DAY = 24 * 60 * 60 * 1000;

/** Midday of a Jerusalem date - far from midnight, so adding whole days never slips a date. */
function middayOf(date: Date): Date {
  const [y, m, d] = jerusalemDateKey(date).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 10));
}

/**
 * The next day a tab stands for, from `today` (today itself when it is one,
 * unless `after` asks for the one after today).
 */
export function nextDateFor(systemKey: string | null | undefined, today: Date, after = false): Date {
  const base = new Date(middayOf(today).getTime() + (after ? DAY : 0));
  const wd = jerusalemWeekday(base);
  const ahead = (target: number) => (target - wd + 7) % 7;
  if (systemKey === "weekday") return wd <= 4 ? base : new Date(base.getTime() + ahead(0) * DAY);
  if (systemKey === "friday") return new Date(base.getTime() + ahead(5) * DAY);
  if (systemKey === "shabbat") return new Date(base.getTime() + ahead(6) * DAY);
  return base;
}

type PlanCategory = Pick<MinyanCategory, "id" | "system_key" | "active" | "visible_from" | "visible_until">;

/** Which tabs the week shows, for which date each, and in what order. */
export function planWeek<C extends PlanCategory>(categories: C[], today: Date, order: WeekOrder): PlannedDay<C>[] {
  const todayKey = jerusalemDateKey(today);
  const todays = todaysCategories(categories, today);
  const todayId = todays.preferred?.id;

  const planned: (PlannedDay<C> & { at: number })[] = categories
    .map((category, at) => ({ category, at }))
    .filter(
      ({ category: c }) =>
        c.active &&
        !isEventCategory(c) &&
        (!c.visible_from || c.visible_from <= todayKey) &&
        (!c.visible_until || c.visible_until >= todayKey),
    )
    .map(({ category, at }) => {
      // On a special day its own tab is today's; the ordinary tab of today's
      // weekday stands for its next date instead.
      const date = nextDateFor(category.system_key, today, todays.event !== null && category.system_key === todays.ordinaryKey);
      // Today's tab only when it is for today: a Shabbat with no שבת tab
      // leads to ימות החול, which stands for Sunday, not for today. A tab the
      // gabbai made (סליחות) has no day of its own and stands beside today's,
      // as it does in the day view.
      const isToday = category.system_key
        ? category.id === todayId && jerusalemDateKey(date) === todayKey
        : true;
      return { category, at, date, isToday };
    });

  if (todays.event && todays.preferred) {
    planned.unshift({ category: todays.preferred, at: -1, isToday: true, date: middayOf(today) });
  }

  if (order === "today_first") {
    // Today's tab, then the gabbai's own tabs that stand beside it, then the
    // other days by date.
    const group = (d: (typeof planned)[number]) => (!d.category.system_key ? 1 : d.isToday ? 0 : 2);
    planned.sort((a, b) => group(a) - group(b) || (group(a) === 2 ? a.date.getTime() - b.date.getTime() : 0) || a.at - b.at);
  }
  return planned.map(({ category, date, isToday }) => ({ category, date, isToday }));
}

/** The week with each day's minyanim; a day with none is left out. */
export function weekSchedule({
  categories,
  minyanim,
  settings,
  today,
  order,
  todayOverrides,
}: {
  categories: MinyanCategory[];
  minyanim: Minyan[];
  settings: Settings | null | undefined;
  today: Date;
  order: WeekOrder;
  /** Today's one-day exceptions: they belong to today's tab only. */
  todayOverrides?: Map<string, MinyanOverride>;
}): WeekDay[] {
  return planWeek(categories, today, order)
    .map((day) => ({
      ...day,
      rows: resolveCategoryDay(
        minyanim,
        day.category,
        day.date,
        zmanimFor(day.date, settings),
        day.isToday ? todayOverrides : undefined,
      ),
    }))
    .filter((day) => day.rows.length > 0);
}
