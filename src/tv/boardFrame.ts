import type { BoardFrame } from "./config";

/**
 * A frame for the whole board, moved and sized by hand: how thick, how long,
 * how far from the side, up or down, and on which sides. The same five knobs
 * for every frame, each read the way that frame is drawn (BOARD_FRAME_KNOBS);
 * tv.css draws the pieces from the variables, and the board's content makes
 * room for them by the same numbers, so a column never stands on the times.
 */
export interface BoardFrameTune {
  /** Thickness, as a share of the frame's own (1 = as drawn). */
  size: number;
  /** Length along the side it stands on, as a share of that side. */
  length: number;
  /** Away from the side edge, in --u. */
  x: number;
  /** Up or down (columns, curtains), or away from the top and bottom edge, in --u. */
  y: number;
  /** For the frames that stand at the sides: both, or one. */
  sides: "both" | "right" | "left";
}

export const DEFAULT_BOARD_FRAME_TUNE: BoardFrameTune = { size: 1, length: 1, x: 0, y: 0, sides: "both" };

export const BOARD_FRAME_LIMITS = {
  size: [0.4, 2.5],
  length: [0.2, 1.1],
  // Below 0 the piece goes on to the screen's very edge (pieceEdges) and a little past it.
  x: [-2, 20],
  y: [-20, 20],
} as const;

const clamp = (v: unknown, [lo, hi]: readonly [number, number], fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v)) * 100) / 100 : fallback;

export function normalizeBoardFrameTune(raw: unknown): BoardFrameTune {
  const d = DEFAULT_BOARD_FRAME_TUNE;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...d };
  const r = raw as Record<string, unknown>;
  return {
    size: clamp(r.size, BOARD_FRAME_LIMITS.size, d.size),
    length: clamp(r.length, BOARD_FRAME_LIMITS.length, d.length),
    x: clamp(r.x, BOARD_FRAME_LIMITS.x, d.x),
    y: clamp(r.y, BOARD_FRAME_LIMITS.y, d.y),
    sides: r.sides === "right" || r.sides === "left" ? r.sides : "both",
  };
}

/** What each knob means for each frame, as the editor names it; null - the frame has no such knob. */
export const BOARD_FRAME_KNOBS: Record<
  BoardFrame,
  { size: string; length: string | null; x: string | null; y: string | null; sides: boolean }
> = {
  columns: { size: "רוחב העמודים", length: "גובה העמודים", x: "מרחק מהצד", y: "הזזה למעלה / למטה", sides: true },
  beams: { size: "עובי הקורות", length: "אורך הקורות", x: null, y: "מרחק מהקצה למעלה ולמטה", sides: false },
  heichal: { size: "עובי העמודים והקורות", length: "גובה העמודים", x: "מרחק העמודים מהצד", y: "מרחק הקורות מהקצה", sides: true },
  parochet: { size: "גובה הפרוכת", length: "רוחב הפרוכת", x: null, y: "הורדה מלמעלה", sides: false },
  curtain: { size: "רוחב הווילונות", length: "גובה הווילונות", x: "מרחק מהצד", y: "הזזה למעלה / למטה", sides: true },
  carved: { size: "עובי המסגרת", length: null, x: "מרחק מהצדדים", y: "מרחק מלמעלה ולמטה", sides: false },
  "double-line": { size: "עובי הקווים", length: null, x: "מרחק מהצדדים", y: "מרחק מלמעלה ולמטה", sides: false },
  picture: { size: "עובי המסגרת", length: null, x: "מרחק מהצדדים", y: "מרחק מלמעלה ולמטה", sides: false },
};

/** The pieces a frame is drawn from (tv.css, .tv-bf-*), on the sides chosen. */
export function boardFramePieces(frame: BoardFrame, sides: BoardFrameTune["sides"]): string[] {
  const at = (piece: string) =>
    sides === "both" ? [`${piece} is-right`, `${piece} is-left`] : [`${piece} is-${sides}`];
  switch (frame) {
    case "columns":
      return at("tv-bf-column");
    case "beams":
      return ["tv-bf-beam is-top", "tv-bf-beam is-bottom"];
    case "heichal":
      return [...at("tv-bf-column"), "tv-bf-beam is-top", "tv-bf-beam is-bottom"];
    case "parochet":
      return ["tv-bf-drape", "tv-bf-rod"];
    case "curtain":
      return at("tv-bf-curtain");
    case "carved":
      return ["tv-bf-carved"];
    case "double-line":
      return ["tv-bf-line is-outer", "tv-bf-line is-inner"];
    case "picture":
      return ["tv-bf-picture"];
  }
}

/**
 * The handles a piece shows while the board is edited by hand: "size" on its
 * inner edge (thicker, wider), "len-a" and "len-b" at its two ends (longer).
 */
export function pieceHandles(piece: string): string[] {
  if (/tv-bf-(column|curtain|beam|drape)/.test(piece)) return ["size", "len-a", "len-b"];
  if (/tv-bf-(carved|picture|line is-outer)/.test(piece)) return ["size"];
  return [];
}

