import type { SolarEvent } from "@community/lib/zmanim";
import { DEVICE_CLASSES, type DeviceClass } from "./devices";
import {
  CUSTOM_GRADIENT_ID_RE,
  CUSTOM_THEME_ID_RE,
  isSafeFill,
  isSafeGradient,
  type TvGradient,
  isSafeCssValue,
  THEME_VARS,
  TV_FONTS,
  TV_THEMES,
  type ThemeVar,
  type TvFontId,
  type TvTheme,
} from "./themes";

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

/**
 * Per-element look, set by clicking the element in the editor: text size,
 * colour and a nudge from its natural place. The nudge is in percent of the
 * screen (cqw / cqh), so it lands in the same relative spot on a TV, a
 * laptop or a phone.
 */
export interface ElementStyle {
  /** Text size multiplier, 0.5-2. */
  scale?: number;
  /** A safe colour (hex / rgb / hsl). */
  color?: string;
  /** Background colour behind the element (safe colour). */
  bg?: string;
  /** Font weight, 300-900. */
  weight?: number;
  /** 0.15-1. */
  opacity?: number;
  /**
   * Which themes this styling applies in. Absent = every theme (the default:
   * one change is meant to hold everywhere). A theme id = only while that
   * theme is the one on screen.
   */
  theme?: string;
  /** Offset in percent of the screen width / height, -50..50. */
  x?: number;
  y?: number;
}

/**
 * How the whole screen is arranged:
 *   rotate     one slide at a time, full width (the original board)
 *   split      a fixed side column (next minyan + zmanim) beside the slides
 *   dashboard  everything at once, no rotation - prayer times, a large clock,
 *              zmanim, an announcement and lessons, with a strip at the bottom
 */
export type ScreenLayout = "rotate" | "split" | "dashboard";
export const SCREEN_LAYOUTS: ScreenLayout[] = ["rotate", "split", "dashboard"];
export type ClockStyle = "digital" | "analog" | "both";

/**
 * The decorative dress of the board: how panels are framed, over whatever
 * theme is chosen. Inspired by the printed synagogue boards - gold frames,
 * stone tablets, parchment - and drawn entirely in CSS, so it stays sharp at
 * any size and costs the TV nothing.
 */
export type BoardSkin =
  | "plain"
  | "gold"
  | "tablets"
  | "parchment"
  | "velvet"
  | "pillars"
  | "curtain"
  | "sky"
  | "wood"
  | "arch"
  | "hall"
  | "crown"
  | "heichal"
  | "dome"
  | "stone"
  | "medallion"
  | "printed";
export const BOARD_SKINS: BoardSkin[] = [
  "plain",
  "gold",
  "tablets",
  "parchment",
  "velvet",
  "pillars",
  "curtain",
  "sky",
  "wood",
  "arch",
  "hall",
  "crown",
  "heichal",
  "dome",
  "stone",
  "medallion",
  "printed",
];
export const CLOCK_STYLES: ClockStyle[] = ["digital", "analog", "both"];

/**
 * The shape of a panel's corners, over and above how round they are.
 *
 * "auto" leaves the skin's own silhouette alone - an arch stays an arch, a
 * dome stays a dome. Anything else replaces it on every panel of every skin:
 * a plain round corner, a squircle (the corner of a phone icon), a cut
 * corner, a corner scooped inwards, or a notch. They are CSS corner-shape
 * values; a browser without it still gets the roundness.
 */
export type FrameShape = "auto" | "round" | "squircle" | "bevel" | "scoop" | "notch";
export const FRAME_SHAPES: FrameShape[] = ["auto", "round", "squircle", "bevel", "scoop", "notch"];

/** What each shape is in CSS. */
export const CORNER_SHAPE: Record<Exclude<FrameShape, "auto">, string> = {
  round: "round",
  squircle: "superellipse(2)",
  bevel: "bevel",
  scoop: "scoop",
  notch: "notch",
};

/** How round a corner may be set to, in --u units. */
export const FRAME_RADIUS_MAX = 12;

