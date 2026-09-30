import type { CSSProperties } from "react";
import { backdropUrl } from "./backdrops";
import { isSafeCssValue, isSafeGradient, isSafeUrl } from "./themes";
import type { FrameLook } from "./frameLooks";
import type { BackgroundTune, FrameStyle } from "./layers";

/**
 * The layers as CSS: what TvBoard puts on the board's root, and what one
 * frame dressed apart puts on itself.
 *
 * Everything is written as custom properties plus a class that switches a
 * rule on (tv.css, "the layers"). The rules are `!important` because every
 * skin paints its panels its own way; the values are variables so that one
 * frame can still differ, by redefining them on itself.
 */

const HEX6 = /^#[0-9a-f]{6}$/i;

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(alpha * 1000) / 1000})`;
}

/**
 * A stored fill as a CSS background: a colour or a gradient faded to
 * `opacity`, or a picture (a ready one or an uploaded one) covering the
 * frame. A picture keeps its full strength - fading it would need a layer
 * of its own, and the skins already use a panel's ::before and ::after.
 */
export function fillCss(fill: string | null | undefined, opacity = 1): string | null {
  if (!fill) return null;
  const v = fill.trim();
  const a = Math.min(1, Math.max(0, opacity));
  if (HEX6.test(v)) return a >= 1 ? v : rgba(v, a);
  if (isSafeCssValue(v)) return v;
  if (isSafeGradient(v)) return a >= 1 ? v : v.replace(/#[0-9a-f]{6}\b/gi, (h) => rgba(h, a));
  const url = backdropUrl(v);
  return url && (url.startsWith("/") || url.startsWith("data:") || isSafeUrl(url))
    ? `url("${url}") center / cover no-repeat`
    : null;
}

/** Whether a fill is a picture (so the opacity slider has nothing to fade). */
export function isPictureFill(fill: string | null | undefined): boolean {
  if (!fill) return false;
  const v = fill.trim();
  return !isSafeCssValue(v) && !isSafeGradient(v);
}

/** The shadow that makes a frame stand out, 0 - 1. */
export function depthShadow(d: number): string {
  return [
    `0 calc(var(--u) * ${(d * 0.9).toFixed(2)}) calc(var(--u) * ${(d * 2.2).toFixed(2)}) rgba(0,0,0,${(0.45 * d).toFixed(2)})`,
    `inset 0 calc(var(--u) * ${(d * 0.45).toFixed(2)}) calc(var(--u) * ${(d * 0.7).toFixed(2)}) rgba(255,255,255,${(0.35 * d).toFixed(2)})`,
    `inset 0 calc(var(--u) * ${(-d * 0.6).toFixed(2)}) calc(var(--u) * ${(d * 0.9).toFixed(2)}) rgba(0,0,0,${(0.3 * d).toFixed(2)})`,
  ].join(", ");
}

/** The line's width: the stored number is tenths of a board unit, doubled (0-6 -> 0-1.2u). */
const lineWidth = (w: number) => `calc(var(--u) * ${(w * 0.2).toFixed(2)})`;

/** The background's adjustments, as a filter on the background layer (and on nothing above it). */
export function tuneFilter(t: BackgroundTune): string | null {
  const parts: string[] = [];
  if (t.brightness !== 1) parts.push(`brightness(${t.brightness})`);
  if (t.saturation !== 1) parts.push(`saturate(${t.saturation})`);
  if (t.hue !== 0) parts.push(`hue-rotate(${t.hue}deg)`);
  if (t.blur > 0) parts.push(`blur(calc(var(--u) * ${(t.blur * 0.1).toFixed(2)}))`);
  return parts.length ? parts.join(" ") : null;
}

/** Root variables and classes for the whole board's layers. */
export function layerVars(tune: BackgroundTune, frames: FrameStyle): { vars: Record<string, string>; classes: string } {
  const vars: Record<string, string> = {};
  let classes = "";
  const filter = tuneFilter(tune);
  if (filter) {
    vars["--tv-bg-filter"] = filter;
    classes += " has-bg-tune";
  }
  const fill = fillCss(frames.fill, frames.fillOpacity);
  if (fill) {
    vars["--frame-fill"] = fill;
    classes += " has-frame-fill";
  }
  if (frames.line && frames.lineWidth > 0) {
    vars["--frame-line"] = frames.line;
    vars["--frame-line-w"] = lineWidth(frames.lineWidth);
    classes += " has-frame-line";
  }
  if (frames.depth > 0) {
    vars["--frame-depth"] = depthShadow(frames.depth);
    classes += " has-frame-depth";
  }
  if (frames.image) {
    vars["--frame-image"] = `url("${frames.image}")`;
    vars["--frame-image-slice"] = `${frames.imageSlice}%`;
    vars["--frame-image-w"] = `calc(var(--u) * ${frames.imageWidth})`;
    classes += " has-frame-image";
  }
  return { vars, classes };
}

/**
 * One frame dressed apart (frameLooks.ts): the same variables, redefined on
 * the frame itself, plus the markers that switch the rules on for a frame
 * whose board has none. Colours of the text go in as the theme's own
 * variables, so every line inside takes them the way it takes the theme's.
 */
export function frameLookProps(look: FrameLook | undefined): {
  style?: CSSProperties;
  "data-own-fill"?: "";
  "data-own-line"?: "";
} {
  if (!look) return {};
  const css: Record<string, string> = {};
  const out: { style?: CSSProperties; "data-own-fill"?: ""; "data-own-line"?: "" } = {};
  const fill = fillCss(look.bg, look.bgOpacity ?? 1);
  if (fill) {
    css["--frame-fill"] = fill;
    if (HEX6.test(look.bg ?? "") || isSafeCssValue(look.bg ?? "")) css["--tv-panel"] = fill;
    out["data-own-fill"] = "";
  }
  if (look.text) {
    css.color = look.text;
    css["--tv-text"] = look.text;
    css["--tv-text-dim"] = look.text;
  }
  if (look.accent) css["--tv-accent"] = look.accent;
  if (look.line) {
    css["--frame-line"] = look.line;
    css["--frame-line-w"] = lineWidth(look.lineWidth ?? 2);
    out["data-own-line"] = "";
  }
  if (Object.keys(css).length) out.style = css as CSSProperties;
  return out;
}
