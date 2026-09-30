import { isSafeCssValue } from "./themes";
import { isSafeLayerFill } from "./layers";

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

export const FRAME_IDS = ["prayers", "zmanim", "next", "clock", "announcements", "shiurim", "learning"] as const;
export type FrameId = (typeof FRAME_IDS)[number];

export const FRAME_LABELS: Record<FrameId, string> = {
  prayers: "התפילות",
  zmanim: "זמני היום",
  next: "המניין הבא",
  clock: "השעון",
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
}

export type FrameLooks = Partial<Record<FrameId, FrameLook>>;

const FIELDS = ["bg", "text", "accent", "line"] as const;
const NUMBERS = { bgOpacity: [0, 1], lineWidth: [0, 6] } as const;

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
    if (!look.bg) delete look.bgOpacity;
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