/**
 * The air around the panels, in --u units (1 = one percent of the board's
 * height). Less air means taller panels and another row of times; more means
 * a calmer board. null leaves it to the layout and the style, which is what
 * every board had before this existed.
 */
export const SPACING_MAX = 10;
export const SPACING_EDGES = ["top", "sides", "gap"] as const;
export type SpacingEdge = (typeof SPACING_EDGES)[number];

/**
 * How a ready-made background is written down: "backdrop:<id>".
 *
 * The rule lives here, with the validation that uses it, and not beside the
 * pictures - this module must not reach an image import. Everything that
 * loads a board loads this file, including the end-to-end tests, whose
 * transpiler reads a .jpg as JavaScript and stops at the first byte.
 */
export const BACKDROP_PREFIX = "backdrop:";

export function isBackdropRef(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(BACKDROP_PREFIX);
}

/**
 * The parts of a board one kind of screen may do differently.
 *
 * Deliberately not everything. The list of saved themes, the gradients in
 * the library, the Shabbat pictures, which slides exist - those are the
 * shul's, not a screen's, and letting them differ per screen would be three
 * libraries to keep in step for no gain. What is here is what somebody
 * actually stands in front of a screen and wants changed for that screen.
 */
export interface DeviceOverlay {
  screenLayout?: ScreenLayout;
  clockStyle?: ClockStyle;
  skin?: BoardSkin;
  frame?: TvConfig["frame"];
  spacing?: TvConfig["spacing"];
  theme?: string;
  themeOverrides?: Record<string, string>;
  backgroundGradient?: string | null;
  backgroundImage?: string | null;
  backgroundDim?: number;
  font?: TvFontId;
  textScale?: number;
  tracking?: number | null;
  countdown?: TvConfig["countdown"];
  texts?: Record<string, string>;
  hidden?: string[];
  flipped?: FlipArea[];
  styles?: Record<string, ElementStyle>;
  header?: TvConfig["header"];
  ticker?: TvConfig["ticker"];
}

