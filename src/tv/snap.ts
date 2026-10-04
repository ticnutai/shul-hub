import type { BoardFrameTune } from "./boardFrame";

/**
 * Snapping while something is dragged on the board, so things line up
 * without a steady hand: an element lands back on its own place or with its
 * middle on the board's middle, and otherwise on a half-percent grid; a piece
 * of the board's frame lands on round numbers and back on its usual size.
 * Holding Ctrl drags freely (TvPreview).
 */

/** How close, in percent of the board, counts as "on" a line. */
const NEAR = 1.2;

/**
 * One axis of an element's offset (percent of the board), given where its
 * middle is with no offset. `line` is where to draw the guide, in percent of
 * the board along that axis; null when it snapped only to the grid.
 */
export function snapOffset(value: number, natural: number): { value: number; line: number | null } {
  const lines = [
    { to: 0, line: natural },
    { to: 50 - natural, line: 50 },
  ];
  const near = lines
    .map((l) => ({ ...l, d: Math.abs(value - l.to) }))
    .filter((l) => l.d <= NEAR)
    .sort((a, b) => a.d - b.d)[0];
  if (near) return { value: Math.round(near.to * 10) / 10, line: near.line };
  return { value: Math.round(value * 2) / 2, line: null };
}

/** A piece of the board's frame, on round numbers and back on its usual size when close. */
export function snapTune(t: BoardFrameTune): BoardFrameTune {
  const half = (v: number) => Math.round(v * 2) / 2;
  const step = (v: number) => Math.round(v * 20) / 20;
  return {
    ...t,
    x: Math.abs(t.x) < 0.5 ? 0 : half(t.x),
    y: Math.abs(t.y) < 0.5 ? 0 : half(t.y),
    size: Math.abs(t.size - 1) < 0.05 ? 1 : step(t.size),
    length: t.length > 0.96 ? 1 : step(t.length),
  };
}
