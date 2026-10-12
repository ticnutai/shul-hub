import type { BoardElement } from './elements';

/**
 * Which part a press on the board means.
 *
 * Parts stand one over another: a moon picture on a box, the box in a frame.
 * A press takes the topmost; a second press at the same place takes the one
 * under it, and so on round; a press twice in quick succession takes the part
 * alone, without the section it moves with. The board (BoardElements) asks
 * here, so the rules are tested without a pointer.
 */

/** A place on the board, in percent of its width and height - the units the parts stand in. */
export interface BoardPoint { x: number; y: number }

/** A press: where on the board (in pixels from its corner), when, and the part it chose. */
export interface Press { x: number; y: number; at: number; id: string }

/** Two presses within this many milliseconds are a double click. */
export const DOUBLE_MS = 450;
/** A second press within this many milliseconds, at the same place, takes the part under. */
export const AGAIN_MS = 1500;
/** "The same place": a hand moves a little between two presses. */
export const SAME_PLACE_PX = 6;

/**
 * Every part whose box holds the point, the topmost first: the board draws
 * them in order, so the last one stands over the others. A hidden part is not
 * there to press. The box is enough - a turned part is taken as it stood.
 */
export function partsAt(all: readonly BoardElement[], p: BoardPoint): string[] {
  const out: string[] = [];
  for (let i = all.length - 1; i >= 0; i -= 1) {
    const e = all[i];
    if (e.hidden) continue;
    if (p.x >= e.x && p.x <= e.x + e.width && p.y >= e.y && p.y <= e.y + e.height) out.push(e.id);
  }
  return out;
}

/** The part under `current` in that pile, and after the lowest - the top again. */
export function partBelow(pile: readonly string[], current: string | null | undefined): string | null {
  if (!pile.length) return null;
  const at = current ? pile.indexOf(current) : -1;
  return pile[(at + 1) % pile.length];
}

/**
 * What this press is, after the one before it: a double click (quick, at the
 * same place), a press again at the same place (to go one part down), or a
 * press of its own.
 */
export function pressKind(before: Press | null, now: { x: number; y: number; at: number }): 'double' | 'again' | 'new' {
  if (!before) return 'new';
  const gap = now.at - before.at;
  if (gap < 0 || Math.hypot(now.x - before.x, now.y - before.y) > SAME_PLACE_PX) return 'new';
  if (gap < DOUBLE_MS) return 'double';
  if (gap < AGAIN_MS) return 'again';
  return 'new';
}

/**
 * The selection a plain press leaves: with Shift, the part (and its section)
 * added to what was chosen; on a part already chosen, the same choice, so
 * dragging moves all of it; otherwise the part with its section. The part
 * pressed is always first - the panel of the chosen part shows the first.
 */
export function pressSelection(clicked: string, family: readonly string[], selected: readonly string[], shift: boolean): string[] {
  const own = [clicked, ...family.filter(id => id !== clicked)];
  if (shift) return [...new Set([...selected, ...own])];
  if (selected.includes(clicked)) return [clicked, ...selected.filter(id => id !== clicked)];
  return own;
}
