import type { SavedDesign } from './designs';
import type { PartContainer } from './containers';
import { newElement, type BoardElement, type ElementBinding } from './elements';
import { EMERALD_COMPOSITION } from './emeraldComposition';
import type { PartShape } from './partShapes';
import { ZMAN_DISPLAY_KEYS } from '@/community/lib/zmanim';

/**
 * Kits painted as a room - a wood-panelled wall, a library under a round
 * window, a hall of Jerusalem stone, three wooden arches - each picture the
 * main background, and in every empty panel of it a container ready made: its
 * board (a tint over the painted panel, so the words read), its frame in the
 * panel's own shape, its heading and its live content. The containers are
 * real (containers.ts): chosen, moved, resized, re-dressed and emptied like
 * any other; the picture stays whole behind them. Rectangles are percents of
 * the 1672 x 941 pictures, traced on the panels.
 */
type Rect = readonly [number, number, number, number];
interface Panel {
  key: string;
  name: string;
  rect: Rect;
  binding: ElementBinding;
  shape?: PartShape;
  rows?: number;
  /** The words' size; the heading is a little larger. */
  size?: number;
  /** No heading: the panel is small, its content says what it is. */
  bare?: boolean;
}
interface Free {
  key: string;
  name: string;
  rect: Rect;
  binding: ElementBinding;
  size: number;
  accent?: boolean;
}
interface Room {
  id: string;
  name: string;
  picture: string;
  theme: string;
  /** The words, and the headings and ornaments. */
  ink: string;
  accent: string;
  /** The board of each container: a see-through tint over the painted panel. */
  board: string;
  panels: Panel[];
  free: Free[];
}

