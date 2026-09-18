import type { CSSProperties } from "react";

/**
 * Visual themes for the wall display.
 *
 * A theme is only a set of CSS custom properties; every colour in tv.css is
 * read from these (softer tints are derived with color-mix), so the live editor
 * in the admin can change one value and the whole board follows. The same
 * objects drive the TV and the admin preview - there is no second copy of the
 * palette to drift.
 *
 * Dark themes are the default for a reason: an OLED panel left on a bright,
 * static screen for weeks burns in. The light themes are fine on LCD screens
 * and suit Shabbat, when the board is often left on one page.
 */

export type TvThemeId = "navy" | "royal" | "forest" | "slate" | "stone" | "shabbat";

export const THEME_VARS = [
  "--tv-bg-a",
  "--tv-bg-b",
  "--tv-bg-c",
  "--tv-accent",
  "--tv-accent-2",
  "--tv-text",
  "--tv-text-dim",
  "--tv-panel",
  "--tv-on-accent",
  "--tv-pinned",
] as const;
export type ThemeVar = (typeof THEME_VARS)[number];

/** Human labels for the live editor. */
export const THEME_VAR_LABELS: Record<ThemeVar, string> = {
  "--tv-bg-a": "רקע ראשי",
  "--tv-bg-b": "הילה עליונה",
  "--tv-bg-c": "הילה תחתונה",
  "--tv-accent": "צבע מודגש (כותרות, שעות)",
  "--tv-accent-2": "צבע משני",
  "--tv-text": "טקסט",
  "--tv-text-dim": "טקסט משני",
  "--tv-panel": "רקע כרטיסים",
  "--tv-on-accent": "טקסט על צבע מודגש",
  "--tv-pinned": "מודעה נעוצה",
};

export interface TvTheme {
  /** A built-in id, or "c_<random>" for a theme the admin saved (tv_config.customThemes). */
  id: string;
  name: string;
  description: string;
  light: boolean;
  vars: Record<ThemeVar, string>;
}

/** Ids of themes the admin saved; kept distinct from the built-in ids. */
export const CUSTOM_THEME_ID_RE = /^c_[a-z0-9]{4,24}$/;

export function newCustomThemeId(): string {
  return `c_${Math.random().toString(36).slice(2, 10)}`;
}

/** Built-in themes followed by the admin's own, which may shadow nothing (ids never clash). */
export function allThemes(customThemes?: readonly TvTheme[] | null): TvTheme[] {
  return [...TV_THEMES, ...(customThemes ?? [])];
}

