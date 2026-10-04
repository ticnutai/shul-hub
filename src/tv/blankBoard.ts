import { BLOCKS } from "./blocks";
import { DEFAULT_TV_CONFIG, type BlockId, type TvConfig } from "./config";
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
  };
}

/**
 * The system's ordinary board again: its look and its screens as every new
 * board starts, with what the shul has collected kept (as blankBoard keeps
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
  };
}
