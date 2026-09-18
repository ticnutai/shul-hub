import type { SolarEvent } from "@community/lib/zmanim";
import { TV_FONTS, TV_THEMES, type TvFontId, type TvThemeId } from "./themes";

/**
 * Everything an admin can change about the board, in one JSON document.
 *
 * Stored as a single row (tv_config) so a change is one realtime event and
 * the TV never sees half an update. `normalizeTvConfig` is deliberately
 * forgiving: a value written by a newer admin build, a removed option, or a
 * hand-edited row must still produce a working board, never a blank screen.
 */

export type SlideKind = "prayer" | "learning" | "announcements" | "shiurim" | "slideshow";

export const SLIDE_KIND_LABELS: Record<SlideKind, string> = {
  prayer: "זמני תפילות",
  learning: "לימוד יומי ולוח שנה",
  announcements: "מודעות",
  shiurim: "שיעורים",
  slideshow: "מצגת תמונות",
};

export const SLIDE_LAYOUTS: Record<SlideKind, Array<{ id: string; label: string }>> = {
  prayer: [
    { id: "split", label: "מניינים + זמני היום" },
    { id: "next", label: "המניין הבא בגדול" },
    { id: "timeline", label: "ציר זמן" },
  ],
  learning: [
    { id: "cards", label: "כרטיסים" },
    { id: "hero", label: "פרשה בגדול" },
  ],
  announcements: [
    { id: "grid", label: "רשת (עד 4)" },
    { id: "spotlight", label: "אחת בכל פעם, בגדול" },
  ],
  shiurim: [
    { id: "list", label: "רשימה" },
    { id: "cards", label: "כרטיסים" },
  ],
  slideshow: [
    { id: "fade", label: "מעבר רך" },
    { id: "kenburns", label: "תנועה איטית (קן ברנס)" },
  ],
};

export interface TvSlideConfig {
  kind: SlideKind;
  enabled: boolean;
  seconds: number;
  layout: string;
}

export type AlertEvent = Extract<SolarEvent, "sof_zman_shma" | "sof_zman_tefila" | "sunset" | "candle">;

export const ALERT_EVENT_LABELS: Record<AlertEvent, string> = {
  sof_zman_shma: "סוף זמן קריאת שמע",
  sof_zman_tefila: "סוף זמן תפילה",
  sunset: "שקיעה",
  candle: "הדלקת נרות (בערב שבת)",
};

export interface TvConfig {
  theme: TvThemeId;
  font: TvFontId;
  textScale: number;
  /** Live-editor colour overrides on top of the theme (CSS var -> colour). */
  themeOverrides: Record<string, string>;
  backgroundImage: string | null;
  backgroundDim: number;
  slides: TvSlideConfig[];
  header: { parasha: boolean; dafYomi: boolean };
  alerts: {
    enabled: boolean;
    events: AlertEvent[];
    /** Pop the reminder this many minutes before, e.g. [30, 15, 5]. */
    leadMinutes: number[];
    /** How long each reminder stays on screen. */
    popupSeconds: number;
  };
  ticker: { enabled: boolean; text: string };
  slideshow: { images: Array<{ url: string; caption?: string }>; secondsPerImage: number };
}

export const DEFAULT_TV_CONFIG: TvConfig = {
  theme: "navy",
  font: "classic",
  textScale: 1,
  themeOverrides: {},
  backgroundImage: null,
  backgroundDim: 0.55,
  slides: [
    { kind: "prayer", enabled: true, seconds: 20, layout: "split" },
    { kind: "learning", enabled: true, seconds: 15, layout: "cards" },
    { kind: "announcements", enabled: true, seconds: 18, layout: "grid" },
    { kind: "shiurim", enabled: true, seconds: 18, layout: "list" },
    { kind: "slideshow", enabled: false, seconds: 30, layout: "kenburns" },
  ],
  header: { parasha: true, dafYomi: true },
  alerts: {
    enabled: true,
    events: ["sof_zman_shma", "sof_zman_tefila", "sunset", "candle"],
    leadMinutes: [30, 15, 5],
    popupSeconds: 40,
  },
  ticker: { enabled: false, text: "" },
  slideshow: { images: [], secondsPerImage: 8 },
};

