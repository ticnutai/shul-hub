import type { TvConfig } from "./config";
import { DESIGN_KEYS, DESIGN_PARTS, MAX_DESIGNS, applyDesign, captureDesign, findDesign, newDesignId } from "./designs";
import { readOccasions } from "./occasions";

/**
 * An occasion's own design, edited in the board's design tab.
 *
 * An occasion wore a design picked from a list ("עיצוב המועד"), and its look
 * could be changed only by making a design elsewhere and picking it. Now the
 * design tab can work on one occasion: what it shows is the board in that
 * occasion's design, and what is changed there goes into that design - the
 * board's own look is left exactly as it was.
 */

/** The board as the occasion wears it: its design over the board, or the board itself. */
export function occasionLook(config: TvConfig, occasionId: string): TvConfig {
  const occ = readOccasions(config).find((o) => o.id === occasionId);
  const design = findDesign(config, occ?.design);
  return design ? applyDesign(config, design) : config;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * An edit made while working on an occasion: the look it changes is captured
 * into the occasion's own design, the rest (texts, what is hidden...) lands on
 * the board as any edit does.
 *
 * Its own design is changed in place. A ready-made design, or one another
 * occasion wears too, is copied first - so that changing יום כיפור does not
 * change ראש השנה, nor the ready-made design itself.
 */
export function editOccasionDesign(config: TvConfig, occasionId: string, update: (c: TvConfig) => TvConfig): TvConfig {
  const occ = readOccasions(config).find((o) => o.id === occasionId);
  if (!occ) return update(config);
  const before = occasionLook(config, occasionId);
  const after = update(before);
  const board = { ...after } as TvConfig;
  for (const k of DESIGN_KEYS) (board as unknown as Record<string, unknown>)[k] = config[k];
  if (DESIGN_KEYS.every((k) => same(after[k], before[k]))) return board;

  const own = config.designs.find((d) => d.id === occ.design);
  const shared = own && readOccasions(config).some((o) => o.id !== occasionId && o.design === own.id);
  const id = own && !shared ? own.id : newDesignId();
  const design = captureDesign(after, own && !shared ? own.name : `עיצוב ${occ.name}`, [...DESIGN_PARTS], id);
  const designs = board.designs.some((d) => d.id === id)
    ? board.designs.map((d) => (d.id === id ? design : d))
    : [...board.designs, design].slice(-MAX_DESIGNS);
  // Worn on its own screen unless it was already set to dress the whole board.
  const occasions = readOccasions(board).map((o) =>
    o.id === occasionId ? { ...o, design: id, designOn: o.design ? o.designOn : ("screen" as const) } : o,
  );
  return { ...board, designs, occasions };
}
