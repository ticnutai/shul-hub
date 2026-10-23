import { describe, expect, it } from 'vitest';
import { ROOM_DESIGNS } from './roomDesigns';
import { BUILTIN_DESIGNS, applyDesign } from './designs';
import { DEFAULT_TV_CONFIG } from './config';
import { containerTree } from './containers';
import { roleOf, isBackdrop } from './containerParts';
import { normalizeElements, unreadableParts, type BoardElement } from './elements';

describe('the painted rooms, their panels containers ready made', () => {
  it('are among the kits, first', () => {
    expect(BUILTIN_DESIGNS.slice(0, ROOM_DESIGNS.length).map(d => d.id)).toEqual(ROOM_DESIGNS.map(d => d.id));
  });
  for (const kit of ROOM_DESIGNS) {
    it(`${kit.name}: the picture behind, each container with its board, frame and live content`, () => {
      const board = applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit);
      const els = board.elements as BoardElement[];
      // Kept as written: nothing of them dropped by the board's own check.
      expect(normalizeElements(els)).toHaveLength(els.length);
      expect(els.filter(isBackdrop)).toHaveLength(1);
      const tree = containerTree(els, board.containers);
      const records = board.containers.map(c => c.id);
      expect(records.length).toBeGreaterThanOrEqual(3);
      for (const id of records) {
        const node = tree.containers.find(c => c.id === id)!;
        const own = node.parts.map(p => els.find(e => e.id === p)!);
        expect(own.filter(e => roleOf(e) === 'board'), id).toHaveLength(1);
        expect(own.filter(e => roleOf(e) === 'frame'), id).toHaveLength(1);
        expect(own.some(e => e.kind === 'text' && e.binding), id).toBe(true);
        // Inside the board, and the board on the picture.
        for (const e of own) {
          expect(e.x).toBeGreaterThanOrEqual(0);
          expect(e.x + e.width).toBeLessThanOrEqual(100);
          expect(e.y + e.height).toBeLessThanOrEqual(100);
        }
      }
      expect(unreadableParts(els)).toEqual([]);
    });
  }
});
