import {
  minyanSubcategories,
  useAnnouncements,
  useMinyanCategories,
  useMinyanim,
  useSettings,
  useShiurim,
  type Announcement,
  type Minyan,
  type MinyanCategory,
  type MinyanSubcategory,
  type Settings,
  type Shiur,
} from "@community/lib/data";
import { useMemo } from "react";
import { dayTypeFor, jerusalemWeekday, resolveDay, resolveMinyan, zmanimFor, type ResolvedMinyan } from "@community/lib/minyan-time";
import { formatTime, type Zmanim } from "@community/lib/zmanim";
import { useRealtimeSync, type RealtimeSyncState } from "@community/lib/realtime";
import type { TvConfig } from "./config";
import { useOfflineSnapshot } from "./useOfflineSnapshot";
import { shabbatNow, type ShabbatTimes } from "./shabbat";
import { checkClock } from "./clock";

/**
 * Data for the board, plus the rules that turn it into slides. Shared by the
 * TV app and the admin preview, so what the admin sees is computed by exactly
 * the same code as what hangs on the wall.
 */

export interface BoardData {
  settings: Settings | null;
  minyanim: Minyan[] | null;
  categories: MinyanCategory[] | null;
  announcements: Announcement[] | null;
  shiurim: Shiur[] | null;
  /** Some of the data came from the on-device copy, not from the server. */
  stale: boolean;
  anyLoaded: boolean;
  sync: RealtimeSyncState;
}

export function useBoardData({ persist, live }: { persist: boolean; live: boolean }): BoardData {
  // The admin site already refreshes through its own screens; only the TV
  // needs its own socket.
  const sync = useRealtimeSync(
    live ? ["settings", "minyanim", "minyan_categories", "announcements", "shiurim"] : [],
  );
  const settings = useOfflineSnapshot("settings", useSettings().data, persist);
  const minyanim = useOfflineSnapshot("minyanim", useMinyanim().data, persist);
  const categories = useOfflineSnapshot("minyan_categories", useMinyanCategories().data, persist);
  const announcements = useOfflineSnapshot("announcements", useAnnouncements().data, persist);
  const shiurim = useOfflineSnapshot("shiurim", useShiurim().data, persist);

  const parts = [settings, minyanim, categories, announcements, shiurim];
  const stale = parts.some((p) => p.isStale);
  const anyLoaded = parts.some((p) => p.data !== null);
  const syncStatus = live ? sync.status : "live";
  const lastSyncedAt = live ? sync.lastSyncedAt : null;
  // One stable object until something actually changes. A fresh object on
  // every render (the TV re-renders each second for the clock) defeated the
  // once-a-minute slide cache and re-drew the whole slide every second.
  return useMemo(
    () => ({
      settings: settings.data ?? null,
      minyanim: minyanim.data,
      categories: categories.data,
      announcements: announcements.data,
      shiurim: shiurim.data,
      stale,
      anyLoaded,
      sync: { status: syncStatus, lastSyncedAt },
    }),
    [settings.data, minyanim.data, categories.data, announcements.data, shiurim.data, stale, anyLoaded, syncStatus, lastSyncedAt],
  );
}

/* ----------------------------------------------------------------- slides */

interface SlideBase {
  /** Stable across data refreshes, so rotation keeps its place. */
  id: string;
  seconds: number;
  layout: string;
}

export type BoardSlide =
  | (SlideBase & { kind: "prayer"; title: string; rows: ResolvedMinyan[]; subcategories: MinyanSubcategory[] })
  | (SlideBase & { kind: "learning" })
  | (SlideBase & { kind: "announcements"; items: Announcement[]; page: number; pages: number })
  | (SlideBase & { kind: "shiurim"; items: Shiur[] })
  | (SlideBase & { kind: "slideshow"; images: TvConfig["slideshow"]["images"]; secondsPerImage: number })
  | (SlideBase & { kind: "shabbat"; times: ShabbatTimes; scenes: string[]; secondsPerScene: number });

const ANNOUNCEMENTS_PER_PAGE = 4;

function jerusalemDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * The prayer schedules to show today, mirroring the website's category rules:
 * the category for today's day type, plus every visible category that is not
 * tied to a day type (e.g. סליחות). The board previously filtered minyanim by
 * `day_type` only, so a category like סליחות - whose minyanim are stored as
 * `custom` - never appeared on the wall at all.
 */
export function prayerSchedules(data: BoardData, now: Date, zmanim: Zmanim, hidden: Set<string>) {
  const dayType = dayTypeFor(now);
  // Hidden from the board by the admin (the website still lists them).
  const minyanim = (data.minyanim ?? []).filter((m) => !hidden.has(`minyan:${m.id}`));

  if (!data.categories || data.categories.length === 0) {
    return [{ id: dayType, title: "", rows: resolveDay(minyanim, dayType, zmanim), subcategories: [] as MinyanSubcategory[] }];
  }

  const todayKey = jerusalemDateKey(now);
  return data.categories
    .filter(
      (c) =>
        // Taken off the board by the admin - "סליחות" after Yom Kippur, say.
        // The website still lists it; only the wall stops showing it.
        !hidden.has(`cat:${c.id}`) &&
        c.active &&
        (!c.visible_from || c.visible_from <= todayKey) &&
        (!c.visible_until || c.visible_until >= todayKey) &&
        (c.system_key === dayType || !c.system_key),
    )
    .sort((a, b) => (a.system_key ? 0 : 1) - (b.system_key ? 0 : 1) || a.sort_order - b.sort_order)
    .map((c) => ({
      id: c.id,
      title: c.name,
      subcategories: minyanSubcategories(c),
      rows: minyanim
        .filter((m) => m.active && (m.category_id === c.id || (!m.category_id && m.day_type === c.system_key)))
        .map((m) => resolveMinyan(m, zmanim))
        .filter((r): r is ResolvedMinyan => r !== null)
        .sort((a, b) => a.minutes - b.minutes),
    }));
}

