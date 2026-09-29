/**
 * Reading a board that was set up before screens existed.
 *
 * Four boards are on walls with configs written in the old vocabulary, one of
 * them a row where almost every field is undefined and the board simply runs
 * on defaults. None of them can be asked to stop while a new model is
 * introduced, and none of their gabbaim should have to re-enter anything.
 *
 * So this is a reading, not a migration. `toScreens` takes an existing config
 * and answers the question the new composer asks - which screens, and what is
 * on each - without writing anything back. The old fields stay exactly as
 * they are and keep driving the board until the new editor saves over them,
 * which means there is no moment where a wall depends on the change having
 * gone right.
 *
 * The rules it encodes are the ones the board already follows, written down
 * in one place for the first time:
 *
 *   - `rotate` and `split` take turns: each enabled slide is a screen.
 *   - `dashboard` and `illustrated` merge: everything enabled is one screen.
 *     This is why an arrow did nothing on the אהבת התורה board - it was
 *     illustrated, so there was one screen and nowhere to move to, while
 *     `slides[]` still listed four things as if there were four.
 *   - the day's screen is a block like any other, which is what makes
 *     "the festival on my single screen" expressible at all.
 */
import { BLOCKS, BLOCK_FOR_SLIDE } from "./blocks";
import type { BlockEntry, BlockId, Screen, TvConfig } from "./config";

export type { BlockEntry, Screen };

/** Blocks that stand on every screen: the bars above and below. */
const CHROME: BlockId[] = BLOCKS.filter((b) => b.chrome).map((b) => b.id);

/**
 * How long a screen holds when nobody has said otherwise.
 *
 * Long enough to read a list of minyanim, short enough that somebody waiting
 * for the other screen does not give up. The gabbai sets his own in the
 * composer; this is only what an unconfigured board falls back to.
 */
const TURN_SECONDS = 40;

/** The layouts that show one thing at a time, rather than all of them at once. */
const ROTATING = new Set(["rotate", "split"]);

function screenName(block: BlockId): string {
  return BLOCKS.find((b) => b.id === block)?.name ?? block;
}

/**
 * The screens this board is showing, however it was set up.
 *
 * The one entry point: the composer edits what this returns and the board
 * draws it, so there is never a moment where the editor believes one thing
 * and the wall another. A board saved in the composer has `screens` and that
 * wins; every board that came before is read from its old fields.
 */
export function readScreens(config: Partial<TvConfig>): Screen[] {
  return config.screens?.length ? config.screens : toScreens(config);
}

/**
 * The screens an existing config describes.
 *
 * Takes a partial config on purpose: one real row has almost nothing in it,
 * and a reader that throws on a half-filled board is no use for reading the
 * boards that exist.
 */