const KINDS = Object.keys(SLIDE_LAYOUTS) as SlideKind[];
const ALERT_EVENTS = Object.keys(ALERT_EVENT_LABELS) as AlertEvent[];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const str = (v: unknown, fallback: string, max = 500) => (typeof v === "string" ? v.slice(0, max) : fallback);

export function normalizeTvConfig(raw: unknown): TvConfig {
  const d = DEFAULT_TV_CONFIG;
  if (!isObj(raw)) return structuredClone(d);

  const theme = TV_THEMES.some((t) => t.id === raw.theme) ? (raw.theme as TvThemeId) : d.theme;
  const font = TV_FONTS.some((f) => f.id === raw.font) ? (raw.font as TvFontId) : d.font;

  // Slides: keep the admin's order, drop unknown kinds, append any kind a newer
  // default introduced so it can be switched on without a data migration.
  const seen = new Set<SlideKind>();
  const slides: TvSlideConfig[] = [];
  for (const s of Array.isArray(raw.slides) ? raw.slides : []) {
    if (!isObj(s) || !KINDS.includes(s.kind as SlideKind) || seen.has(s.kind as SlideKind)) continue;
    const kind = s.kind as SlideKind;
    const def = d.slides.find((x) => x.kind === kind)!;
    seen.add(kind);
    slides.push({
      kind,
      enabled: bool(s.enabled, def.enabled),
      seconds: num(s.seconds, def.seconds, 5, 300),
      layout: SLIDE_LAYOUTS[kind].some((l) => l.id === s.layout) ? String(s.layout) : def.layout,
    });
  }
  for (const def of d.slides) if (!seen.has(def.kind)) slides.push({ ...def });

  const overrides: Record<string, string> = {};
  if (isObj(raw.themeOverrides))
    for (const [k, v] of Object.entries(raw.themeOverrides)) if (typeof v === "string") overrides[k] = v.slice(0, 60);

  const header = isObj(raw.header) ? raw.header : {};
  const alerts = isObj(raw.alerts) ? raw.alerts : {};
  const ticker = isObj(raw.ticker) ? raw.ticker : {};
  const slideshow = isObj(raw.slideshow) ? raw.slideshow : {};

  const leads = Array.isArray(alerts.leadMinutes)
    ? [...new Set(alerts.leadMinutes.filter((n): n is number => typeof n === "number" && n >= 1 && n <= 180))]
        .sort((a, b) => b - a)
        .slice(0, 5)
    : d.alerts.leadMinutes;

  return {
    theme,
    font,
    textScale: num(raw.textScale, d.textScale, 0.8, 1.3),
    themeOverrides: overrides,
    backgroundImage: typeof raw.backgroundImage === "string" && raw.backgroundImage.startsWith("https://") ? raw.backgroundImage : null,
    backgroundDim: num(raw.backgroundDim, d.backgroundDim, 0, 0.95),
    slides,
    header: { parasha: bool(header.parasha, d.header.parasha), dafYomi: bool(header.dafYomi, d.header.dafYomi) },
    alerts: {
      enabled: bool(alerts.enabled, d.alerts.enabled),
      events: Array.isArray(alerts.events)
        ? alerts.events.filter((e): e is AlertEvent => ALERT_EVENTS.includes(e as AlertEvent))
        : d.alerts.events,
      leadMinutes: leads.length ? leads : d.alerts.leadMinutes,
      popupSeconds: num(alerts.popupSeconds, d.alerts.popupSeconds, 10, 300),
    },
    ticker: { enabled: bool(ticker.enabled, d.ticker.enabled), text: str(ticker.text, "", 400) },
    slideshow: {
      images: (Array.isArray(slideshow.images) ? slideshow.images : [])
        .filter((i): i is Record<string, unknown> => isObj(i) && typeof i.url === "string" && i.url.startsWith("https://"))
        .slice(0, 40)
        .map((i) => ({ url: String(i.url), caption: typeof i.caption === "string" ? i.caption.slice(0, 120) : undefined })),
      secondsPerImage: num(slideshow.secondsPerImage, d.slideshow.secondsPerImage, 3, 60),
    },
  };
}
