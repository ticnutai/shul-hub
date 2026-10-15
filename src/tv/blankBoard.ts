import { BLOCKS } from "./blocks";
import { DEFAULT_TV_CONFIG, type BlockId, type TvConfig } from "./config";
import type { PartContainer } from "./containers";
import { elementId, newElement, type BoardElement, type ElementBinding } from "./elements";
import { DESIGN_KEYS } from "./designs";
import { readOccasions } from "./occasions";
import { DAY_BLOCKS } from "./screens";

/**
 * A board started again from nothing: what stands on it first, then its look.
 *
 * The content comes first because the look is built around it - a frame for
 * the clock is wasted work if the clock then goes, and two big boxes want a
 * different shape from six small ones. So the gabbai ticks what the board
 * shows, gets one screen with those blocks and the plainest look there is,
 * and builds from there: the arrangement, the background, the boxes, their
 * frames, the text.
 *
 * Only the look and the arrangement go. What the shul has collected stays -
 * the wording, the logos, the occasions, the saved designs, backgrounds and
 * frames - and so does every screen's own setting that is not a look.
 */

/** The blocks a new board can start with: everything but the day's screens, which are occasions. */
export const STARTER_BLOCKS: readonly BlockId[] = BLOCKS.map((b) => b.id).filter((id) => !DAY_BLOCKS.includes(id));

/** Ticked to begin with: what nearly every board shows. */
export const STARTER_DEFAULT: readonly BlockId[] = ["header", "clock", "prayers", "zmanim", "footer"];

/** What each block shows on a board of parts, and how large its words are. */
const PART_OF: Partial<Record<BlockId, { binding: ElementBinding; size: number }>> = {
  header: { binding: "title", size: 5.5 },
  logo: { binding: "logos", size: 4 },
  clock: { binding: "clock", size: 6 },
  prayers: { binding: "prayers", size: 3.4 },
  zmanim: { binding: "zmanim", size: 3.4 },
  announcements: { binding: "announcements", size: 3.4 },
  shiurim: { binding: "lessons", size: 3.4 },
  learning: { binding: "dafYomi", size: 3.4 },
  footer: { binding: "footer", size: 3.4 },
};
type Box = { x: number; y: number; width: number; height: number };

/**
 * The blocks ticked, each a container of its own on a board of parts: a board
 * behind, a frame on it, its heading and its live content - the name on top
 * (with the logos at its side and the clock at the other), the line of the
 * parasha at the foot, and the rest side by side between them, in one row or
 * two. A plain look, to be dressed from there.
 */
export function partsOfBlocks(blocks: readonly BlockId[]): { elements: BoardElement[]; containers: PartContainer[] } {
  const has = (b: BlockId) => blocks.includes(b) && PART_OF[b];
  const places: Array<[BlockId, Box]> = [];
  const top = ["logo", "header", "clock"].some((b) => has(b as BlockId));
  if (has("header")) places.push(["header", { x: 22, y: 2.5, width: 56, height: 11 }]);
  if (has("logo")) places.push(["logo", { x: 3, y: 2.5, width: 17, height: 11 }]);
  if (has("clock")) places.push(["clock", { x: 80, y: 2.5, width: 17, height: 11 }]);
  if (has("footer")) places.push(["footer", { x: 3, y: 87, width: 94, height: 10 }]);
  const middle = (["prayers", "zmanim", "shiurim", "announcements", "learning"] as BlockId[]).filter(has);
  const from = top ? 16 : 3, to = has("footer") ? 84 : 97;
  const rows = middle.length > 3 ? 2 : 1, perRow = Math.ceil(middle.length / rows), gap = 2;
  middle.forEach((b, i) => {
    const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, middle.length - row * perRow);
    const width = (94 - gap * (inRow - 1)) / inRow, height = (to - from - gap * (rows - 1)) / rows;
    // Right to left, as the board reads.
    places.push([b, { x: 97 - (col + 1) * width - col * gap, y: from + row * (height + gap), width, height }]);
  });
  const elements: BoardElement[] = [], containers: PartContainer[] = [];
  for (const [block, at] of places) {
    const { binding, size } = PART_OF[block]!;
    const name = BLOCKS.find((x) => x.id === block)?.name ?? block;
    const group = `c_${elementId().slice(3, 30)}`;
    const headed = !["header", "clock", "logo", "footer"].includes(block);
    const inner = { x: at.x + at.width * 0.06, width: at.width * 0.88 };
    elements.push(
      // The board's own rounded box and double frame: an even line all round, at any width (a shape is chosen later).
      { ...newElement("box"), ...at, group, name: `לוח ${name}`, fill: "#13213d", color: "#c9a227" },
      { ...newElement("frame"), ...at, group, name: `מסגרת ${name}`, color: "#c9a227" },
      ...(headed ? [{ ...newElement("text"), ...inner, y: at.y + at.height * 0.05, height: at.height * 0.14, group, name: `כותרת ${name}`, text: name, fontSize: 4.2, color: "#e6c27a" }] : []),
      {
        ...newElement("text"), ...inner, group, name, text: "", binding, fontSize: size, color: "#f3f5f8",
        y: headed ? at.y + at.height * 0.22 : at.y + at.height * 0.1, height: headed ? at.height * 0.72 : at.height * 0.8,
      },
    );
    containers.push({ id: group, name, parent: null });
  }
  return { elements, containers };
}