export function toScreens(config: Partial<TvConfig>): Screen[] {
  const layout = config.screenLayout ?? "rotate";
  const slides = config.slides ?? [];
  const enabled = slides.filter((s) => s.enabled);

  // Always on a board: the zmanim have no slide of their own in any layout -
  // they are the panel beside the prayers - so nothing in `slides` mentions
  // them and a reader that only walked that list would lose them silently.
  const extras: BlockEntry[] = [{ block: "zmanim" }];
  if (config.ticker?.enabled) extras.push({ block: "ticker" });

  const chrome = (): BlockEntry[] => CHROME.map((block) => ({ block }));
  // Shabbat is a screen of its own, shown only while it is Shabbat - the same
  // thing the old board did by taking itself over, now written down where
  // the gabbai can see it, change what is on it, or take it away.
  const shabbatScreen: Screen[] =
    config.shabbat?.enabled === false
      ? []
      : [{ id: "shabbat", name: screenName("shabbat"), seconds: TURN_SECONDS, blocks: [{ block: "shabbat" }] }];

  if (!ROTATING.has(layout)) {
    // One screen with everything on it - and the day's screen beside it as a
    // second, rather than over it.
    //
    // The day's screen used to decide for itself when to take the board, and
    // on chol hamoed it took it for the week. Read as two screens it simply
    // takes its turn, which is what a gabbai standing in front of the wall
    // expects: times, then the day, then times.
    const content = enabled
      .map((s) => BLOCK_FOR_SLIDE[s.kind])
      .filter((b): b is BlockId => Boolean(b))
      .map((block) => ({ block }));
    const board: Screen = {
      id: "board",
      name: "הלוח",
      seconds: config.eventSplash ? TURN_SECONDS : 0,
      blocks: [...chrome(), ...extras, ...content],
    };
    if (!config.eventSplash) return [board, ...shabbatScreen];
    return [
      board,
      { id: "festival", name: screenName("festival"), seconds: TURN_SECONDS, blocks: [{ block: "festival" }] },
      ...shabbatScreen,
    ];
  }

  // Taking turns: a screen per enabled slide, in the order they were in.
  const screens: Screen[] = [];
  for (const slide of enabled) {
    const block = BLOCK_FOR_SLIDE[slide.kind];
    if (!block) continue;
    screens.push({
      id: block,
      name: screenName(block),
      seconds: slide.seconds,
      blocks: [...chrome(), ...(block === "prayers" ? extras : [{ block: "zmanim" as BlockId }]), { block }],
    });
  }

  // The day's screen takes its own turn here rather than sharing one.
  if (config.eventSplash)
    screens.push({ id: "festival", name: screenName("festival"), seconds: TURN_SECONDS, blocks: [{ block: "festival" }] });

  // A board with nothing enabled still has to show something.
  if (screens.length === 0)
    screens.push({ id: "board", name: "הלוח", seconds: 0, blocks: [...chrome(), ...extras] });

  return [...screens, ...shabbatScreen];
}

/**
 * Where each block goes, given what is on the screen.
 *
 * The one field: a block with `area` is pinned there and the rest arrange
 * themselves around it. That is the whole of "automatic, unless I say
 * otherwise" - there is no second mode to fall out of step with the first,
 * because pinning and not pinning are the same field present or absent.
 *
 * Returns rows of blocks for the body of the board; the bars are placed by
 * their zone and are not the layout's business.
 */
/** The blocks that have something to show only in their time. */
export const DAY_BLOCKS: readonly BlockId[] = ["festival", "shabbat"];

/**
 * Whether a screen appears only in its time, and which time.
 *
 * A screen with the Shabbat block is a Shabbat screen, whatever else is on
 * it: that is how prayer times get onto the wall on Shabbat. A screen of only
 * the day's screen appears only when there is a day. A screen of ordinary
 * content that also has the day's block is an ordinary screen - on a festival
 * it carries the day's card, and on any other day it is simply itself.
 */
export function dayScreen(screen: Screen): "shabbat" | "festival" | null {
  if (screen.blocks.some((b) => b.block === "shabbat")) return "shabbat";
  const content = screen.blocks.filter((b) => !BLOCKS.find((x) => x.id === b.block)?.chrome);
  return content.length > 0 && content.every((b) => b.block === "festival") ? "festival" : null;
}

export function place(blocks: BlockEntry[]): BlockEntry[][] {
  const main = blocks.filter((e) => BLOCKS.find((b) => b.id === e.block)?.zone === "main");
  const rows: BlockEntry[][] = [];

  for (const wide of main.filter((e) => e.area === "wide")) rows.push([wide]);

  const right = main.filter((e) => e.area === "right");
  const left = main.filter((e) => e.area === "left");
  // The unpinned join whichever side has less on it, so a board never leaves
  // one block stretched across a row while the other side stands empty.
  for (const auto of main.filter((e) => !e.area)) (right.length <= left.length ? right : left).push(auto);

  for (let i = 0; i < Math.max(right.length, left.length); i += 1) {
    const row = [right[i], left[i]].filter(Boolean) as BlockEntry[];
    if (row.length) rows.push(row);
  }
  return rows;
}
