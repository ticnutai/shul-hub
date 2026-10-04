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

/** A piece of the board's frame, on round numbers, back on its usual size and place when close - or on the screen's edge (boardFrame.pieceEdges). */
export function snapTune(
  t: BoardFrameTune,
  edge: { x?: number | null; y?: number | null; length?: number | null } = {},
): BoardFrameTune {
  const half = (v: number) => Math.round(v * 2) / 2;
  const step = (v: number) => Math.round(v * 20) / 20;
  // Caught by the nearer of its usual place and the screen's edge, else on the grid.
  const nearest = (v: number, targets: Array<number | null | undefined>, within: number) =>
    targets
      .filter((to): to is number => to != null && Math.abs(v - to) < within)
      .sort((p, q) => Math.abs(v - p) - Math.abs(v - q))[0];
  const place = (v: number, at: number | null | undefined) => nearest(v, [0, at], 0.5) ?? half(v);
  const run = (v: number) => {
    const to = nearest(v, [1, edge.length], 0.04);
    return to === undefined ? step(v) : Math.round(to * 1000) / 1000;
  };
  return {
    ...t,
    x: place(t.x, edge.x),
    y: place(t.y, edge.y),
    size: Math.abs(t.size - 1) < 0.05 ? 1 : step(t.size),
    length: Math.min(run(t.length), 1.1),
  };
}