export interface TvConfig {
  screenLayout: ScreenLayout;
  clockStyle: ClockStyle;
  skin: BoardSkin;
  /**
   * The corners of every panel, when the admin wants to decide instead of
   * the skin. `top`/`bottom` are in --u units; null means "as the skin
   * draws it", and setting either one also drops the skin's own silhouette
   * (a clipped dome cannot show a corner radius).
   */
  frame: { shape: FrameShape; top: number | null; bottom: number | null };
  /**
   * `top`: between the header strip and the panels. `sides`: the margin at
   * the edges of the board. `gap`: between one panel and the next. null =
   * as the layout and the style draw it.
   */
  spacing: Record<SpacingEdge, number | null>;
  /** A built-in theme id, or the id of one of `customThemes`. */
  theme: string;
  /** Themes the admin saved (from a built-in plus colour edits). */
  customThemes: TvTheme[];
  /** Whole looks the admin saved or imported: a theme plus style, corners, spacing, font… (see TvLook). */
  customLooks: TvLook[];
  /** Gradients the admin saved, offered anywhere a background is chosen. */
  gradients: TvGradient[];
  /** A gradient behind the whole board; null = the theme's own background. */
  backgroundGradient: string | null;
  font: TvFontId;
  textScale: number;
  /**
   * How far apart the letters of a title are set, in em. null = as the skin
   * draws it, which is how every board reads until somebody moves this.
   *
   * It is here rather than inside a skin because it is the cheapest
   * hierarchy there is: a Hebrew title set wide reads as a title without
   * being bigger or louder, so it buys separation without spending
   * contrast - and contrast is the whole budget on a wall seen from thirty
   * metres. Titles only; body text set wide stops being readable at speed.
   */
  tracking: number | null;
  /** Live-editor colour overrides on top of the theme (CSS var -> colour). */
  themeOverrides: Record<string, string>;
  backgroundImage: string | null;
  backgroundDim: number;
  slides: TvSlideConfig[];
  /** Header extras. `logo`: the קרובים logo beside the synagogue name. */
  header: { parasha: boolean; dafYomi: boolean; logo: boolean };
  alerts: {
    enabled: boolean;
    events: AlertEvent[];
    /** Pop the reminder this many minutes before, e.g. [30, 15, 5]. */
    leadMinutes: number[];
    /** How long each reminder stays on screen. */
    popupSeconds: number;
  };
  ticker: { enabled: boolean; text: string };
  /**
   * A live count to the next minyan, under the prayer times.
   *
   * Off unless it is switched on: a board that has run for months without it
   * keeps looking exactly as it did. What it adds is the one question a
   * person crossing the hall actually has - not "when is mincha" but "have I
   * missed it" - and a number that moves answers that faster than a time
   * they have to subtract from a clock.
   */
  countdown: { enabled: boolean };
  /**
   * The Shabbat screen: from candle lighting on Friday until the end of
   * Shabbat the board shows only it (see shabbat.ts).
   */
  shabbat: {
    enabled: boolean;
    endMinutesAfterSunset: number;
    /**
     * The pictures to show, in order: "art:<id>" for a built-in drawing
     * (ShabbatScene.SHABBAT_ART) or an https URL of an uploaded photo.
     * Never empty.
     */
    scenes: string[];
    /** Photos the admin uploaded for Shabbat (https URLs), selectable in `scenes`. */
    photos: string[];
    /** Rotate through `scenes`; otherwise only the first one is shown. */
    rotate: boolean;
    secondsPerScene: number;
  };
  slideshow: { images: Array<{ url: string; caption?: string }>; secondsPerImage: number };
  /**
   * Board-only wording, keyed by element (see EDITABLE in boardEdit.tsx):
   * "header.title" -> "בית הכנסת ...". A missing key shows the default text.
   */
  texts: Record<string, string>;
  /** Elements taken off the board: element keys, or "ann:<id>", "shiur:<id>", "minyan:<id>". */
  hidden: string[];
  /** Areas drawn mirror-wise (clock on the other side, panels swapped). */
  flipped: FlipArea[];
  /** Per-element look, keyed like `texts` (see ElementStyle). */
  styles: Record<string, ElementStyle>;
  /**
   * What each kind of screen does differently; see devices.ts.
   *
   * Absent or empty means "the same as everywhere else", which is what
   * every board is until somebody deliberately changes one screen. So the
   * ordinary edit stays one edit, applying to the wall, the laptop and the
   * phone at once, and only what is genuinely different is stored twice.
   */
  perDevice: Partial<Record<DeviceClass, DeviceOverlay>>;
  /**
   * Editor only, never stored: content edits (an announcement's text, a
   * minyan's name...) waiting for "שמור ושדר". normalizeTvConfig drops it.
   */
  _records?: RecordEdit[];
}

/* ---------------------------------------------------------------- looks -- */

/**
 * A look: everything that makes the board look the way it does, under one
 * name. A theme is only the colours; a look is the colours *and* the style
 * (marble, velvet, Jerusalem stone…), the shape of the corners, the air
 * around the panels, the font, the background and the clock - what a
 * designer actually means by "a design".
 *
 * A look is a choice among parts the board already has. That is what makes
 * it safe to import from anyone: it can pick "stone", it cannot bring a new
 * stone. New materials and shapes are code (docs/NEW_SKIN_SPEC.md).
 *
 * `board` holds only what the look sets. Applying it overwrites those keys
 * and leaves the rest of the board as it is; a look saved from the board
 * sets all of them, so it comes back exactly.
 */
export const LOOK_KEYS = [
  "skin",
  "frame",
  "spacing",
  "font",
  "textScale",
  "tracking",
  "backgroundGradient",
  "backgroundImage",
  "backgroundDim",
  "clockStyle",
  "screenLayout",
] as const;
export type LookKey = (typeof LOOK_KEYS)[number];
export type LookBoard = Partial<Pick<TvConfig, LookKey>>;

export interface TvLook {
  /** "l_<random>" */
  id: string;
  name: string;
  description: string;
  /** A built-in theme id, or one of `customThemes`. */
  theme: string;
  board: LookBoard;
}

export const CUSTOM_LOOK_ID_RE = /^l_[a-z0-9]{4,24}$/;
export const MAX_LOOKS = 24;

