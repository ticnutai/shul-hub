import type { CSSProperties } from "react";
import type { FrameShape, TvConfig } from "./config";
import { setFrameLook, type BoxShape, type FrameId } from "./frameLooks";
import { FRAME_PICTURES, framePictureRef, framePictureUrl } from "./framePictures";

/**
 * Ready boxes: a shape, a line, a background, how far it stands out and a
 * frame picture, chosen together with one click - for every box, or for one.
 * Each part can then be changed on its own below them, like a background
 * from the gallery.
 */
export interface BoxPreset {
  id: string;
  name: string;
  shape: Exclude<BoxShape, "square">;
  line: string | null;
  lineWidth: number;
  /** 0–1; every box only (one box takes the board's). */
  depth: number;
  /** A colour for the box's background; null: as the style draws it. */
  fill: string | null;
  image: string | null;
}

export const BOX_PRESETS: BoxPreset[] = [
  { id: "classic-gold", name: "קלאסי זהב", shape: "round", line: "#c9a227", lineWidth: 2, depth: 0.3, fill: null, image: null },
  { id: "soft-pill", name: "כמוסה רכה", shape: "pill", line: null, lineWidth: 2, depth: 0.55, fill: null, image: null },
  { id: "hexagon-gold", name: "משושה זהב", shape: "hexagon", line: "#d8ab35", lineWidth: 2.5, depth: 0.2, fill: null, image: null },
  { id: "octagon-silver", name: "מתומן כסוף", shape: "octagon", line: "#c0c7d1", lineWidth: 2, depth: 0.25, fill: null, image: null },
  { id: "ellipse-gold", name: "אליפסה", shape: "ellipse", line: "#c9a227", lineWidth: 1.5, depth: 0.3, fill: null, image: null },
  { id: "clear-line", name: "שקוף עם קו", shape: "round", line: "#ffffff", lineWidth: 1.5, depth: 0, fill: "rgba(0, 0, 0, 0.15)", image: null },
  { id: "glass", name: "זכוכית", shape: "round", line: "rgba(255, 255, 255, 0.35)", lineWidth: 1, depth: 0.45, fill: "rgba(255, 255, 255, 0.12)", image: null },
  { id: "ornate", name: "מסגרת מעוטרת", shape: "round", line: null, lineWidth: 2, depth: 0.3, fill: null, image: framePictureRef("gold-ornate") },
  { id: "double-gold", name: "קו כפול", shape: "round", line: null, lineWidth: 2, depth: 0.2, fill: null, image: framePictureRef("double-gold") },
  { id: "stepped", name: "פינות מדורגות", shape: "round", line: null, lineWidth: 2, depth: 0.2, fill: null, image: framePictureRef("stepped") },
];

const SHAPE_FOR_ALL: Record<BoxPreset["shape"], FrameShape> = {
  round: "round",
  pill: "pill",
  ellipse: "ellipse",
  hexagon: "hexagon",
  octagon: "octagon",
};

/** The preset on every box, or on one (`frame`); the board leaves a painting it was. */
export function applyBoxPreset(c: TvConfig, p: BoxPreset, frame: FrameId | null): TvConfig {
  const picture = FRAME_PICTURES.find((f) => framePictureRef(f.id) === p.image);
  if (frame)
    return {
      ...c,
      frameLooks: setFrameLook(c.frameLooks, frame, {
        shape: p.shape,
        line: p.line,
        lineWidth: p.line ? p.lineWidth : null,
        bg: p.fill,
        bgOpacity: null,
        image: p.image,
      }),
    };
  return {
    ...c,
    frame: { ...c.frame, shape: SHAPE_FOR_ALL[p.shape] },
    frameStyle: {
      ...c.frameStyle,
      fill: p.fill,
      fillOpacity: 1,
      line: p.line,
      lineWidth: p.lineWidth,
      depth: p.depth,
      image: p.image,
      ...(picture ? { imageSlice: picture.slice, imageWidth: picture.width } : {}),
    },
  };
}

/** Is it what every box (or the one box) wears now? */
export function wearsBoxPreset(c: TvConfig, p: BoxPreset, frame: FrameId | null): boolean {
  if (frame) {
    const l = c.frameLooks[frame];
    return Boolean(l) && l!.shape === p.shape && (l!.line ?? null) === p.line && (l!.bg ?? null) === p.fill && (l!.image ?? null) === p.image;
  }
  const f = c.frameStyle;
  return c.frame.shape === SHAPE_FOR_ALL[p.shape] && f.line === p.line && f.fill === p.fill && f.image === p.image && f.depth === p.depth;
}

/** A small box drawn as the preset would draw it, for its tile. */
export function boxShapeCss(shape: BoxShape | FrameShape): CSSProperties {
  switch (shape) {
    case "square":
      return { borderRadius: 0 };
    case "pill":
      return { borderRadius: 999 };
    case "ellipse":
      return { borderRadius: "50%" };
    case "hexagon":
      return { borderRadius: 0, clipPath: "polygon(14% 0, 86% 0, 100% 50%, 86% 100%, 14% 100%, 0 50%)" };
    case "octagon":
      return { borderRadius: 0, clipPath: "polygon(18% 0, 82% 0, 100% 22%, 100% 78%, 82% 100%, 18% 100%, 0 78%, 0 22%)" };
    default:
      return { borderRadius: 8 };
  }
}

export function boxPresetCss(p: BoxPreset): CSSProperties {
  const picture = framePictureUrl(p.image);
  const def = FRAME_PICTURES.find((f) => framePictureRef(f.id) === p.image);
  const cut = p.shape === "hexagon" || p.shape === "octagon";
  return {
    ...boxShapeCss(p.shape),
    background: p.fill ?? "#16304f",
    ...(p.line && !cut ? { outline: `${Math.max(1, p.lineWidth)}px solid ${p.line}`, outlineOffset: -Math.max(1, p.lineWidth) } : {}),
    ...(p.line && cut ? { boxShadow: `inset 0 0 0 ${Math.max(1, p.lineWidth)}px ${p.line}` } : {}),
    ...(p.depth > 0 && !cut ? { boxShadow: `0 ${Math.round(p.depth * 8)}px ${Math.round(p.depth * 16)}px rgba(0,0,0,0.45)` } : {}),
    ...(picture
      ? { borderStyle: "solid", borderColor: "transparent", borderWidth: 8, borderImage: `url("${picture}") ${def?.slice ?? 30}% fill / 8px stretch` }
      : {}),
  };
}
