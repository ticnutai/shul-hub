import type { CSSProperties } from "react";
import { isSafeCssValue, isSafeFill } from "./themes";

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
  /** The frame's background: a colour or a gradient. */
  bg?: string;
  /** Its text. */
  text?: string;
  /** Its titles and times. */
  accent?: string;
  /** A line around it. */
  line?: string;
}

export type FrameLooks = Partial<Record<FrameId, FrameLook>>;

const FIELDS = ["bg", "text", "accent", "line"] as const;

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
      const ok = f === "bg" ? isSafeFill(value) : isSafeCssValue(value);
      if (ok) look[f] = value.trim();
    }
    if (Object.keys(look).length) out[id] = look;
  }
  return out;
}

/** Sets or clears one field; a frame left with nothing is dropped. */
export function setFrameLook(looks: FrameLooks, id: FrameId, patch: Partial<Record<keyof FrameLook, string | null>>): FrameLooks {
  const next: FrameLook = { ...looks[id] };
  for (const [k, v] of Object.entries(patch) as [keyof FrameLook, string | null][]) {
    if (v) next[k] = v;
    else delete next[k];
  }
  const out = { ...looks };
  if (Object.keys(next).length) out[id] = next;
  else delete out[id];
  return out;
}

/**
 * The frame's look as an inline style on a flat board's panel.
 *
 * Colours go in as the theme's own variables, redefined on the panel, so
 * every line inside it - the times, the dim labels, the titles - takes them
 * the way it takes the theme's. An inline style is the only thing that beats
 * the skins' per-panel rules (tv.css sets --tv-text-dim on light panels).
 * The background replaces the skin's texture on this one panel: that is
 * what "this frame looks different" means.
 */
export function frameLookCss(look: FrameLook | undefined): CSSProperties | undefined {
  if (!look) return undefined;
  const css: Record<string, string> = {};
  if (look.bg) {
    css.background = look.bg;
    if (isSafeCssValue(look.bg)) css["--tv-panel"] = look.bg;
  }
  if (look.text) {
    css.color = look.text;
    css["--tv-text"] = look.text;
    css["--tv-text-dim"] = look.text;
  }
  if (look.accent) css["--tv-accent"] = look.accent;
  if (look.line) css.boxShadow = `inset 0 0 0 calc(var(--u, 1vh) * 0.3) ${look.line}`;
  return Object.keys(css).length ? (css as CSSProperties) : undefined;
}