const ROOMS: Room[] = [
  {
    id: 'woodwall', name: 'קיר עץ וספרייה', picture: '/new-shul-assets/room-wood-wall.webp', theme: 'stone',
    ink: '#fff3dc', accent: '#f0c77a', board: '#1a0d0699',
    panels: [
      { key: 'prayers', name: 'זמני תפילות', rect: [62, 23, 24.5, 50], binding: 'prayers', shape: 'rounded', rows: 7 },
      { key: 'lessons', name: 'שיעורי תורה', rect: [13.5, 23, 24.5, 50], binding: 'lessons', shape: 'rounded', rows: 4 },
      { key: 'zmanim', name: 'זמני היום', rect: [40, 36, 20, 37], binding: 'zmanim', shape: 'rounded', rows: 10, size: 1.7 },
    ],
    free: [
      { key: 'title', name: 'שם בית הכנסת', rect: [25, 8.5, 50, 7], binding: 'title', size: 4.4, accent: true },
      { key: 'date', name: 'תאריך עברי', rect: [32, 15.5, 36, 4], binding: 'date', size: 2.2 },
      { key: 'clock', name: 'שעון חי', rect: [42, 22, 16, 11], binding: 'clock', size: 7.5, accent: true },
      { key: 'footer', name: 'פרשה ולימוד יומי', rect: [14, 74.5, 72, 4.5], binding: 'footer', size: 1.8 },
    ],
  },
  {
    id: 'librarywindow', name: 'ספרייה וחלון ירושלים', picture: '/new-shul-assets/room-library-window.webp', theme: 'navy',
    ink: '#f4ecdc', accent: '#e8c27a', board: '#0b1428cc',
    panels: [
      // The dark board under the window, as it is painted.
      { key: 'prayers', name: 'זמני תפילות', rect: [37.2, 33.4, 25.8, 24.6], binding: 'prayers', shape: 'rectangle', rows: 5 },
      // Glass over the shelves on either side.
      { key: 'lessons', name: 'שיעורי תורה', rect: [3, 9, 17.5, 55], binding: 'lessons', shape: 'rounded', rows: 4 },
      { key: 'zmanim', name: 'זמני היום', rect: [79.5, 9, 17.5, 55], binding: 'zmanim', shape: 'rounded', rows: 12, size: 1.6 },
      // The wooden panel under the board.
      { key: 'parasha', name: 'פרשת השבוע', rect: [37.2, 59.3, 25.8, 9], binding: 'parasha', shape: 'rectangle', bare: true, size: 2.4 },
    ],
    free: [
      { key: 'title', name: 'שם בית הכנסת', rect: [36, 1.5, 28, 6], binding: 'title', size: 3.6, accent: true },
      { key: 'clock', name: 'שעון חי', rect: [43, 8.5, 14, 9], binding: 'clock', size: 6.5 },
      { key: 'date', name: 'תאריך עברי', rect: [38, 18.5, 24, 4], binding: 'date', size: 2 },
      { key: 'footer', name: 'פרשה ולימוד יומי', rect: [12, 89, 76, 5], binding: 'footer', size: 1.9 },
    ],
  },
  {
    id: 'jerusalemstone', name: 'היכל אבן ירושלמית', picture: '/new-shul-assets/room-jerusalem-stone.webp', theme: 'stone',
    ink: '#3b2614', accent: '#8a5a24', board: '#fff8ebd9',
    panels: [
      // The great arch in the middle, lit from within.
      { key: 'prayers', name: 'זמני תפילות', rect: [42.2, 27, 15.6, 38], binding: 'prayers', shape: 'arch', rows: 6, size: 2.2 },
      // The stone between the carved columns, on either side.
      { key: 'lessons', name: 'שיעורי תורה', rect: [19.8, 28, 11.6, 37], binding: 'lessons', shape: 'arch', rows: 3, size: 1.9 },
      { key: 'zmanim', name: 'זמני היום', rect: [68.6, 28, 11.6, 37], binding: 'zmanim', shape: 'arch', rows: 9, size: 1.5 },
      // On the floor, before the arch.
      { key: 'notices', name: 'הודעות', rect: [30, 72, 40, 10], binding: 'announcements', shape: 'pill', bare: true, size: 2 },
      // The name on a plaque of its own: on the carved stone it would not read.
      { key: 'title', name: 'שם בית הכנסת', rect: [32, 1.2, 36, 7], binding: 'title', shape: 'pill', bare: true, size: 3.2 },
    ],
    free: [
      { key: 'clock', name: 'שעון חי', rect: [44, 15.5, 12, 8.5], binding: 'clock', size: 6 },
      { key: 'date', name: 'תאריך עברי', rect: [40, 23.8, 20, 3], binding: 'date', size: 1.7 },
      { key: 'footer', name: 'פרשה ולימוד יומי', rect: [12, 89, 76, 5], binding: 'footer', size: 1.9 },
    ],
  },
  {
    id: 'woodarches', name: 'שלוש קשתות עץ', picture: '/new-shul-assets/room-wood-arches.webp', theme: 'stone',
    ink: '#fff3dc', accent: '#f0c77a', board: '#1a0d0680',
    panels: [
      { key: 'prayers', name: 'זמני תפילות', rect: [69.6, 15.5, 17, 43.5], binding: 'prayers', shape: 'arch', rows: 6, size: 2.2 },
      { key: 'zmanim', name: 'זמני היום', rect: [37.4, 27.5, 25.2, 31.5], binding: 'zmanim', shape: 'rounded', rows: 8, size: 1.6 },
      { key: 'lessons', name: 'שיעורי תורה', rect: [13.4, 15.5, 17, 43.5], binding: 'lessons', shape: 'arch', rows: 3, size: 2 },
      // The three wooden panels under the arches.
      { key: 'parasha', name: 'פרשת השבוע', rect: [69.2, 64, 17.8, 9.5], binding: 'parasha', shape: 'rectangle', bare: true, size: 2.2 },
      { key: 'notices', name: 'הודעות', rect: [36.8, 64, 26.4, 9.5], binding: 'announcements', shape: 'rectangle', bare: true, size: 1.9 },
      { key: 'daf', name: 'דף יומי', rect: [13, 64, 17.8, 9.5], binding: 'dafYomi', shape: 'rectangle', bare: true, size: 2 },
      // The name on a plaque over the carved frieze.
      { key: 'title', name: 'שם בית הכנסת', rect: [34, 3.2, 32, 7], binding: 'title', shape: 'pill', bare: true, size: 3 },
    ],
    free: [
      { key: 'clock', name: 'שעון חי', rect: [43, 16, 14, 10], binding: 'clock', size: 7, accent: true },
      { key: 'date', name: 'תאריך עברי', rect: [36, 80, 28, 4], binding: 'date', size: 2 },
    ],
  },
  {
    id: 'walnutmedallion', name: 'היכל אגוז ומדליון', picture: '/new-shul-assets/room-walnut-medallion.webp', theme: 'stone',
    ink: '#3a2412', accent: '#8a5a1c', board: '#fffaf0b3',
    panels: [
      { key: 'prayers', name: 'זמני תפילות', rect: [71.8, 20, 20.6, 60.5], binding: 'prayers', shape: 'arch', rows: 7, size: 2.3 },
      { key: 'zmanim', name: 'זמני היום', rect: [7.8, 20, 20.6, 60.5], binding: 'zmanim', shape: 'arch', rows: 11, size: 1.6 },
      // The middle arch, above the candles and the book on the shelf.
      { key: 'lessons', name: 'שיעורי תורה', rect: [36, 39, 28, 23], binding: 'lessons', shape: 'rounded', rows: 3, size: 1.9 },
      // The wooden plaque under the medallion.
      { key: 'parasha', name: 'פרשת השבוע', rect: [44.2, 31, 12.6, 6.5], binding: 'parasha', shape: 'pill', bare: true, size: 1.6 },
      // The dark wooden base: the words on light plaques, or they would not be seen.
      { key: 'footer', name: 'פרשה ולימוד יומי', rect: [12, 89, 56, 6], binding: 'footer', shape: 'pill', bare: true, size: 1.6 },
      { key: 'date', name: 'תאריך עברי', rect: [70, 89, 18, 6], binding: 'date', shape: 'pill', bare: true, size: 1.6 },
    ],
    free: [
      { key: 'title', name: 'שם בית הכנסת', rect: [36, 1.5, 28, 6], binding: 'title', size: 3.2, accent: true },
      { key: 'clock', name: 'שעון חי', rect: [45, 13, 10, 15], binding: 'clock', size: 4.6, accent: true },
    ],
  },
  {
    id: 'olivemosaic', name: 'שיש ופסיפס זית', picture: '/new-shul-assets/room-olive-mosaic.webp', theme: 'stone',
    ink: '#33301c', accent: '#7d6418', board: '#fffbf2c7',
    panels: [
      { key: 'prayers', name: 'זמני תפילות', rect: [71, 31, 17.4, 48], binding: 'prayers', shape: 'rounded', rows: 7, size: 2.1 },
      { key: 'zmanim', name: 'זמני היום', rect: [11.8, 31, 17.4, 48], binding: 'zmanim', shape: 'rounded', rows: 11, size: 1.5 },
      { key: 'notices', name: 'הודעות', rect: [33.5, 35, 33, 19], binding: 'announcements', shape: 'rounded', rows: 3, size: 1.8 },
      // The name on the long plaque under the medallion.
      { key: 'title', name: 'שם בית הכנסת', rect: [32.5, 21.5, 35, 8], binding: 'title', shape: 'pill', bare: true, size: 3 },
    ],
    free: [
      { key: 'clock', name: 'שעון חי', rect: [45, 4, 10, 14], binding: 'clock', size: 4.4, accent: true },
      { key: 'date', name: 'תאריך עברי', rect: [36, 55, 28, 3.5], binding: 'date', size: 1.6, accent: true },
      { key: 'footer', name: 'פרשה ולימוד יומי', rect: [14, 93.5, 72, 4.5], binding: 'footer', size: 1.6 },
    ],
  },
  {
    id: 'blackmarble', name: 'שיש שחור וזהב', picture: '/new-shul-assets/room-black-marble.webp', theme: 'navy',
    ink: '#f6e8c6', accent: '#e4ba5c', board: '#0b090799',
    panels: [
      { key: 'prayers', name: 'זמני תפילות', rect: [71.4, 31.5, 17, 47.5], binding: 'prayers', shape: 'rounded', rows: 7, size: 2.1 },
      { key: 'zmanim', name: 'זמני היום', rect: [11.8, 31.5, 17, 47.5], binding: 'zmanim', shape: 'rounded', rows: 11, size: 1.5 },
      { key: 'lessons', name: 'שיעורי תורה', rect: [33.5, 35, 33, 19], binding: 'lessons', shape: 'rounded', rows: 3, size: 1.8 },
      { key: 'title', name: 'שם בית הכנסת', rect: [32.5, 21, 35, 9], binding: 'title', shape: 'pill', bare: true, size: 3 },
      // The marble band at the foot.
      { key: 'notices', name: 'הודעות', rect: [20, 88.5, 60, 6], binding: 'announcements', shape: 'rectangle', bare: true, size: 1.7 },
    ],
    free: [
      { key: 'clock', name: 'שעון חי', rect: [45, 4, 10, 14], binding: 'clock', size: 4.4, accent: true },
      { key: 'date', name: 'תאריך עברי', rect: [36, 55, 28, 3.5], binding: 'date', size: 1.6, accent: true },
    ],
  },
  {
    id: 'stonelight', name: 'אבן ואור יום', picture: '/new-shul-assets/room-stone-light.webp', theme: 'stone',
    ink: '#3a2b1a', accent: '#8a5a24', board: '#fffaf2d4',
    panels: [
      { key: 'prayers', name: 'זמני תפילות', rect: [61, 15, 30, 57], binding: 'prayers', shape: 'rounded', rows: 8, size: 2.4 },
      { key: 'zmanim', name: 'זמני היום', rect: [37, 15, 22, 57], binding: 'zmanim', shape: 'rounded', rows: 12, size: 1.6 },
      { key: 'lessons', name: 'שיעורי תורה', rect: [11, 15, 24, 27.5], binding: 'lessons', shape: 'rounded', rows: 3, size: 1.8 },
      { key: 'notices', name: 'הודעות', rect: [11, 44.5, 24, 27.5], binding: 'announcements', shape: 'rounded', rows: 3, size: 1.7 },
    ],
    free: [
      { key: 'title', name: 'שם בית הכנסת', rect: [25, 2.5, 50, 7], binding: 'title', size: 4, accent: true },
      { key: 'date', name: 'תאריך עברי', rect: [32, 9.3, 36, 4], binding: 'date', size: 1.9 },
      { key: 'clock', name: 'שעון חי', rect: [78, 2.5, 13, 10], binding: 'clock', size: 5.5, accent: true },
      { key: 'footer', name: 'פרשה ולימוד יומי', rect: [12, 80, 76, 5], binding: 'footer', size: 1.9 },
    ],
  },
  {
    id: 'walnutwall', name: 'קיר אגוז וארונות ספרים', picture: '/new-shul-assets/room-walnut-wall.webp', theme: 'stone',
    ink: '#fff3dc', accent: '#f0c77a', board: '#1a0d0680',
    panels: [
      { key: 'prayers', name: 'זמני תפילות', rect: [63, 22, 23.5, 52], binding: 'prayers', shape: 'rounded', rows: 7, size: 2.3 },
      { key: 'zmanim', name: 'זמני היום', rect: [39, 22, 22, 52], binding: 'zmanim', shape: 'rounded', rows: 11, size: 1.6 },
      { key: 'lessons', name: 'שיעורי תורה', rect: [13.5, 22, 23.5, 25], binding: 'lessons', shape: 'rounded', rows: 3, size: 1.8 },
      { key: 'notices', name: 'הודעות', rect: [13.5, 49, 23.5, 25], binding: 'announcements', shape: 'rounded', rows: 3, size: 1.7 },
    ],
    free: [
      { key: 'title', name: 'שם בית הכנסת', rect: [28, 9, 44, 7], binding: 'title', size: 4, accent: true },
      { key: 'date', name: 'תאריך עברי', rect: [36, 16, 28, 4], binding: 'date', size: 1.9 },
      { key: 'clock', name: 'שעון חי', rect: [14, 9, 13, 10], binding: 'clock', size: 5.5, accent: true },
      { key: 'footer', name: 'פרשה ולימוד יומי', rect: [12, 85, 76, 5], binding: 'footer', size: 1.9 },
    ],
  },
];