export function newLookId(): string {
  return `l_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The parts of a look, validated by the one normaliser every board goes
 * through. Only keys the input actually has come back, so a partial look
 * stays partial instead of quietly resetting the rest to defaults.
 */
export function normalizeLookBoard(raw: unknown): LookBoard {
  if (!isObj(raw)) return {};
  const present = LOOK_KEYS.filter((k) => raw[k] !== undefined);
  const full = normalizeTvConfig(Object.fromEntries(present.map((k) => [k, raw[k]])));
  return Object.fromEntries(present.map((k) => [k, full[k]])) as LookBoard;
}

function normalizeLooks(raw: unknown, themeIds: string[]): TvLook[] {
  if (!Array.isArray(raw)) return [];
  const out: TvLook[] = [];
  const seen = new Set<string>();
  for (const l of raw) {
    if (!isObj(l) || typeof l.id !== "string" || !CUSTOM_LOOK_ID_RE.test(l.id) || seen.has(l.id)) continue;
    const name = str(l.name, "", 40).trim();
    if (!name) continue;
    seen.add(l.id);
    out.push({
      id: l.id,
      name,
      description: str(l.description, "", 80),
      // A look outlives the theme it was made with: if that theme is deleted
      // the look falls back to the default colours rather than disappearing.
      theme: typeof l.theme === "string" && themeIds.includes(l.theme) ? l.theme : "navy",
      board: normalizeLookBoard(l.board),
    });
    if (out.length >= MAX_LOOKS) break;
  }
  return out;
}

/** The board as it looks now, as a look. */
export function lookFromConfig(c: TvConfig, name: string, description = ""): TvLook {
  const board = Object.fromEntries(LOOK_KEYS.map((k) => [k, structuredClone(c[k])])) as LookBoard;
  return { id: newLookId(), name: name.trim().slice(0, 40) || "מראה", description: description.slice(0, 80), theme: c.theme, board };
}

/** Puts a look on the board. Colour tweaks on top of the old theme go with it. */
export function applyLook(c: TvConfig, look: TvLook): TvConfig {
  const themeExists = TV_THEMES.some((t) => t.id === look.theme) || c.customThemes.some((t) => t.id === look.theme);
  return {
    ...c,
    ...structuredClone(look.board),
    theme: themeExists ? look.theme : c.theme,
    themeOverrides: {},
  };
}

export const FLIP_AREAS = ["header", "prayer", "learning"] as const;
export type FlipArea = (typeof FLIP_AREAS)[number];

export type RecordTable = "announcements" | "shiurim" | "minyanim" | "settings";
export type RecordEdit =
  | { table: RecordTable; id: string; field: string; value: string | number }
  | { table: "announcements"; id: string; delete: true };

export const DEFAULT_TV_CONFIG: TvConfig = {
  perDevice: {},
  theme: "navy",
  font: "classic",
  textScale: 1,
  tracking: null,
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
  header: { parasha: true, dafYomi: true, logo: true },
  alerts: {
    enabled: true,
    events: ["sof_zman_shma", "sof_zman_tefila", "sunset", "candle"],
    leadMinutes: [30, 15, 5],
    popupSeconds: 40,
  },
  ticker: { enabled: false, text: "" },
  countdown: { enabled: false },
  shabbat: { enabled: true, endMinutesAfterSunset: 40, scenes: ["art:classic"], photos: [], rotate: false, secondsPerScene: 60 },
  slideshow: { images: [], secondsPerImage: 8 },
  texts: {},
  hidden: [],
  flipped: [],
  customThemes: [],
  customLooks: [],
  gradients: [],
  backgroundGradient: null,
  styles: {},
  screenLayout: "rotate",
  clockStyle: "digital",
  frame: { shape: "auto", top: null, bottom: null },
  spacing: { top: null, sides: null, gap: null },
  skin: "plain",
};

const KINDS = Object.keys(SLIDE_LAYOUTS) as SlideKind[];
const ALERT_EVENTS = Object.keys(ALERT_EVENT_LABELS) as AlertEvent[];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const str = (v: unknown, fallback: string, max = 500) => (typeof v === "string" ? v.slice(0, max) : fallback);
/** Element keys: letters, digits and . : _ - only (ids are UUIDs). */
const KEY_RE = /^[a-z0-9_.:-]{1,90}$/i;

function normalizeCustomThemes(raw: unknown): TvTheme[] {
  if (!Array.isArray(raw)) return [];
  const out: TvTheme[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    if (!isObj(t) || typeof t.id !== "string" || !CUSTOM_THEME_ID_RE.test(t.id) || seen.has(t.id)) continue;
    if (!isObj(t.vars)) continue;
    const vars = {} as Record<ThemeVar, string>;
    let complete = true;
    for (const v of THEME_VARS) {
      const value = t.vars[v];
      if (typeof value === "string" && isSafeCssValue(value)) vars[v] = value.trim();
      else complete = false;
    }
    if (!complete) continue;
    seen.add(t.id);
    out.push({
      id: t.id,
      name: str(t.name, "ערכה מותאמת", 40).trim() || "ערכה מותאמת",
      description: str(t.description, "", 80),
      light: bool(t.light, false),
      vars,
    });
    if (out.length >= 24) break;
  }
  return out;
}

/** Built-in Shabbat drawings (ids of ShabbatScene.SHABBAT_ART). */
export const SHABBAT_ART_IDS = ["classic", "kiddush", "jerusalem", "candles"] as const;

function normalizeShabbatScenes(raw: unknown): string[] {
  const out: string[] = [];
  for (const s of Array.isArray(raw) ? raw : []) {
    if (typeof s !== "string" || out.includes(s)) continue;
    const art = s.startsWith("art:") && (SHABBAT_ART_IDS as readonly string[]).includes(s.slice(4));
    const photo = /^https:\/\/[^\s"'()<>]+$/i.test(s) && s.length <= 600;
    if (art || photo) out.push(s);
    if (out.length >= 30) break;
  }
  return out.length ? out : ["art:classic"];
}

export function normalizeGradients(raw: unknown): TvGradient[] {
  const out: TvGradient[] = [];
  const seen = new Set<string>();
  for (const g of Array.isArray(raw) ? raw : []) {
    if (!isObj(g) || typeof g.id !== "string" || !CUSTOM_GRADIENT_ID_RE.test(g.id) || seen.has(g.id)) continue;
    if (typeof g.value !== "string" || !isSafeGradient(g.value)) continue;
    const name = str(g.name, "", 40).trim();
    if (!name) continue;
    seen.add(g.id);
    out.push({ id: g.id, name, value: g.value.trim() });
    if (out.length >= 40) break;
  }
  return out;
}

export function normalizeElementStyle(raw: unknown, themes?: string[]): ElementStyle | null {
  if (!isObj(raw)) return null;
  const s: ElementStyle = {};
  if (typeof raw.scale === "number" && Number.isFinite(raw.scale) && raw.scale !== 1) s.scale = Math.min(2, Math.max(0.5, raw.scale));
  if (typeof raw.color === "string" && isSafeCssValue(raw.color)) s.color = raw.color.trim();
  if (typeof raw.bg === "string" && isSafeFill(raw.bg)) s.bg = raw.bg.trim();
  if (typeof raw.weight === "number" && Number.isFinite(raw.weight)) s.weight = Math.round(Math.min(900, Math.max(300, raw.weight)) / 100) * 100;
  if (typeof raw.opacity === "number" && Number.isFinite(raw.opacity) && raw.opacity < 1) s.opacity = Math.round(Math.min(1, Math.max(0.15, raw.opacity)) * 100) / 100;
  if (typeof raw.theme === "string" && raw.theme && (!themes || themes.includes(raw.theme))) s.theme = raw.theme;
  if (typeof raw.x === "number" && Number.isFinite(raw.x) && raw.x !== 0) s.x = Math.min(50, Math.max(-50, Math.round(raw.x * 10) / 10));
  if (typeof raw.y === "number" && Number.isFinite(raw.y) && raw.y !== 0) s.y = Math.min(50, Math.max(-50, Math.round(raw.y * 10) / 10));
  return Object.keys(s).length ? s : null;
}

function normalizeStyles(raw: unknown, themes: string[]): Record<string, ElementStyle> {
  const out: Record<string, ElementStyle> = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw).slice(0, 200)) {
    // Keys are either one element ("header.title") or a family of them
    // ("kind:minyan" - every minyan row); both match KEY_RE.
    const s = KEY_RE.test(k) ? normalizeElementStyle(v, themes) : null;
    if (s) out[k] = s;
  }
  return out;
}

/** A corner setting from storage: unknown shapes and silly sizes are dropped. */
function normalizeFrame(raw: unknown, fallback: TvConfig["frame"]): TvConfig["frame"] {
  const r = (raw ?? {}) as Record<string, unknown>;
  const size = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, 0), FRAME_RADIUS_MAX) : null;
  return {
    shape: FRAME_SHAPES.includes(r.shape as FrameShape) ? (r.shape as FrameShape) : fallback.shape,
    top: size(r.top),
    bottom: size(r.bottom),
  };
}

/** Spacing from storage: only numbers, and only sane ones. */
function normalizeSpacing(raw: unknown): TvConfig["spacing"] {
  const r = (raw ?? {}) as Record<string, unknown>;
  const size = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, 0), SPACING_MAX) : null;
  return { top: size(r.top), sides: size(r.sides), gap: size(r.gap) };
}

export function normalizeTvConfig(raw: unknown): TvConfig {
  const d = DEFAULT_TV_CONFIG;
  if (!isObj(raw)) return structuredClone(d);

  const customThemes = normalizeCustomThemes(raw.customThemes);
  const theme =
    TV_THEMES.some((t) => t.id === raw.theme) || customThemes.some((t) => t.id === raw.theme) ? String(raw.theme) : d.theme;
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
  const countdown = isObj(raw.countdown) ? raw.countdown : {};
  const shabbat = isObj(raw.shabbat) ? raw.shabbat : {};
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
    tracking: raw.tracking === null || raw.tracking === undefined ? null : num(raw.tracking, 0, 0, 0.3),
    themeOverrides: overrides,
    // An uploaded picture, or one of the ready-made backdrops by name
    // (see backdrops.ts - stored by name so a rebuild cannot break it).
    backgroundImage:
      typeof raw.backgroundImage === "string" &&
      (raw.backgroundImage.startsWith("https://") || isBackdropRef(raw.backgroundImage))
        ? raw.backgroundImage
        : null,
    backgroundDim: num(raw.backgroundDim, d.backgroundDim, 0, 0.95),
    slides,
    header: {
      parasha: bool(header.parasha, d.header.parasha),
      dafYomi: bool(header.dafYomi, d.header.dafYomi),
      logo: bool(header.logo, d.header.logo),
    },
    alerts: {
      enabled: bool(alerts.enabled, d.alerts.enabled),
      events: Array.isArray(alerts.events)
        ? alerts.events.filter((e): e is AlertEvent => ALERT_EVENTS.includes(e as AlertEvent))
        : d.alerts.events,
      leadMinutes: leads.length ? leads : d.alerts.leadMinutes,
      popupSeconds: num(alerts.popupSeconds, d.alerts.popupSeconds, 10, 300),
    },
    ticker: { enabled: bool(ticker.enabled, d.ticker.enabled), text: str(ticker.text, "", 400) },
    countdown: { enabled: bool(countdown.enabled, d.countdown.enabled) },
    shabbat: {
      enabled: bool(shabbat.enabled, d.shabbat.enabled),
      endMinutesAfterSunset: Math.round(num(shabbat.endMinutesAfterSunset, d.shabbat.endMinutesAfterSunset, 18, 90)),
      scenes: normalizeShabbatScenes(shabbat.scenes),
      photos: normalizeShabbatScenes(shabbat.photos).filter((s) => !s.startsWith("art:")),
      rotate: bool(shabbat.rotate, d.shabbat.rotate),
      secondsPerScene: Math.round(num(shabbat.secondsPerScene, d.shabbat.secondsPerScene, 10, 3600)),
    },
    slideshow: {
      images: (Array.isArray(slideshow.images) ? slideshow.images : [])
        .filter((i): i is Record<string, unknown> => isObj(i) && typeof i.url === "string" && i.url.startsWith("https://"))
        .slice(0, 40)
        .map((i) => ({ url: String(i.url), caption: typeof i.caption === "string" ? i.caption.slice(0, 120) : undefined })),
      secondsPerImage: num(slideshow.secondsPerImage, d.slideshow.secondsPerImage, 3, 60),
    },
    texts: Object.fromEntries(
      Object.entries(isObj(raw.texts) ? raw.texts : {})
        .filter((e): e is [string, string] => KEY_RE.test(e[0]) && typeof e[1] === "string")
        .slice(0, 200)
        .map(([k, v]) => [k, v.slice(0, 300)]),
    ),
    hidden: [...new Set((Array.isArray(raw.hidden) ? raw.hidden : []).filter((k): k is string => typeof k === "string" && KEY_RE.test(k)))].slice(0, 300),
    flipped: FLIP_AREAS.filter((a) => Array.isArray(raw.flipped) && raw.flipped.includes(a)),
    customThemes,
    customLooks: normalizeLooks(raw.customLooks, [...TV_THEMES.map((t) => t.id), ...customThemes.map((t) => t.id)]),
    gradients: normalizeGradients(raw.gradients),
    backgroundGradient: typeof raw.backgroundGradient === "string" && isSafeGradient(raw.backgroundGradient) ? raw.backgroundGradient.trim() : null,
    styles: normalizeStyles(raw.styles, [...TV_THEMES.map((t) => t.id), ...customThemes.map((t) => t.id)]),
    screenLayout: SCREEN_LAYOUTS.includes(raw.screenLayout as ScreenLayout) ? (raw.screenLayout as ScreenLayout) : d.screenLayout,
    clockStyle: CLOCK_STYLES.includes(raw.clockStyle as ClockStyle) ? (raw.clockStyle as ClockStyle) : d.clockStyle,
    skin: BOARD_SKINS.includes(raw.skin as BoardSkin) ? (raw.skin as BoardSkin) : d.skin,
    frame: normalizeFrame(raw.frame, d.frame),
    spacing: normalizeSpacing(raw.spacing),
    perDevice: normalizePerDevice(raw.perDevice),
  };
}

/**
 * The per-screen overlays, kept only where they say something.
 *
 * An overlay with nothing in it is dropped rather than stored, so that
 * "does this screen differ" is answerable by looking, and a board nobody
 * has customised per screen carries no trace of the feature at all.
 */
function normalizePerDevice(raw: unknown): TvConfig["perDevice"] {
  if (!isObj(raw)) return {};
  const out: TvConfig["perDevice"] = {};
  for (const device of DEVICE_CLASSES) {
    const layer = raw[device];
    if (!isObj(layer)) continue;
    const kept: DeviceOverlay = {};
    for (const [k, v] of Object.entries(layer)) {
      if (v === undefined) continue;
      if (!(k in DEVICE_OVERLAY_KEYS)) continue;
      (kept as Record<string, unknown>)[k] = v;
    }
    if (Object.keys(kept).length > 0) out[device] = kept;
  }
  return out;
}

/** Guards normalizePerDevice against a stray key from an older board. */
const DEVICE_OVERLAY_KEYS: Record<keyof DeviceOverlay, true> = {
  screenLayout: true, clockStyle: true, skin: true, frame: true, spacing: true,
  theme: true, themeOverrides: true, backgroundGradient: true, backgroundImage: true,
  backgroundDim: true, font: true, textScale: true, tracking: true, texts: true, hidden: true,
  flipped: true, styles: true, header: true, ticker: true, countdown: true,
};

/**
 * The board as one kind of screen sees it: the shared settings, with that
 * screen's differences laid over them.
 *
 * The result is an ordinary TvConfig, which is the point - everything
 * downstream (the board, the themes, the styles, the editor's preview)
 * carries on knowing nothing about screens.
 *
 * Two merge rules, and the difference between them matters:
 *
 *   The things keyed by element - the wording, the per-element styling,
 *   the colour overrides - merge key by key. "A shorter title on a phone"
 *   should change that one title and leave everything else following the
 *   board, and deleting the key puts it back.
 *
 *   Everything else replaces wholesale, including the lists of what is
 *   hidden and what is flipped. A list cannot merge: if the board hides a
 *   panel and this screen wants it back, no union of two lists can say so.
 *   The editor writes the whole list, so this stays invisible.
 */
export function configForDevice(config: TvConfig, device: DeviceClass | null): TvConfig {
  const layer = device ? config.perDevice?.[device] : undefined;
  if (!layer || Object.keys(layer).length === 0) return config;
  const { texts, styles, themeOverrides, ...rest } = layer;
  return {
    ...config,
    ...rest,
    texts: texts ? { ...config.texts, ...texts } : config.texts,
    styles: styles ? { ...config.styles, ...styles } : config.styles,
    themeOverrides: themeOverrides
      ? { ...config.themeOverrides, ...themeOverrides }
      : config.themeOverrides,
  };
}

/** Does this screen differ from the board at all? */
export function deviceHasOverrides(config: TvConfig, device: DeviceClass): boolean {
  return Object.keys(config.perDevice?.[device] ?? {}).length > 0;
}

/**
 * Makes an edit apply to one screen instead of to the board.
 *
 * The editor is full of functions of the shape (config) => config: pick a
 * theme, hide a panel, retype a title. None of them know that screens
 * exist and none of them should have to. So the edit is run against the
 * board as that screen sees it, and what came out different is kept as
 * that screen's overlay.
 *
 * That means a new control added to the editor next year can be scoped to
 * one screen without anybody remembering to make it so.
 */
export function editForDevice(
  config: TvConfig,
  device: DeviceClass | null,
  edit: (c: TvConfig) => TvConfig,
): TvConfig {
  if (!device) return edit(config);
  const after = edit(configForDevice(config, device));
  const layer = overlayFrom(config, after);
  const perDevice = { ...config.perDevice };
  if (Object.keys(layer).length === 0) delete perDevice[device];
  else perDevice[device] = layer;
  // Only the overlay moves; the shared board and the editor-only record
  // edits are the board's, whichever screen is being looked at.
  return { ...config, perDevice, _records: after._records };
}

/** What `after` says that the shared board does not. */
function overlayFrom(base: TvConfig, after: TvConfig): DeviceOverlay {
  const layer: DeviceOverlay = {};
  const set = <K extends keyof DeviceOverlay>(k: K, v: DeviceOverlay[K]) => {
    layer[k] = v;
  };

  for (const key of Object.keys(DEVICE_OVERLAY_KEYS) as (keyof DeviceOverlay)[]) {
    if (key === "texts" || key === "styles" || key === "themeOverrides") continue;
    const a = (after as unknown as Record<string, unknown>)[key];
    const b = (base as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) set(key, a as never);
  }

  // Keyed by element, so only the elements that differ are kept - a screen
  // with one shorter title should not carry a copy of every other title.
  const texts = differingKeys(base.texts, after.texts, () => "");
  if (texts) set("texts", texts);
  const themeOverrides = differingKeys(base.themeOverrides, after.themeOverrides, () => "");
  if (themeOverrides) set("themeOverrides", themeOverrides);
  const styles = differingKeys(base.styles, after.styles, () => ({}) as ElementStyle);
  if (styles) set("styles", styles);

  return layer;
}

/**
 * The entries of `after` that differ from `base`.
 *
 * A key the edit removed is kept as `cleared()` rather than dropped: the
 * overlay is laid over the board, so leaving it out would bring the board's
 * value back, and "no styling on the phone" has to be sayable.
 */
function differingKeys<T>(
  base: Record<string, T>,
  after: Record<string, T>,
  cleared: () => T,
): Record<string, T> | undefined {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(after)) {
    if (JSON.stringify(v) !== JSON.stringify(base[k])) out[k] = v;
  }
  for (const k of Object.keys(base)) {
    if (!(k in after)) out[k] = cleared();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
