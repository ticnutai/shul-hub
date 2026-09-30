import type { TvConfig } from "./config";
import { getTheme, isSafeCssValue, THEME_VARS, THEME_VAR_LAYERS, type ThemeVar } from "./themes";

/**
 * A saved design: the board's look, or part of it, kept under a name.
 *
 * The gabbai builds a look out of the layers - a background, frames, text,
 * and where things stand - and saves it. When saving they choose which parts
 * it holds: only a background, a background and its text, everything.
 * Applying it changes those parts and nothing else, so a "night sky"
 * background can go under whatever frames and text are already on the wall.
 *
 * Colours are kept as the colours on screen, not as a theme plus edits: a
 * design has to look the same after the theme it was made on is renamed,
 * changed or deleted. The theme it was made on is kept too, only so that a
 * design with a background brings the theme's light or dark character with
 * it.
 */

export const DESIGN_PARTS = ["background", "frames", "text", "layout"] as const;
export type DesignPart = (typeof DESIGN_PARTS)[number];

export const DESIGN_PART_LABELS: Record<DesignPart, string> = {
  background: "רקע",
  frames: "מסגרות",
  text: "טקסט",
  layout: "פריסה",
};

/** Which settings each part is made of - the same split as the editor's layers. */
const PART_KEYS: Record<DesignPart, Array<keyof TvConfig>> = {
  background: ["backgroundGradient", "backgroundImage", "backgroundDim", "backgroundTune"],
  frames: ["skin", "frame"],
  text: ["font", "textScale", "tracking", "styles"],
  layout: ["screenLayout", "illustration", "spacing", "clockStyle"],
};

/** The theme colours of each part (layout has none). */
const PART_VARS: Record<DesignPart, ThemeVar[]> = {
  background: THEME_VAR_LAYERS.background,
  frames: THEME_VAR_LAYERS.frames,
  text: THEME_VAR_LAYERS.text,
  layout: [],
};

export interface SavedDesign {
  /** "d_…" */
  id: string;
  name: string;
  parts: DesignPart[];
  /** The theme it was made on (for its light or dark character). */
  theme: string;
  /** The colours on screen when it was saved, for its parts. */
  colours: Partial<Record<ThemeVar, string>>;
  /** Its parts' settings, as a TvConfig carries them. */
  values: Partial<TvConfig>;
}

export const MAX_DESIGNS = 40;
const DESIGN_ID_RE = /^d_[a-z0-9]{4,16}$/;

export function newDesignId(): string {
  return `d_${Math.random().toString(36).slice(2, 10)}`;
}

/** The colours on screen: the theme with the admin's edits over it. */
export function coloursOnScreen(c: TvConfig): Record<ThemeVar, string> {
  const theme = getTheme(c.theme, c.customThemes);
  return { ...theme.vars, ...(c.themeOverrides as Partial<Record<ThemeVar, string>>) } as Record<ThemeVar, string>;
}

/**
 * The parts of frameLooks and frameStyle each part owns. A frame's own
 * background belongs to the background, its line to the frames and its inks
 * to the text - exactly where the editor puts each of them.
 */
function frameLooksFor(c: TvConfig, parts: DesignPart[]): TvConfig["frameLooks"] {
  const out: TvConfig["frameLooks"] = {};
  for (const [id, look] of Object.entries(c.frameLooks) as [keyof TvConfig["frameLooks"], NonNullable<TvConfig["frameLooks"][keyof TvConfig["frameLooks"]]>][]) {
    const kept = {
      ...(parts.includes("background") && look.bg ? { bg: look.bg, ...(look.bgOpacity !== undefined ? { bgOpacity: look.bgOpacity } : {}) } : {}),
      ...(parts.includes("frames") && look.line ? { line: look.line, ...(look.lineWidth !== undefined ? { lineWidth: look.lineWidth } : {}) } : {}),
      ...(parts.includes("text") && look.text ? { text: look.text } : {}),
      ...(parts.includes("text") && look.accent ? { accent: look.accent } : {}),
    };
    if (Object.keys(kept).length) out[id] = kept;
  }
  return out;
}

/** The look on screen now, as a design holding `parts`. */
export function captureDesign(c: TvConfig, name: string, parts: DesignPart[], id = newDesignId()): SavedDesign {
  const colours = coloursOnScreen(c);
  const values: Partial<TvConfig> = {};
  for (const part of parts) for (const k of PART_KEYS[part]) (values as Record<string, unknown>)[k] = structuredClone(c[k]);
  if (parts.includes("background") || parts.includes("frames")) {
    values.frameStyle = {
      ...c.frameStyle,
      ...(parts.includes("background") ? {} : { fill: null, fillOpacity: 1 }),
      ...(parts.includes("frames") ? {} : { line: null, depth: 0, image: null }),
    };
  }
  if (parts.includes("layout") && c.screenLayout === "illustrated") values.illustratedStyle = structuredClone(c.illustratedStyle);
  values.frameLooks = frameLooksFor(c, parts);
  return {
    id,
    name: name.trim().slice(0, 40) || "עיצוב",
    parts: DESIGN_PARTS.filter((p) => parts.includes(p)),
    theme: c.theme,
    colours: Object.fromEntries(parts.flatMap((p) => PART_VARS[p].map((v) => [v, colours[v]]))),
    values,
  };
}

