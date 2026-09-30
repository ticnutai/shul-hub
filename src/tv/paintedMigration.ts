import type { TvConfig } from "./config";
import { applyDesign, BUILTIN_DESIGNS } from "./designs";

/**
 * A painted board, moved onto the ready design that replaces its painting.
 *
 * The paintings were one picture each; the designs rebuild them from parts
 * (a background, frames, the text's colours, the medallion layout). This
 * puts a board that shows a painting onto its design, and then carries over
 * what the gabbai had adjusted on the painting, each to the part that now
 * owns it - so the wall looks as it did, and every part can be changed.
 *
 *   type size            illustratedStyle.scale  -> textScale
 *   brightness, colour   brightness/saturation/hue, stone tint -> backgroundTune
 *   a line, depth        frameLine/frameLineWidth/frameDepth -> frameStyle
 *   inks                 ink/accent -> the text's colours; clockInk -> the clock frame
 *
 * The painting drew the weekday, the date and the clock whatever the board's
 * "hidden" list said (that list was written for the ordinary header), so
 * those three are shown again: the medallion honours the list, and a board
 * should not lose its weekday by being moved.
 *
 * A board that is not painted, or whose painting has no design (an imported
 * one), is returned as it is.
 */
export const DESIGN_FOR_PAINTING: Record<string, string> = {
  curtain: "d_curtain",
  stone: "d_stone",
  wood: "d_wood",
  modern: "d_modern",
};

export function migratePainted(c: TvConfig): TvConfig {
  if (c.screenLayout !== "illustrated") return c;
  const design = BUILTIN_DESIGNS.find((d) => d.id === DESIGN_FOR_PAINTING[c.illustration]);
  if (!design) return c;

  // What the painting's own settings were (older boards may carry more keys than the type knows).
  const old = c.illustratedStyle as TvConfig["illustratedStyle"] & Record<string, unknown>;
  const num = (k: string, d: number) => (typeof old[k] === "number" ? (old[k] as number) : d);
  const str = (k: string) => (typeof old[k] === "string" && old[k] ? (old[k] as string) : null);

  let next = applyDesign(c, design);

  next = {
    ...next,
    textScale: old.scale ?? next.textScale,
    backgroundTune: {
      ...next.backgroundTune,
      brightness: num("brightness", 1),
      saturation: num("saturation", 1),
      hue: num("hue", 0),
      ...(str("stoneTint") ? { tint: str("stoneTint"), tintStrength: num("stoneTintStrength", 0.35) } : {}),
    },
    frameStyle: {
      ...next.frameStyle,
      ...(str("frameLine") ? { line: str("frameLine"), lineWidth: num("frameLineWidth", 2) } : {}),
      ...(num("frameDepth", 0) > 0 ? { depth: num("frameDepth", 0) } : {}),
    },
    themeOverrides: {
      ...next.themeOverrides,
      ...(old.ink ? { "--tv-text": old.ink } : {}),
      ...(old.accent ? { "--tv-accent": old.accent, "--tv-accent-2": old.accent } : {}),
    },
    frameLooks: old.clockInk
      ? { ...next.frameLooks, clock: { ...next.frameLooks.clock, text: old.clockInk, accent: old.clockInk } }
      : next.frameLooks,
    hidden: next.hidden.filter((k) => k !== "header.weekday" && k !== "header.date" && k !== "header.clock"),
  };
  return next;
}
