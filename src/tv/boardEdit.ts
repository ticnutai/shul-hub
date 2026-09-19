import { createContext, useContext, type CSSProperties } from "react";
import { ZMAN_LABELS, type SolarEvent } from "@community/lib/zmanim";
import type { ElementStyle, FlipArea, TvConfig } from "./config";

/**
 * What an admin can change directly on the board, and how the board reads it.
 *
 * The pattern is the one visual-editing CMSs use (Sanity's overlays,
 * TinaCMS's data-tina-field): every editable element carries a key naming
 * its source, the editor maps a click to that key, and the value is edited in
 * a real form field - never by typing into the rendered text, which fights
 * React for the DOM and loses the caret and undo.
 *
 * Two kinds of source:
 *   - board wording and layout (this file): stored in tv_config, affects the
 *     board only;
 *   - content records ("ann:<id>:title", "minyan:<id>:label"...): the same
 *     row the website shows, edited in place (see the admin editor).
 *
 * "Moving" is constrained on purpose: swapping sides and reordering. Free
 * dragging to x/y positions would break the moment the board is shown on a
 * screen of another shape (TV, laptop, phone), which is exactly what the
 * device preview is for.
 */

export interface EditableSpec {
  label: string;
  /** Default wording; absent = the element has no editable text. */
  text?: string;
  hideable?: boolean;
  /** Clicking "move" swaps this area. */
  flip?: FlipArea;
  /** The text normally comes from the site settings (name / address). */
  siteField?: "name" | "address";
  multiline?: boolean;
}

export const SHOWN_ZMANIM: SolarEvent[] = ["alot", "sunrise", "sof_zman_shma", "sof_zman_tefila", "chatzot", "plag", "sunset", "tzeit"];

export const EDITABLE: Record<string, EditableSpec> = {
  "header.logo": { label: "לוגו קרובים", hideable: true, flip: "header" },
  "dash.prayers": { label: "לוח מלא: כותרת זמני התפילות", text: "זמני התפילות" },
  "dash.zmanim": { label: "לוח מלא: כותרת זמני היום", text: "זמני היום" },
  "dash.announcement": { label: "לוח מלא: כותרת ההודעות", text: "הודעות", hideable: true },
  "dash.shiurim": { label: "לוח מלא: כותרת השיעורים", text: "שיעורים", hideable: true },
  "dash.clock": { label: "לוח מלא: השעון", hideable: true },
  "dash.strip": { label: "לוח מלא: שורת הפרשה והדף היומי", hideable: true },
  "dash.seasonal": { label: "משיב הרוח / מוריד הטל", hideable: true },
  "split.next": { label: "מפוצל: המניין הבא", text: "המניין הבא", hideable: true },
  "header.title": { label: "שם בית הכנסת", text: "", hideable: true, flip: "header", siteField: "name" },
  "header.weekday": { label: "היום בשבוע", hideable: true },
  "header.address": { label: "כתובת", text: "", hideable: true, siteField: "address" },
  "header.parasha": { label: "פרשת השבוע (בראש המסך)", hideable: true },
  "header.daf": { label: "הדף היומי (בראש המסך)", hideable: true },
  "header.clock": { label: "שעון", hideable: true, flip: "header" },
  "header.date": { label: "תאריך", hideable: true },
  "heading.prayer": { label: "כותרת: זמני התפילות", text: "זמני התפילות", hideable: true },
  "heading.learning": { label: "כותרת: לימוד יומי", text: "לימוד יומי ולוח שנה", hideable: true },
  "heading.announcements": { label: "כותרת: מודעות", text: "מודעות לציבור", hideable: true },
  "heading.shiurim": { label: "כותרת: שיעורים", text: "שיעורי תורה", hideable: true },
  "panel.minyanim": { label: "כותרת: מניינים", text: "מניינים", hideable: true, flip: "prayer" },
  "panel.zmanim": { label: "לוח זמני היום", text: "זמני היום", hideable: true, flip: "prayer" },
  "hero.kicker": { label: "המניין הבא", text: "המניין הבא" },
  "learning.parasha": { label: "כרטיס פרשת השבוע", text: "פרשת השבוע", hideable: true, flip: "learning" },
  "learning.daf": { label: "כרטיס הדף היומי", text: "הדף היומי", hideable: true, flip: "learning" },
  "learning.upcoming": { label: "כרטיס בימים הקרובים", text: "בימים הקרובים", hideable: true, flip: "learning" },
  "footer.dots": { label: "נקודות השקופיות", hideable: true },
  ticker: { label: "סרגל רץ", text: "", hideable: true, multiline: true },
  "footer.status": { label: "מצב חיבור", hideable: true },
  "shabbat.title": { label: "מסך שבת: כותרת", text: "שבת שלום" },
  "shabbat.blessing": { label: "מסך שבת: שורת ברכה", text: "בּוֹאִי בְשָׁלוֹם עֲטֶרֶת בַּעְלָהּ, גַּם בְּשִׂמְחָה וּבְצָהֳלָה", hideable: true, multiline: true },
  "shabbat.art": { label: "מסך שבת: ציור חלות ונרות", hideable: true },
  "shabbat.times": { label: "מסך שבת: זמני השבת", hideable: true },
  ...Object.fromEntries(
    SHOWN_ZMANIM.map((e) => [`zman.${e}`, { label: `זמן: ${ZMAN_LABELS[e]}`, text: ZMAN_LABELS[e], hideable: true } satisfies EditableSpec]),
  ),
};