/**
 * The board with a design put on: its parts replace the board's, the rest
 * stays exactly as it was - colours included, even when the design brings
 * another theme with it.
 */
export function applyDesign(c: TvConfig, d: SavedDesign): TvConfig {
  const before = coloursOnScreen(c);
  const next: TvConfig = { ...c };
  // Only a design with a background changes the theme under the colours.
  if (d.parts.includes("background")) next.theme = getTheme(d.theme, c.customThemes).id === d.theme ? d.theme : c.theme;
  const base = getTheme(next.theme, c.customThemes).vars;
  const overrides: Record<string, string> = {};
  for (const v of THEME_VARS) {
    const part = (Object.keys(PART_VARS) as DesignPart[]).find((p) => PART_VARS[p].includes(v));
    const want = part && d.parts.includes(part) && d.colours[v] ? d.colours[v]! : before[v];
    if (want !== base[v]) overrides[v] = want;
  }
  next.themeOverrides = overrides;

  for (const part of d.parts) for (const k of PART_KEYS[part]) if (k in d.values) (next as unknown as Record<string, unknown>)[k] = structuredClone(d.values[k]);
  if (d.values.frameStyle) {
    next.frameStyle = {
      ...c.frameStyle,
      ...(d.parts.includes("background") ? { fill: d.values.frameStyle.fill, fillOpacity: d.values.frameStyle.fillOpacity } : {}),
      ...(d.parts.includes("frames")
        ? {
            line: d.values.frameStyle.line,
            lineWidth: d.values.frameStyle.lineWidth,
            depth: d.values.frameStyle.depth,
            image: d.values.frameStyle.image,
            imageSlice: d.values.frameStyle.imageSlice,
            imageWidth: d.values.frameStyle.imageWidth,
          }
        : {}),
    };
  }
  if (d.values.illustratedStyle && d.parts.includes("layout")) next.illustratedStyle = structuredClone(d.values.illustratedStyle);
  // Each frame: the design's fields for its parts over what the frame had for the others.
  const looks = frameLooksFor(c, DESIGN_PARTS.filter((p) => !d.parts.includes(p)));
  for (const [id, look] of Object.entries(d.values.frameLooks ?? {})) {
    looks[id as keyof typeof looks] = { ...looks[id as keyof typeof looks], ...look };
  }
  next.frameLooks = looks;
  return next;
}

/**
 * Saved designs from storage. Their settings are checked by the same rules
 * as the board's own (`normalize` is normalizeTvConfig, passed in to keep
 * this file free of a circular import), and only the keys of their parts
 * are kept.
 */
export function normalizeDesigns(raw: unknown, normalize: (raw: unknown) => TvConfig): SavedDesign[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedDesign[] = [];
  const seen = new Set<string>();
  for (const d of raw.slice(0, MAX_DESIGNS)) {
    if (!d || typeof d !== "object") continue;
    const r = d as Record<string, unknown>;
    if (typeof r.id !== "string" || !DESIGN_ID_RE.test(r.id) || seen.has(r.id)) continue;
    const parts = DESIGN_PARTS.filter((p) => Array.isArray(r.parts) && r.parts.includes(p));
    if (!parts.length) continue;
    const checked = normalize(r.values && typeof r.values === "object" ? r.values : {});
    const values: Partial<TvConfig> = {};
    for (const part of parts) for (const k of PART_KEYS[part]) (values as Record<string, unknown>)[k] = checked[k];
    values.frameStyle = checked.frameStyle;
    values.frameLooks = frameLooksFor(checked, parts);
    if (parts.includes("layout")) values.illustratedStyle = checked.illustratedStyle;
    const colours: Partial<Record<ThemeVar, string>> = {};
    const rc = (r.colours && typeof r.colours === "object" ? r.colours : {}) as Record<string, unknown>;
    for (const part of parts)
      for (const v of PART_VARS[part]) {
        const value = rc[v];
        if (typeof value === "string" && isSafeCssValue(value)) colours[v] = value.trim();
      }
    seen.add(r.id);
    out.push({
      id: r.id,
      name: (typeof r.name === "string" ? r.name : "").trim().slice(0, 40) || "עיצוב",
      parts,
      theme: typeof r.theme === "string" ? r.theme.slice(0, 40) : "navy",
      colours,
      values,
    });
  }
  return out;
}
