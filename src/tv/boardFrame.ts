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
  length: [0.2, 1],
  x: [0, 20],
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
  }
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