export function blankBoard(c: TvConfig, blocks: readonly BlockId[]): TvConfig {
  const chosen = STARTER_BLOCKS.filter((id) => blocks.includes(id));
  const plain = Object.fromEntries(DESIGN_KEYS.map((k) => [k, structuredClone(DEFAULT_TV_CONFIG[k])])) as Partial<TvConfig>;
  // Each screen's own look goes with the board's, or the TV would keep the old one.
  const perDevice = Object.fromEntries(
    Object.entries(c.perDevice).map(([device, overlay]) => [
      device,
      Object.fromEntries(Object.entries(overlay ?? {}).filter(([k]) => !(DESIGN_KEYS as string[]).includes(k))),
    ]),
  ) as TvConfig["perDevice"];
  return {
    ...c,
    ...plain,
    boardFrame: null,
    boardFrameTune: structuredClone(DEFAULT_TV_CONFIG.boardFrameTune),
    titleStyle: "plain",
    perDevice,
    // The occasions are kept as they were read from the old screens, before those screens go.
    occasions: readOccasions(c),
    screens: [{ id: "screen1", name: "מסך 1", seconds: 15, blocks: chosen.map((block) => ({ block })) }],
    // A board is built of parts: each block ticked, a container of its own; one page, the board.
    screenLayout: "composition",
    ...partsOfBlocks(chosen),
    partPages: [],
  };
}

/**
 * The system's basic board again: built of parts - the name, the clock, the
 * prayers, the day's times and the line at the foot, each in a container - with what the shul has collected kept (as blankBoard keeps
 * it) - the wording, the logos, the occasions, the galleries, its own sets.
 */
export function standardBoard(c: TvConfig): TvConfig {
  const plain = Object.fromEntries(DESIGN_KEYS.map((k) => [k, structuredClone(DEFAULT_TV_CONFIG[k])])) as Partial<TvConfig>;
  const perDevice = Object.fromEntries(
    Object.entries(c.perDevice).map(([device, overlay]) => [
      device,
      Object.fromEntries(Object.entries(overlay ?? {}).filter(([k]) => !(DESIGN_KEYS as string[]).includes(k))),
    ]),
  ) as TvConfig["perDevice"];
  const { screens: _screens, ...rest } = c;
  return {
    ...rest,
    ...plain,
    boardFrame: null,
    boardFrameTune: structuredClone(DEFAULT_TV_CONFIG.boardFrameTune),
    titleStyle: "plain",
    perDevice,
    occasions: readOccasions(c),
    slides: structuredClone(DEFAULT_TV_CONFIG.slides),
    // The system's own board is of parts too: what nearly every board shows, each in a container.
    screenLayout: "composition",
    ...partsOfBlocks(STARTER_DEFAULT),
    partPages: [],
  };
}
