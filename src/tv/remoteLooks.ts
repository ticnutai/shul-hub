import type { TvConfig } from "./config";
import { applyDesign, BUILTIN_DESIGNS, findDesign, REMOTE_BUILTIN_IDS } from "./designs";
import { isHiddenReady } from "./readyItems";

/**
 * The looks a screen can be switched to from its remote (and from the admin's
 * "connected screens" tab): the board as the gabbai designed it, and every set
 * - the ready ones not hidden, and the shul's own. A set is worn for its look
 * only - background, boxes, frames, text - and never rearranges what is on
 * the screen: a remote on a wall is no place to move the times around.
 */

export interface RemoteLook {
  /** null: the board as designed. */
  id: string | null;
  name: string;
  /** The board wearing it, for its thumbnail. */
  config: TvConfig;
}

/** The board wearing a set's look (not its arrangement); unknown or gone: the board as it is. */
export function applyLook(c: TvConfig, id: string | null | undefined): TvConfig {
  const d = findDesign(c, id);
  if (!d) return c;
  const parts = d.parts.filter((p) => p !== "layout");
  return parts.length ? applyDesign(c, { ...d, parts }) : c;
}

export function remoteLooks(c: TvConfig): RemoteLook[] {
  // The remote keeps the sets it always had: the classic ones and the shul's own (a new design is saved as one's own to be here).
  const sets = [...BUILTIN_DESIGNS.filter((d) => REMOTE_BUILTIN_IDS.has(d.id) && !isHiddenReady(c, "design", d.id)), ...c.designs];
  return [
    { id: null, name: "העיצוב של הלוח", config: c },
    ...sets.filter((d) => d.parts.some((p) => p !== "layout")).map((d) => ({ id: d.id, name: d.name, config: applyLook(c, d.id) })),
  ];
}