function make(r: Room): SavedDesign {
  const elements: BoardElement[] = [];
  const containers: PartContainer[] = [];
  const el = (key: string, kind: BoardElement['kind'], name: string, rect: Rect, extra: Partial<BoardElement> = {}) => {
    const [x, y, width, height] = rect;
    elements.push({ ...newElement(kind), id: `room_${r.id}_${key}`, name, x, y, width, height, color: r.ink, fill: 'transparent', ...extra });
  };
  // The picture, whole: the main background, painted (containerParts' isBackdrop).
  el('picture', 'image', `רקע המקור - ${r.name}`, [0, 0, 100, 100], { image: r.picture, fit: 'cover' });
  for (const p of r.panels) {
    const group = `c_room_${r.id}_${p.key}`;
    const [x, y, w, h] = p.rect;
    const size = p.size ?? 2.4;
    containers.push({ id: group, name: p.name, parent: null, ...(p.shape ? { shape: p.shape } : {}) });
    el(`${p.key}_fill`, 'box', `מילוי ${p.name}`, p.rect, { group, fill: r.board, color: 'transparent', ...(p.shape ? { shape: p.shape } : {}) });
    el(`${p.key}_frame`, 'frame', `מסגרת ${p.name}`, p.rect, { group, color: r.accent, ...(p.shape ? { shape: p.shape } : {}) });
    // An arch's top is its curve: the words begin under it.
    const top = p.shape === 'arch' ? h * 0.2 : 0;
    if (!p.bare) el(`${p.key}_heading`, 'text', `כותרת ${p.name}`, [x + 1.5, y + top + 1.5, w - 3, 4.5], { group, text: p.name, color: r.accent, fontSize: size + 0.8 });
    const head = p.bare ? 1 : top + 6.5;
    el(`${p.key}_content`, 'text', `תוכן ${p.name}`, [x + 1.8, y + head, w - 3.6, h - head - 1.5], {
      group, binding: p.binding, text: '', fontSize: size,
      ...(p.rows ? { rowsPerPage: p.rows } : {}),
      ...(p.binding === 'zmanim' ? { zmanKeys: [...ZMAN_DISPLAY_KEYS] } : {}),
    });
  }
  for (const f of r.free) el(f.key, 'text', f.name, f.rect, { binding: f.binding, text: '', fontSize: f.size, color: f.accent ? r.accent : r.ink });
  return {
    id: `d_room_${r.id}`, name: r.name, theme: r.theme, parts: ['background', 'frames', 'text', 'layout'],
    colours: { '--tv-text': r.ink, '--tv-accent': r.accent },
    values: { ...structuredClone(EMERALD_COMPOSITION.values), elements, containers, font: 'traditional', backgroundImage: null, backgroundGradient: null },
  };
}

export const ROOM_DESIGNS: SavedDesign[] = ROOMS.map(make);
