/**
 * The prayer book's look: its view settings, its colour sets (built-in and the reader's own, remembered), and the contexts that carry the set and the display style to every part.
 * Split out of the prayer book's page (src/pages/Siddur.tsx).
 */
import { createContext, useContext } from "react";

import {
  DEFAULT_THEME_APPEARANCE,
  THEME_SHADOWS,
  type ThemeAppearanceSettings,
} from "@/components/ThemeAppearanceControls";

/* ─── Types ─────────────────────────────────────────────── */
export type DisplayStyle    = "classic" | "ornate";
export type ViewMode        = "accordion" | "continuous" | "scroll" | "split" | "book";

export interface SiddurViewSettings {
  viewMode: ViewMode;
  displayStyle: DisplayStyle;
}

export const isViewMode = (value: unknown): value is ViewMode =>
  value === "accordion" || value === "continuous" || value === "scroll" || value === "split" || value === "book";

export const isDisplayStyle = (value: unknown): value is DisplayStyle => value === "classic" || value === "ornate";

export const loadLegacySiddurViewSettings = (): SiddurViewSettings => {
  const savedMode = localStorage.getItem("siddur-view-mode");
  const savedStyle = localStorage.getItem("siddur-display-style");
  return {
    viewMode: isViewMode(savedMode) ? savedMode : "continuous",
    displayStyle: isDisplayStyle(savedStyle) ? savedStyle : "classic",
  };
};

/* ─── Theme system ───────────────────────────────────────── */
export interface SiddurTheme extends Partial<ThemeAppearanceSettings> {
  id: string;
  name: string;
  emoji: string;
  bg: string;                   // page background
  headerBg: string;             // header/tabs background
  headerTextColor?: string;     // text in header/tabs area (defaults to textColor)
  headerAccentColor?: string;   // accent in header/tabs area (defaults to accentColor)
  textColor: string;            // prayer text color
  headingColor?: string;        // section headings (defaults to accentColor)
  instructionColor?: string;    // rubric / instruction lines (defaults to textColor)
  /** Instruction lines in bold - the default; a theme may set false for regular weight. */
  instructionBold?: boolean;
  accentColor: string;          // accent / gold
  cardBg: string;               // section card bg
  cardBorder: string;           // section card border
  bgImage?: string;             // optional CSS background-image
  isCustom?: boolean;
}

export const DEFAULT_ACCENT = "#c8a04d";

export const SIDDUR_PRESET_THEMES: SiddurTheme[] = [
  {
    id: "chumash_gold",
    name: "חומש זהב",
    emoji: "✦",
    bg: "linear-gradient(180deg, #fffefd 0%, #fbf8f1 100%)",
    headerBg: "#142b57",
    headerTextColor: "#f8fafc",
    headerAccentColor: "#d5aa45",
    textColor: "#172033",
    headingColor: "#173463",
    // Gold, a shade darker than the accent: small italic text on ivory needs the contrast.
    instructionColor: "#a17a28",
    accentColor: "#d5aa45",
    cardBg: "#fffdfa",
    cardBorder: "rgba(213,170,69,0.38)",
    cornerRadius: 18,
    buttonRadius: 14,
    borderWidth: 1,
    shadow: "soft",
    headerShadow: true,
  },
  {
    id: "dark_navy",
    name: "כחול לילה",
    emoji: "🌙",
    bg: "#15254a",
    headerBg: "#0f1b38",
    textColor: "#e8dfc8",
    accentColor: DEFAULT_ACCENT,
    cardBg: "rgba(255,255,255,0.04)",
    cardBorder: `${DEFAULT_ACCENT}33`,
  },
  {
    id: "parchment",
    name: "קלף עתיק",
    emoji: "📜",
    bg: "linear-gradient(180deg, #fffefb 0%, #fff7e9 52%, #fffdf7 100%)",
    headerBg: "linear-gradient(180deg, hsl(var(--sidebar-background)) 0%, #1a2f63 100%)",
    textColor: "#2d1e0e",
    accentColor: "#9a6b1a",
    cardBg: "linear-gradient(180deg, #fffdfa 0%, #fffaf0 100%)",
    cardBorder: "#c8a04d44",
  },
  {
    id: "midnight",
    name: "שחור לילה",
    emoji: "⬛",
    bg: "#0a0a0f",
    headerBg: "#111118",
    textColor: "#e8e6e0",
    accentColor: "#c8a04d",
    cardBg: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(200,160,77,0.22)",
  },
  {
    id: "deep_blue",
    name: "כחול עמוק",
    emoji: "🔷",
    bg: "#0d1b2e",
    headerBg: "#0a1520",
    textColor: "#cfe2f5",
    accentColor: "#7ab8e8",
    cardBg: "rgba(100,160,220,0.07)",
    cardBorder: "rgba(122,184,232,0.22)",
  },
  {
    id: "forest",
    name: "יער ירוק",
    emoji: "🌿",
    bg: "#0d1f0f",
    headerBg: "#091508",
    textColor: "#d4edda",
    accentColor: "#66bb6a",
    cardBg: "rgba(102,187,106,0.07)",
    cardBorder: "rgba(102,187,106,0.22)",
  },
  {
    id: "burgundy",
    name: "בורדו",
    emoji: "🍷",
    bg: "#1a0a0e",
    headerBg: "#120609",
    textColor: "#f5d5db",
    accentColor: "#d4728a",
    cardBg: "rgba(212,114,138,0.07)",
    cardBorder: "rgba(212,114,138,0.22)",
  },
  {
    id: "sepia",
    name: "ספיה",
    emoji: "🟤",
    bg: "#1c130b",
    headerBg: "#130d06",
    textColor: "#e8d5b0",
    accentColor: "#c49a47",
    cardBg: "rgba(196,154,71,0.07)",
    cardBorder: "rgba(196,154,71,0.22)",
  },
];

