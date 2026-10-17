/**
 * One rule for every container of a board of parts: it has one board (what
 * stands behind its content) and one frame - drawn as parts of their own, or
 * painted, cut from a kit's picture ("מילוי זמני תפילות", "מסגרת זמני
 * תפילות"). Whatever is chosen in a container, its board takes the colour or
 * the background, and its frame is replaced - never a second frame added. A
 * painted piece becomes a part of its own where it stands, in the shape it
 * nearly has, the first time it is changed.
 */
import type { SavedBackground } from "./backgroundItem";
import { normalizeElements, normalizePaint, type BoardElement } from "./elements";
import { STRAIGHT_SHAPES, type PartShape } from "./partShapes";
import { linkedSection } from "./sectionGeometry";

export type PartRole = "backdrop" | "board" | "frame" | "text" | "ornament" | "picture";

const paintedBoard = (e: BoardElement) => e.kind === "image" && e.name.startsWith("מילוי ");
const paintedFrame = (e: BoardElement) => e.kind === "image" && e.name.startsWith("מסגרת ");

/**
 * The main background's own picture, in a kit painted from one picture ("רקע
 * המקור ללא חלקי העיצוב"): it covers the whole board, over the board's own
 * background - the main container's board, painted.
 */
export const isBackdrop = (e: BoardElement) =>
  e.kind === "image" && (e.name.startsWith("רקע המקור") || (e.x <= 1 && e.y <= 1 && e.width >= 98 && e.height >= 98));

/** The board's own background chosen: the painted one over it hidden (not deleted - it can come back). */
export const hideBackdrops = (all: BoardElement[]): BoardElement[] => all.map((e) => (isBackdrop(e) && !e.hidden ? { ...e, hidden: true } : e));
export const showBackdrops = (all: BoardElement[]): BoardElement[] => all.map((e) => (isBackdrop(e) && e.hidden ? { ...e, hidden: false } : e));

/** What a part is to its container. */
export function roleOf(e: BoardElement): PartRole {
  if (isBackdrop(e)) return "backdrop";
  if (e.kind === "box" || paintedBoard(e)) return "board";
  if (e.kind === "frame" || paintedFrame(e)) return "frame";
  if (e.kind === "text") return "text";
  if (e.kind === "ornament" || e.kind === "column" || (e.kind === "image" && (e.crop || e.sourceMask))) return "ornament";
  return "picture";
}

export interface Container {
  ids: string[];
  board: BoardElement | null;
  frame: BoardElement | null;
}

/** How much of `a` lies inside `b`, 0-1. */
function inside(a: BoardElement, b: BoardElement): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 && a.width > 0 && a.height > 0 ? (w * h) / (a.width * a.height) : 0;
}

/**
 * The containers the parts chosen stand in, each once, with its board and frame.
 * A kit's pieces are paired by name ("מילוי X" - "מסגרת X") and by containment;
 * where neither pairs them ("מסגרת מרכזית מהמקור" over "מילוי התיבה המרכזית"),
 * a frame takes the board that lies within it, and a board the frame around it -
 * the same pair from whichever of the two is chosen.
 */
export function containersOf(all: BoardElement[], chosen: readonly string[]): Container[] {
  const out: Container[] = [];
  for (const id of chosen) {
    if (out.some((c) => c.ids.includes(id))) continue;
    const ids = linkedSection(all, id);
    const own = all.filter((e) => ids.includes(e.id));
    let board = own.find((e) => roleOf(e) === "board") ?? null;
    let frame = own.find((e) => roleOf(e) === "frame") ?? null;
    const free = (e: BoardElement) => !out.some((c) => c.ids.includes(e.id)) && !ids.includes(e.id);
    if (frame && !board) {
      // Close in size too: a box standing somewhere inside a large frame is not its board.
      board = all.filter((e) => roleOf(e) === "board" && free(e) && inside(e, frame!) >= 0.8 && e.width * e.height >= frame!.width * frame!.height * 0.6)
        .sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null;
      if (board) ids.push(...linkedSection(all, board.id).filter((x) => !ids.includes(x)));
    } else if (board && !frame) {
      frame = all.filter((e) => roleOf(e) === "frame" && free(e) && inside(board!, e) >= 0.8 && e.width * e.height >= board!.width * board!.height * 0.9 && e.width * e.height <= board!.width * board!.height * 1.6)
        .sort((a, b) => a.width * a.height - b.width * b.height)[0] ?? null;
      if (frame) ids.push(...linkedSection(all, frame.id).filter((x) => !ids.includes(x)));
    }
    out.push({ ids, board, frame });
  }
  return out;
}

