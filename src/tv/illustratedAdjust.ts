import type { CSSProperties } from "react";
import type { IllustratedStyle } from "./config";
import type { Illustration } from "./illustrated";

/**
 * "התאמות תמונה" for a painted board: the picture is one image, so its
 * colours cannot be edited stone by stone. What can be done - and is done
 * here - is layering over it:
 *
 *   the picture itself     brightness, saturation, hue (a CSS filter on its
 *                          own layer, so the text on top is untouched)
 *   the stones             a colour laid over everything outside the frames
 *                          (mix-blend-mode: color keeps the stones' light and
 *                          shade and changes only their colour)
 *   the frames             a background colour of their own, a line around
 *                          them, and depth - a shadow outside and a highlight
 *                          and shade inside, so they stand out more (or at 0,
 *                          exactly as painted)
 *
 * Frames are the two panels, the two plaques and the bars, in the shape the
 * admin picks: rectangles, or arched at the top like tablets.
 */

type Box = [number, number, number, number];
type FrameKey = "panelR" | "panelL" | "plaqueR" | "plaqueL" | "barR" | "barL";
const FRAME_KEYS: FrameKey[] = ["panelR", "panelL", "plaqueR", "plaqueL", "barR", "barL"];
/** How tall the arch is, as a share of the frame's height. */
const ARCH = 0.22;

const HEX6 = /^#[0-9a-f]{6}$/i;
function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(alpha * 1000) / 1000})`;
}

/** Only panels are arched; plaques and bars stay rectangles. */
const isArched = (key: FrameKey, look: IllustratedStyle) => look.frameShape === "arch" && key.startsWith("panel");

/** An SVG path (in the picture's 0..100 space) of one frame. */
function framePath([x1, y1, x2, y2]: Box, arched: boolean): string {
  if (!arched) return `M${x1} ${y1}H${x2}V${y2}H${x1}Z`;
  const w = x2 - x1;
  const top = y1 + (y2 - y1) * ARCH;
  return `M${x1} ${y2}V${top}A${w / 2} ${top - y1} 0 0 1 ${x2} ${top}V${y2}Z`;
}

/** Everything outside the frames, as a mask (white shows the stone colour). */
export function stoneMask(boxes: Illustration["boxes"], look: IllustratedStyle): string {
  const holes = FRAME_KEYS.flatMap((k) => (boxes[k] ? [framePath(boxes[k] as Box, isArched(k, look))] : []))
    // The clock sits on the picture too; keep its medallion as painted.
    .concat(boxes.clock ? [framePath(boxes.clock as Box, false)] : []);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">` +
    `<path fill="white" fill-rule="evenodd" d="M0 0H100V100H0Z ${holes.join(" ")}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function isNeutral(look: IllustratedStyle): boolean {
  return (
    look.brightness === 1 &&
    look.saturation === 1 &&
    look.hue === 0 &&
    !look.stoneTint &&
    !look.frameFill &&
    look.frameDepth === 0 &&
    !look.frameLine
  );
}

export interface IllustratedLayers {
  /** The picture's own layer (filter only when something is changed). */
  picture: CSSProperties;
  /** The stones' colour, or null. */
  stone: CSSProperties | null;
  /** One style per frame that gets a background, a line or depth. */
  frames: Array<{ key: FrameKey; style: CSSProperties }>;
}

export function illustratedLayers(boxes: Illustration["boxes"], look: IllustratedStyle): IllustratedLayers {
  const filter =
    look.brightness !== 1 || look.saturation !== 1 || look.hue !== 0
      ? `brightness(${look.brightness}) saturate(${look.saturation}) hue-rotate(${look.hue}deg)`
      : undefined;

  const stone =
    look.stoneTint && HEX6.test(look.stoneTint) && look.stoneTintStrength > 0
      ? ({
          background: look.stoneTint,
          opacity: look.stoneTintStrength,
          mixBlendMode: "color",
          maskImage: stoneMask(boxes, look),
          WebkitMaskImage: stoneMask(boxes, look),
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
        } as CSSProperties)
      : null;

  const d = look.frameDepth;
  const fill = look.frameFill && HEX6.test(look.frameFill) && look.frameFillOpacity > 0 ? rgba(look.frameFill, look.frameFillOpacity) : null;
  const line = look.frameLine && HEX6.test(look.frameLine) && look.frameLineWidth > 0 ? look.frameLine : null;
  const frames: IllustratedLayers["frames"] = [];
  if (fill || line || d > 0) {
    for (const key of FRAME_KEYS) {
      const b = boxes[key] as Box | undefined;
      if (!b) continue;
      const arched = isArched(key, look);
      const shadows =
        d > 0
          ? [
              `0 ${(d * 0.9).toFixed(2)}cqw ${(d * 2.2).toFixed(2)}cqw rgba(0,0,0,${(0.45 * d).toFixed(2)})`,
              `inset 0 ${(d * 0.45).toFixed(2)}cqw ${(d * 0.7).toFixed(2)}cqw rgba(255,255,255,${(0.4 * d).toFixed(2)})`,
              `inset 0 ${(-d * 0.6).toFixed(2)}cqw ${(d * 0.9).toFixed(2)}cqw rgba(0,0,0,${(0.35 * d).toFixed(2)})`,
            ].join(", ")
          : undefined;
      frames.push({
        key,
        style: {
          left: `${b[0]}%`,
          top: `${b[1]}%`,
          width: `${b[2] - b[0]}%`,
          height: `${b[3] - b[1]}%`,
          background: fill ?? undefined,
          border: line ? `${(look.frameLineWidth * 0.08).toFixed(2)}cqw solid ${line}` : undefined,
          boxShadow: shadows,
          borderRadius: arched ? `50% 50% 0.4cqw 0.4cqw / ${ARCH * 100}% ${ARCH * 100}% 0.4cqw 0.4cqw` : "0.4cqw",
        },
      });
    }
  }
  return { picture: filter ? { filter } : {}, stone, frames };
}
