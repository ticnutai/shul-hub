import { describe, expect, it } from 'vitest';
import { newElement, type BoardElement } from './elements';
import { AGAIN_MS, DOUBLE_MS, partBelow, partsAt, pressKind, pressSelection } from './elementHits';

const part = (id: string, x: number, y: number, width: number, height: number, more: Partial<BoardElement> = {}): BoardElement =>
  ({ ...newElement('box'), id, name: id, x, y, width, height, ...more });

// A frame, a box in it, a small moon over the box - drawn in that order.
const frame = part('frame', 20, 20, 40, 50, { kind: 'frame' });
const box = part('box', 25, 25, 30, 40);
const moon = part('moon', 35, 35, 10, 15, { kind: 'image' });
const board = [frame, box, moon];

describe('partsAt', () => {
  it('lists the parts under the point, the topmost first', () => {
    expect(partsAt(board, { x: 40, y: 40 })).toEqual(['moon', 'box', 'frame']);
    expect(partsAt(board, { x: 27, y: 30 })).toEqual(['box', 'frame']);
    expect(partsAt(board, { x: 21, y: 21 })).toEqual(['frame']);
    expect(partsAt(board, { x: 90, y: 90 })).toEqual([]);
  });
  it('skips a hidden part', () => {
    expect(partsAt([frame, box, { ...moon, hidden: true }], { x: 40, y: 40 })).toEqual(['box', 'frame']);
  });
  it('takes the edges of a box as inside', () => {
    expect(partsAt([moon], { x: 35, y: 50 })).toEqual(['moon']);
  });
});

describe('partBelow', () => {
  const pile = ['moon', 'box', 'frame'];
  it('goes one down, and from the lowest back to the top', () => {
    expect(partBelow(pile, 'moon')).toBe('box');
    expect(partBelow(pile, 'box')).toBe('frame');
    expect(partBelow(pile, 'frame')).toBe('moon');
  });
  it('starts at the top when nothing there was chosen', () => {
    expect(partBelow(pile, 'elsewhere')).toBe('moon');
    expect(partBelow(pile, null)).toBe('moon');
    expect(partBelow([], 'moon')).toBeNull();
  });
});

describe('pressKind', () => {
  const before = { x: 100, y: 100, at: 10_000, id: 'moon' };
  it('a quick second press at the same place is a double click', () => {
    expect(pressKind(before, { x: 102, y: 99, at: 10_000 + DOUBLE_MS - 50 })).toBe('double');
  });
  it('a slower one, still at the same place, goes one part down', () => {
    expect(pressKind(before, { x: 100, y: 100, at: 10_000 + DOUBLE_MS + 100 })).toBe('again');
  });
  it('too late, or elsewhere, is a press of its own', () => {
    expect(pressKind(before, { x: 100, y: 100, at: 10_000 + AGAIN_MS + 1 })).toBe('new');
    expect(pressKind(before, { x: 130, y: 100, at: 10_100 })).toBe('new');
    expect(pressKind(null, { x: 100, y: 100, at: 10_100 })).toBe('new');
  });
});

describe('pressSelection', () => {
  const family = ['frame', 'box', 'moon'];
  it('puts the part pressed first, with its section', () => {
    expect(pressSelection('moon', family, [], false)).toEqual(['moon', 'frame', 'box']);
  });
  it('keeps what was chosen when the part is in it, the part first', () => {
    expect(pressSelection('moon', ['moon'], ['frame', 'box', 'moon'], false)).toEqual(['moon', 'frame', 'box']);
    expect(pressSelection('moon', family, ['moon'], false)).toEqual(['moon']);
  });
  it('with Shift adds to what was chosen', () => {
    expect(pressSelection('moon', ['moon'], ['other'], true)).toEqual(['other', 'moon']);
  });
});