/** The shape a painted piece nearly has: an arch when it stands tall (on the 16:9 board), else rounded. */
export function nearShape(e: BoardElement): PartShape {
  if (e.shape) return e.shape;
  return e.height * 9 > e.width * 16 * 1.15 ? "arch" : "rounded";
}

/** A painted piece made a part of its own where it stands: a board (a box) or a frame. */
function realize(e: BoardElement, as: "box" | "frame"): BoardElement {
  const { crop: _c, sourceMask: _m, imageTune: _t, archFill: _a, symbol: _s, ...rest } = e as BoardElement & { symbol?: unknown };
  return {
    ...rest,
    kind: as,
    image: "",
    shape: nearShape(e),
    fill: as === "frame" ? "transparent" : e.fill && e.fill !== "transparent" ? e.fill : "#fff5dc",
    color: e.color && e.color !== "transparent" ? e.color : "#c9a24a",
  } as BoardElement;
}

/**
 * The frames of the containers chosen in a frame of the gallery ("frame:<id>"),
 * or a drawn line (null). A painted frame is replaced where it stands; a
 * container without one gets one around its board, in its shape - a picture
 * frame too, drawn along any outline.
 */
export function wearFrame(all: BoardElement[], chosen: readonly string[], ref: string | null): { elements: BoardElement[] } {
  let next = [...all];
  for (const c of containersOf(all, chosen)) {
    const base = c.frame ?? c.board;
    if (!base) continue;
    const shape = c.frame?.kind === "frame" ? c.frame.shape : nearShape(c.board ?? base);
    const straight = !shape || STRAIGHT_SHAPES.includes(shape);
    // A picture frame goes on any shape: on a straight one as it always did, on any other along its outline.
    const look = { image: ref ?? "", shape: ref && straight ? undefined : shape };
    if (c.frame) {
      const f = c.frame.kind === "frame" ? c.frame : realize(c.frame, "frame");
      next = next.map((e) => (e.id === c.frame!.id ? { ...f, ...look } : e));
    } else {
      const b = c.board!;
      const frame: BoardElement = {
        ...realize(b, "frame"),
        id: `e_${Math.random().toString(36).slice(2, 10)}`,
        name: `מסגרת ${b.name.replace(/^(מילוי|תיבה) ?-? ?/, "")}`.trim(),
        ...look,
      };
      // Right over its board.
      const at = next.findIndex((e) => e.id === b.id);
      next.splice(at + 1, 0, frame);
    }
  }
  return { elements: normalizeElements(next) };
}

/** The boards of the containers chosen in a background of the gallery (null - their own colour again). */
export function paintBoards(all: BoardElement[], chosen: readonly string[], b: Pick<SavedBackground, "fill" | "picture" | "overlay" | "strength"> | null): BoardElement[] {
  const paint = b ? normalizePaint({ fill: b.fill, picture: b.picture, overlay: b.overlay, strength: b.strength }) : undefined;
  const boards = new Set(containersOf(all, chosen).flatMap((c) => (c.board ? [c.board.id] : [])));
  return normalizeElements(all.map((e) => {
    if (!boards.has(e.id)) return e;
    const box = e.kind === "box" ? e : realize(e, "box");
    const { paint: _old, ...rest } = box;
    return paint ? { ...rest, paint } : rest;
  }));
}

/** The boards of the containers chosen in one colour of their own. */
export function colourBoards(all: BoardElement[], chosen: readonly string[], colour: string): BoardElement[] {
  const boards = new Set(containersOf(all, chosen).flatMap((c) => (c.board ? [c.board.id] : [])));
  return normalizeElements(all.map((e) => {
    if (!boards.has(e.id)) return e;
    const box = e.kind === "box" ? e : realize(e, "box");
    const { paint: _old, ...rest } = box;
    return { ...rest, fill: colour };
  }));
}

/** The frames' line colour (a drawn frame; a painted one becomes one). */
export function colourFrames(all: BoardElement[], chosen: readonly string[], colour: string): BoardElement[] {
  const frames = new Set(containersOf(all, chosen).flatMap((c) => (c.frame ? [c.frame.id] : [])));
  return normalizeElements(all.map((e) => {
    if (!frames.has(e.id)) return e;
    const f = e.kind === "frame" ? e : realize(e, "frame");
    return { ...f, image: "", color: colour, shape: f.shape ?? nearShape(e) };
  }));
}
