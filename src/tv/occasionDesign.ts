import type { TvConfig } from "./config";
import { DESIGN_KEYS, DESIGN_PARTS, MAX_DESIGNS, applyDesign, captureDesign, findDesign, newDesignId, type SavedDesign } from "./designs";
import { readOccasions, type Occasion } from "./occasions";

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
  const captured = captureDesign(after, own && !shared ? own.name : `עיצוב ${occ.name}`, [...DESIGN_PARTS], id);
  // A copy made here is the occasion's own (kept out of "הערכות שלי"); a kit of
  // the gabbai's, changed in place, stays his.
  const owner = own && !shared ? own.occasion : occasionId;
  const kept = own && !shared && own.from ? { from: own.from } : {};
  const design = owner ? { ...captured, occasion: owner, ...kept } : { ...captured, ...kept };
  const designs = board.designs.some((d) => d.id === id)
    ? board.designs.map((d) => (d.id === id ? design : d))
    : [...board.designs, design].slice(-MAX_DESIGNS);
  // Worn on its own screen unless it was already set to dress the whole board.
  const occasions = readOccasions(board).map((o) =>
    o.id === occasionId ? { ...o, design: id, designOn: o.design ? o.designOn : ("screen" as const) } : o,
  );
  return { ...board, designs, occasions };
}

/**
 * A kit that belongs to an occasion: made for it here, or - saved before
 * kits were marked - one an occasion wears under the name this file gives
 * ("עיצוב …"). It is edited through the occasion's page, not offered among
 * the gabbai's own kits.
 */
export function isOccasionKit(config: TvConfig, d: SavedDesign): boolean {
  if (d.occasion) return true;
  return d.name.startsWith("עיצוב ") && readOccasions(config).some((o) => o.design === d.id);
}

/**
 * A kit made an occasion's own ("קבע לשבת ופתח" in the kits' library): put on
 * through the occasion's page, as a kit chosen there would be - a copy of the
 * occasion's, the board and the kit left as they were - and marked with the
 * kit it came from, so that kit's tile can say so.
 */
export function wearForOccasion(config: TvConfig, occasionId: string, kit: SavedDesign): TvConfig {
  const occ = readOccasions(config).find((o) => o.id === occasionId);
  if (!occ) return config;
  // Always a kit of the occasion's own - even when it is the kit the board wears every day, where
  // an edit "changing nothing" made none, and the occasion kept its card (אושר של יהודי, 18.10.2026).
  const captured = captureDesign(applyDesign(occasionLook(config, occasionId), kit), kit.name.slice(0, 40), [...DESIGN_PARTS], newDesignId());
  const own = config.designs.find((d) => d.id === occ.design && d.occasion === occasionId);
  const shared = own && readOccasions(config).some((o) => o.id !== occasionId && o.design === own.id);
  const id = own && !shared ? own.id : captured.id;
  const design: SavedDesign = { ...captured, id, occasion: occasionId, from: kit.id };
  const designs = config.designs.some((d) => d.id === id)
    ? config.designs.map((d) => (d.id === id ? design : d))
    : [...config.designs, design].slice(-MAX_DESIGNS);
  const occasions = readOccasions(config).map((o) =>
    o.id === occasionId ? { ...o, design: id, designOn: o.design ? o.designOn : ("screen" as const) } : o,
  );
  return { ...config, designs, occasions };
}

/** The occasions whose own kit was made from this kit. */
export function wornBy(config: TvConfig, kitId: string): Occasion[] {
  const own = new Set(config.designs.filter((d) => d.from === kitId).map((d) => d.id));
  return readOccasions(config).filter((o) => o.design && own.has(o.design));
}
