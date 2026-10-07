/**
 * The symbol at the top of an arch, when the drawing has one that speaks.
 *
 * Most kits draw a neutral flourish there, right over anything. The wooden
 * heritage kit draws an open book over the prayers and a Torah scroll over
 * the shiurim - and an arch that now shows the notices keeps its book, since
 * it is part of the picture. So the picture is laid over with a piece of
 * itself: the other arch's symbol, or the plain parchment just below the
 * symbol, which hides it. Measured on the drawing (1672 x 941), in percent.
 */
import { elementId, newElement, sectionOf, type BoardElement } from './elements';

type Rect = { x: number; y: number; width: number; height: number };
interface ArtSymbols {
  /** Where the symbol stands in an arch, from the arch's top-left corner. */
  slot: { dx: number; dy: number; width: number; height: number };
  /** Which arches have it: the drawing's tall frames. */
  arch: (crop: Rect) => boolean;
  choices: { id: string; label: string; crop: Rect }[];
}

const HERITAGE = '/new-shul-assets/heritage-wood.webp';
export const ART_SYMBOLS: Record<string, ArtSymbols> = {
  [HERITAGE]: {
    slot: { dx: 5.5, dy: 13.3, width: 12, height: 10.5 },
    arch: (c) => c.height > 60 && c.width > 18 && c.width < 28,
    choices: [
      { id: 'none', label: 'בלי סמל', crop: { x: 12.1, y: 35.9, width: 12, height: 8 } },
      { id: 'book', label: 'ספר פתוח', crop: { x: 12.1, y: 25.3, width: 12, height: 10.5 } },
      { id: 'scroll', label: 'ספר תורה', crop: { x: 76.5, y: 25.3, width: 12, height: 10.5 } },
    ],
  },
};

/** The arch a piece of content stands in, when that arch has a symbol to choose. */
function archOf(all: BoardElement[], id: string) {
  const ids = sectionOf(all, id);
  const arch = all.find(e => ids.includes(e.id) && e.kind === 'image' && e.crop && !e.symbol && ART_SYMBOLS[e.image]?.arch(e.crop));
  return arch ? { arch, ids, art: ART_SYMBOLS[arch.image] } : null;
}

/** The choices for the symbol over this content's arch (none: it has no such arch). */
export function symbolChoices(all: BoardElement[], id: string) {
  const found = archOf(all, id);
  if (!found) return null;
  const over = all.find(e => found.ids.includes(e.id) && e.symbol);
  return { choices: found.art.choices, current: over?.symbol ?? '' };
}

/**
 * The symbol over this content's arch: one of the choices, or '' for the
 * drawing's own. Laid just above the arch, so it moves, hides and is copied
 * with it.
 */
export function setSymbol(all: BoardElement[], id: string, symbol: string): BoardElement[] {
  const found = archOf(all, id);
  if (!found) return all;
  const { arch, ids, art } = found;
  const rest = all.filter(e => !(ids.includes(e.id) && e.symbol));
  const choice = art.choices.find(c => c.id === symbol);
  if (!choice) return rest;
  const over: BoardElement = {
    ...newElement('image'), id: elementId(), name: `סמל המסגרת: ${choice.label}`, image: arch.image, crop: choice.crop, symbol: choice.id,
    x: arch.x + art.slot.dx, y: arch.y + art.slot.dy, width: art.slot.width, height: art.slot.height, group: arch.group,
  };
  const at = rest.indexOf(arch) + 1;
  return [...rest.slice(0, at), over, ...rest.slice(at)];
}