/** Keys whose visibility lives in an existing setting rather than `hidden`. */
const HEADER_TOGGLES: Record<string, keyof TvConfig["header"]> = {
  "header.parasha": "parasha",
  "header.daf": "dafYomi",
  "header.logo": "logo",
};

export function isHidden(config: TvConfig, key: string): boolean {
  const toggle = HEADER_TOGGLES[key];
  return toggle ? !config.header[toggle] : config.hidden.includes(key);
}

export function setHidden(config: TvConfig, key: string, hidden: boolean): TvConfig {
  const toggle = HEADER_TOGGLES[key];
  if (toggle) return { ...config, header: { ...config.header, [toggle]: !hidden } };
  const rest = config.hidden.filter((k) => k !== key);
  return { ...config, hidden: hidden ? [...rest, key] : rest };
}

export function setText(config: TvConfig, key: string, value: string | null): TvConfig {
  const texts = { ...config.texts };
  if (value === null) delete texts[key];
  else texts[key] = value.slice(0, 300);
  return { ...config, texts };
}

export function setElementStyle(config: TvConfig, key: string, patch: Partial<ElementStyle> | null): TvConfig {
  const styles = { ...config.styles };
  if (patch === null) {
    delete styles[key];
    return { ...config, styles };
  }
  const next: ElementStyle = { ...styles[key], ...patch };
  // Defaults are dropped so an untouched element carries no entry.
  if (next.scale === 1 || next.scale === undefined) delete next.scale;
  if (!next.color) delete next.color;
  if (!next.bg) delete next.bg;
  if (!next.weight) delete next.weight;
  if (next.opacity === undefined || next.opacity >= 1) delete next.opacity;
  if (!next.x) delete next.x;
  if (!next.y) delete next.y;
  if (Object.keys(next).length) styles[key] = next;
  else delete styles[key];
  return { ...config, styles };
}

/**
 * Inline style for one element from its ElementStyle. Text size works by
 * redefining --fs on the element (every font-size in tv.css is a multiple of
 * it, and children inherit it), colour is plain `color`, and the nudge is a
 * translate in screen-percent units so it holds on any screen shape.
 */
export function elementStyleCss(s: ElementStyle | undefined): CSSProperties | undefined {
  if (!s) return undefined;
  const css: Record<string, string> = {};
  if (s.scale && s.scale !== 1) {
    css["--fs"] = `calc(var(--u) * var(--tv-scale, 1) * ${s.scale})`;
    css["--es"] = String(s.scale);
  }
  if (s.color) css.color = s.color;
  if (s.bg) {
    css.backgroundColor = s.bg;
    css.borderRadius = "calc(var(--u) * 0.8)";
    // Some breathing room, without shifting the layout around it.
    css.boxShadow = `0 0 0 calc(var(--u) * 0.5) ${s.bg}`;
  }
  if (s.weight) css.fontWeight = String(s.weight);
  if (s.opacity !== undefined && s.opacity < 1) css.opacity = String(s.opacity);
  if (s.x || s.y) css.transform = `translate(${s.x ?? 0}cqw, ${s.y ?? 0}cqh)`;
  return css as CSSProperties;
}

export function toggleFlip(config: TvConfig, area: FlipArea): TvConfig {
  return {
    ...config,
    flipped: config.flipped.includes(area) ? config.flipped.filter((a) => a !== area) : [...config.flipped, area],
  };
}

/* ------------------------------------------------ what the board reads -- */

export interface BoardEditApi {
  /** The admin's wording for `key`, or `fallback`. */
  text: (key: string, fallback: string) => string;
  hidden: (key: string) => boolean;
  flipped: (area: FlipArea) => boolean;
  /**
   * Props for an editable element: its admin-set look (always), and the
   * data-edit marker for click-to-edit (only while the admin is editing).
   */
  attr: (key: string) => { "data-edit"?: string; style?: CSSProperties };
}

const NO_ATTR = {};

export function makeBoardEdit(config: TvConfig, editing: boolean): BoardEditApi {
  return {
    text: (key, fallback) => {
      const v = config.texts[key];
      return v !== undefined && v.trim() !== "" ? v : fallback;
    },
    hidden: (key) => isHidden(config, key),
    flipped: (area) => config.flipped.includes(area),
    attr: (key) => {
      const style = elementStyleCss(config.styles[key]);
      if (!editing) return style ? { style } : NO_ATTR;
      return style ? { "data-edit": key, style } : { "data-edit": key };
    },
  };
}

export const BoardEditContext = createContext<BoardEditApi>({
  text: (_k, fallback) => fallback,
  hidden: () => false,
  flipped: () => false,
  attr: () => NO_ATTR,
});

export function useBoardEdit(): BoardEditApi {
  return useContext(BoardEditContext);
}
