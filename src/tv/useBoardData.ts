import {
  minyanSubcategories,
  useAnnouncements,
  useMinyanCategories,
  useMinyanim,
  useMinyanOverrides,
  useSettings,
  useShiurim,
  type Announcement,
  type Minyan,
  type MinyanCategory,
  type MinyanOverrideRow,
  type MinyanSubcategory,
  type Settings,
  type Shiur,
} from "@community/lib/data";
import { useMemo } from "react";
import { dayTypeFor, heldOn, jerusalemDateKey, jerusalemWeekday, overridesFor, resolveDay, resolveMinyan, zmanimFor, type ResolvedMinyan } from "@community/lib/minyan-time";
import { formatTime, type Zmanim } from "@community/lib/zmanim";
import { todaysCategories } from "@community/lib/specialDays";
import { useRealtimeSync, type RealtimeSyncState } from "@community/lib/realtime";
import type { BlockArea, BlockId, Screen, TvConfig } from "./config";
import { place, readScreens } from "./screens";
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
  /** One-day exceptions to the timetable. Empty on almost every day. */
  overrides: MinyanOverrideRow[] | null;
  /** Some of the data came from the on-device copy, not from the server. */
  stale: boolean;
  anyLoaded: boolean;
  sync: RealtimeSyncState;
}

export function useBoardData({ persist, live }: { persist: boolean; live: boolean }): BoardData {
  // The admin site already refreshes through its own screens; only the TV
  // needs its own socket.
  const sync = useRealtimeSync(
    live ? ["settings", "minyanim", "minyan_categories", "announcements", "shiurim", "minyan_overrides"] : [],
  );
  const settings = useOfflineSnapshot("settings", useSettings().data, persist);
  const minyanim = useOfflineSnapshot("minyanim", useMinyanim().data, persist);
  const categories = useOfflineSnapshot("minyan_categories", useMinyanCategories().data, persist);
  const announcements = useOfflineSnapshot("announcements", useAnnouncements().data, persist);
  const shiurim = useOfflineSnapshot("shiurim", useShiurim().data, persist);
  // Kept on the device like everything else: a screen that loses the network
  // on the morning mincha was moved must still move it.
  const overrides = useOfflineSnapshot("minyan_overrides", useMinyanOverrides().data, persist);

  const parts = [settings, minyanim, categories, announcements, shiurim, overrides];
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
      overrides: overrides.data,
      stale,
      anyLoaded,
      sync: { status: syncStatus, lastSyncedAt },
    }),
    [settings.data, minyanim.data, categories.data, announcements.data, shiurim.data, overrides.data, stale, anyLoaded, syncStatus, lastSyncedAt],
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
  | (SlideBase & { kind: "shabbat"; times: ShabbatTimes; scenes: string[]; secondsPerScene: number })
  /**
   * A screen the gabbai built in the composer: several blocks at once.
   *
   * It is a slide like any other on purpose. The rotation, the arrows on the
   * remote, the watchdog and what the admin sees all work on the list of
   * slides, so making a screen one of them means none of that has to learn
   * anything new - and it is also honest about the model, where a screen is
   * simply the unit the board turns over.
   */
  | (SlideBase & { kind: "composed"; screen: Screen; parts: ComposedPart[] });

/**
 * One block on a composed screen.
 *
 * `slide` is the content built by buildSlides, reused rather than rebuilt:
 * the rules for which minyanim show today, which notices have not expired
 * and how announcements page are hard-won and live in one place. A block with
 * no slide of its own (the zmanim, which are a panel in every layout and
 * appear in nobody's slide list) is drawn by the composed view directly.
 */
export interface ComposedPart {
  block: BlockId;
  area?: BlockArea;
  slide?: BoardSlide;
}