/**
 * Where a piece touches the screen's edge, in its own knobs: x (and y, for a
 * frame around the screen) at which it stands on the edge, and the length at
 * which a column or curtain runs from the top of the screen to its bottom.
 * `height` and `u` in the same pixels. A drag is caught there (snap.snapTune).
 */
export function pieceEdges(piece: string, height: number, u: number): { x: number | null; y: number | null; length: number | null } {
  if (/tv-bf-column/.test(piece)) return { x: -0.8, y: null, length: height > 1.2 * u ? height / (height - 1.2 * u) : null };
  if (/tv-bf-curtain/.test(piece)) return { x: 0, y: null, length: 1 };
  if (/tv-bf-(beam|drape|rod)/.test(piece)) return { x: null, y: 0, length: 1 };
  if (/tv-bf-(carved|picture)/.test(piece)) return { x: -0.8, y: -0.8, length: null };
  if (/tv-bf-line/.test(piece)) return { x: -1, y: -1, length: null };
  return { x: null, y: null, length: null };
}

/** The variables the pieces and the room around them are drawn from. */
export function boardFrameVars(t: BoardFrameTune): Record<string, string> {
  return {
    "--bf-s": String(t.size),
    "--bf-l": String(t.length),
    "--bf-x": `calc(var(--u) * ${t.x})`,
    "--bf-y": `calc(var(--u) * ${t.y})`,
  };
}

/** The size a piece is drawn at when its thickness is 1, in --u (tv.css). */
const PIECE_THICKNESS: Array<[RegExp, number]> = [
  [/tv-bf-column/, 6.4],
  [/tv-bf-curtain/, 8.5],
  [/tv-bf-beam/, 1.6],
  [/tv-bf-drape/, 9],
  [/tv-bf-rod/, 1.1],
  [/tv-bf-carved/, 2.4],
  [/tv-bf-picture/, 2.4],
  [/tv-bf-line/, 0.9],
];

/**
 * A drag on a piece of the board's frame, as the knobs it moves.
 *
 * `dx`/`dy` are the pointer's travel in screen pixels and `u` one --u in the
 * same pixels, so it lands the same at any preview scale. Without a handle
 * the piece is moved; with one it is stretched - at an end it grows longer
 * (and, being centred, its middle follows the end that moved), at its inner
 * edge thicker. `fromRight`/`fromBottom` say where on the screen the drag
 * started, which is what tells a frame around the screen which way is in.
 */
export function dragTune(
  piece: string,
  handle: string | null,
  t0: BoardFrameTune,
  move: { dx: number; dy: number; u: number; width: number; height: number; fromRight: boolean; fromBottom: boolean },
): BoardFrameTune {
  const { dx, dy, u, width, height } = move;
  const upright = /tv-bf-(column|curtain)/.test(piece);
  const lying = /tv-bf-(beam|drape|rod)/.test(piece);
  const right = /is-right/.test(piece);
  const bottom = /is-bottom/.test(piece);
  const next = { ...t0 };
  if (!handle) {
    if (upright) {
      next.x = t0.x + (right ? -dx : dx) / u;
      next.y = t0.y + dy / u;
    } else if (lying) {
      next.y = t0.y + (bottom ? -dy : dy) / u;
    } else {
      next.x = t0.x + (move.fromRight ? -dx : dx) / u;
      next.y = t0.y + (move.fromBottom ? -dy : dy) / u;
    }
  } else if (handle === "size") {
    const thick = PIECE_THICKNESS.find(([re]) => re.test(piece))?.[1] ?? 1;
    const inward = upright ? (right ? -dx : dx) : lying && bottom ? -dy : dy;
    next.size = t0.size + inward / (thick * u);
  } else if (upright) {
    // The column's run is the board less a little at each end; a curtain's is all of it.
    const run = /tv-bf-column/.test(piece) ? height - 1.2 * u : height;
    next.length = t0.length + (handle === "len-b" ? dy : -dy) / run;
    next.y = t0.y + dy / 2 / u;
  } else if (lying) {
    next.length = t0.length + (2 * (handle === "len-b" ? dx : -dx)) / width;
  }
  return normalizeBoardFrameTune(next);
}

/** The knobs as the board is drawing them now (its inline variables), so a drag starts from what is seen. */
export function readTuneFrom(root: HTMLElement): BoardFrameTune {
  const num = (name: string, re = /(-?[\d.]+)/) => Number(re.exec(root.style.getPropertyValue(name))?.[1] ?? NaN);
  const sides = /is-bf-sides-(right|left)/.exec(root.className)?.[1] as BoardFrameTune["sides"] | undefined;
  return normalizeBoardFrameTune({
    size: num("--bf-s"),
    length: num("--bf-l"),
    x: num("--bf-x", /\*\s*(-?[\d.]+)/),
    y: num("--bf-y", /\*\s*(-?[\d.]+)/),
    sides: sides ?? "both",
  });
}
