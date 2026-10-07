/**
 * The pages of a board of parts: each its own board, kept once, edited alone,
 * taking turns by the clock.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_TV_CONFIG, PAGE_LOOK_KEYS, configForDevice, editForDevice, normalizeTvConfig, type TvConfig } from './config';
import { BUILTIN_DESIGNS, DESIGN_KEYS, applyDesign } from './designs';
import { setContent } from './elements';
import { addPage, copyPage, editPage, movePage, pageAt, pageLook, readPages, removePage, setPage } from './partPages';
import { PREMIUM_DESIGNS } from './premiumDesigns';

const kit = (i: number) => BUILTIN_DESIGNS.filter(d => d.values.elements?.length)[i];
const board = (): TvConfig => applyDesign(structuredClone(DEFAULT_TV_CONFIG), PREMIUM_DESIGNS[0]);
const at = (s: number) => new Date(s * 1000);

describe('the pages of a board of parts', () => {
  it('keeps of a page what a design keeps - the same list', () => {
    expect([...PAGE_LOOK_KEYS].sort()).toEqual([...DESIGN_KEYS].sort());
  });

  it('is one page, with no trace of pages, until a second is added', () => {
    const c = board();
    expect(c.partPages).toEqual([]);
    expect(readPages(c)).toHaveLength(1);
    expect(pageLook(c, 0)).toBe(c);
    expect(pageAt(c, at(12345))).toBe(0);
  });

  it('adds a page as a copy, then lets it be its own kit, changing nothing else', () => {
    const one = board();
    const { config: two, index } = addPage(one, 0);
    expect(index).toBe(1);
    expect(readPages(two).map(p => p.name)).toEqual(['עמוד 1', 'עמוד 2']);
    expect(pageLook(two, 1).elements).toEqual(one.elements);
    // Its own kit: page 2 wears another, page 1 is untouched.
    const other = kit(3);
    const dressed = editPage(two, 1, c => applyDesign(c, other));
    expect(pageLook(dressed, 1).elements).toEqual(other.values.elements);
    expect(dressed.elements).toEqual(one.elements);
    expect(dressed.theme).toBe(one.theme);
    // Its own content: the prayers' arch of page 2 shows the day's times; page 1 still the prayers.
    const prayers = pageLook(dressed, 1).elements.find(e => e.binding === 'prayers');
    if (prayers) {
      const changed = editPage(dressed, 1, c => ({ ...c, elements: setContent(c.elements, prayers.id, 'zmanim') }));
      expect(pageLook(changed, 1).elements.some(e => e.binding === 'zmanim')).toBe(true);
      expect(changed.elements.some(e => e.binding === 'zmanim')).toBe(false);
    }
    // What is not a look (the board's texts) lands on the board, from any page.
    const texts = editPage(dressed, 1, c => ({ ...c, texts: { ...c.texts, 'header.title': 'אהל משה' } }));
    expect(texts.texts['header.title']).toBe('אהל משה');
    expect(texts.partPages[1].look).toEqual(dressed.partPages[1].look);
  });

  it('keeps every look once: page 1 in the board, the others beside it', () => {
    const { config } = addPage(addPage(board(), 0).config, 0);
    expect(config.partPages[0].look).toBeUndefined();
    expect(config.partPages.slice(1).every(p => p.look)).toBe(true);
    expect(new Set(config.partPages.map(p => p.id)).size).toBe(3);
  });

  it('takes turns by the clock, each page for its seconds, the same on every screen', () => {
    let c = addPage(addPage(board(), 0).config, 0).config;
    c = setPage(setPage(setPage(c, 0, { seconds: 10 }), 1, { seconds: 20 }), 2, { seconds: 30 });
    const turns = [0, 9, 10, 29, 30, 59, 60].map(s => pageAt(c, at(s)));
    expect(turns).toEqual([0, 0, 1, 1, 2, 2, 0]);
  });

  it('reorders and removes pages without losing a look', () => {
    const one = board();
    const two = editPage(addPage(one, 0).config, 1, c => applyDesign(c, kit(3)));
    const looks = [one.elements, pageLook(two, 1).elements];
    const swapped = movePage(two, 1, -1);
    expect(swapped.elements).toEqual(looks[1]);
    expect(pageLook(swapped, 1).elements).toEqual(looks[0]);
    expect(readPages(swapped).map(p => p.name)).toEqual(['עמוד 2', 'עמוד 1']);
    // The first taken off: the next is the board, and one page is no pages.
    const left = removePage(two, 0);
    expect(left.elements).toEqual(looks[1]);
    expect(left.partPages).toEqual([]);
    expect(removePage(two, 1).elements).toEqual(one.elements);
  });

  it('comes back from storage as it went, and refuses what a board would', () => {
    const two = editPage(addPage(board(), 0).config, 1, c => applyDesign(c, kit(3)));
    const stored = normalizeTvConfig(JSON.parse(JSON.stringify(two)));
    expect(stored.partPages.map(p => p.id)).toEqual(two.partPages.map(p => p.id));
    // Read back once, it stays as it is: saved again and read again, nothing moves.
    expect(normalizeTvConfig(JSON.parse(JSON.stringify(stored))).partPages).toEqual(stored.partPages);
    expect(pageLook(stored, 1).elements).toEqual(pageLook(two, 1).elements);
    const bad = normalizeTvConfig({ ...two, partPages: [two.partPages[0], { ...two.partPages[1], look: { ...two.partPages[1].look, backgroundImage: 'javascript:alert(1)' } }] });
    expect(pageLook(bad, 1).backgroundImage ?? '').not.toContain('javascript');
    // A page without its look, or pages with no page 1, are no pages.
    expect(normalizeTvConfig({ ...two, partPages: [two.partPages[1]] }).partPages).toEqual([]);
    expect(normalizeTvConfig({ ...two, partPages: [two.partPages[0], { id: 'x', name: 'x', seconds: 5 }] }).partPages).toHaveLength(1);
  });
});

describe('a page on each kind of screen, and a page copied', () => {
  const two = () => editPage(addPage(board(), 0).config, 1, c => applyDesign(c, kit(3)));

  it('gives a page a phone of its own, and leaves page 1\'s phone alone', () => {
    const c = two();
    const phone = editPage(c, 1, p => editForDevice(p, 'mobile', x => ({ ...x, elements: x.elements.slice(0, 2) })));
    expect(configForDevice(pageLook(phone, 1), 'mobile').elements).toHaveLength(2);
    expect(configForDevice(pageLook(phone, 1), 'tv').elements).toEqual(pageLook(c, 1).elements);
    // Page 1 on a phone: as it was.
    expect(configForDevice(phone, 'mobile').elements).toEqual(c.elements);
    expect(phone.partPages[1].devices?.mobile?.elements).toHaveLength(2);
    // The board's own wording for the phone, written from page 2, is the board's.
    const worded = editPage(phone, 1, p => editForDevice(p, 'mobile', x => ({ ...x, texts: { ...x.texts, 'header.title': 'קצר' } })));
    expect(configForDevice(worded, 'mobile').texts['header.title']).toBe('קצר');
    expect(worded.partPages[1].devices?.mobile?.texts).toBeUndefined();
    // Saved and read back, the page keeps its phone.
    const stored = normalizeTvConfig(JSON.parse(JSON.stringify(worded)));
    expect(configForDevice(pageLook(stored, 1), 'mobile').elements).toHaveLength(2);
  });

  it('keeps each page\'s phone with it when the pages change places', () => {
    const c = editPage(two(), 1, p => editForDevice(p, 'mobile', x => ({ ...x, elements: x.elements.slice(0, 2) })));
    const swapped = movePage(c, 1, -1);
    // Page 2 is first now: its phone is the board's phone.
    expect(configForDevice(swapped, 'mobile').elements).toHaveLength(2);
    expect(configForDevice(pageLook(swapped, 1), 'mobile').elements).toEqual(c.elements);
  });

  it('copies one page onto another, and only that one', () => {
    const c = addPage(two(), 0).config;
    const copied = copyPage(c, 1, 2);
    expect(pageLook(copied, 2).elements).toEqual(pageLook(c, 1).elements);
    expect(pageLook(copied, 1).elements).toEqual(pageLook(c, 1).elements);
    expect(copied.elements).toEqual(c.elements);
    expect(readPages(copied).map(p => p.name)).toEqual(readPages(c).map(p => p.name));
    // Onto page 1: the board is the copy.
    expect(copyPage(c, 1, 0).elements).toEqual(pageLook(c, 1).elements);
    expect(copyPage(c, 1, 1)).toBe(c);
  });
});