/** Whether a background colour reads as light (for the picker's contrast and the OLED hint). */
export function isLightColor(color: string): boolean {
  const m = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

export const TV_THEMES: TvTheme[] = [
  {
    id: "navy",
    name: "לילה כחול",
    description: "כחול עמוק וזהב — ברירת המחדל",
    light: false,
    vars: {
      "--tv-bg-a": "#0b1628",
      "--tv-bg-b": "#1b3054",
      "--tv-bg-c": "#16304f",
      "--tv-accent": "#f0c35c",
      "--tv-accent-2": "#b99236",
      "--tv-text": "#f4f7fb",
      "--tv-text-dim": "#9fb2cc",
      "--tv-panel": "rgba(255, 255, 255, 0.045)",
      "--tv-on-accent": "#0b1628",
      "--tv-pinned": "#ef8f4c",
    },
  },
  {
    id: "royal",
    name: "זהב מלכותי",
    description: "בורדו כהה וזהב חם",
    light: false,
    vars: {
      "--tv-bg-a": "#14080b",
      "--tv-bg-b": "#3d101a",
      "--tv-bg-c": "#24080e",
      "--tv-accent": "#e9c46a",
      "--tv-accent-2": "#b8913c",
      "--tv-text": "#fbf3e4",
      "--tv-text-dim": "#cfae9f",
      "--tv-panel": "rgba(233, 196, 106, 0.06)",
      "--tv-on-accent": "#14080b",
      "--tv-pinned": "#f08c6c",
    },
  },
  {
    id: "forest",
    name: "ירוק שבת",
    description: "ירוק יער, שמנת וזהב",
    light: false,
    vars: {
      "--tv-bg-a": "#07170f",
      "--tv-bg-b": "#143d29",
      "--tv-bg-c": "#0c2a1c",
      "--tv-accent": "#e5c975",
      "--tv-accent-2": "#b39a4f",
      "--tv-text": "#f1f5ec",
      "--tv-text-dim": "#a7bfad",
      "--tv-panel": "rgba(255, 255, 255, 0.045)",
      "--tv-on-accent": "#07170f",
      "--tv-pinned": "#f0a35e",
    },
  },
  {
    id: "slate",
    name: "מודרני",
    description: "פחם ותכלת, נקי ועכשווי",
    light: false,
    vars: {
      "--tv-bg-a": "#0d1014",
      "--tv-bg-b": "#1d2733",
      "--tv-bg-c": "#121821",
      "--tv-accent": "#5cc8f5",
      "--tv-accent-2": "#3b95bd",
      "--tv-text": "#eef2f6",
      "--tv-text-dim": "#94a3b8",
      "--tv-panel": "rgba(255, 255, 255, 0.05)",
      "--tv-on-accent": "#0d1014",
      "--tv-pinned": "#f59e0b",
    },
  },
  {
    id: "stone",
    name: "אבן ירושלים",
    description: "גוני אבן חמים ובהירים (למסכי LCD)",
    light: true,
    vars: {
      "--tv-bg-a": "#ece2cf",
      "--tv-bg-b": "#f8f2e6",
      "--tv-bg-c": "#ddcdae",
      "--tv-accent": "#8a5a1f",
      "--tv-accent-2": "#a8773a",
      "--tv-text": "#2b2116",
      "--tv-text-dim": "#6d5d48",
      "--tv-panel": "rgba(255, 255, 255, 0.55)",
      "--tv-on-accent": "#fbf6ec",
      "--tv-pinned": "#b5462f",
    },
  },
  {
    id: "shabbat",
    name: "שבת קודש",
    description: "שנהב, כחול וזהב (למסכי LCD)",
    light: true,
    vars: {
      "--tv-bg-a": "#faf6ec",
      "--tv-bg-b": "#ffffff",
      "--tv-bg-c": "#efe5cf",
      "--tv-accent": "#1e3a5f",
      "--tv-accent-2": "#b08a3e",
      "--tv-text": "#1f2a37",
      "--tv-text-dim": "#5b6675",
      "--tv-panel": "rgba(255, 255, 255, 0.85)",
      "--tv-on-accent": "#ffffff",
      "--tv-pinned": "#b08a3e",
    },
  },
];

export type TvFontId = "classic" | "modern" | "soft" | "traditional" | "bold";

export interface TvFont {
  id: TvFontId;
  name: string;
  display: string;
  body: string;
}

/** Families must match what index-tv.html / the admin preview load. */
export const TV_FONTS: TvFont[] = [
  { id: "classic", name: "קלאסי (פרנק רוהל + חיבו)", display: '"Frank Ruhl Libre"', body: '"Heebo"' },
  { id: "modern", name: "מודרני (חיבו)", display: '"Heebo"', body: '"Heebo"' },
  { id: "soft", name: "רך (רוביק + אסיסטנט)", display: '"Rubik"', body: '"Assistant"' },
  { id: "traditional", name: "מסורתי (דוד)", display: '"David Libre"', body: '"David Libre"' },
  { id: "bold", name: "בולט (סקולר + אסיסטנט)", display: '"Secular One"', body: '"Assistant"' },
];

/** Google Fonts request for every family above (used by the admin preview). */
export const TV_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=David+Libre:wght@400;500;700&family=Frank+Ruhl+Libre:wght@500;700;900&family=Heebo:wght@400;500;700;800&family=Rubik:wght@500;700&family=Secular+One&display=swap";

export function getTheme(id: string | null | undefined, customThemes?: readonly TvTheme[] | null): TvTheme {
  return allThemes(customThemes).find((t) => t.id === id) ?? TV_THEMES[0];
}

export function getFont(id: string | null | undefined): TvFont {
  return TV_FONTS.find((f) => f.id === id) ?? TV_FONTS[0];
}

const FALLBACK = ', "Segoe UI", system-ui, sans-serif';

/**
 * Inline style for .tv-root. Overrides from the live editor win over the
 * theme; anything not a known variable is ignored so a bad saved value cannot
 * inject arbitrary CSS.
 */
export function themeStyle(options: {
  theme: string;
  customThemes?: readonly TvTheme[] | null;
  overrides?: Record<string, string> | null;
  font: string;
  textScale?: number;
  backgroundImage?: string | null;
  backgroundDim?: number;
}): CSSProperties {
  const theme = getTheme(options.theme, options.customThemes);
  const font = getFont(options.font);
  const vars: Record<string, string> = { ...theme.vars };
  for (const [key, value] of Object.entries(options.overrides ?? {})) {
    if ((THEME_VARS as readonly string[]).includes(key) && isSafeCssValue(value)) vars[key] = value;
  }
  vars["--tv-font-display"] = font.display + FALLBACK;
  vars["--tv-font-body"] = font.body + FALLBACK;
  vars["--tv-scale"] = String(clamp(options.textScale ?? 1, 0.8, 1.3));
  vars["--tv-bg-image"] =
    options.backgroundImage && isSafeUrl(options.backgroundImage)
      ? `url("${options.backgroundImage}")`
      : "none";
  vars["--tv-bg-dim"] = String(clamp(options.backgroundDim ?? 0.55, 0, 0.95));
  return vars as CSSProperties;
}

function clamp(n: number, min: number, max: number) {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

/** Colours only: hex, rgb(a), hsl(a). Rejects anything that could break out of a declaration. */
export function isSafeCssValue(value: string): boolean {
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i.test(value.trim());
}

function isSafeUrl(value: string): boolean {
  return /^https:\/\/[^\s"'()]+$/i.test(value);
}
