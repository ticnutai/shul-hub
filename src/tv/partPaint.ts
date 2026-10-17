/**
 * The boards of a board of parts (its boxes) dressed from the backgrounds'
 * gallery, one or all of them - as the board's own background is - from the
 * same panel, "רקע הלוח", with the parts chosen.
 */
import type { SavedBackground } from "./backgroundItem";
import { normalizePaint, type BoardElement } from "./elements";

/** The parts of a choice that can wear a background: the boxes. */
export const paintable = (elements: BoardElement[], ids: readonly string[]): BoardElement[] =>
  elements.filter((e) => e.kind === "box" && ids.includes(e.id));

/** The boxes chosen in a background of the gallery; null takes it off (back to their own colour). */
export function paintParts(elements: BoardElement[], ids: readonly string[], b: Pick<SavedBackground, "fill" | "picture" | "overlay" | "strength"> | null): BoardElement[] {
  const paint = b ? normalizePaint({ fill: b.fill, picture: b.picture, overlay: b.overlay, strength: b.strength }) : undefined;
  return elements.map((e) => {
    if (e.kind !== "box" || !ids.includes(e.id)) return e;
    const { paint: _old, ...rest } = e;
    return paint ? { ...rest, paint } : rest;
  });
}

/** The boxes chosen in one colour of their own: the colour itself, the gallery's look taken off. */
export function colourParts(elements: BoardElement[], ids: readonly string[], colour: string): BoardElement[] {
  return elements.map((e) => {
    if (e.kind !== "box" || !ids.includes(e.id)) return e;
    const { paint: _old, ...rest } = e;
    return { ...rest, fill: colour };
  });
}

/** Whether a box wears this background of the gallery. */
export function wearsPaint(e: BoardElement, b: Pick<SavedBackground, "fill" | "picture" | "overlay">): boolean {
  if (!e.paint) return false;
  return b.picture ? e.paint.picture === b.picture && e.paint.overlay === b.overlay : !e.paint.picture && e.paint.fill === b.fill;
}
