import { TV_FONTS, isSafeCssValue, type TvFontId } from "./themes";
import { isSafeLayerFill } from "./layers";

/** A box's own shape: square or round corners, or one of the whole-box shapes. */
export type BoxShape =
  | "square" | "round" | "arch" | "pill" | "ellipse" | "hexagon" | "octagon"
  | "dome" | "onion" | "lancet" | "scallop";
export const BOX_SHAPES: BoxShape[] = [
  "square", "round", "arch", "pill", "ellipse", "hexagon", "octagon", "dome", "onion", "lancet", "scallop",
];

/**
 * How a box's name is set: on a ribbon notched at both ends, in a capsule, on
 * a gold plate over the box's edge, over a rule, or on a shield. Here rather
 * than in config.ts, which loads this file.
 */
export type TitleStyle = "plain" | "ribbon" | "pill" | "plate" | "underline" | "shield";
export const TITLE_STYLES: TitleStyle[] = ["plain", "ribbon", "pill", "plate", "underline", "shield"];

/**
 * A frame picture a box may wear: a ready one ("frame:<id>") or an uploaded
 * one. By its form, as layers.ts checks FrameStyle.image: config.ts loads this
 * file, and the end-to-end tests load config.ts, so it may not import the
 * pictures themselves.
 */
export function isFramePicture(v: string): boolean {
  return /^frame:[a-z0-9-]{1,40}$/.test(v) || /^https:\/\/[^\s"'()<>]{1,500}$/.test(v);
}

/**
 * One frame dressed differently from the rest.
 *
 * The board's frames all wear the same style (the skin, or the painted
 * board), the same panel colour and the same inks. A gabbai wants the
 * prayers in burgundy with gold times and the zmanim in blue with white -
 * one frame standing apart, the others as they were.
 *
 * A frame here is a thing on the board, not a box on one layout: "the
 * prayers" is the prayer panel on the rotating board, the prayers column of
 * the full board, and the right-hand frame of a painted board. So one choice
 * follows the board from layout to layout, and to every kind of screen.
 *
 * Everything is optional; a frame with nothing set is exactly as its style
 * draws it, which is every frame of every board that existed before this.
 */

export const FRAME_IDS = ["prayers", "zmanim", "next", "clock", "date", "strip", "announcements", "shiurim", "learning"] as const;
export type FrameId = (typeof FRAME_IDS)[number];

export const FRAME_LABELS: Record<FrameId, string> = {
  prayers: "התפילות",
  zmanim: "זמני היום",
  next: "המניין הבא",
  clock: "השעון",
  date: "היום והתאריך",
  strip: "הפס התחתון",
  announcements: "המודעות",
  shiurim: "השיעורים",
  learning: "לימוד יומי ופרשה",
};

export interface FrameLook {
  /** The frame's background: a colour, a gradient, or a picture (layers.isSafeLayerFill). */
  bg?: string;
  /** 0–1, for a colour or a gradient. */
  bgOpacity?: number;
  /** Its text. */
  text?: string;
  /** Its titles and times. */
  accent?: string;
  /** A line around it. */
  line?: string;
  /** 0–6, as FrameStyle.lineWidth. */
  lineWidth?: number;
  /** Its own shape, over the one every box has. */
  shape?: BoxShape;
  /** Its own frame picture, over the one every box has. */
  image?: string;
  /** Its text's own font, over the board's. */
  font?: TvFontId;
  /** Its text's own size, as a share of the board's (1 = as the board). */
  textScale?: number;
  /** How its name is set, over the way every box's is. */
  titleStyle?: TitleStyle;
}

export type FrameLooks = Partial<Record<FrameId, FrameLook>>;

const FIELDS = ["bg", "text", "accent", "line"] as const;
const NUMBERS = { bgOpacity: [0, 1], lineWidth: [0, 6], textScale: [0.6, 1.8] } as const;

/** Only frames that exist, only colours (and, for the background, gradients) that are safe in a style attribute. */
export function normalizeFrameLooks(raw: unknown): FrameLooks {
  const out: FrameLooks = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const id of FRAME_IDS) {
    const v = (raw as Record<string, unknown>)[id];
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const look: FrameLook = {};
    for (const f of FIELDS) {
      const value = (v as Record<string, unknown>)[f];
      if (typeof value !== "string") continue;
      const ok = f === "bg" ? isSafeLayerFill(value) : isSafeCssValue(value);
      if (ok) look[f] = value.trim();
    }
    for (const [f, [lo, hi]] of Object.entries(NUMBERS) as [keyof typeof NUMBERS, readonly [number, number]][]) {
      const value = (v as Record<string, unknown>)[f];
      if (typeof value === "number" && Number.isFinite(value)) look[f] = Math.round(Math.min(hi, Math.max(lo, value)) * 100) / 100;
    }
    const shape = (v as Record<string, unknown>).shape;
    if (typeof shape === "string" && (BOX_SHAPES as string[]).includes(shape)) look.shape = shape as BoxShape;
    const font = (v as Record<string, unknown>).font;
    if (typeof font === "string" && TV_FONTS.some((f) => f.id === font)) look.font = font as TvFontId;
    if (look.textScale === 1) delete look.textScale;
    const titleStyle = (v as Record<string, unknown>).titleStyle;
    if (typeof titleStyle === "string" && (TITLE_STYLES as string[]).includes(titleStyle)) look.titleStyle = titleStyle as TitleStyle;
    const image = (v as Record<string, unknown>).image;
    if (typeof image === "string" && isFramePicture(image.trim())) look.image = image.trim();
    // A box with no colour of its own may still be see-through (the theme's colour, faded).
    if (look.bgOpacity === 1) delete look.bgOpacity;
    if (!look.line) delete look.lineWidth;
    if (Object.keys(look).length) out[id] = look;
  }
  return out;
}

/** Sets or clears one field; a frame left with nothing is dropped. */
export function setFrameLook(
  looks: FrameLooks,
  id: FrameId,
  patch: { [K in keyof FrameLook]?: FrameLook[K] | null },
): FrameLooks {
  const next: Record<string, unknown> = { ...looks[id] };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") delete next[k];
    else next[k] = v;
  }
  // Only a size, with nothing to size, is no look at all.
  if (!next.bg) delete next.bgOpacity;
  if (!next.line) delete next.lineWidth;
  const out = { ...looks };
  if (Object.keys(next).length) out[id] = next as FrameLook;
  else delete out[id];
  return out;
}