/**
 * Minutes past midnight from a shiur's free-text time ("16:15 · חצי שעה").
 * Untimed entries sort last instead of breaking the order.
 */
export function shiurMinutes(timeText: string | null | undefined): number {
  const match = timeText?.match(/(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.POSITIVE_INFINITY;
}

export function buildSlides(data: BoardData, config: TvConfig, now: Date, zmanim: Zmanim): BoardSlide[] {
  // Shabbat: one screen, no rotation, from candle lighting until it ends.
  //
  // It takes the whole board, so it is the one thing here that must not
  // happen on a guess. A box that lost power while the router was down can
  // come back believing it is a different day, and the board would then
  // hide every time in the building and look entirely deliberate about it.
  // A clock that cannot be trusted keeps the ordinary board (clock.ts).
  if (config.shabbat.enabled && checkClock(now).trusted) {
    const times = shabbatNow(now, data.settings, config.shabbat.endMinutesAfterSunset);
    if (times) {
      const { scenes, rotate, secondsPerScene } = config.shabbat;
      return [{ id: "shabbat", kind: "shabbat", seconds: 3600, layout: "scene", times, scenes: rotate ? scenes : scenes.slice(0, 1), secondsPerScene }];
    }
  }
  const slides: BoardSlide[] = [];
  const nowMs = now.getTime();
  const hidden = new Set(config.hidden);

  for (const sc of config.slides) {
    if (!sc.enabled) continue;
    // Split screen: the side column already shows the zmanim, so the prayer
    // slide uses its timeline layout (the one without a zmanim panel).
    const base = { seconds: sc.seconds, layout: config.screenLayout === "split" && sc.kind === "prayer" ? "timeline" : sc.layout };

    if (sc.kind === "prayer") {
      const schedules = prayerSchedules(data, now, zmanim, hidden);
      const withRows = schedules.filter((s) => s.rows.length > 0);
      // Always keep one prayer slide, even empty: it also carries the zmanim.
      for (const s of withRows.length ? withRows : schedules.slice(0, 1)) {
        slides.push({ ...base, id: `prayer:${s.id}`, kind: "prayer", title: s.title, rows: s.rows, subcategories: s.subcategories });
      }
    } else if (sc.kind === "learning") {
      slides.push({ ...base, id: "learning", kind: "learning" });
    } else if (sc.kind === "announcements") {
      const items = (data.announcements ?? []).filter(
        (a) => !hidden.has(`ann:${a.id}`) && (!a.expires_at || new Date(a.expires_at).getTime() > nowMs),
      );
      if (sc.layout === "spotlight") {
        items.forEach((a, i) =>
          slides.push({ ...base, id: `ann:${a.id}`, kind: "announcements", items: [a], page: i + 1, pages: items.length }),
        );
      } else {
        const pages = Math.ceil(items.length / ANNOUNCEMENTS_PER_PAGE);
        for (let p = 0; p < pages; p += 1)
          slides.push({
            ...base,
            id: `ann:page${p}`,
            kind: "announcements",
            items: items.slice(p * ANNOUNCEMENTS_PER_PAGE, (p + 1) * ANNOUNCEMENTS_PER_PAGE),
            page: p + 1,
            pages,
          });
      }
    } else if (sc.kind === "shiurim") {
      const weekday = jerusalemWeekday(now);
      const items = (data.shiurim ?? [])
        .filter((s) => s.active && !hidden.has(`shiur:${s.id}`) && (s.schedule_type !== "weekly" || s.day_of_week === weekday))
        // `sort_order` is the website's ordering; on the wall it read as
        // 16:15, 08:45, 14:15, 15:15. A schedule is scanned by time.
        .sort((a, b) => shiurMinutes(a.time_text) - shiurMinutes(b.time_text));
      if (items.length) slides.push({ ...base, id: "shiurim", kind: "shiurim", items });
    } else if (sc.kind === "slideshow") {
      const images = config.slideshow.images;
      if (images.length)
        slides.push({
          ...base,
          id: "slideshow",
          kind: "slideshow",
          images,
          secondsPerImage: config.slideshow.secondsPerImage,
          // Show every picture once per pass, however long the admin set.
          seconds: images.length * config.slideshow.secondsPerImage,
        });
    }
  }

  return slides.length ? slides : [{ id: "learning", kind: "learning", seconds: 30, layout: "cards" }];
}

/** Zmanim for the calendar day of `now`, recomputed once a day, not every second. */
export function useDayZmanim(now: Date, settings: Settings | null): Zmanim {
  const dayStamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime();
  return useMemo(() => zmanimFor(new Date(dayStamp), settings), [dayStamp, settings]);
}

/** Minutes past midnight in Jerusalem, the scale ResolvedMinyan.minutes uses. */
export function jerusalemMinutes(date: Date): number {
  const [h, m] = formatTime(date).split(":");
  return Number(h) * 60 + Number(m);
}
