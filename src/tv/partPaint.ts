/**
 * Whether a board wears a background of the gallery. (The boards themselves -
 * one container's or all - are dressed through containerParts.ts: paintBoards,
 * colourBoards.)
 */
import type { SavedBackground } from "./backgroundItem";
import type { BoardElement } from "./elements";

/** Whether a box wears this background of the gallery. */
export function wearsPaint(e: BoardElement, b: Pick<SavedBackground, "fill" | "picture" | "overlay">): boolean {
  if (!e.paint) return false;
  return b.picture ? e.paint.picture === b.picture && e.paint.overlay === b.overlay : !e.paint.picture && e.paint.fill === b.fill;
}