export const CUSTOM_THEME_KEY = "siddur-custom-theme";
export const CUSTOM_THEMES_KEY = "siddur-custom-themes-v2";
export const ACTIVE_THEME_KEY = "siddur-active-theme";

export const normalizeSiddurTheme = (theme: SiddurTheme): SiddurTheme => ({
  ...DEFAULT_THEME_APPEARANCE,
  ...theme,
});

export const siddurAppearance = (theme: SiddurTheme): ThemeAppearanceSettings => ({
  cornerRadius: theme.cornerRadius ?? DEFAULT_THEME_APPEARANCE.cornerRadius,
  buttonRadius: theme.buttonRadius ?? DEFAULT_THEME_APPEARANCE.buttonRadius,
  borderWidth: theme.borderWidth ?? DEFAULT_THEME_APPEARANCE.borderWidth,
  shadow: theme.shadow ?? DEFAULT_THEME_APPEARANCE.shadow,
  headerShadow: theme.headerShadow ?? DEFAULT_THEME_APPEARANCE.headerShadow,
});

export const siddurCardChrome = (theme: SiddurTheme) => {
  const appearance = siddurAppearance(theme);
  return {
    borderRadius: `${appearance.cornerRadius}px`,
    borderWidth: `${appearance.borderWidth}px`,
    boxShadow: THEME_SHADOWS[appearance.shadow],
  };
};

export function loadCustomTheme(): SiddurTheme {
  try {
    const raw = localStorage.getItem(CUSTOM_THEME_KEY);
    if (raw) return normalizeSiddurTheme(JSON.parse(raw));
  } catch { /* ignore */ }
  return normalizeSiddurTheme({
    id: "custom",
    name: "מותאם אישית",
    emoji: "🎨",
    bg: "#0d1b2e",
    headerBg: "#0a1520",
    textColor: "#e8dfc8",
    headingColor: "#c8a04d",
    instructionColor: "#b8cce8",
    accentColor: "#c8a04d",
    cardBg: "rgba(255,255,255,0.05)",
    cardBorder: "rgba(200,160,77,0.28)",
    isCustom: true,
  });
}

export function loadCustomThemes(): SiddurTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalizeSiddurTheme);
    }
  } catch { /* ignore */ }
  const legacy = loadCustomTheme();
  return legacy ? [legacy] : [];
}

export function saveLatestCustomTheme(t: SiddurTheme) {
  localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(normalizeSiddurTheme(t)));
}

export function saveCustomThemes(items: SiddurTheme[]) {
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(items.map(normalizeSiddurTheme)));
}

/* ─── Theme context ──────────────────────────────────────── */
export interface SiddurThemeCtx {
  theme: SiddurTheme;
  setTheme: (t: SiddurTheme) => void;
  previewTheme: (t: SiddurTheme) => void;
  customTheme: SiddurTheme;
  setCustomTheme: (t: SiddurTheme) => void;
  customThemes: SiddurTheme[];
  saveCustomTheme: (t: SiddurTheme, options?: { duplicate?: boolean }) => Promise<SiddurTheme>;
  publicThemes: SiddurTheme[];
  publishTheme: (t: SiddurTheme) => Promise<SiddurTheme>;
}
export const SiddurThemeContext = createContext<SiddurThemeCtx | null>(null);
export const useSiddurTheme = (): SiddurThemeCtx => {
  const ctx = useContext(SiddurThemeContext);
  if (!ctx) return {
    theme: SIDDUR_PRESET_THEMES[0],
    setTheme: () => {},
    previewTheme: () => {},
    customTheme: loadCustomTheme(),
    setCustomTheme: () => {},
    customThemes: loadCustomThemes(),
    saveCustomTheme: async t => t,
    publicThemes: [],
    publishTheme: async t => t,
  };
  return ctx;
};

export const SiddurDisplayStyleContext = createContext<{
  displayStyle: DisplayStyle;
  setDisplayStyle: (style: DisplayStyle) => void;
} | null>(null);

export const useSiddurDisplayStyle = () => {
  const ctx = useContext(SiddurDisplayStyleContext);
  return ctx ?? { displayStyle: "classic" as DisplayStyle, setDisplayStyle: () => {} };
};
