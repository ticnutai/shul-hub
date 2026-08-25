import { useState, useEffect, useRef, createContext, useContext, useCallback, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { TextDisplaySettings } from "@/components/TextDisplaySettings";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useSyncedState } from "@/hooks/useSyncedState";

import { FontAndColorSettingsProvider, useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";
import { LuxuryTextView } from "@/components/LuxuryTextView";
import { MinimizeButton } from "@/components/MinimizeButton";
import type { FlatPasuk } from "@/types/torah";
import { TEHILLIM_COMMENTATORS } from "@/hooks/useCommentaries";
import { ColorPicker } from "@/components/ColorPicker";
import { DEFAULT_THEME_APPEARANCE, THEME_SHADOWS, ThemeAppearanceControls, type ThemeAppearanceSettings } from "@/components/ThemeAppearanceControls";
import { ArrowLeft, ChevronDown, ChevronUp, BookMarked, Loader2, BookOpen, ExternalLink, LayoutList, AlignJustify, ScrollText, Layers, Sunrise, Sun, Moon, Sparkles, Flame, Star, Leaf, Heart, Book, Columns2, PanelRightOpen, Palette, Save, CloudUpload, Pencil, Copy, type LucideProps } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { normalizeHebrewText } from "@/utils/textUtils";
import { useSiddurCategories, useSiddurSections, useTehillimData, preloadSiddurNusach } from "@/hooks/useSiddurData";
import { getWeekdayLeyning, getCalendarPreference, type WeekdayLeyning } from "@/utils/parshaUtils";
import { useOmerSeason } from "@/features/omer/hooks/useOmerSeason";

/* ─── Types ─────────────────────────────────────────────── */
type SiddurSection   = { title: string; lines: string[] };
type SiddurCategory  = { name: string; sections: SiddurSection[]; total_lines: number };
type SiddurData      = Record<string, SiddurCategory>;
type TehillimChapter = { chapter: number; title: string; lines: string[] };
type TehillimMap     = Record<string, TehillimChapter>;
type DisplayStyle    = "classic" | "ornate";
type ViewMode        = "accordion" | "continuous" | "scroll" | "split" | "book";

interface SiddurViewSettings {
  viewMode: ViewMode;
  displayStyle: DisplayStyle;
}

const isViewMode = (value: unknown): value is ViewMode =>
  value === "accordion" || value === "continuous" || value === "scroll" || value === "split" || value === "book";

const isDisplayStyle = (value: unknown): value is DisplayStyle => value === "classic" || value === "ornate";

const loadLegacySiddurViewSettings = (): SiddurViewSettings => {
  const savedMode = localStorage.getItem("siddur-view-mode");
  const savedStyle = localStorage.getItem("siddur-display-style");
  return {
    viewMode: isViewMode(savedMode) ? savedMode : "accordion",
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
  accentColor: string;          // accent / gold
  cardBg: string;               // section card bg
  cardBorder: string;           // section card border
  bgImage?: string;             // optional CSS background-image
  isCustom?: boolean;
}

const DEFAULT_ACCENT = "#c8a04d";

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
    instructionColor: "#64748b",
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

const CUSTOM_THEME_KEY = "siddur-custom-theme";
const CUSTOM_THEMES_KEY = "siddur-custom-themes-v2";
const ACTIVE_THEME_KEY = "siddur-active-theme";

const normalizeSiddurTheme = (theme: SiddurTheme): SiddurTheme => ({
  ...DEFAULT_THEME_APPEARANCE,
  ...theme,
});

const siddurAppearance = (theme: SiddurTheme): ThemeAppearanceSettings => ({
  cornerRadius: theme.cornerRadius ?? DEFAULT_THEME_APPEARANCE.cornerRadius,
  buttonRadius: theme.buttonRadius ?? DEFAULT_THEME_APPEARANCE.buttonRadius,
  borderWidth: theme.borderWidth ?? DEFAULT_THEME_APPEARANCE.borderWidth,
  shadow: theme.shadow ?? DEFAULT_THEME_APPEARANCE.shadow,
  headerShadow: theme.headerShadow ?? DEFAULT_THEME_APPEARANCE.headerShadow,
});

const siddurCardChrome = (theme: SiddurTheme) => {
  const appearance = siddurAppearance(theme);
  return {
    borderRadius: `${appearance.cornerRadius}px`,
    borderWidth: `${appearance.borderWidth}px`,
    boxShadow: THEME_SHADOWS[appearance.shadow],
  };
};

function loadCustomTheme(): SiddurTheme {
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

function loadCustomThemes(): SiddurTheme[] {
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

function saveLatestCustomTheme(t: SiddurTheme) {
  localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(normalizeSiddurTheme(t)));
}

function saveCustomThemes(items: SiddurTheme[]) {
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(items.map(normalizeSiddurTheme)));
}

/* ─── Theme context ──────────────────────────────────────── */
interface SiddurThemeCtx {
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
const SiddurThemeContext = createContext<SiddurThemeCtx | null>(null);
const useSiddurTheme = (): SiddurThemeCtx => {
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

const SiddurDisplayStyleContext = createContext<{
  displayStyle: DisplayStyle;
  setDisplayStyle: (style: DisplayStyle) => void;
} | null>(null);

const useSiddurDisplayStyle = () => {
  const ctx = useContext(SiddurDisplayStyleContext);
  return ctx ?? { displayStyle: "classic" as DisplayStyle, setDisplayStyle: () => {} };
};

/* ─── Nusach list ────────────────────────────────────────── */
const NUSACHOT = [
  { id: "sefard",          label: "ספרד",           fullName: "נוסח ספרד"           },
  { id: "ashkenaz",        label: "אשכנז",          fullName: "נוסח אשכנז"          },
  { id: "edot_hamizrach",  label: "עדות המזרח",     fullName: "נוסח עדות המזרח"     },
  { id: "chabad",          label: "חב\"ד",           fullName: "נוסח חב\"ד"           },
];

/* ─── Category display order & metadata ─────────────────── */
const CATEGORIES_ORDER = [
  "shacharit", "mincha", "arvit",
  "shabbat_kabbalat", "shabbat_arvit", "shabbat_shacharit",
  "shabbat_musaf",    "shabbat_mincha",
  "brachot", "other",
];
/* Tabs that are always shown regardless of nusach data */
const STATIC_TABS = [
  { id: "tehillim", name: "תהילים"       },
  { id: "kria",     name: "קריאה בתורה" },
];
const NUSACH_INDEP = new Set(["tehillim", "kria"]);

function readingGutter(width: "narrow" | "normal" | "wide" | "full"): string {
  if (width === "narrow") return "clamp(18px, 5.5vw, 32px)";
  if (width === "wide") return "clamp(10px, 3.3vw, 18px)";
  if (width === "full") return "clamp(6px, 2.2vw, 12px)";
  return "clamp(14px, 4.2vw, 24px)";
}

/* ─── Hebrew numeral helper (1–150) ───────────────────────── */
function heNum(n: number): string {
  const ones = ["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
  const tens = ["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
  const h   = n >= 100 ? "ק" : "";
  const rem = n % 100;
  if (rem === 15) return h + "ט\u05F4ו";
  if (rem === 16) return h + "ט\u05F4ז";
  return h + (tens[Math.floor(rem / 10)] || "") + (ones[rem % 10] || "");
}

/* ─── HTML line cleaner ──────────────────────────────────── */
/**
 * Some siddur source data uses self-closing pseudo-tags as bracket markers
 * around emphasized spans, e.g.  `<b/>פתיחת אליהו<b/>`  instead of the
 * proper `<b>פתיחת אליהו</b>`. Without normalization those tags slip past
 * `renderLineContent` (which only matches paired `<b>...</b>`) and end up
 * displayed as literal `<b/>` text in the UI.
 *
 * We pair occurrences of each self-closing tag — odd ones become opening
 * tags, even ones become closing tags. Any unmatched trailing opener is
 * dropped so we never emit invalid HTML.
 */
function pairSelfClosingTags(html: string): string {
  for (const tag of ["b", "small"]) {
    const re = new RegExp(`<\\s*${tag}\\s*\\/\\s*>`, "gi");
    let count = 0;
    html = html.replace(re, () => (count++ % 2 === 0 ? `<${tag}>` : `</${tag}>`));
    if (count % 2 === 1) {
      // odd => last opener has no closer; strip it to avoid unclosed markup
      html = html.replace(new RegExp(`<${tag}>(?![\\s\\S]*<\\/${tag}>)`), "");
    }
  }
  return html;
}

/**
 * Stack-based normaliser for the only two inline tags we support (`b`, `small`).
 *
 * Guarantees well-formed, non-redundant markup:
 *  - `<big><b>X</b></big>` → (after big→b) `<b><b>X</b></b>` → `<b>X</b>`
 *  - `<small>X<small>Y</small></small>` → `<small>XY</small>`
 *  - drops closers with no matching opener and auto-closes unclosed openers,
 *    so no stray `</b>` / `</small>` can ever reach the UI as literal text
 *    (in RTL a stray `</b>` visually renders as `<b/>`).
 */
type InlineTag = "b" | "small";

function flattenNestedSameTags(html: string): string {
  const re = /<\/?(b|small)>/gi;
  const stack: InlineTag[] = [];
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out += html.slice(last, m.index);
    last = re.lastIndex;
    const tag = m[1].toLowerCase() as InlineTag;
    const isClose = m[0][1] === "/";
    if (isClose) {
      const idx = stack.lastIndexOf(tag);
      if (idx === -1) continue;                    // stray closer → drop
      if (idx !== stack.length - 1) continue;      // improperly nested → drop
      // Only emit the closer for the outermost occurrence of this tag.
      if (stack.indexOf(tag) === idx) out += `</${tag}>`;
      stack.pop();
    } else {
      if (!stack.includes(tag)) out += `<${tag}>`; // skip redundant nesting
      stack.push(tag);
    }
  }
  out += html.slice(last);
  // Auto-close anything left open (outermost occurrence only).
  const closed = new Set<InlineTag>();
  for (let i = stack.length - 1; i >= 0; i--) {
    const tag = stack[i];
    if (closed.has(tag)) continue;
    closed.add(tag);
    out += `</${tag}>`;
  }
  return out;
}

function sanitizeHebrewMarkup(html: string): string {
  return flattenNestedSameTags(
    pairSelfClosingTags(
      normalizeHebrewText(html)
        .replace(/<\s*big\s*>/gi, "<b>")
        .replace(/<\s*\/\s*big\s*>/gi, "</b>")
        .replace(/<\s*big\s*\/\s*>/gi, "")
        .replace(/<\s*br\s*\/??\s*>/gi, "\n")
    )
      // Keep only supported inline tags to avoid raw tag names in the UI.
      .replace(/<\/?(?!b\b|small\b)[a-z0-9:-]+[^>]*>/gi, "")
  );
}

function cleanLine(html: string): string {
  return sanitizeHebrewMarkup(html)
    .replace(/<[^>]*>/g, "")
    .replace(/&thinsp;/g, "\u2009")
    .replace(/&nbsp;/g, "\u00a0")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\{[פסנ]\}/g, "")
    .trim();
}

/* ─── Siddur line classification ───────────────────────────
   Three types:
   "heading"     — <b>short-title</b>  e.g. <b>קדושה</b>
   "instruction" — <small>...</small>  rubric / stage-direction
   "prayer"      — regular / bold-first-word prayer text
──────────────────────────────────────────────────────────── */
const NIKUD_RE   = /[\u05B0-\u05C7\u05F0-\u05F4\uFB1D-\uFB4E]/g;
const TAAMIM_RE  = /[\u0591-\u05AF]/g;
const NIKUD_STRIP = /[\u05B0-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7]/g;

function stripText(text: string, showNikud: boolean, showTaamim: boolean): string {
  // Normalize Hebrew presentation forms (e.g. שׁ) to standard letters + marks.
  // This keeps glyph metrics consistent across words in the same font.
  let t = normalizeHebrewText(text);
  if (!showTaamim) t = t.replace(TAAMIM_RE, "");
  if (!showNikud)  t = t.replace(NIKUD_STRIP, "");
  // Drop combining marks left without a base letter (they render on a dotted
  // circle and push the line out of alignment).
  t = t.replace(/(^|[\s>])[\u0591-\u05C7]+/g, "$1");
  return t;
}

function classifyLine(html: string): "heading" | "instruction" | "prayer" {
  // Run through the same sanitiser as rendering so wrappers like `<big>` and
  // self-closing `<b/>...<b/>` are recognised as headings just like the
  // canonical `<b>title</b>` form.
  const t = sanitizeHebrewMarkup(html).trim();
  if (t.startsWith("<small>")) return "instruction";
  const m = t.match(/^<b>([^<]+)<\/b>$/);
  if (m && m[1].replace(NIKUD_RE, "").replace(/\s/g, "").length <= 20) return "heading";
  return "prayer";
}

/* Parses <b> and inline <small> tags inside a prayer line into React nodes */
function renderLineContent(html: string, emphasizeInline = false, openingWordCount = 0): React.ReactNode {
  let h = sanitizeHebrewMarkup(html)
    .replace(/&thinsp;/g, "\u2009")
    .replace(/&nbsp;/g, "\u00a0")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\{[פסנ]\}/g, "");
  // Prefer intentional emphasis from the source. When none exists, optionally
  // mark the requested number of opening words without changing the prayer.
  if (emphasizeInline && openingWordCount > 0 && !/<b>/i.test(h)) {
    const match = h.match(new RegExp(`^((?:\\S+\\s+){0,${openingWordCount - 1}}\\S+)`));
    if (match) h = `<b>${match[1]}</b>${h.slice(match[1].length)}`;
  }
  // Recursive descent over the (already well-formed) <b>/<small> markup so
  // mixed nesting like <b>x<small>y</small></b> renders correctly instead of
  // leaking literal tags into the text.
  const re = /<(\/?)(b|small)>/g;
  let key = 0;
  let pos = 0;

  const parse = (stopTag: InlineTag | null): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let m: RegExpExecArray | null;
    re.lastIndex = pos;
    while ((m = re.exec(h)) !== null) {
      if (m.index > pos) parts.push(h.slice(pos, m.index));
      pos = re.lastIndex;
      const tag = m[2].toLowerCase() as InlineTag;
      if (m[1]) {
        if (tag === stopTag) return parts;
        re.lastIndex = pos;
        continue;
      }
      const children = parse(tag);
      if (tag === "b") {
        parts.push(emphasizeInline
          ? <strong key={key++} style={{ fontWeight: 700 }}>{children}</strong>
          : <span key={key++}>{children}</span>);
      } else {
        parts.push(
          <span key={key++} style={{ fontSize: "0.77em", opacity: 0.65, fontStyle: "italic" }}>
            {children}
          </span>
        );
      }
      re.lastIndex = pos;
    }
    if (pos < h.length) {
      parts.push(h.slice(pos));
      pos = h.length;
    }
    return parts;
  };

  const parts = parse(null);
  return parts.length === 0 ? "" : parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
}

/* Maps lineHeight setting token → CSS value (generous for nikud) */
function lineHeightCSS(lh: string, custom?: number): string {
  if (lh === "tight")    return "1.6";
  if (lh === "normal")   return "2.0";
  if (lh === "relaxed")  return "2.4";
  if (lh === "loose")    return "2.8";
  if (lh === "custom" && custom) return String(custom);
  return "2.0";
}

function withNikudTypography(fontFamily: string, lineHeight: string, showNikud: boolean, showTaamim: boolean): React.CSSProperties {
  // CRITICAL: do NOT mix multiple Hebrew fonts in the fallback chain.
  // Browsers do per-glyph fallback: if the chosen font lacks (or weakly
  // supports) a specific letter+nikud combination, the browser substitutes
  // ONLY that single character from the next Hebrew font — and different
  // Hebrew fonts have different em metrics (Noto Serif Hebrew is ~15-20%
  // taller than David Libre at the same font-size). The result: with nikud
  // ON, a few letters look noticeably larger than their neighbours.
  //
  // Fix: keep the user-selected font alone, then fall back ONLY to the
  // generic family. The generic doesn't carry Hebrew glyphs, so the browser
  // will render every Hebrew character from the chosen font — guaranteeing
  // uniform metrics.
  // Some display fonts expose Hebrew base letters but do not contain the
  // complete niqqud/te'amim GPOS anchors. Android then keeps their base glyph
  // and borrows marks (or an entire shaped cluster) from a fallback font.
  // That is exactly what makes isolated מ/ד/ה/ת clusters appear larger.
  // Keep user choice for fonts known to support marked Hebrew; otherwise use
  // the bundled Noto font for the whole run so Android never mixes glyphs.
  const nikudCapableFonts = new Set([
    "Noto Serif Hebrew",
    "David Libre",
    "Frank Ruhl Libre",
    "Heebo",
  ]);
  const requestedFamily = fontFamily.replace(/["']/g, "").split(",")[0].trim();
  // Noto is bundled with the app and contains U+0591–U+05C7 in full. The
  // other verified fonts contain niqqud + mark/mkmk positioning, but not the
  // complete cantillation block. Use them for ordinary/vocalised prayer text
  // and switch the entire run to Noto whenever te'amim are visible.
  const resolvedFamily = showTaamim
    ? "Noto Serif Hebrew"
    : (!showNikud || nikudCapableFonts.has(requestedFamily))
      ? requestedFamily
      : "Noto Serif Hebrew";
  const isSans = /sans|arial|tahoma|frank ruhl|noto sans/i.test(resolvedFamily);
  const generic = isSans ? 'sans-serif' : 'serif';
  // Keep the user's selected font for marked text as well. Quoting the family
  // name is important on Android for multi-word names (David Libre, Frank
  // Ruhl Libre, etc.); otherwise WebView may parse them as separate fallback
  // families and mix glyph metrics inside a single Hebrew word.
  const fullFamily = `'${resolvedFamily}', ${generic}`;
  return {
    fontFamily: fullFamily,
    lineHeight,
    // Do not force `ccmp` on Android WebView. With Hebrew combining marks it
    // can select alternate base glyphs for מ/ד/ה/ת, making only those letters
    // look larger when niqqud or cantillation is enabled. The font shaper's
    // defaults already position mark/mkmk correctly without changing the
    // visible base-letter metrics.
    fontFeatureSettings: 'normal',
    textRendering: 'auto',
    // Lock metrics so per-glyph fallback (if it ever happens) and any
    // contextual substitution can't change letter heights/baselines:
    fontSynthesis: 'none' as React.CSSProperties['fontSynthesis'],
    fontVariant: 'normal',
    fontKerning: 'none',
    // Prevent mobile auto text-size adjustments that scale individual lines.
    WebkitTextSizeAdjust: '100%',
    textSizeAdjust: '100%' as unknown as React.CSSProperties['textSizeAdjust'],
    // Keep all glyphs on the same baseline — defends against accidental
    // sub/superscript variants that some Hebrew fonts apply for marks.
    verticalAlign: 'baseline',
    fontVariantPosition: 'normal' as unknown as React.CSSProperties['fontVariantPosition'],
    // Avoid the parameter being flagged as unused while preserving the API.
  };
}
/* ─── Gold decoration helpers ───────────────────────────── */
const GOLD = "#c8a04d";
const CAT_ICON: Record<string, React.ComponentType<LucideProps>> = {
  shacharit:         Sunrise,
  mincha:            Sun,
  arvit:             Moon,
  shabbat_kabbalat:  Sparkles,
  shabbat_arvit:     Flame,
  shabbat_shacharit: Star,
  shabbat_musaf:     BookOpen,
  shabbat_mincha:    Leaf,
  brachot:           Heart,
  other:             ScrollText,
  tehillim:          BookMarked,
  kria:              Book,
};
const CatIcon = ({ id }: { id: string }) => {
  const { theme } = useSiddurTheme();
  const Icon = CAT_ICON[id];
  return Icon ? <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: theme.accentColor }} /> : null;
};
const Divider = () => {
  const { theme } = useSiddurTheme();
  return (
    <div className="my-1 mx-auto" style={{
      width: "60%", height: "1px",
      background: `linear-gradient(90deg, transparent, ${theme.accentColor}, transparent)`
    }} />
  );
};
const OrnamentTitle = ({ text, fontSize }: { text: string; fontSize?: number }) => {
  const { theme } = useSiddurTheme();
  return (
    <div className="flex items-center justify-center gap-2 my-2">
      <span style={{ color: theme.accentColor, fontSize: "0.9em" }}>❧</span>
      <span className="font-bold tracking-wide" style={{ color: theme.accentColor, fontFamily: "'Noto Serif Hebrew', 'David Libre', serif", fontSize: fontSize ? `${fontSize}px` : "0.9em" }}>
        {text}
      </span>
    <span style={{ color: theme.accentColor, fontSize: "0.9em", transform: "scaleX(-1)", display: "inline-block" }}>❧</span>
  </div>
  );
};

/* ─── SiddurPagePreview ──────────────────────────────────── */
const PREVIEW_PRAYER = [
  "בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ",
  "מֶלֶךְ הָעוֹלָם אֲשֶׁר יָצַר",
  "אֶת הָאָדָם בְּחָכְמָה",
];
const PREVIEW_INSTRUCTION = "הוראה: כוון לבך בברכה זו";

const SiddurPagePreview = ({ theme, label = "תצוגה מקדימה" }: { theme: SiddurTheme; label?: string }) => {
  const { settings } = useFontAndColorSettings();
  const font = settings.siddurFont || "'Noto Serif Hebrew', serif";
  const size = Math.min(settings.siddurSize || 18, 18); // cap at 18 for preview
  const bold = settings.siddurBold;
  const lhVal = lineHeightCSS(settings.siddurLineHeight, settings.siddurLineHeightCustom);
  const headingColor = theme.headingColor ?? theme.accentColor;
  const instrColor   = theme.instructionColor ?? theme.textColor;
  const appearance = siddurAppearance(theme);

  // Resolve solid bg for gradients (use a fallback dark color)
  const solidBg = theme.bg.includes("gradient") || theme.bg.includes("linear")
    ? "#1a1a2e"
    : theme.bg;
  const solidHeaderBg = theme.headerBg.includes("gradient") || theme.headerBg.includes("linear")
    ? theme.accentColor + "cc"
    : theme.headerBg;

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden"
      style={{ borderStyle: "solid", borderColor: `${theme.accentColor}44`, ...siddurCardChrome(theme) }}
    >
      {/* Preview label */}
      <div className="px-2 py-1 flex items-center justify-between flex-shrink-0"
        style={{ background: solidHeaderBg }}>
        <span style={{
          color: theme.accentColor,
          fontSize: "10px",
          fontFamily: "'Noto Serif Hebrew', serif",
          fontWeight: 700,
          letterSpacing: "0.03em",
        }}>
          ❧ {label} ❧
        </span>
        {/* Mini tab indicators */}
        <div className="flex gap-0.5">
          {["שחרית", "מנחה"].map((t, i) => (
            <span key={t} style={{
              fontSize: "7px",
              padding: "1px 5px",
              borderRadius: `${appearance.buttonRadius}px`,
              background: i === 0 ? theme.accentColor : "rgba(255,255,255,0.1)",
              color: i === 0 ? solidBg : theme.textColor,
              fontFamily: "'Noto Serif Hebrew', serif",
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Page body */}
      <div className="flex-1 p-2.5 space-y-1.5 overflow-hidden" style={{ background: solidBg }}>
        {/* Ornament title */}
        <div className="flex items-center justify-center gap-1 mb-1">
          <span style={{ color: theme.accentColor, fontSize: "9px" }}>❧</span>
          <span style={{
            color: theme.accentColor,
            fontSize: "10px",
            fontFamily: "'Noto Serif Hebrew', serif",
            fontWeight: 700,
          }}>שחרית</span>
          <span style={{ color: theme.accentColor, fontSize: "9px", transform: "scaleX(-1)", display: "inline-block" }}>❧</span>
        </div>
        {/* Divider */}
        <div style={{
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${theme.accentColor}, transparent)`,
          marginBottom: "6px",
        }} />

        {/* Section card */}
        <div style={{
          background: theme.cardBg.includes("rgba") || theme.cardBg.includes("#")
            ? theme.cardBg
            : `${theme.accentColor}08`,
          borderStyle: "solid",
          borderColor: theme.cardBorder,
          ...siddurCardChrome(theme),
          padding: "6px 8px",
          direction: "rtl",
        }}>
          {/* Card heading */}
          <div className="flex items-center gap-1 mb-1">
            <span style={{
              display: "inline-block",
              width: "2px",
              height: "10px",
              borderRadius: "1px",
              background: headingColor,
              flexShrink: 0,
            }} />
            <span style={{
              color: headingColor,
              fontSize: `${Math.max(size * 0.78, 10)}px`,
              fontFamily: font,
              fontWeight: 700,
              lineHeight: 1.4,
            }}>ברכות השחר</span>
          </div>

          {/* Thin divider */}
          <div style={{ height: "1px", background: `${theme.accentColor}22`, margin: "4px 0" }} />

          {/* Prayer lines */}
          {PREVIEW_PRAYER.map((line, i) => (
            <p key={i} style={{
              color: theme.textColor,
              fontSize: `${size}px`,
              fontFamily: font,
              fontWeight: bold ? 700 : 400,
              lineHeight: lhVal,
              direction: "rtl",
              margin: 0,
            }}>{line}</p>
          ))}

          {/* Instruction line */}
          <div style={{ height: "1px", background: `${theme.accentColor}22`, margin: "4px 0" }} />
          <p style={{
            color: instrColor,
            fontSize: `${Math.max(size * 0.78, 9)}px`,
            fontFamily: font,
            fontStyle: "italic",
            opacity: 0.85,
            lineHeight: 1.4,
            direction: "rtl",
            margin: 0,
          }}>{PREVIEW_INSTRUCTION}</p>

          {/* Closing prayer line */}
          <p style={{
            color: theme.textColor,
            fontSize: `${size}px`,
            fontFamily: font,
            fontWeight: bold ? 700 : 400,
            lineHeight: lhVal,
            direction: "rtl",
            margin: 0,
          }}>בָּרוּךְ אַתָּה יְיָ</p>
        </div>

        {/* Accent indicator */}
        <div className="flex items-center gap-1 mt-1">
          <span style={{ color: theme.accentColor, fontSize: "8px" }}>✦</span>
          <span style={{ color: theme.accentColor, fontSize: "8px", opacity: 0.6 }}>צבע הדגשה</span>
          <span style={{
            display: "inline-block",
            width: "18px",
            height: "8px",
            borderRadius: "3px",
            background: theme.accentColor,
          }} />
        </div>
      </div>
    </div>
  );
};

/* ─── ThemePicker ────────────────────────────────────────── */
const COLOR_FIELDS: { key: keyof SiddurTheme; label: string; group: string; colorOnly?: boolean }[] = [
  // Header/tabs — independent container
  { key: "headerBg",           label: "רקע כותרת/טאבים",  group: "כותרת" },
  { key: "headerTextColor",    label: "טקסט כותרת",        group: "כותרת" },
  { key: "headerAccentColor",  label: "הדגשה בכותרת",      group: "כותרת", colorOnly: true },
  // Body
  { key: "bg",               label: "רקע דף",           group: "גוף הדף" },
  { key: "cardBg",           label: "רקע כרטיס",        group: "גוף הדף" },
  { key: "cardBorder",       label: "מסגרת כרטיס",      group: "גוף הדף" },
  { key: "textColor",        label: "טקסט תפילה",       group: "טקסט" },
  { key: "headingColor",     label: "כותרת מקטע",       group: "טקסט" },
  { key: "instructionColor", label: "הוראות / רוביקה",  group: "טקסט" },
  { key: "accentColor",      label: "צבע הדגשה (זהב)",  group: "הדגשה", colorOnly: true },
];

const ThemePicker = () => {
  const { theme, setTheme, customTheme, customThemes, saveCustomTheme, previewTheme, publicThemes, publishTheme } = useSiddurTheme();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"presets" | "custom">("presets");
  const [draft, setDraft] = useState<SiddurTheme>({ ...customTheme });
  const [editingThemeId, setEditingThemeId] = useState<string>(customTheme.id);
  const [hoverTheme, setHoverTheme] = useState<SiddurTheme | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  // Captures the saved theme at dialog-open time so we can revert on cancel
  const originalThemeRef = useRef<SiddurTheme>(theme);

  // Keep draft in sync when customTheme changes externally
  useEffect(() => { setDraft(prev => ({ ...prev, ...customTheme })); }, [customTheme]);

  // On open: snapshot current theme + position panel near top-right
  useEffect(() => {
    if (open) {
      originalThemeRef.current = theme;
      setPos({
        x: window.innerWidth < 640 ? 8 : Math.max(8, window.innerWidth - 644),
        y: window.innerWidth < 640 ? 8 : 64,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Mouse-drag logic
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({
        x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 120)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 60)),
      });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  const startDrag = (e: React.MouseEvent) => {
    if (window.innerWidth < 640) return;
    // Don't start drag when clicking interactive elements inside the handle
    if ((e.target as HTMLElement).closest("button, input")) return;
    e.preventDefault();
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
  };

  // Cancel: revert page to saved theme and close
  const handleClose = () => {
    previewTheme(originalThemeRef.current);
    setDraft({ ...customTheme });
    setOpen(false);
  };

  const allThemes = [
    ...SIDDUR_PRESET_THEMES,
    ...publicThemes,
    ...customThemes.filter(custom => !publicThemes.some(t => t.id === custom.id)),
  ];

  // Mini-preview panel still shows hovered / draft theme
  const previewedTheme: SiddurTheme = tab === "custom" ? draft : (hoverTheme ?? theme);

  const buildCustomTheme = (): SiddurTheme => ({
    ...draft,
    name: draft.name.trim(),
    id: editingThemeId || "custom",
    emoji: "🎨",
    isCustom: true,
  });

  const saveCustom = async () => {
    const t = buildCustomTheme();
    if (!t.name) {
      setPublishError("יש להזין שם לערכת הנושא");
      return;
    }
    setPublishError("");
    try {
      const saved = await saveCustomTheme(t);
      setTheme(saved);
      setEditingThemeId(saved.id);
      setDraft(saved);
      originalThemeRef.current = saved;
      setOpen(false);
      toast.success("ערכת הנושא עודכנה ונשמרה");
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "שמירת ערכת הנושא נכשלה");
    }
  };

  const duplicateCustom = async () => {
    const requestedName = draft.name.trim();
    if (!draft.name.trim()) { setPublishError("יש להזין שם לערכת הנושא"); return; }
    const usedNames = new Set(customThemes.map(item => item.name));
    let uniqueName = requestedName;
    if (usedNames.has(uniqueName)) {
      let copyNumber = 2;
      uniqueName = `${requestedName} – עותק`;
      while (usedNames.has(uniqueName)) uniqueName = `${requestedName} – עותק ${copyNumber++}`;
    }
    const t = { ...buildCustomTheme(), name: uniqueName };
    setPublishError("");
    try {
      const saved = await saveCustomTheme(t, { duplicate: true });
      setTheme(saved);
      setEditingThemeId(saved.id);
      originalThemeRef.current = saved;
      setDraft(saved);
      setTab("presets");
      setHoverTheme(null);
      toast.success("נשמרה ערכה חדשה. אפשר ליצור ולשמור ערכות נוספות");
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "שכפול ערכת הנושא נכשל");
    }
  };

  const applyCustom = async () => {
    if (rolesLoading) {
      setPublishError("בודק הרשאת מנהל, נסה שוב בעוד רגע");
      return;
    }
    if (!isAdmin) {
      setPublishError("רק מנהל יכול לפרסם ערכת נושא לכל המשתמשים");
      return;
    }
    const t = buildCustomTheme();
    if (!t.name) {
      setPublishError("יש להזין שם לערכת הנושא");
      return;
    }
    setPublishing(true);
    setPublishError("");
    try {
      const published = await publishTheme(t);
      await saveCustomTheme(t);
      setTheme(published);
      originalThemeRef.current = published;
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
      setPublishError(`הפרסום נכשל: ${message}`);
    } finally {
      setPublishing(false);
    }
  };

  const fieldVal = (key: keyof SiddurTheme): string =>
    (draft[key] as string | undefined) ?? "";

  // Update draft AND push live to the page immediately
  const updateDraft = (key: keyof SiddurTheme, value: string) => {
    const newDraft: SiddurTheme = { ...draft, [key]: value, isCustom: true };
    setDraft(newDraft);
    previewTheme(newDraft);
  };

  const groups = Array.from(new Set(COLOR_FIELDS.map(f => f.group)));

  // The editor chrome deliberately uses fixed, accessible colours. The draft theme
  // is applied only to the page/preview, so an experimental palette cannot hide controls.
  const editor = {
    bg: "#101b35",
    surface: "#172544",
    surfaceSoft: "rgba(255,255,255,0.07)",
    text: "#f8fafc",
    muted: "#cbd5e1",
    accent: "#d5aa45",
    border: "rgba(213,170,69,0.28)",
  };
  const mobileViewport = typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="ערכת נושא"
        className="flex items-center justify-center h-8 w-8 rounded-lg transition-all hover:opacity-80"
        style={{ background: "transparent", border: "none" }}
      >
        <Palette className="h-4 w-4" style={{ color: "#c8a04d" }} />
      </button>

      {open && (
        <div
          ref={panelRef}
          data-siddur-theme-panel
          className="fixed z-[999] rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            left: mobileViewport ? 0 : pos.x,
            right: mobileViewport ? 0 : "auto",
            top: mobileViewport ? "auto" : pos.y,
            bottom: mobileViewport ? 0 : "auto",
            background: editor.bg,
            color: editor.text,
            border: `1px solid ${editor.border}`,
            direction: "rtl",
            height: mobileViewport ? "50dvh" : "auto",
            maxHeight: mobileViewport ? "50dvh" : "88vh",
            width: mobileViewport ? "100vw" : "628px",
            maxWidth: "100vw",
            userSelect: isDragging ? "none" : "auto",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Drag handle / header ── */}
          <div
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b flex-shrink-0"
            style={{
              borderColor: editor.border,
              cursor: mobileViewport ? "default" : (isDragging ? "grabbing" : "grab"),
            }}
            onMouseDown={startDrag}
          >
            {/* Title + live-preview badge */}
            <div className="flex items-center gap-2 pointer-events-none">
              <span className="text-sm font-bold" style={{ color: editor.accent, fontFamily: "'Noto Serif Hebrew', serif" }}>
                ✦ ערכת נושא
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(213,170,69,0.16)", color: editor.accent }}
              >
                תצוגה חיה בדף
              </span>
            </div>
            {/* Tabs + close */}
            <div className="flex gap-1 items-center justify-between sm:justify-start">
              <button
                onClick={() => { setTab("presets"); setHoverTheme(null); }}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                style={{ background: tab === "presets" ? editor.accent : editor.surfaceSoft, color: tab === "presets" ? "#101827" : editor.text }}
              >
                בחירת ערכה
              </button>
              <button
                onClick={() => { setTab("custom"); setHoverTheme(null); }}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                style={{ background: tab === "custom" ? editor.accent : editor.surfaceSoft, color: tab === "custom" ? "#101827" : editor.text }}
              >
                עריכה מותאמת
              </button>
              <button
                onClick={handleClose}
                className="mr-1 h-6 w-6 flex items-center justify-center rounded-full text-sm transition-all hover:opacity-80"
                style={{ background: editor.surfaceSoft, color: editor.text }}
                title="סגור"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── Body: controls (flex-1) + mini preview (fixed 200px) ── */}
          <div className="flex flex-col sm:flex-row flex-1 min-h-0">

            {/* Controls column */}
            <div className="overflow-y-auto flex-1 min-w-0">
              {tab === "presets" && (
                <div className="p-3 grid grid-cols-4 gap-2">
                  {allThemes.map(t => (
                    <div
                      key={t.id}
                      data-siddur-theme-option={t.id}
                      onMouseEnter={() => { setHoverTheme(t); previewTheme(t); }}
                      onMouseLeave={() => { setHoverTheme(null); previewTheme(originalThemeRef.current); }}
                      className="relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all hover:scale-105"
                      style={{
                        background: theme.id === t.id ? "rgba(213,170,69,0.16)" : editor.surfaceSoft,
                        border: `1.5px solid ${(hoverTheme?.id ?? theme.id) === t.id ? editor.accent : "transparent"}`,
                      }}
                    >
                      <button className="absolute inset-0" aria-label={`בחר ${t.name}`} onClick={() => { setTheme(t); originalThemeRef.current = t; setOpen(false); }} />
                      <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0" style={{ border: `1px solid ${t.accentColor}55` }}>
                        <div className="h-4 w-full" style={{ background: t.bg.includes("gradient") ? t.accentColor : t.bg }} />
                        <div className="h-3 w-full flex items-center justify-center" style={{ background: t.cardBg.includes("rgba") ? t.bg : t.cardBg }}>
                          <span style={{ fontSize: "7px", color: t.textColor, fontFamily: "serif" }}>אבג</span>
                        </div>
                        <div className="h-3 w-full flex items-center justify-center" style={{ background: t.headerBg.includes("gradient") ? t.accentColor : t.headerBg }}>
                          <span style={{ fontSize: "6px", color: t.accentColor }}>❧</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-center leading-tight font-medium" style={{ color: editor.text }}>{t.emoji} {t.name}</span>
                      <button
                        className="relative z-10 mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px]"
                        style={{ background: editor.surface, color: editor.accent }}
                        onClick={() => {
                          const editable = normalizeSiddurTheme({ ...t, isCustom: true });
                          setDraft(editable);
                          setEditingThemeId(t.id.startsWith("custom") ? t.id : "");
                          previewTheme(editable);
                          setTab("custom");
                        }}
                      >
                        <Pencil className="h-2.5 w-2.5" /> ערוך
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {tab === "custom" && (
                <div className="p-3 space-y-4" dir="rtl">
                  {/* Theme name */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold w-24 flex-shrink-0" style={{ color: editor.accent }}>שם ערכה</span>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
                      className="flex-1 rounded px-2 py-1 text-xs"
                      style={{ background: editor.surface, border: `1px solid ${editor.border}`, color: editor.text }}
                      dir="rtl"
                      placeholder="שם ערכת הנושא"
                    />
                  </div>

                  {/* Color groups */}
                  {groups.map(group => (
                    <div key={group}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: editor.accent }}>{group}</span>
                        <div className="flex-1 h-px" style={{ background: editor.border }} />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {COLOR_FIELDS.filter(f => f.group === group).map(({ key, label, colorOnly }) => {
                          const val = fieldVal(key);
                          const isHex = val.startsWith("#");
                          return (
                            <div key={key} className="rounded-lg p-2" style={{ background: editor.surfaceSoft, border: `1px solid ${editor.border}` }}>
                              <span className="mb-1 block text-[11px] font-medium" style={{ color: editor.text }}>{label}</span>
                              <div className="flex flex-col gap-1.5">
                                <div className="w-full">
                                  <ColorPicker
                                    compact
                                    label={label}
                                    value={isHex ? val : "#c8a04d"}
                                    onChange={color => updateDraft(key, color)}
                                  />
                                </div>
                                {!colorOnly && (
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={e => updateDraft(key, e.target.value)}
                                    className="flex-1 rounded px-2 py-1 text-[10px] font-mono min-w-0"
                                    style={{ background: editor.surface, border: `1px solid ${editor.border}`, color: editor.text }}
                                    dir="ltr"
                                    placeholder="#hex / rgba(...) / linear-gradient(...)"
                                  />
                                )}
                                {colorOnly && isHex && (
                                  <span className="text-[10px] font-mono" style={{ color: editor.muted }}>{val}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <ThemeAppearanceControls
                    value={{
                      cornerRadius: draft.cornerRadius ?? DEFAULT_THEME_APPEARANCE.cornerRadius,
                      buttonRadius: draft.buttonRadius ?? DEFAULT_THEME_APPEARANCE.buttonRadius,
                      borderWidth: draft.borderWidth ?? DEFAULT_THEME_APPEARANCE.borderWidth,
                      shadow: draft.shadow ?? DEFAULT_THEME_APPEARANCE.shadow,
                      headerShadow: draft.headerShadow ?? DEFAULT_THEME_APPEARANCE.headerShadow,
                    }}
                    onChange={appearance => {
                      const next = { ...draft, ...appearance, isCustom: true };
                      setDraft(next);
                      previewTheme(next);
                    }}
                  />

                  {/* Action buttons */}
                  {publishError && <p className="text-xs text-red-300 text-center">{publishError}</p>}
                  <div className="sticky bottom-0 grid grid-cols-2 gap-2 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]" style={{ background: editor.bg }}>
                    <button
                      onClick={() => {
                        const base = SIDDUR_PRESET_THEMES[0];
                        const reset: SiddurTheme = normalizeSiddurTheme({ ...base, id: "custom", name: "מותאם אישית", emoji: "🎨", isCustom: true });
                        setEditingThemeId("");
                        setDraft(reset);
                        previewTheme(reset);
                      }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                      style={{ background: editor.surfaceSoft, color: editor.text, border: `1px solid ${editor.border}` }}
                    >
                      אפס
                    </button>
                    <button
                      onClick={handleClose}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                      style={{ background: editor.surfaceSoft, color: editor.text, border: `1px solid ${editor.border}` }}
                    >
                      ביטול
                    </button>
                    <button
                      onClick={saveCustom}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                      style={{ background: editor.accent, color: "#101827" }}
                      title="שמור והחל במכשיר ובחשבון המחובר"
                    >
                      <Save className="h-3.5 w-3.5" />
                      עדכן
                    </button>
                    <button
                      onClick={duplicateCustom}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                      style={{ background: editor.surface, color: editor.text, border: `1px solid ${editor.border}` }}
                    >
                      <Copy className="h-3.5 w-3.5" /> שכפל ושמור
                    </button>
                    <button
                      onClick={applyCustom}
                      disabled={publishing}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: "#2563eb", color: "#ffffff" }}
                      title="פרסם את הערכה לכל המשתמשים"
                    >
                      {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
                      {publishing ? "מפרסם..." : "פרסם לכולם"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Mini preview column ── */}
            <div
              className="hidden sm:flex flex-col border-r flex-shrink-0"
              style={{
                width: "200px",
                borderColor: editor.border,
                background: "rgba(0,0,0,0.15)",
              }}
            >
              <div className="px-3 py-2 text-center flex-shrink-0" style={{ borderBottom: `1px solid ${editor.border}` }}>
                <span style={{ color: editor.accent, fontSize: "10px", fontFamily: "'Noto Serif Hebrew', serif", opacity: 0.9 }}>
                  {tab === "custom" ? "⟳ תצוגה מקדימה" : "עבר עם העכבר לתצוגה"}
                </span>
              </div>
              <div className="flex-1 p-2.5 overflow-hidden">
                <SiddurPagePreview
                  theme={previewedTheme}
                  label={previewedTheme.name || "תצוגה מקדימה"}
                />
              </div>
              <div className="px-3 py-1.5 text-center flex-shrink-0" style={{ borderTop: `1px solid ${editor.border}` }}>
                <span style={{ color: previewedTheme.accentColor, fontSize: "9px", fontFamily: "'Noto Serif Hebrew', serif" }}>
                  {previewedTheme.emoji} {previewedTheme.name}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

/* ─── SiddurLine — renders one siddur line with semantic styling ─── */
type SiddurLineSettings = { siddurFont: string; siddurSize: number; siddurBold: boolean; siddurHeadingBold: boolean; siddurOpeningBold: boolean; siddurOpeningWordCount: 1 | 2 | 3; textAlignment: string; lineHeight: string; lineHeightCustom: number; showNikud: boolean; showTaamim: boolean; letterSpacing: string; letterSpacingCustom: number; wordSpacing: number; };

const SiddurLine = ({ html, s }: { html: string; s: SiddurLineSettings }) => {
  html = stripText(html, s.showNikud, s.showTaamim);
  const type = classifyLine(html);
  const lh = lineHeightCSS(s.lineHeight, s.lineHeightCustom);
  const nikudStyle = withNikudTypography(s.siddurFont, lh, s.showNikud, s.showTaamim);
  const { theme } = useSiddurTheme();

  const letterSpacingCSS = s.letterSpacing === "custom"
    ? `${s.letterSpacingCustom ?? 0}em`
    : s.letterSpacing === "tight"  ? "-0.02em"
    : s.letterSpacing === "wide"   ? "0.05em"
    : s.letterSpacing === "wider"  ? "0.1em"
    : "0em";
  const wordSpacingCSS = `${s.wordSpacing ?? 0}em`;

  const headingColor  = theme.headingColor     ?? theme.accentColor;
  const instrColor    = theme.instructionColor  ?? theme.textColor;

  if (type === "heading") {
    return (
      <div className="flex items-center gap-2 mt-3 mb-0.5" style={{ direction: "rtl" }}>
        <span className="inline-block h-3 w-0.5 rounded-full flex-shrink-0" style={{ background: headingColor, opacity: 0.8 }} />
        <span style={{
          ...nikudStyle,
          fontSize: `${Math.round(s.siddurSize * 0.82)}px`,
          fontWeight: s.siddurHeadingBold ? 700 : 600,
          color: headingColor,
          letterSpacing: letterSpacingCSS,
          wordSpacing: wordSpacingCSS,
        }}>
          {renderLineContent(html, s.siddurHeadingBold)}
        </span>
      </div>
    );
  }

  if (type === "instruction") {
    return (
      <p style={{
        color: instrColor,
        ...nikudStyle,
        fontSize: `${Math.max(Math.round(s.siddurSize * 0.78), 12)}px`,
        fontStyle: "italic",
        textAlign: s.textAlignment as React.CSSProperties["textAlign"],
        ...(s.textAlignment === "justify" ? { textAlignLast: "right" as React.CSSProperties["textAlignLast"], textJustify: "inter-word" as React.CSSProperties["textJustify"], hyphens: "none" as React.CSSProperties["hyphens"] } : {}),
        direction: "rtl",
        opacity: 0.82,
        letterSpacing: letterSpacingCSS,
        wordSpacing: wordSpacingCSS,
      }}>
        {renderLineContent(html)}
      </p>
    );
  }

  return (
    <p style={{
      ...nikudStyle,
      color: theme.textColor,
      fontSize: `${s.siddurSize}px`,
      fontWeight: s.siddurBold ? 700 : 400,
      textAlign: s.textAlignment as React.CSSProperties["textAlign"],
      ...(s.textAlignment === "justify" ? { textAlignLast: "right" as React.CSSProperties["textAlignLast"], textJustify: "inter-word" as React.CSSProperties["textJustify"], hyphens: "none" as React.CSSProperties["hyphens"] } : {}),
      direction: "rtl",
      letterSpacing: letterSpacingCSS,
      wordSpacing: wordSpacingCSS,
    }}>
      {renderLineContent(html, s.siddurOpeningBold, s.siddurOpeningWordCount)}
    </p>
  );
};

/* ─── SectionCard ────────────────────────────────────────── */
const SectionCard = ({ section, initialOpen = false }: { section: SiddurSection; initialOpen?: boolean }) => {
  const [open, setOpen] = useState(initialOpen);
  const { settings: siddurSettings } = useFontAndColorSettings();
  const { theme } = useSiddurTheme();
  const gutter = readingGutter(siddurSettings.siddurContentWidth);
  const lineSettings: SiddurLineSettings = {
    ...siddurSettings,
    textAlignment: siddurSettings.siddurTextAlignment,
    lineHeight: siddurSettings.siddurLineHeight,
    lineHeightCustom: siddurSettings.siddurLineHeightCustom,
    letterSpacing: siddurSettings.siddurLetterSpacing,
    letterSpacingCustom: siddurSettings.siddurLetterSpacingCustom,
    wordSpacing: siddurSettings.siddurWordSpacing,
  };

  return (
    <div data-siddur-card className="rounded-lg border overflow-hidden mb-2" style={{
      background: theme.cardBg,
      borderColor: theme.cardBorder,
      ...siddurCardChrome(theme),
    }}>
      {/* Section header / toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-right transition-colors hover:bg-white/10 focus:outline-none"
        style={{ direction: "rtl" }}
      >
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-4 rounded-full" style={{ background: theme.accentColor, opacity: 0.7 }} />
          <span
            style={{
              color: theme.textColor,
              fontFamily: siddurSettings.siddurFont,
              fontSize: `${siddurSettings.siddurSize}px`,
              fontWeight: siddurSettings.siddurBold ? 700 : 600,
            }}
          >
            {section.title}
          </span>
        </div>
        <span className="ml-2" style={{ color: theme.textColor, opacity: 0.5 }}>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Prayer lines */}
      {open && (
        <div
        className="pb-4 pt-2 space-y-1.5 animate-fade-in border-t"
          style={{ direction: "rtl", paddingInline: gutter, borderColor: `${theme.accentColor}22` }}
        >
          {section.lines.map((line, i) => (
            <SiddurLine key={i} html={line} s={lineSettings} />
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── ContinuousReader ───────────────────────────────────── */
const ContinuousReader = ({ sections }: { sections: SiddurSection[] }) => {
  const [visibleCount, setVisibleCount] = useState(8);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { settings: siddurSettings } = useFontAndColorSettings();
  const { theme } = useSiddurTheme();
  const gutter = readingGutter(siddurSettings.siddurContentWidth);
  const lineSettings: SiddurLineSettings = {
    ...siddurSettings,
    textAlignment: siddurSettings.siddurTextAlignment,
    lineHeight: siddurSettings.siddurLineHeight,
    lineHeightCustom: siddurSettings.siddurLineHeightCustom,
    letterSpacing: siddurSettings.siddurLetterSpacing,
    letterSpacingCustom: siddurSettings.siddurLetterSpacingCustom,
    wordSpacing: siddurSettings.siddurWordSpacing,
  };

  // Reset when sections array changes (e.g. tab switch)
  useEffect(() => { setVisibleCount(8); }, [sections]);

  useEffect(() => {
    if (visibleCount >= sections.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(v => Math.min(v + 8, sections.length)); },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, sections.length]);

  return (
    <div className="space-y-6 pb-8" dir="rtl">
      {sections.slice(0, visibleCount).map((sec, i) => (
        <div key={i}>
          <h3
            className="mb-1 flex items-center gap-2"
            style={{
              color: theme.accentColor,
              fontFamily: siddurSettings.siddurFont,
              fontSize: `${siddurSettings.siddurSize}px`,
              fontWeight: siddurSettings.siddurBold ? 700 : 600,
            }}
          >
            <span className="inline-block w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: theme.accentColor, opacity: 0.7 }} />
            {sec.title}
          </h3>
          <Divider />
          <div
            data-siddur-card
            className="space-y-1.5 mt-2 rounded-xl border py-3"
            style={{ paddingInline: gutter, background: theme.cardBg, borderColor: theme.cardBorder, ...siddurCardChrome(theme) }}
          >
            {sec.lines.map((line, j) => (
              <SiddurLine key={j} html={line} s={lineSettings} />
            ))}
          </div>
        </div>
      ))}
      {visibleCount < sections.length && (
        <div ref={sentinelRef} className="flex justify-center items-center py-4 gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: theme.accentColor }} />
          <span className="text-sm" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
            טוען {sections.length - visibleCount} סעיפים נוספים...
          </span>
        </div>
      )}
    </div>
  );
};

/* ─── CategoryPane ───────────────────────────────────────── */
const CategoryPane = ({
  nusach,
  catId,
  viewMode,
}: {
  nusach: string;
  catId: string;
  viewMode: "accordion" | "continuous";
}) => {
  const { sections, catName, loading, error } = useSiddurSections(nusach, catId);
  const { settings: siddurSettings } = useFontAndColorSettings();
  const { theme } = useSiddurTheme();

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.accentColor }} />
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
          טוען סידור...
        </p>
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4" dir="rtl">
        <div className="rounded-xl p-6 text-center max-w-sm border border-border" style={{ background: "hsl(var(--card))" }}>
          <span className="text-3xl mb-3 block">📖</span>
          <p className="font-semibold text-foreground mb-2" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
            הסידור עדיין בהורדה
          </p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );

  if (!sections || !sections.length)
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground" dir="rtl">
        <BookMarked className="h-10 w-10 opacity-30" />
        <p className="text-sm">אין תוכן זמין כרגע</p>
      </div>
    );

  return (
    <div className="pb-8">
      <OrnamentTitle text={catName} fontSize={siddurSettings.siddurSize} />
      <Divider />
      <div className="mt-4">
        {viewMode === "continuous"
          ? <ContinuousReader sections={sections} />
          : (
            <div className="space-y-1">
              {sections.map((sec, i) => (
                <SectionCard key={`${sec.title}-${i}`} section={sec} initialOpen={i === 0} />
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
};

/* ─── CategorySectionsBlock (used by FullContinuousPane) ─── */
const SERIF = "'Noto Serif Hebrew', 'David Libre', serif";

const CategorySectionsBlock = ({ nusach, cat }: { nusach: string; cat: { id: string; name: string } }) => {
  const { sections, loading } = useSiddurSections(nusach, cat.id);
  const { settings: siddurSettings } = useFontAndColorSettings();
  const { theme } = useSiddurTheme();
  const gutter = readingGutter(siddurSettings.siddurContentWidth);
  const lineSettings: SiddurLineSettings = {
    ...siddurSettings,
    textAlignment: siddurSettings.siddurTextAlignment,
    lineHeight: siddurSettings.siddurLineHeight,
    lineHeightCustom: siddurSettings.siddurLineHeightCustom,
    letterSpacing: siddurSettings.siddurLetterSpacing,
    letterSpacingCustom: siddurSettings.siddurLetterSpacingCustom,
    wordSpacing: siddurSettings.siddurWordSpacing,
  };
  if (loading)
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: theme.accentColor }} />
      </div>
    );
  if (!sections?.length) return null;
  return (
    <div className="mb-10">
      <OrnamentTitle text={cat.name} fontSize={siddurSettings.siddurSize} />
      <Divider />
      <div className="mt-4 space-y-6">
        {sections.map((sec, i) => (
          <div key={i}>
            <h3
              className="mb-1 flex items-center gap-2"
              style={{
                color: theme.accentColor,
                fontFamily: siddurSettings.siddurFont,
                fontSize: `${siddurSettings.siddurSize}px`,
                fontWeight: siddurSettings.siddurBold ? 700 : 600,
              }}
            >
              <span className="inline-block w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: theme.accentColor, opacity: 0.7 }} />
              {sec.title}
            </h3>
            <div
              data-siddur-card
              className="space-y-1.5 mt-2 rounded-xl border py-3"
              style={{ paddingInline: gutter, background: theme.cardBg, borderColor: theme.cardBorder, ...siddurCardChrome(theme) }}
            >
              {sec.lines.map((line, j) => (
                <SiddurLine key={j} html={line} s={lineSettings} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── FullContinuousPane ─────────────────────────────────── */
// Renders ALL categories in a single infinite scroll, loading one category at a time
const FullContinuousPane = ({ nusach }: { nusach: string }) => {
  const { categories, loading: catsLoading } = useSiddurCategories(nusach);
  const { theme } = useSiddurTheme();
  const [visibleCount, setVisibleCount] = useState(1);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleCount(1); }, [nusach]);

  useEffect(() => {
    if (visibleCount >= categories.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(v => Math.min(v + 1, categories.length)); },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, categories.length]);

  if (catsLoading)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.accentColor }} />
        <p className="text-sm text-muted-foreground" style={{ fontFamily: SERIF }}>טוען סידור...</p>
      </div>
    );

  return (
    <div className="pb-8" dir="rtl">
      {categories.slice(0, visibleCount).map(cat => (
        <CategorySectionsBlock key={cat.id} nusach={nusach} cat={cat} />
      ))}
      {visibleCount < categories.length && (
        <div ref={sentinelRef} className="flex justify-center items-center py-6 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: theme.accentColor }} />
          <span className="text-sm" style={{ fontFamily: SERIF }}>
            טוען {categories[visibleCount]?.name}...
          </span>
        </div>
      )}
    </div>
  );
};

/* ─── SplitPane — master/detail: section list | prayer text ─ */
const SplitPane = ({ nusach, catId }: { nusach: string; catId: string }) => {
  const { sections, catName, loading } = useSiddurSections(nusach, catId);
  const [selIdx, setSelIdx] = useState(0);
  const { settings: s } = useFontAndColorSettings();
  const { displayStyle } = useSiddurDisplayStyle();
  const { theme } = useSiddurTheme();
  const ornate = displayStyle === "ornate";
  const gutter = readingGutter(s.siddurContentWidth);
  const lineSettings: SiddurLineSettings = {
    ...s,
    textAlignment: s.siddurTextAlignment,
    lineHeight: s.siddurLineHeight,
    lineHeightCustom: s.siddurLineHeightCustom,
    letterSpacing: s.siddurLetterSpacing,
    letterSpacingCustom: s.siddurLetterSpacingCustom,
    wordSpacing: s.siddurWordSpacing,
  };

  useEffect(() => { setSelIdx(0); }, [catId, nusach]);

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.accentColor }} />
      </div>
    );
  if (!sections?.length) return null;

  const sec = sections[Math.min(selIdx, sections.length - 1)];

  return (
    <div className="flex flex-col sm:flex-row gap-0 pb-8" dir="rtl">
      {/* Section nav panel (right side in RTL) */}
      <div
        className="w-full sm:w-52 flex-shrink-0 border-b sm:border-b-0 sm:border-l border-border/50 max-h-36 sm:max-h-none overflow-y-auto"
        style={{ paddingLeft: "0.5rem" }}
      >
        <div
          className="text-xs font-bold mb-2 px-2 py-1.5 text-center sticky top-0 z-10"
          style={{
            color: theme.accentColor,
            fontFamily: "'Noto Serif Hebrew', serif",
            background: ornate ? "#fffdf7" : theme.headerBg,
            borderBottom: `1px solid ${theme.accentColor}22`,
          }}
        >
          {catName}
        </div>
        <div className="flex sm:flex-col flex-row gap-1 sm:gap-0 sm:space-y-0.5 pb-2 sm:pb-4 overflow-x-auto sm:overflow-x-hidden">
          {sections.map((item, i) => (
            <button
              key={i}
              onClick={() => setSelIdx(i)}
              className="sm:w-full flex-shrink-0 whitespace-nowrap sm:whitespace-normal text-right text-sm px-2.5 py-2 rounded-lg transition-all leading-snug"
              style={{
                fontFamily: "'Noto Serif Hebrew', serif",
                color: i === selIdx ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                background: i === selIdx ? `${theme.accentColor}18` : "transparent",
                borderRight: i === selIdx ? `3px solid ${theme.accentColor}` : "3px solid transparent",
                fontWeight: i === selIdx ? 600 : 400,
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      {/* Prayer text (left side in RTL) */}
      <div className="flex-1 min-w-0 pt-4 sm:pt-0 pr-0 sm:pr-4 overflow-y-auto">
        <OrnamentTitle text={sec.title} fontSize={s.siddurSize} />
        <Divider />
        <div
          data-siddur-card
          className="space-y-1.5 mt-3 rounded-xl border py-4"
          style={{
            paddingInline: gutter,
            background: ornate ? "linear-gradient(180deg, #fffdfa 0%, #fffaf0 100%)" : theme.cardBg,
            borderColor: ornate ? `${theme.accentColor}44` : theme.cardBorder,
            ...(ornate ? { borderRadius: `${siddurAppearance(theme).cornerRadius}px`, borderWidth: `${siddurAppearance(theme).borderWidth}px`, boxShadow: `0 4px 16px ${theme.accentColor}1f` } : siddurCardChrome(theme)),
          }}
        >
          {sec.lines.map((line, i) => (
            <SiddurLine key={i} html={line} s={lineSettings} />
          ))}
        </div>

        {/* Prev / Next */}
        <div className="flex justify-between items-center mt-4 gap-2">
          <button
            onClick={() => setSelIdx(v => Math.min(v + 1, sections.length - 1))}
            disabled={selIdx >= sections.length - 1}
            className="text-xs px-3 py-1.5 rounded-full disabled:opacity-30 transition-all"
            style={{ background: `${theme.accentColor}22`, color: theme.accentColor, border: `1px solid ${theme.accentColor}55` }}
          >
            « הבא
          </button>
          <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
            {selIdx + 1} / {sections.length}
          </span>
          <button
            onClick={() => setSelIdx(v => Math.max(v - 1, 0))}
            disabled={selIdx <= 0}
            className="text-xs px-3 py-1.5 rounded-full disabled:opacity-30 transition-all"
            style={{ background: `${theme.accentColor}22`, color: theme.accentColor, border: `1px solid ${theme.accentColor}55` }}
          >
            קודם »
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── BookColumnPane — two CSS-columns book layout ────────── */
const BookColumnPane = ({ nusach, catId }: { nusach: string; catId: string }) => {
  const { sections, catName, loading } = useSiddurSections(nusach, catId);
  const { settings: s } = useFontAndColorSettings();
  const { theme } = useSiddurTheme();
  const [isMobileView, setIsMobileView] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobileView(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const lineSettings: SiddurLineSettings = {
    ...s,
    textAlignment: s.siddurTextAlignment,
    lineHeight: s.siddurLineHeight,
    lineHeightCustom: s.siddurLineHeightCustom,
    letterSpacing: s.siddurLetterSpacing,
    letterSpacingCustom: s.siddurLetterSpacingCustom,
    wordSpacing: s.siddurWordSpacing,
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.accentColor }} />
      </div>
    );
  if (!sections?.length) return null;

  return (
    <div className="pb-8" dir="rtl">
      <OrnamentTitle text={catName} fontSize={s.siddurSize} />
      <Divider />
      <div
        style={{
          columnCount: isMobileView ? 1 : 2,
          columnGap: "2.5rem",
          columnRule: isMobileView ? undefined : `1px solid ${theme.accentColor}44`,
          direction: "rtl",
        }}
      >
        {sections.map((sec, i) => (
          <div
            key={i}
            style={{ breakInside: "avoid", pageBreakInside: "avoid", marginBottom: "1.5rem" }}
          >
            <div className="flex items-center gap-2 mb-1.5" style={{ direction: "rtl" }}>
              <span
                className="inline-block h-3 w-0.5 rounded-full flex-shrink-0"
                style={{ background: theme.accentColor, opacity: 0.7 }}
              />
              <span
                style={{
                  color: theme.accentColor,
                  fontFamily: "'Noto Serif Hebrew', serif",
                  fontSize: `${Math.round(s.siddurSize * 0.85)}px`,
                  fontWeight: 700,
                }}
              >
                {sec.title}
              </span>
            </div>
            <div className="space-y-1">
              {sec.lines.map((line, j) => (
                <SiddurLine key={j} html={line} s={lineSettings} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── TextFiltersBar (nikud / taamim toggles) ───────────── */
const TextFiltersBar = ({ scope }: { scope: "siddur" | "tehillim" }) => {
  const { settings, updateSettings } = useFontAndColorSettings();
  const { displayStyle, setDisplayStyle } = useSiddurDisplayStyle();
  const { theme } = useSiddurTheme();
  const showNikud  = settings.showNikud  ?? true;
  const showTaamim = settings.showTaamim ?? true;
  const widthOrder: Array<"narrow" | "normal" | "wide" | "full"> = ["narrow", "normal", "wide", "full"];
  const widthLabels: Record<"narrow" | "normal" | "wide" | "full", string> = {
    narrow: "צר",
    normal: "רגיל",
    wide: "רחב",
    full: "מלא",
  };
  const scopedWidth = scope === "tehillim" ? settings.tehillimContentWidth : settings.siddurContentWidth;
  const scopedNextWidth = widthOrder[(widthOrder.indexOf(scopedWidth) + 1) % widthOrder.length];

  const pill = (active: boolean, onClick: () => void, label: string, example: string) => (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all select-none"
      style={{
        background: active ? theme.accentColor : "hsl(var(--muted))",
        color:      active ? "hsl(var(--sidebar-background))" : "hsl(var(--muted-foreground))",
        boxShadow:  active ? `0 2px 8px ${theme.accentColor}44` : "none",
        fontFamily: "'Noto Serif Hebrew', serif",
        opacity:    active ? 1 : 0.6,
      }}
    >
      <span style={{ fontSize: "0.85em", opacity: active ? 1 : 0.5 }}>{example}</span>
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap justify-center gap-2 mb-3">
      {pill(showNikud,  () => updateSettings({ showNikud:  !showNikud  }), "ניקוד",  "בָּ")}
      {pill(showTaamim, () => updateSettings({ showTaamim: !showTaamim }), "טעמים", "֑")}
      {pill(true, () => updateSettings(scope === "tehillim" ? { tehillimContentWidth: scopedNextWidth } : { siddurContentWidth: scopedNextWidth }), `שוליים: ${widthLabels[scopedWidth]}`, "↔")}
      {pill(displayStyle === "ornate", () => setDisplayStyle(displayStyle === "ornate" ? "classic" : "ornate"), "תצוגה מפוארת", "✦")}
    </div>
  );
};

/* ─── TehillimPane ───────────────────────────────────────── */
const TEHILLIM_DAILY: Record<number, number>   = { 0: 24, 1: 48, 2: 82, 3: 94, 4: 81, 5: 93, 6: 92 };
const TEHILLIM_DAY_HEB: Record<number, string> = { 0: "ראשון", 1: "שני", 2: "שלישי", 3: "רביעי", 4: "חמישי", 5: "שישי", 6: "שבת" };

const TehillimPane = () => {
  const { tehillim, loading } = useTehillimData();
  const { displayStyle } = useSiddurDisplayStyle();
  const { theme } = useSiddurTheme();
  const ornate = displayStyle === "ornate";
  const [chapter, setChapter] = useState(1);
  const [pasuk,   setPasuk]   = useState<number | null>(null);  // 1-based
  const [level,   setLevel]   = useState<"chapter" | "text">("chapter");
  const [mode,    setMode]    = useState<"select" | "daily" | "continuous">(
    () => (localStorage.getItem("tehillim-view-mode") as "select" | "daily" | "continuous") ?? "select"
  );
  const [contentTab, setContentTab] = useState<"text" | "commentary">("text");
  const [commentaryExpanded, setCommentaryExpanded] = useState(true);
  const { settings: tehillimSettings } = useFontAndColorSettings();
  const textRef               = useRef<HTMLDivElement>(null);
  const continuousSentinelRef = useRef<HTMLDivElement>(null);
  const verseRefs             = useRef<(HTMLParagraphElement | null)[]>([]);
  const [visibleCount, setVisibleCount] = useState(5);

  const handleChapterSelect = (ch: number) => {
    setChapter(ch);
    setPasuk(null);
    verseRefs.current = [];
    setLevel("text");
    setTimeout(() => textRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const handlePasukSelect = (idx: number) => {
    setPasuk(idx + 1);
    setTimeout(() => verseRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  };

  useEffect(() => { setVisibleCount(5); }, [mode]);
  useEffect(() => { setLevel("chapter"); setPasuk(null); }, [mode]);

  useEffect(() => {
    if (mode !== "continuous" || !tehillim) return;
    const entries = Object.keys(tehillim).length;
    if (visibleCount >= entries) return;
    const el = continuousSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(v => Math.min(v + 5, entries)); },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [mode, visibleCount, tehillim]);

  const setModeWithSave = (m: "select" | "daily" | "continuous") => {
    localStorage.setItem("tehillim-view-mode", m);
    setMode(m);
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.accentColor }} />
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
          טוען תהילים...
        </p>
      </div>
    );

  if (!tehillim)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground" dir="rtl">
        <BookOpen className="h-10 w-10 opacity-30" />
        <p className="text-sm">תהילים עדיין בהורדה — נסה לרענן</p>
      </div>
    );

  const allChapters  = Array.from({ length: 150 }, (_, i) => tehillim[String(i + 1)]).filter(Boolean);
  const current      = tehillim[String(chapter)];
  const dayOfWeek    = new Date().getDay();
  const todayChapter = TEHILLIM_DAILY[dayOfWeek];
  const todayDayName = TEHILLIM_DAY_HEB[dayOfWeek];
  const dailyCurrent = tehillim[String(todayChapter)];

  const textStyle: React.CSSProperties = {
    fontFamily: tehillimSettings.tehillimFont,
    fontSize:   `${tehillimSettings.tehillimSize}px`,
    fontWeight: tehillimSettings.tehillimBold ? 700 : 400,
    textAlign:  tehillimSettings.tehillimTextAlignment as React.CSSProperties["textAlign"],
    lineHeight: lineHeightCSS(tehillimSettings.tehillimLineHeight, tehillimSettings.tehillimLineHeightCustom),
  };

  const showNikud  = tehillimSettings.showNikud  ?? true;
  const showTaamim = tehillimSettings.showTaamim ?? true;
  const gutter = readingGutter(tehillimSettings.tehillimContentWidth);
  const nikudTextStyle = withNikudTypography(
    tehillimSettings.tehillimFont,
    lineHeightCSS(tehillimSettings.tehillimLineHeight, tehillimSettings.tehillimLineHeightCustom),
    showNikud,
    showTaamim
  );

  const verseNumStyle: React.CSSProperties = {
    color: theme.accentColor, fontSize: "0.7em", opacity: 0.9,
    fontFamily: "'Noto Serif Hebrew', serif",
    minWidth: "1.4em", verticalAlign: "super", lineHeight: 1,
    display: "inline-block", marginLeft: "0.3em",
  };

  const contentTabs = (
    <div className="mb-4 flex justify-center" data-layout="tehillim-content-tabs">
      <div
        className="inline-flex items-center gap-1 rounded-2xl border p-1 shadow-sm"
        style={{ background: "hsl(var(--card))", borderColor: `${theme.accentColor}55` }}
      >
        {([[
          "text", "תהילים",
        ], [
          "commentary", "פירושים",
        ]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={contentTab === id}
            onClick={() => setContentTab(id)}
            className="min-w-[94px] rounded-xl border px-4 py-2 text-sm font-bold transition-all"
            style={contentTab === id ? {
              color: "hsl(var(--primary))",
              borderColor: theme.accentColor,
              background: `${theme.accentColor}10`,
              boxShadow: `0 0 0 1px ${theme.accentColor}18`,
            } : {
              color: "hsl(var(--primary))",
              borderColor: "transparent",
              background: "transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  if (contentTab === "commentary") {
    // 27 is the stable application id reserved for Tehillim commentary rows.
    // Uploaded rows in `commentaries` can therefore use sefer_id=27 and are
    // picked up automatically by the same loader used by Chumash commentaries.
    const commentaryPesukim: FlatPasuk[] = current.lines.map((line, index) => ({
      id: chapter * 1000 + index + 1,
      sefer: 27,
      sefer_name: "תהילים",
      perek: chapter,
      pasuk_num: index + 1,
      text: stripText(cleanLine(line), showNikud, showTaamim),
      content: [],
    }));

    const chapterNavigation = (
      <div className="flex min-w-0 items-center justify-center gap-2" data-layout="tehillim-commentary-navigation">
        <button
          type="button"
          aria-label="פרק קודם"
          disabled={chapter <= 1}
          onClick={() => setChapter(value => Math.max(1, value - 1))}
          className="h-8 w-8 rounded-lg text-lg disabled:opacity-30"
        >
          ›
        </button>
        <span className="min-w-[92px] text-center text-sm font-bold text-primary">פרק {heNum(chapter)}</span>
        <button
          type="button"
          aria-label="פרק הבא"
          disabled={chapter >= 150}
          onClick={() => setChapter(value => Math.min(150, value + 1))}
          className="h-8 w-8 rounded-lg text-lg disabled:opacity-30"
        >
          ‹
        </button>
      </div>
    );

    return (
      <div className="pb-10 px-1" dir="rtl" data-layout="tehillim-commentary-pane">
        <OrnamentTitle text="תהילים" fontSize={tehillimSettings.tehillimSize} />
        <Divider />
        {contentTabs}
        <div
          data-layout="tehillim-commentary-controls"
          data-layout-label="בקרות פירושי תהילים"
          className="mb-4 grid w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 rounded-2xl border border-accent/20 bg-card/35 px-3 py-3 shadow-sm"
          dir="ltr"
        >
          <div className="flex h-11 w-11 items-center justify-center justify-self-start">
            <MinimizeButton
              variant="global"
              isMinimized={!commentaryExpanded}
              onClick={() => setCommentaryExpanded(value => !value)}
            />
          </div>
          <div className="min-w-0 text-center text-sm font-bold text-primary" dir="rtl">
            תצוגת פירושים
          </div>
          <div aria-hidden="true" className="h-11 w-11" />
        </div>
        <FontAndColorSettingsProvider scopeKey="tehillim-commentary">
          <LuxuryTextView
            key={`tehillim-commentary-${chapter}`}
            pesukim={commentaryPesukim}
            expandAll={commentaryExpanded}
            navigation={chapterNavigation}
            settingsTitle="הגדרות תצוגת פירושי תהילים"
            commentaryStorageKey="tehillim-commentary-configs"
            availableCommentators={TEHILLIM_COMMENTATORS}
          />
        </FontAndColorSettingsProvider>
      </div>
    );
  }

  const renderVerseCard = (lines: string[], highlightPasuk: number | null, trackRefs = false) => (
    <div className="rounded-xl border border-border/50 py-5 space-y-3" style={{
      background: ornate ? "linear-gradient(180deg, #fffdfa 0%, #fff8eb 100%)" : "hsl(var(--card))",
      borderColor: ornate ? `${theme.accentColor}44` : undefined,
      boxShadow: ornate ? `0 6px 18px ${theme.accentColor}1f` : undefined,
      paddingInline: gutter,
    }}>
      {lines.map((line, i) => (
        <p
          key={i}
          ref={trackRefs ? (el => { verseRefs.current[i] = el; }) : undefined}
          className="leading-relaxed text-foreground transition-all rounded-lg"
          style={{
            ...textStyle,
            ...nikudTextStyle,
            background:  highlightPasuk === i + 1 ? `${theme.accentColor}18` : "transparent",
            padding:     highlightPasuk === i + 1 ? "2px 6px" : "0",
            borderRight: highlightPasuk === i + 1 ? `3px solid ${theme.accentColor}` : "3px solid transparent",
          }}
        >
          <span style={verseNumStyle}>{heNum(i + 1)}</span>
          {stripText(cleanLine(line), showNikud, showTaamim)}
        </p>
      ))}
    </div>
  );

  return (
    <div className="pb-10 px-1" dir="rtl">
      <OrnamentTitle text="תהילים" fontSize={tehillimSettings.tehillimSize} />
      <Divider />
      {contentTabs}

      {/* ── Mode toggle — 3 pills ── */}
      <div className="flex justify-center mb-4">
        <div
          className="flex gap-1 rounded-full p-1"
          style={{ background: "hsl(var(--muted))", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)" }}
        >
          {([
            { id: "select"     as const, icon: <BookOpen   className="h-3.5 w-3.5" />, label: "בחר פרק"     },
            { id: "daily"      as const, icon: <Star       className="h-3.5 w-3.5" />, label: "מזמור היום"  },
            { id: "continuous" as const, icon: <ScrollText className="h-3.5 w-3.5" />, label: "קריאה רציפה" },
          ]).map(m => (
            <button
              key={m.id}
              onClick={() => setModeWithSave(m.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: mode === m.id ? theme.accentColor : "transparent",
                color:      mode === m.id ? "hsl(var(--sidebar-background))" : "hsl(var(--muted-foreground))",
                boxShadow:  mode === m.id ? `0 2px 8px ${theme.accentColor}55` : "none",
                fontFamily: "'Noto Serif Hebrew', 'David Libre', serif",
              }}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ SELECT mode ═══ */}
      {mode === "select" && (
        <>
          {level === "chapter" && (
            <>
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-xs text-muted-foreground">מזמור היום:</span>
                <button
                  onClick={() => handleChapterSelect(todayChapter)}
                  className="text-xs font-bold px-2 py-0.5 rounded-full transition-all"
                  style={{ background: `${theme.accentColor}22`, color: theme.accentColor, border: `1px solid ${theme.accentColor}55` }}
                >
                  פרק {heNum(todayChapter)} ({todayChapter})
                </button>
              </div>

              <div className="grid gap-1 mb-4 justify-items-center grid-cols-7 sm:grid-cols-10 lg:grid-cols-[repeat(15,minmax(0,1fr))]">
                {Array.from({ length: 150 }, (_, i) => i + 1).map(ch => (
                  <button
                    key={ch}
                    onClick={() => handleChapterSelect(ch)}
                    title={`פרק ${ch}`}
                    className="w-full aspect-square flex items-center justify-center rounded text-[10px] sm:text-xs font-medium transition-all leading-none"
                    style={
                      ch === chapter
                        ? { background: theme.accentColor, color: "hsl(var(--sidebar-background))", boxShadow: `0 0 0 2px ${theme.accentColor}` }
                        : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                    }
                  >
                    {heNum(ch)}
                  </button>
                ))}
              </div>
            </>
          )}

          {level === "text" && current && (
            <div key={chapter} className="animate-fade-in">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs mb-3 flex-wrap" dir="ltr">
                <button
                  onClick={() => { setLevel("chapter"); setPasuk(null); }}
                  className="font-medium hover:underline transition-colors"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  תהילים
                </button>
                <span className="opacity-40 text-foreground">›</span>
                <span className="font-semibold" style={{ color: theme.accentColor }}>
                  {`פרק ${heNum(chapter)} (${chapter})`}
                </span>
                {pasuk && (
                  <>
                    <span className="opacity-40 text-foreground">›</span>
                    <span className="font-semibold" style={{ color: theme.accentColor }}>פסוק {heNum(pasuk)}</span>
                  </>
                )}
              </div>

              {/* Verse picker row */}
              <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden mb-3" style={{ scrollbarWidth: "none" }}>
                <div className="flex gap-1 min-w-max pb-1">
                  {current.lines.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => handlePasukSelect(i)}
                      className="min-w-[30px] h-7 px-1 rounded-md text-[10px] font-bold transition-all"
                      style={{
                        background: pasuk === i + 1 ? theme.accentColor : "hsl(var(--muted))",
                        color:      pasuk === i + 1 ? "hsl(var(--sidebar-background))" : "hsl(var(--muted-foreground))",
                        boxShadow:  pasuk === i + 1 ? `0 2px 6px ${theme.accentColor}55` : "none",
                        fontFamily: "'Noto Serif Hebrew', serif",
                      }}
                    >
                      {heNum(i + 1)}
                    </button>
                  ))}
                </div>
              </div>

              <OrnamentTitle text={`פרק ${heNum(chapter)} — ${current.title || "תהלים"}`} fontSize={tehillimSettings.tehillimSize} />
              <div ref={textRef}>
                {renderVerseCard(current.lines, pasuk, true)}
              </div>

              <div className="flex justify-between items-center mt-4 gap-2">
                <button
                  onClick={() => chapter > 1 && handleChapterSelect(chapter - 1)}
                  disabled={chapter <= 1}
                  className="text-xs px-3 py-1.5 rounded-full disabled:opacity-30 transition-all"
                  style={{ background: `${theme.accentColor}22`, color: theme.accentColor, border: `1px solid ${theme.accentColor}55` }}
                >
                  פרק קודם «
                </button>
                <button
                  onClick={() => setLevel("chapter")}
                  className="text-xs px-3 py-1.5 rounded-full transition-all"
                  style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                >
                  כל הפרקים
                </button>
                <button
                  onClick={() => chapter < 150 && handleChapterSelect(chapter + 1)}
                  disabled={chapter >= 150}
                  className="text-xs px-3 py-1.5 rounded-full disabled:opacity-30 transition-all"
                  style={{ background: `${theme.accentColor}22`, color: theme.accentColor, border: `1px solid ${theme.accentColor}55` }}
                >
                  » פרק הבא
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ DAILY mode ═══ */}
      {mode === "daily" && dailyCurrent && (
        <div className="animate-fade-in">
          <div
            className="flex items-center justify-center gap-2 mb-4 py-2.5 rounded-xl"
            style={{ background: `${theme.accentColor}12`, border: `1px solid ${theme.accentColor}30` }}
          >
            <Star className="h-4 w-4 flex-shrink-0" style={{ color: theme.accentColor }} />
            <span
              className="text-sm font-semibold"
              style={{ color: theme.accentColor, fontFamily: "'Noto Serif Hebrew', serif" }}
            >
              {`מזמור של יום ${todayDayName} — פרק ${heNum(todayChapter)}`}
            </span>
          </div>
          <OrnamentTitle text={`פרק ${heNum(todayChapter)} — ${dailyCurrent.title || "תהלים"}`} fontSize={tehillimSettings.tehillimSize} />
          {renderVerseCard(dailyCurrent.lines, null, false)}
        </div>
      )}

      {/* ═══ CONTINUOUS mode ═══ */}
      {mode === "continuous" && (
        <div className="space-y-8">
          {allChapters.slice(0, visibleCount).map(ch => (
            <div key={ch.chapter}>
              <h3
                className="mb-2 flex items-center gap-2"
                style={{
                  color:      theme.accentColor,
                  fontFamily: tehillimSettings.tehillimFont,
                  fontSize:   `${tehillimSettings.tehillimSize}px`,
                  fontWeight: tehillimSettings.tehillimBold ? 700 : 600,
                }}
              >
                <span className="inline-block w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: theme.accentColor, opacity: 0.7 }} />
                {`פרק ${heNum(ch.chapter)}`}
                {ch.title && ch.title !== "תהילים" && (
                  <span style={{ fontSize: "0.7em", fontWeight: 400, opacity: 0.7 }}>— {ch.title}</span>
                )}
              </h3>
              <Divider />
              {renderVerseCard(ch.lines, null, false)}
            </div>
          ))}
          {visibleCount < allChapters.length && (
            <div ref={continuousSentinelRef} className="flex justify-center items-center py-6 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: theme.accentColor }} />
              <span className="text-sm" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
                טוען פרקים נוספים...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── KriaPane ───────────────────────────────────────────── */
const ALIYAH_NUM_HE: Record<number, string> = { 1: 'ראשון', 2: 'שני', 3: 'שלישי' };

function pasukRef(ref: string): string {
  const [p, v] = ref.split(':').map(Number);
  return `פרק\u00a0${p} פסוק\u00a0${v}`;
}

const WeekdayReadingCard = ({ onNavigate }: { onNavigate: (seferId: number, perek: number) => void }) => {
  const [leyning, setLeyning] = useState<WeekdayLeyning | null>(null);
  const [loadingL, setLoadingL] = useState(true);
  const { theme } = useSiddurTheme();

  useEffect(() => {
    try { setLeyning(getWeekdayLeyning(getCalendarPreference())); }
    catch { /* ignore */ }
    setLoadingL(false);
  }, []);

  if (loadingL)
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.accentColor }} />
      </div>
    );

  if (!leyning)
    return (
      <div
        className="my-4 rounded-xl border px-4 py-3 text-sm text-right text-muted-foreground"
        dir="rtl"
        style={{ borderColor: `${theme.accentColor}30`, background: `${theme.accentColor}0a` }}
      >
        קריאת שני וחמישי אינה זמינה כעת
      </div>
    );

  const todayLabel = (() => {
    const d = new Date().getDay();
    return d === 1 ? 'שני' : d === 4 ? 'חמישי' : 'שני / חמישי';
  })();

  return (
    <div
      className="my-4 rounded-xl border overflow-hidden"
      dir="rtl"
      style={{ borderColor: `${theme.accentColor}44`, boxShadow: `0 2px 12px ${theme.accentColor}18` }}
    >
      {/* Card header */}
      <div
        className="px-4 py-3 flex items-center justify-between gap-3"
        style={{ background: `${theme.accentColor}14`, borderBottom: `1px solid ${theme.accentColor}30` }}
      >
        <Button
          size="sm"
          onClick={() => onNavigate(leyning.seferId, leyning.openPerek)}
          className="flex items-center gap-1.5 text-xs font-medium shrink-0"
          style={{ background: theme.accentColor, color: '#1a1a1a' }}
        >
          <ExternalLink className="h-3 w-3" />
          פתח בסידור
        </Button>
        <div className="text-right">
          <p className="font-bold" style={{ color: theme.accentColor, fontFamily: "'Noto Serif Hebrew', serif", fontSize: '1rem' }}>
            {leyning.parshaHe}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            קריאת {todayLabel} שבוע זה — ג׳ עולים
          </p>
        </div>
      </div>

      {/* Aliyot rows */}
      <div className="divide-y divide-border/30">
        {leyning.aliyot.map((a, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3" dir="rtl">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: `${theme.accentColor}22`, color: theme.accentColor, fontFamily: "'Noto Serif Hebrew', serif" }}
            >
              {ALIYAH_NUM_HE[i + 1] ?? `עלייה ${i + 1}`}
            </span>
            <div className="flex-1 text-right">
              <span className="text-sm font-medium" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
                {a.bookHe} {pasukRef(a.begin)}
              </span>
              <span className="text-xs text-muted-foreground"> עד </span>
              <span className="text-sm font-medium" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
                {pasukRef(a.end)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{a.verses}&nbsp;פסוקים</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const KRIA_BLESSINGS: SiddurSection[] = [
  {
    title: "ברכה לפני הקריאה",
    lines: [
      "בָּרְכוּ אֶת יְיָ הַמְבֹרָךְ׃",
      "בָּרוּךְ יְיָ הַמְבֹרָךְ לְעוֹלָם וָעֶד׃",
      "בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם אֲשֶׁר בָּחַר בָּנוּ מִכָּל הָעַמִּים וְנָתַן לָנוּ אֶת תּוֹרָתוֹ׃ בָּרוּךְ אַתָּה יְיָ נוֹתֵן הַתּוֹרָה׃",
    ],
  },
  {
    title: "ברכה לאחר הקריאה",
    lines: [
      "בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם אֲשֶׁר נָתַן לָנוּ תּוֹרַת אֱמֶת וְחַיֵּי עוֹלָם נָטַע בְּתוֹכֵנוּ׃ בָּרוּךְ אַתָּה יְיָ נוֹתֵן הַתּוֹרָה׃",
    ],
  },
  {
    title: "ברכות ההפטרה (לפני)",
    lines: [
      "בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם אֲשֶׁר בָּחַר בִּנְבִיאִים טוֹבִים וְרָצָה בְדִבְרֵיהֶם הַנֶּאֱמָרִים בֶּאֱמֶת׃ בָּרוּךְ אַתָּה יְיָ הַבּוֹחֵר בַּתּוֹרָה וּבְמֹשֶׁה עַבְדּוֹ וּבְיִשְׂרָאֵל עַמּוֹ וּבִנְבִיאֵי הָאֱמֶת וָצֶדֶק׃",
    ],
  },
  {
    title: "ברכות ההפטרה (לאחר)",
    lines: [
      "בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם צוּר כָּל הָעוֹלָמִים צַדִּיק בְּכָל הַדּוֹרוֹת הָאֵל הַנֶּאֱמָן הָאוֹמֵר וְעוֹשֶׂה הַמְדַבֵּר וּמְקַיֵּם שֶׁכָּל דְּבָרָיו אֱמֶת וָצֶדֶק׃",
      "נֶאֱמָן אַתָּה הוּא יְיָ אֱלֹהֵינוּ וְנֶאֱמָנִים דְּבָרֶיךָ וְדָבָר אֶחָד מִדְּבָרֶיךָ אָחוֹר לֹא יָשׁוּב רֵיקָם כִּי אֵל מֶלֶךְ נֶאֱמָן וְרַחֲמָן אָתָּה׃ בָּרוּךְ אַתָּה יְיָ הָאֵל הַנֶּאֱמָן בְּכָל דְּבָרָיו׃",
    ],
  },
  {
    title: "מי שברך לעולה לתורה",
    lines: [
      "מִי שֶׁבֵּרַךְ אֲבוֹתֵינוּ אַבְרָהָם יִצְחָק וְיַעֲקֹב הוּא יְבָרֵךְ אֶת [שם] בַּעֲבוּר שֶׁעָלָה לִכְבוֹד הַמָּקוֹם וְלִכְבוֹד הַתּוֹרָה׃",
      "בִּשְׂכַר זֶה הַקָּדוֹשׁ בָּרוּךְ הוּא יִשְׁמְרֵהוּ וְיַצִּילֵהוּ מִכָּל צָרָה וְצוּקָה וּמִכָּל נֶגַע וּמַחֲלָה וְיִשְׁלַח בְּרָכָה וְהַצְלָחָה בְּכָל מַעֲשֵׂה יָדָיו וְיִזְכֶּה לַעֲלוֹת לְרֶגֶל עִם כָּל יִשְׂרָאֵל אֶחָיו׃ וְנֹאמַר אָמֵן׃",
    ],
  },
];

const KRIA_SCHEDULE = [
  { days: "שני וחמישי",   aliyot: "ג׳ עולים",            note: "ראשית הפרשה" },
  { days: "שבת שחרית",   aliyot: "ז׳ + מפטיר",          note: "קריאה שלמה" },
  { days: "שבת מנחה",    aliyot: "ג׳ עולים",            note: "פרשה הבאה" },
  { days: "ראש חודש",    aliyot: "ד׳ עולים",            note: "במדבר כח" },
  { days: "שלש רגלים",   aliyot: "ה׳ עולים",            note: "ענין היום" },
  { days: "ראש השנה",    aliyot: "ב׳ ספרי תורה",        note: "עקידה + מוסף" },
  { days: "יום כיפור",   aliyot: "ו׳ שחרית + ג׳ מנחה", note: "" },
];

const KriaPane = ({ onNavigate }: { onNavigate: (seferId?: number, perek?: number) => void }) => {
  const { theme } = useSiddurTheme();
  return (
  <div className="pb-8" dir="rtl">
    <OrnamentTitle text="קריאה בתורה" />
    <Divider />

    {/* Live Mon/Thu reading for this week */}
    <WeekdayReadingCard onNavigate={(sid, perek) => onNavigate(sid, perek)} />

    {/* Reading schedule table */}
    <div
      className="mb-4 rounded-xl border border-border/50 overflow-hidden"
      style={{ background: "hsl(var(--card))" }}
    >
      <div className="px-4 py-2 border-b border-border/40">
        <span className="text-xs font-bold text-muted-foreground tracking-wider">לוח קריאות</span>
      </div>
      {KRIA_SCHEDULE.map((row, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-between px-4 py-2.5 gap-2",
            i < KRIA_SCHEDULE.length - 1 && "border-b border-border/30"
          )}
          dir="rtl"
        >
          <div>
            <span
              className="font-semibold text-sm text-foreground"
              style={{ fontFamily: "'Noto Serif Hebrew', serif" }}
            >
              {row.days}
            </span>
            {row.note && (
              <span className="text-xs text-muted-foreground mr-1.5">— {row.note}</span>
            )}
          </div>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
            style={{ background: `${theme.accentColor}22`, color: theme.accentColor }}
          >
            {row.aliyot}
          </span>
        </div>
      ))}
    </div>

    {/* Blessings */}
    <div className="mt-2 space-y-1">
      {KRIA_BLESSINGS.map((sec, i) => (
        <SectionCard key={i} section={sec} initialOpen={i < 2} />
      ))}
    </div>
  </div>
  );
};

/* ─── Main Siddur component ──────────────────────────────── */
export const Siddur = () => {
  const navigate                = useNavigate();
  const omerInSeason            = useOmerSeason();
  const [nusach, setNusach]    = useState("sefard");
  const [catId, setCatId]      = useState("shacharit");
  const { user } = useAuth();
  const initialSiddurViewSettings = useRef(loadLegacySiddurViewSettings()).current;
  const { data: syncedViewSettings, setData: setSyncedViewSettings } = useSyncedState<SiddurViewSettings>({
    localStorageKey: "siddur-view-settings-v1",
    tableName: "user_settings",
    column: "siddur_display_settings",
    userId: user?.id ?? null,
    syncToCloud: !!user,
    defaultValue: initialSiddurViewSettings,
  });
  const viewMode = isViewMode(syncedViewSettings.viewMode) ? syncedViewSettings.viewMode : "accordion";
  const displayStyle = isDisplayStyle(syncedViewSettings.displayStyle) ? syncedViewSettings.displayStyle : "classic";

  const [activeTheme, setActiveTheme] = useState<SiddurTheme>(() => {
    const saved = localStorage.getItem(ACTIVE_THEME_KEY);
    if (saved) {
      const found = SIDDUR_PRESET_THEMES.find(t => t.id === saved);
      if (found) return found;
      const savedCustom = loadCustomThemes().find(item => item.id === saved) ?? loadCustomTheme();
      if (saved === savedCustom.id || saved.startsWith("custom")) return savedCustom;
    }
    return SIDDUR_PRESET_THEMES[0];
  });
  const [customTheme, setCustomTheme] = useState<SiddurTheme>(loadCustomTheme);
  const [customThemes, setCustomThemes] = useState<SiddurTheme[]>(loadCustomThemes);
  const [publicThemes, setPublicThemes] = useState<SiddurTheme[]>([]);

  const loadPublicThemes = useCallback(async () => {
    const { data, error } = await supabase
      .from("siddur_themes")
      .select("id,name,theme,updated_at")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Failed to load public Siddur themes:", error);
      return;
    }
    setPublicThemes((data ?? []).map(row => normalizeSiddurTheme({
      ...(row.theme as unknown as SiddurTheme),
      id: `public:${row.id}`,
      name: row.name,
      emoji: (row.theme as unknown as SiddurTheme)?.emoji || "🎨",
      isCustom: true,
    })));
  }, []);

  useEffect(() => { void loadPublicThemes(); }, [loadPublicThemes]);

  const publishTheme = useCallback(async (draft: SiddurTheme): Promise<SiddurTheme> => {
    if (!user) throw new Error("יש להתחבר כמנהל כדי לפרסם ערכת נושא");
    const payload = { ...draft, id: "public", name: draft.name.trim(), isCustom: true };
    const { data, error } = await supabase
      .from("siddur_themes")
      .insert({ name: payload.name, theme: payload as unknown as import("@/integrations/supabase/types").Json, created_by: user.id })
      .select("id,name,theme")
      .single();
    if (error) throw new Error(error.message);
    const published: SiddurTheme = normalizeSiddurTheme({ ...(data.theme as unknown as SiddurTheme), id: `public:${data.id}`, name: data.name, isCustom: true });
    await loadPublicThemes();
    return published;
  }, [user, loadPublicThemes]);

  // A public theme is loaded asynchronously; restore a locally/cloud-saved selection once available.
  useEffect(() => {
    const savedId = localStorage.getItem(ACTIVE_THEME_KEY);
    if (!savedId?.startsWith("public:")) return;
    const found = publicThemes.find(t => t.id === savedId);
    if (found) setActiveTheme(found);
  }, [publicThemes]);

  // Cloud sync helpers
  const cloudSaveActiveTheme = useCallback(async (t: SiddurTheme) => {
    const ts = Date.now();
    localStorage.setItem(`${ACTIVE_THEME_KEY}__ts`, String(ts));
    if (!user) return;
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      await supabase.auth.updateUser({ data: {
        ...u.user_metadata,
        siddur_active_theme_id: t.id,
        siddur_active_theme_ts: ts,
      }});
    } catch { /* ignore */ }
  }, [user]);

  const cloudSaveCustomThemes = useCallback(async (items: SiddurTheme[], active: SiddurTheme) => {
    const ts = Date.now();
    localStorage.setItem(`${CUSTOM_THEME_KEY}__ts`, String(ts));
    if (!user) return;
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      await supabase.auth.updateUser({ data: {
        ...u.user_metadata,
        siddur_custom_theme: JSON.stringify(active),
        siddur_custom_themes: items,
        siddur_custom_theme_ts: ts,
      }});
    } catch { /* ignore */ }
  }, [user]);

  const saveCustomThemeItem = useCallback(async (draft: SiddurTheme, options?: { duplicate?: boolean }): Promise<SiddurTheme> => {
    const normalized = normalizeSiddurTheme({ ...draft, name: draft.name.trim(), emoji: "🎨", isCustom: true });
    const existingIsEditable = !options?.duplicate && normalized.id.startsWith("custom") && customThemes.some(item => item.id === normalized.id);
    const saved = {
      ...normalized,
      id: existingIsEditable ? normalized.id : `custom-${crypto.randomUUID()}`,
    };
    const items = existingIsEditable
      ? customThemes.map(item => item.id === saved.id ? saved : item)
      : [...customThemes, saved];
    setCustomThemes(items);
    setCustomTheme(saved);
    saveCustomThemes(items);
    saveLatestCustomTheme(saved);
    await cloudSaveCustomThemes(items, saved);
    return saved;
  }, [cloudSaveCustomThemes, customThemes]);

  // On login: pull cloud theme state and apply if newer
  useEffect(() => {
    if (!user) return;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return;
      const meta = u.user_metadata ?? {};

      // Restore all custom themes (new format), with backwards-compatible single-theme fallback.
      const cloudCustomTs = Number(meta["siddur_custom_theme_ts"]) || 0;
      const localCustomTs = Number(localStorage.getItem(`${CUSTOM_THEME_KEY}__ts`)) || 0;
      if (cloudCustomTs > localCustomTs && (meta["siddur_custom_themes"] || meta["siddur_custom_theme"])) {
        try {
          const ct: SiddurTheme = typeof meta["siddur_custom_theme"] === "string"
            ? JSON.parse(meta["siddur_custom_theme"])
            : meta["siddur_custom_theme"];
          const cloudItems: SiddurTheme[] = Array.isArray(meta["siddur_custom_themes"])
            ? meta["siddur_custom_themes"].map((item: SiddurTheme) => normalizeSiddurTheme(item))
            : ct?.id ? [normalizeSiddurTheme(ct)] : [];
          if (cloudItems.length > 0) {
            const activeCustom = normalizeSiddurTheme(ct?.id ? ct : cloudItems[cloudItems.length - 1]);
            saveCustomThemes(cloudItems);
            saveLatestCustomTheme(activeCustom);
            localStorage.setItem(`${CUSTOM_THEME_KEY}__ts`, String(cloudCustomTs));
            setCustomThemes(cloudItems);
            setCustomTheme(activeCustom);
            // If active theme was custom, update it too
            if (localStorage.getItem(ACTIVE_THEME_KEY) === activeCustom.id || localStorage.getItem(ACTIVE_THEME_KEY)?.startsWith("custom")) {
              const selected = cloudItems.find(item => item.id === localStorage.getItem(ACTIVE_THEME_KEY)) ?? activeCustom;
              setActiveTheme(selected);
            }
          }
        } catch { /* ignore */ }
      }

      // Restore active theme id
      const cloudActiveTs = Number(meta["siddur_active_theme_ts"]) || 0;
      const localActiveTs = Number(localStorage.getItem(`${ACTIVE_THEME_KEY}__ts`)) || 0;
      if (cloudActiveTs > localActiveTs && meta["siddur_active_theme_id"]) {
        const id = meta["siddur_active_theme_id"] as string;
        localStorage.setItem(ACTIVE_THEME_KEY, id);
        localStorage.setItem(`${ACTIVE_THEME_KEY}__ts`, String(cloudActiveTs));
        const found = SIDDUR_PRESET_THEMES.find(t => t.id === id);
        if (found) setActiveTheme(found);
        else if (id.startsWith("custom")) {
          const ct = loadCustomThemes().find(item => item.id === id) ?? loadCustomTheme();
          setActiveTheme(ct);
        }
      }
    }).catch(() => {});
  }, [user?.id]);

  const { categories, loading: catsLoading } = useSiddurCategories(nusach);
  const { settings: fontSettings } = useFontAndColorSettings();

  // Header-scoped color helpers — use headerTextColor/headerAccentColor when set (custom theme),
  // otherwise fall back to the body textColor/accentColor (preset themes are unaffected)
  const hText   = activeTheme.headerTextColor   ?? activeTheme.textColor;
  const hAccent = activeTheme.headerAccentColor ?? activeTheme.accentColor;

  // Kick off local JSON download as early as possible so it's ready when sections load
  useEffect(() => { preloadSiddurNusach(nusach); }, [nusach]);
  const isSpecial = NUSACH_INDEP.has(catId);
  const settingsTab = catId === "tehillim" ? "tehillim" : catId === "kria" ? "pasuk" : "siddur";

  const activeWidth = catId === "tehillim" ? fontSettings.tehillimContentWidth : fontSettings.siddurContentWidth;
  const containerMaxW =
    activeWidth === "narrow" ? "max-w-2xl" :
    activeWidth === "wide"   ? "max-w-6xl" :
    activeWidth === "full"   ? "max-w-full" :
    "max-w-4xl";

  // If active category disappeared in new nusach, fall back to first
  useEffect(() => {
    if (!isSpecial && categories.length > 0 && !categories.find(c => c.id === catId)) {
      setCatId(categories[0].id);
    }
  }, [categories, catId, isSpecial]);

  const setMode = (mode: ViewMode) => {
    localStorage.setItem("siddur-view-mode", mode);
    setSyncedViewSettings(prev => ({ ...prev, viewMode: mode }));
  };

  const setDisplayStyle = (style: DisplayStyle) => {
    localStorage.setItem("siddur-display-style", style);
    setSyncedViewSettings(prev => ({ ...prev, displayStyle: style }));
  };

  const VIEW_MODES: { id: ViewMode; icon: React.ReactNode; title: string; desc?: string }[] = [
    { id: "accordion",  icon: <LayoutList     className="h-4 w-4" />, title: "מקטעים",       desc: "קפסאות מתקפלות" },
    { id: "continuous", icon: <AlignJustify   className="h-4 w-4" />, title: "רציף",          desc: "גלילה סעיף-אחר-סעיף" },
    { id: "scroll",     icon: <ScrollText     className="h-4 w-4" />, title: "גלילה כוללת",  desc: "כל הקטגוריות ברצף" },
    { id: "split",      icon: <PanelRightOpen className="h-4 w-4" />, title: "פצול",          desc: "רשימת סעיפים + טקסט" },
    { id: "book",       icon: <Columns2       className="h-4 w-4" />, title: "שתי עמודות",   desc: "פריסת ספר" },
  ];

  return (
    <SiddurThemeContext.Provider value={{
      theme: activeTheme,
      setTheme: t => {
        setActiveTheme(t);
        localStorage.setItem(ACTIVE_THEME_KEY, t.id);
        cloudSaveActiveTheme(t);
      },
      previewTheme: t => setActiveTheme(t),
      customTheme,
      setCustomTheme: (t) => {
        const normalized = normalizeSiddurTheme(t);
        setCustomTheme(normalized);
        saveLatestCustomTheme(normalized);
      },
      customThemes,
      saveCustomTheme: saveCustomThemeItem,
      publicThemes,
      publishTheme,
    }}>
    <SiddurDisplayStyleContext.Provider value={{ displayStyle, setDisplayStyle }}>
    <div
      data-siddur-theme={activeTheme.id}
      className="siddur-themed-root min-h-screen flex flex-col"
      style={{
        background: activeTheme.bg,
        direction: "rtl",
        "--siddur-card-radius": `${siddurAppearance(activeTheme).cornerRadius}px`,
        "--siddur-button-radius": `${siddurAppearance(activeTheme).buttonRadius}px`,
        "--siddur-border-width": `${siddurAppearance(activeTheme).borderWidth}px`,
        "--siddur-card-shadow": THEME_SHADOWS[siddurAppearance(activeTheme).shadow],
      } as CSSProperties}
    >
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: activeTheme.headerBg,
          paddingTop: "max(var(--safe-area-inset-top, var(--sai-top, env(safe-area-inset-top, 0px))), 24px)",
          boxShadow: siddurAppearance(activeTheme).headerShadow
            ? THEME_SHADOWS[siddurAppearance(activeTheme).shadow]
            : "none",
        }}
      >
        <div className="w-full px-3 sm:px-5">

          {/* ── Row 1: Title right, actions left ── */}
          <div className="flex items-center justify-between gap-1 pt-2.5 pb-2 flex-nowrap min-w-0">

            {/* Right side: Title + Back */}
            <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
              <h1
                className="text-lg sm:text-2xl font-bold tracking-wide whitespace-nowrap"
                style={{
                  color: hText,
                  fontFamily: "'Noto Serif Hebrew', 'David Libre', serif",
                  textShadow: `0 0 20px ${hAccent}33`,
                }}
              >
                סידור תפילה
              </h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm font-medium flex-shrink-0 whitespace-nowrap"
                style={{ color: hText, background: "transparent" }}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">חזרה</span>
              </Button>
            </div>

            {/* Left side: actions — ltr so order is predictable */}
            <div className="flex items-center gap-1.5 flex-shrink-0" dir="ltr">
              {/* Theme picker */}
              <ThemePicker />
              {/* T — text settings */}
              <TextDisplaySettings initialTab={settingsTab} />

              {/* View mode dropdown (siddur only) */}
              {!isSpecial && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs font-medium rounded-lg"
                      style={{ color: hAccent, background: "transparent", border: "none" }}
                    >
                      <Layers className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="hidden md:inline max-w-[80px] truncate">{VIEW_MODES.find(m => m.id === viewMode)?.title ?? "תצוגה"}</span>
                      <ChevronDown className="h-3 w-3 opacity-60 flex-shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56" style={{ direction: "rtl" }}>
                    <DropdownMenuLabel className="text-right text-xs text-muted-foreground">מצב תצוגה</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {VIEW_MODES.map(m => (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <span style={{ color: viewMode === m.id ? activeTheme.accentColor : "hsl(var(--muted-foreground))" }}>{m.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className={cn("block text-sm", viewMode === m.id && "font-semibold text-foreground")}>{m.title}</span>
                          {m.desc && <span className="block text-[10px] text-muted-foreground">{m.desc}</span>}
                        </div>
                        {viewMode === m.id && <span className="text-xs flex-shrink-0" style={{ color: hAccent }}>✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Mode switcher: חומש | סידור | עומר — hidden on xs */}
              <div
                className="hidden sm:flex items-center rounded-full flex-shrink-0"
                style={{ }}
              >
                <button
                  onClick={() => navigate("/")}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all hover:opacity-100"
                  style={{ color: hAccent, opacity: 0.65 }}
                  title="חומש"
                >
                  <Book className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">חומש</span>
                </button>
                <span className="w-px h-3.5 opacity-25" style={{ background: hAccent }} />
                <div
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold"
                  style={{ color: hAccent }}
                >
                  <BookMarked className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">סידור</span>
                </div>
                {omerInSeason && <>
                <span className="w-px h-3.5 opacity-25" style={{ background: hAccent }} />
                <button
                  onClick={() => navigate('/omer')}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all hover:opacity-100"
                  style={{ color: hAccent, opacity: 0.65 }}
                  title="ספירת העומר"
                >
                  <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">עומר</span>
                </button>
                </>}
              </div>
            </div>
          </div>

          {/* ── Row 2: Nusach pills ── */}
          <div
            className="flex gap-1.5 pb-2.5 justify-center overflow-x-auto [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none", opacity: isSpecial ? 0.45 : 1, transition: "opacity 0.2s" }}
          >
            {NUSACHOT.map(n => (
              <button
                key={n.id}
                onClick={() => { setNusach(n.id); if (isSpecial) setCatId("shacharit"); }}
                className="px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-all"
                style={
                  nusach === n.id
                    ? { background: hAccent, color: "hsl(var(--sidebar-background))", boxShadow: `0 2px 8px ${hAccent}55`, fontWeight: 700 }
                    : { background: "transparent", color: hText }
                }
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Category tabs ── */}
      <div
        className="border-b flex items-stretch"
        style={{
          background: activeTheme.headerBg,
          borderColor: `${hAccent}30`,
        }}
      >
        {/* Scrollable tabs */}
        <div
          className="flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
        <div className="flex gap-0 min-w-max px-2 py-1 items-center">
          {/* Loading spinner placeholder */}
          {catsLoading && (
            <div className="px-4 py-2 flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>טוען...</span>
            </div>
          )}

          {/* Siddur prayer categories (from loaded nusach data) */}
          {!catsLoading && categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCatId(cat.id)}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-all"
              style={{
                fontFamily: "'Noto Serif Hebrew', 'David Libre', serif",
                color: catId === cat.id ? hAccent : hText,
                borderBottomColor: catId === cat.id ? hAccent : "transparent",
              }}
            >
              <CatIcon id={cat.id} />
              {cat.name}
            </button>
          ))}

          {/* Separator before special tabs */}
          {!catsLoading && categories.length > 0 && (
            <div className="self-stretch w-px bg-white/15 mx-1 my-2" />
          )}

          {/* Static tabs — always shown */}
          {STATIC_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setCatId(tab.id)}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-all"
              style={{
                fontFamily: "'Noto Serif Hebrew', 'David Libre', serif",
                color: catId === tab.id ? hAccent : hText,
                borderBottomColor: catId === tab.id ? hAccent : "transparent",
              }}
            >
              <CatIcon id={tab.id} />
              {tab.name}
            </button>
          ))}

          {/* View mode segmented control (only for siddur panes, not tehillim/kria) */}
          {/* (moved outside the scrollable area — see below) */}
        </div>
        </div>

        {/* View mode picker — clickable dropdown in tab bar */}
        {!isSpecial && (
          <div className="flex-shrink-0 flex items-center px-2 border-r border-white/10" dir="ltr">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ background: `${hAccent}18`, color: hAccent }}
                  title={VIEW_MODES.find(m => m.id === viewMode)?.title}
                >
                  {VIEW_MODES.find(m => m.id === viewMode)?.icon}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" className="w-56 z-[9999]" style={{ direction: "rtl" }}>
                <DropdownMenuLabel className="text-right text-xs text-muted-foreground">מצב תצוגה</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {VIEW_MODES.map(m => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <span style={{ color: viewMode === m.id ? activeTheme.accentColor : "hsl(var(--muted-foreground))" }}>{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className={cn("block text-sm", viewMode === m.id && "font-semibold text-foreground")}>{m.title}</span>
                      {m.desc && <span className="block text-[10px] text-muted-foreground">{m.desc}</span>}
                    </div>
                    {viewMode === m.id && <span className="text-xs flex-shrink-0" style={{ color: activeTheme.accentColor }}>✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* ── Content area ── */}
      <main
        className={cn(
          "flex-1 flex flex-col pt-4 sm:pt-6 mx-auto w-full",
          containerMaxW,
          viewMode === "split" || viewMode === "book"
            ? "px-3 sm:px-5"
            : viewMode === "scroll"
            ? "px-4 sm:px-6"
            : "px-5 sm:px-7"
        )}
      >
        {/* ── Text filter toggles (nikud / taamim) ── */}
        <TextFiltersBar scope={catId === "tehillim" ? "tehillim" : "siddur"} />

        {/* Special — nusach-independent panes */}
        {catId === "tehillim" && <TehillimPane />}
        {catId === "kria"     && (
          <KriaPane
            onNavigate={(seferId, perek) => {
              if (seferId && perek) {
                navigate(`/?sefer=${seferId}&perek=${perek}`);
              } else {
                navigate("/");
              }
            }}
          />
        )}

        {/* Regular siddur prayer content */}
        {!isSpecial && (viewMode === "accordion" || viewMode === "continuous") && (
          <CategoryPane nusach={nusach} catId={catId} viewMode={viewMode} />
        )}
        {!isSpecial && viewMode === "scroll" && (
          <FullContinuousPane nusach={nusach} />
        )}
        {!isSpecial && viewMode === "split" && (
          <SplitPane nusach={nusach} catId={catId} />
        )}
        {!isSpecial && viewMode === "book" && (
          <BookColumnPane nusach={nusach} catId={catId} />
        )}
      </main>
    </div>
    </SiddurDisplayStyleContext.Provider>
    </SiddurThemeContext.Provider>
  );
};

export default Siddur;
