import { safeImage } from "./elements";
import { isSafeCssValue, isSafeFill, isSafeUrl } from "./themes";

/**
 * The board in three layers - רקע, מסגרות, טקסט - and the settings of the
 * first two that are not already somewhere else.
 *
 *   BackgroundTune  how the board's background is adjusted, whatever it is:
 *                   a colour, a gradient, a ready picture, an uploaded one.
 *   FrameStyle      how every frame is dressed, whatever style draws it: its
 *                   own background, a line, depth, or a picture of a frame.
 *
 * Both are neutral by default, which is how every board that existed before
 * them keeps looking exactly as it did. One frame dressed apart from the
 * others is frameLooks.ts; the text is config.styles and the theme's inks.
 *
 * No image imports here: config.ts loads this, and the end-to-end tests
 * load config.ts (see BACKDROP_PREFIX there). Turning a stored fill into CSS,
 * which needs the pictures, is layerCss.ts.
 */

export interface BackgroundTune {
  /** 0.6–1.4, 1 = as it is. */
  brightness: number;
  /** 0–2, 1 = as it is. */
  saturation: number;
  /** Degrees, -180–180. */
  hue: number;
  /** 0–10, in tenths of a board unit - a picture made quiet behind the times. */
  blur: number;
  /** A colour laid over it, keeping its light and shade. */
  tint: string | null;
  /** 0–1. */
  tintStrength: number;
}

export const DEFAULT_BACKGROUND_TUNE: BackgroundTune = {
  brightness: 1,
  saturation: 1,
  hue: 0,
  blur: 0,
  tint: null,
  tintStrength: 0.35,
};

export interface FrameStyle {
  /** The frames' own background: a colour, a gradient, "backdrop:<id>" or an uploaded picture. */
  fill: string | null;
  /** 0–1, for a colour or a gradient. */
  fillOpacity: number;
  /** A line around each frame. */
  line: string | null;
  /** 0–6, in tenths of a board unit x 2. */
  lineWidth: number;
  /** 0 (as the style draws it) – 1: how much the frames stand out. */
  depth: number;
  /**
   * A picture of a frame (its corners kept, its edges stretched): a ready-made
   * one, "frame:<id>" (framePictures.ts), or one the admin uploaded.
   */
  image: string | null;
  /** How much of each edge of that picture is the frame, in percent (10–45). */
  imageSlice: number;
  /** How thick that frame is drawn, in board units (0.5–6). */
  imageWidth: number;
}

export const DEFAULT_FRAME_STYLE: FrameStyle = {
  fill: null,
  fillOpacity: 1,
  line: null,
  lineWidth: 2,
  depth: 0,
  image: null,
  imageSlice: 30,
  imageWidth: 2.5,
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const n = (v: unknown, d: number, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const two = (v: number) => Math.round(v * 100) / 100;
const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : null);
const colour = (v: unknown) => (typeof v === "string" && isSafeCssValue(v) ? v.trim() : null);

/** A stored ready picture: "backdrop:<id>" (the same rule as config.BACKDROP_PREFIX). */
const BACKDROP_REF = /^backdrop:[a-z0-9-]{1,40}$/;

/** What a background may be: a colour, a gradient, a ready picture, or an uploaded one (https). */
export function isSafeLayerFill(value: string): boolean {
  const v = value.trim();
  return safeImage(v) || isSafeFill(v) || BACKDROP_REF.test(v) || (/^https:\/\//i.test(v) && isSafeUrl(v));
}

const fill = (v: unknown) => (typeof v === "string" && isSafeLayerFill(v) ? v.trim() : null);
/** A picture of a frame: a ready-made one ("frame:<id>", framePictures.ts) or an uploaded one. */
const picture = (v: unknown) =>
  typeof v === "string" && (safeImage(v) || /^frame:[a-z0-9-]{1,40}$/.test(v.trim()) || (/^https:\/\//i.test(v.trim()) && isSafeUrl(v.trim())))
    ? v.trim()
    : null;

export function normalizeBackgroundTune(raw: unknown): BackgroundTune {
  const r = isObj(raw) ? raw : {};
  const d = DEFAULT_BACKGROUND_TUNE;
  return {
    brightness: two(n(r.brightness, d.brightness, 0.6, 1.4)),
    saturation: two(n(r.saturation, d.saturation, 0, 2)),
    hue: Math.round(n(r.hue, d.hue, -180, 180)),
    blur: two(n(r.blur, d.blur, 0, 10)),
    tint: hex(r.tint),
    tintStrength: two(n(r.tintStrength, d.tintStrength, 0, 1)),
  };
}

export function normalizeFrameStyle(raw: unknown): FrameStyle {
  const r = isObj(raw) ? raw : {};
  const d = DEFAULT_FRAME_STYLE;
  return {
    fill: fill(r.fill),
    fillOpacity: two(n(r.fillOpacity, d.fillOpacity, 0, 1)),
    line: colour(r.line),
    lineWidth: two(n(r.lineWidth, d.lineWidth, 0, 6)),
    depth: two(n(r.depth, d.depth, 0, 1)),
    image: picture(r.image),
    imageSlice: Math.round(n(r.imageSlice, d.imageSlice, 10, 45)),
    imageWidth: two(n(r.imageWidth, d.imageWidth, 0.5, 6)),
  };
}

export function isNeutralTune(t: BackgroundTune): boolean {
  return t.brightness === 1 && t.saturation === 1 && t.hue === 0 && t.blur === 0 && !t.tint;
}
