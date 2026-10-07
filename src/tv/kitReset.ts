/**
 * "איפוס הכול": a board of parts back to the kit it was made from.
 *
 * A board does not record which kit it came from, but its parts do: every
 * part of a kit carries the kit's own id (premium_heritage-wood_art_3), and
 * the gabbai's changes keep them - a part moved, hidden or showing other
 * content is still that part. So the kit is the one most of the board's
 * parts belong to. Parts added since have ids of their own and count for
 * nothing; a board none of whose parts is a kit's has nothing to go back to.
 */
import type { TvConfig } from './config';
import { BUILTIN_DESIGNS, applyDesign, type SavedDesign } from './designs';

export function kitOf(config: TvConfig): SavedDesign | null {
  const ids = new Set(config.elements.map(e => e.id));
  if (!ids.size) return null;
  let best: { design: SavedDesign; score: number } | null = null;
  // One's own kits first: one saved from this board matches it as well as the kit it was made from, and is the one meant.
  for (const design of [...(config.designs ?? []), ...BUILTIN_DESIGNS]) {
    const own = design.values.elements ?? [];
    if (!own.length) continue;
    const score = own.filter(e => ids.has(e.id)).length / own.length;
    if (score > 0 && (!best || score > best.score)) best = { design, score };
  }
  return best?.design ?? null;
}

/** The board as the kit made it: its parts, where and as they were, and its look. */
export const resetToKit = (config: TvConfig, kit: SavedDesign): TvConfig => applyDesign(config, kit);