const ANNOUNCEMENTS_PER_PAGE = 4;

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
  // Today's exceptions, if the gabbai wrote any. Almost always empty, in
  // which case every line below resolves exactly as it did before.
  const today = overridesFor(data.overrides, now);

  if (!data.categories || data.categories.length === 0) {
    return [{ id: dayType, title: "", rows: resolveDay(minyanim, dayType, zmanim, today, now), subcategories: [] as MinyanSubcategory[] }];
  }

  // Today's tabs: a special day's own timetable (יום כיפור, צום גדליה) in place
  // of the ordinary one when the gabbai made one, else ימות החול / יום שישי /
  // שבת; tabs he made himself either way (specialDays.ts).
  const today_ = todaysCategories(data.categories, now);
  return today_.categories
    .filter(
      (c) =>
        // Taken off the board by the admin - "סליחות" after Yom Kippur, say.
        // The website still lists it; only the wall stops showing it.
        !hidden.has(`cat:${c.id}`) &&
        (today_.event !== null || c.system_key === today_.ordinaryKey || !c.system_key),
    )
    .sort((a, b) => (a.system_key ? 0 : 1) - (b.system_key ? 0 : 1) || a.sort_order - b.sort_order)
    .map((c) => ({
      id: c.id,
      title: c.name,
      subcategories: minyanSubcategories(c),
      rows: minyanim
        .filter((m) => m.active && heldOn(m, now) && (m.category_id === c.id || (!m.category_id && m.day_type === c.system_key)))
        .map((m) => resolveMinyan(m, zmanim, today.get(m.id)))
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
        // "בתוקף עד" a date means through that whole day, in Israel. Read as a
        // moment it was UTC midnight, and the notice left the wall at 03:00 of
        // its last day.
        (a) => !hidden.has(`ann:${a.id}`) && (!a.expires_at || a.expires_at.slice(0, 10) >= jerusalemDateKey(new Date(nowMs))),
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

  const built = slides.length ? slides : [{ id: "learning", kind: "learning", seconds: 30, layout: "cards" } as BoardSlide];
  return config.screens?.length ? compose(built, config) : built;
}

/**
 * The screens a gabbai built, filled with the content just worked out.
 *
 * Composing rather than building again is the whole reason this is safe to
 * turn on: which minyanim belong to today, which notices have not expired,
 * how announcements divide into pages - all of that stays in buildSlides,
 * unchanged, still covered by the tests it already had. A screen only decides
 * which of those pieces stand together and where.
 *
 * A screen whose blocks all turned out empty is dropped rather than shown:
 * on a Monday with no announcements, a screen of nothing but announcements
 * would otherwise take its turn on the wall as a blank rectangle. If that
 * leaves nothing at all, the board falls back to what it would have shown
 * before the composer existed.
 */
function compose(slides: BoardSlide[], config: TvConfig): BoardSlide[] {
  const byBlock = new Map<BlockId, BoardSlide[]>();
  for (const slide of slides) {
    const block = SLIDE_KIND_BLOCK[slide.kind];
    if (!block) continue;
    const list = byBlock.get(block);
    if (list) list.push(slide);
    else byBlock.set(block, [slide]);
  }

  const out: BoardSlide[] = [];
  for (const screen of readScreens(config)) {
    // The prayer panel carries its own zmanim in most of its layouts, so a
    // screen that also has the zmanim block would show them twice - which is
    // the exact duplication this change exists to remove, appearing in the
    // first thing it drew. `timeline` is the prayer layout without that
    // panel; the split board already used it for the same reason.
    const ownZmanim = screen.blocks.some((b) => b.block === "zmanim");
    const parts: ComposedPart[] = [];
    for (const entry of screen.blocks) {
      // The zmanim have no slide anywhere - they are a panel - so they are
      // carried as a part with no content and drawn by the composed view.
      if (entry.block === "zmanim") {
        parts.push({ block: entry.block, area: entry.area });
        continue;
      }
      for (const slide of byBlock.get(entry.block) ?? [])
        parts.push({
          block: entry.block,
          area: entry.area,
          slide:
            ownZmanim && slide.kind === "prayer" && slide.layout !== "timeline"
              ? { ...slide, layout: "timeline" }
              : slide,
        });
    }
    // Bars are drawn by the board around the slide, not inside it.
    const body = parts.filter((p) => p.slide || p.block === "zmanim");
    if (!body.length) continue;
    out.push({
      id: `screen:${screen.id}`,
      kind: "composed",
      seconds: screen.seconds > 0 ? screen.seconds : 3600,
      layout: "composed",
      screen,
      parts: body,
    });
  }
  return out.length ? out : slides;
}

/** Which block each kind of built slide belongs to. */
const SLIDE_KIND_BLOCK: Partial<Record<BoardSlide["kind"], BlockId>> = {
  prayer: "prayers",
  learning: "learning",
  announcements: "announcements",
  shiurim: "shiurim",
  slideshow: "slideshow",
};

/** The rows a composed screen lays its parts out in. */
export function composedRows(parts: ComposedPart[]): ComposedPart[][] {
  const entries = parts.map((p) => ({ block: p.block, area: p.area }));
  const rows = place(entries);
  const taken = new Set<ComposedPart>();
  return rows.map((row) =>
    row.map((e) => {
      // Several parts can share a block (two prayer schedules, paged
      // announcements); each row slot takes the next one not yet placed.
      const found = parts.find((p) => p.block === e.block && p.area === e.area && !taken.has(p));
      const part = found ?? parts.find((p) => p.block === e.block)!;
      taken.add(part);
      return part;
    }),
  );
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
