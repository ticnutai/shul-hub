import { describe, it, expect } from 'vitest';
import { newElement, normalizeElements, moveElements, alignElements, normalizeElementLibrary, exportElementSet, importElementSet, placeSection, sectionOf, sideOf, boundsOf, styledBox, setContent, addContent, setAlternates, turnOf, resizeElements, fitContent, type BoardElement } from './elements';
import { kitOf, resetToKit } from './kitReset';
import { BUILTIN_DESIGNS, applyDesign } from './designs';
import { setSymbol, symbolChoices } from './artSymbols';
import { DEFAULT_TV_CONFIG, normalizeTvConfig, editForDevice, configForDevice } from './config';
import { workspaceDocument, parseWorkspace, type StoreImage } from './workspaceTransfer';

/** As the picture storage answers: one address per stored picture. */
const STORED = 'https://bfiayuuhjtyccqobsjvl.supabase.co/storage/v1/object/public/community-media/tv/stored.png';
const store: StoreImage = async () => STORED;
import { PREMIUM_DESIGNS } from './premiumDesigns';
import { EMERALD_COMPOSITION } from './emeraldComposition';

describe('New Shul element persistence and transfer', () => {
  it('keeps clean composition frames, extended bindings and row counts in portable data',async()=>{
    const saved=await parseWorkspace(JSON.stringify(workspaceDocument({...structuredClone(DEFAULT_TV_CONFIG),...EMERALD_COMPOSITION.values})), store);
    expect(saved.elements).toEqual(EMERALD_COMPOSITION.values.elements);
    expect(saved.backgroundImage).toBeNull();
    expect(saved.frameStyle.image).toBeNull();
    expect(saved.elements.filter(e=>e.kind==='frame'&&e.image)).toHaveLength(3);
    expect(saved.elements.find(e=>e.binding==='prayers')?.rowsPerPage).toBe(14);
    expect(saved.elements.some(e=>e.binding==='zmanim')).toBe(true);
  });
  it('preserves original-art regions and live bindings across normalization and transfer', async () => {
    for (const design of PREMIUM_DESIGNS) {
      const saved = await parseWorkspace(JSON.stringify(workspaceDocument({ ...structuredClone(DEFAULT_TV_CONFIG), ...design.values })), store);
      expect(saved.screenLayout).toBe('composition');
      expect(saved.elements).toEqual(design.values.elements);
      const restored = importElementSet(exportElementSet(saved.elements));
      expect(restored.filter(e => e.crop).length).toBeGreaterThanOrEqual(8);
      expect(restored.some(e => e.binding === 'prayers')).toBe(true);
    }
    const [bounded] = normalizeElements([{ ...newElement('image'), crop: {x: 99, y: -4, width: 25, height: Infinity}, binding: 'unsafe' }]);
    expect(bounded.crop).toEqual({x:75,y:0,width:25,height:100});
    expect(bounded.binding).toBeUndefined();
  });
  it('round trips an editable board including groups, stored pictures and device-specific elements', async () => {
    const e = { ...newElement('image'), group: 'pair', image: STORED };
    const original = { ...structuredClone(DEFAULT_TV_CONFIG), elements: [e] };
    const config = editForDevice(original, 'tv', c => ({ ...c, elements: [{ ...e, x: 33 }] }));
    const restored = await parseWorkspace(JSON.stringify(workspaceDocument(config)), store);
    expect(restored.elements).toEqual([e]);
    expect(configForDevice(restored, 'tv').elements[0].x).toBe(33);
    expect(restored._records ?? []).toEqual([]);
  });
  it('bounds malformed input and drops unsafe image references and duplicate identities', () => {
    const e = newElement('image');
    const rows = normalizeElements([{ ...e, x: 500, height: -5, opacity: Infinity, image: 'javascript:alert(1)' }, e]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ x: 70, height: 1, opacity: 1, image: '' });
    expect(normalizeTvConfig({ perDevice: { tv: { elements: [{ ...e, image: 'data:image/svg+xml,<svg/>' }] } } }).perDevice.tv.elements[0].image).toBe('');
  });
  it('moves grouped elements together, keeps their spacing and respects a locked member', () => {
    const a = { ...newElement('column'), x: 5 }, b = { ...newElement('column'), x: 90 };
    const moved = moveElements([a, b], [a.id, b.id], 40, 0);
    expect(moved[1].x).toBe(92); expect(moved[1].x - moved[0].x).toBe(85);
    expect(moveElements([a, { ...b, locked: true }], [a.id, b.id], 5, 0)[0].x).toBe(5);
  });
  it('imports a reusable group with fresh identities and preserves its positions', () => {
    const a = { ...newElement('column'), group: 'pair', x: 3 };
    const b = { ...newElement('ornament'), group: 'pair', x: 60 };
    const restored = importElementSet(exportElementSet([a, b]));
    expect(restored.map(e => e.x)).toEqual([3, 60]);
    expect(restored[0].id).not.toBe(a.id);
    expect(restored[0].group).not.toBe('pair');
    expect(restored[0].group).toBe(restored[1].group);
  });
  it('aligns a group without changing its spacing and keeps locked groups still', () => {
    const a = { ...newElement('column'), x: 10 }, b = { ...newElement('column'), x: 60 };
    const centered = alignElements([a, b], [a.id, b.id], 'center-x');
    expect(centered.map(e => e.x)).toEqual([21, 71]);
    expect(alignElements([a, { ...b, locked: true }], [a.id, b.id], 'left')[0].x).toBe(10);
  });
  it('a picture written into a saved board is put in storage, and only its address kept', async () => {
    const doc = workspaceDocument({ ...structuredClone(DEFAULT_TV_CONFIG), elements: [] });
    const inline = { ...doc, config: { ...doc.config, elements: [{ ...newElement('image'), id: 'pic', image: 'data:image/png;base64,aGVsbG8=' }] } };
    const stored: Blob[] = [];
    const restored = await parseWorkspace(JSON.stringify(inline), async (blob) => { stored.push(blob); return STORED; });
    expect(stored).toHaveLength(1);
    expect(restored.elements[0].image).toBe(STORED);
    // A picture inside the settings is never kept: it would go to every screen on every change.
    expect(normalizeElements([{ ...newElement('image'), image: 'data:image/png;base64,aGVsbG8=' }])[0].image).toBe('');
  });
  it('keeps a saved element set across workspace export and removes unsafe library entries', async () => {
    const item = { id: 'set1', name: 'My columns', elements: [newElement('column')] };
    const config = { ...structuredClone(DEFAULT_TV_CONFIG), elementLibrary: [item] };
    expect((await parseWorkspace(JSON.stringify(workspaceDocument(config)), store)).elementLibrary).toEqual([item]);
    expect(normalizeElementLibrary([item, item, { ...item, id: 'invalid', elements: [] }])).toHaveLength(1);
  });
  it('rejects unrelated or future package formats', async () => {
    await expect(parseWorkspace('{"format":"new-shul-board","version":99,"config":{}}', store)).rejects.toThrow();
    await expect(parseWorkspace('[]', store)).rejects.toThrow();
  });
});

describe('placing a section on a side of the board', () => {
  const byName = (els: BoardElement[], name: string) => els.find(e => e.name === name)!;
  for (const design of PREMIUM_DESIGNS) {
    it(`swaps the prayers and the lessons, frames and text together - ${design.name}`, () => {
      const els = design.values.elements!;
      const prayers = byName(els, 'תפילות היום'), lessons = byName(els, 'שיעורי היום');
      const prayerSection = sectionOf(els, prayers.id).map(id => els.find(e => e.id === id)!.name);
      expect(prayerSection).toEqual(expect.arrayContaining(['מסגרת תפילות', 'כותרת תפילות', 'תפילות היום']));
      expect(prayerSection).not.toContain('שיעורי היום');
      expect(sideOf(boundsOf(els, sectionOf(els, prayers.id)))).toBe('left');
      const r = placeSection(els, prayers.id, 'right');
      expect(r.result).toBe('swapped');
      const after = (name: string) => byName(r.elements, name);
      // Each moved by the same step as its frame, so nothing slid off its frame.
      const step = after('מסגרת תפילות').x - byName(els, 'מסגרת תפילות').x;
      expect(step).toBeGreaterThan(30);
      expect(after('תפילות היום').x - prayers.x).toBeCloseTo(step);
      expect(after('כותרת תפילות').x - byName(els, 'כותרת תפילות').x).toBeCloseTo(step);
      expect(after('שיעורי היום').x - lessons.x).toBeCloseTo(-step);
      expect(sideOf(boundsOf(r.elements, sectionOf(r.elements, prayers.id)))).toBe('right');
      expect(sideOf(boundsOf(r.elements, sectionOf(r.elements, lessons.id)))).toBe('left');
      // Everything else stays where it was.
      const moved = new Set([...sectionOf(els, prayers.id), ...sectionOf(els, lessons.id)]);
      for (const e of els) if (!moved.has(e.id)) expect(byName(r.elements, e.name)).toEqual(e);
      // And back again.
      expect(placeSection(r.elements, prayers.id, 'left').elements.map(e => e.x)).toEqual(els.map(e => e.x).map((x, i) => expect.closeTo(x, 5) as unknown as number));
    });
  }
  it('does nothing where the section already stands, and refuses a locked one', () => {
    const els = PREMIUM_DESIGNS[0].values.elements!;
    const lessons = byName(els, 'שיעורי היום');
    expect(placeSection(els, lessons.id, 'right').result).toBe('already');
    const locked = els.map(e => e.name === 'מסגרת שיעורים' ? { ...e, locked: true } : e);
    const r = placeSection(locked, byName(locked, 'תפילות היום').id, 'right');
    expect(r.result).toBe('locked');
    expect(r.elements).toBe(locked);
  });
  it('moves a lone box to an empty side, and centres it', () => {
    const box = { ...newElement('box'), x: 34, y: 20, width: 32, height: 30 };
    const text = { ...newElement('text'), x: 36, y: 25, width: 28, height: 10 };
    const r = placeSection([box, text], text.id, 'left');
    expect(r.result).toBe('moved');
    expect(r.elements[0].x).toBe(2);
    expect(r.elements[1].x).toBe(4);
    expect(placeSection(r.elements, box.id, 'center').elements[0].x).toBe(34);
  });
});

describe('frames in the board\'s own look', () => {
  const designs = [...PREMIUM_DESIGNS, EMERALD_COMPOSITION];
  for (const design of designs) {
    it(`copies a frame of ${design.name} for new content, and changes what a frame shows`, () => {
      const els = design.values.elements!;
      const copy = styledBox(els, 'announcements');
      expect(copy, 'a frame to copy').not.toBeNull();
      expect(copy!.filter(e => e.binding)).toHaveLength(1);
      expect(copy!.find(e => e.binding)!.binding).toBe('announcements');
      expect(new Set(copy!.map(e => e.group)).size).toBe(1);
      const all = [...els, ...copy!];
      // In the middle, and moving alone.
      const ids = sectionOf(all, copy![0].id);
      expect(ids.sort()).toEqual(copy!.map(e => e.id).sort());
      expect(sideOf(boundsOf(all, ids))).toBe('center');
      // The prayers' frame showing the day's times.
      const prayers = els.find(e => e.binding === 'prayers')!;
      const changed = setContent(els, prayers.id, 'zmanim');
      expect(changed.find(e => e.id === prayers.id)!.binding).toBe('zmanim');
      expect(changed.filter((e, i) => e !== els[i]).length).toBeLessThanOrEqual(3);
    });
  }
  it('takes the place of a hidden frame exactly', () => {
    const els = PREMIUM_DESIGNS[0].values.elements!;
    const prayers = sectionOf(els, els.find(e => e.binding === 'prayers')!.id);
    const hidden = els.map(e => prayers.includes(e.id) ? { ...e, hidden: true } : e);
    const copy = styledBox(hidden, 'announcements')!;
    const r = placeSection([...hidden, ...copy], copy[0].id, 'left');
    expect(r.result).toBe('moved');
    const a = boundsOf(r.elements, r.ids), b = boundsOf(hidden, prayers);
    expect(a.x + a.width / 2).toBeCloseTo(b.x + b.width / 2);
  });
  it('falls back to a box of its own on a board with no frame to copy', () => {
    expect(styledBox([], 'zmanim')).toBeNull();
    expect(addContent([], 'zmanim').some(e => e.kind === 'box')).toBe(true);
  });
});

describe('the options of a frame', () => {
  const heritage = PREMIUM_DESIGNS[0].values.elements!;
  const ivory = PREMIUM_DESIGNS[1].values.elements!;
  const byBinding = (els: BoardElement[], b: string) => els.find(e => e.binding === b)!;

  it('puts a plain panel behind content the arch was not drawn for, and none behind its own', () => {
    const prayers = byBinding(ivory, 'prayers');
    const zmanim = setContent(ivory, prayers.id, 'zmanim');
    expect(byBinding(zmanim, 'zmanim').backdrop).toBe(true);
    expect(byBinding(setContent(zmanim, prayers.id, 'lessons'), 'lessons').backdrop).toBeUndefined();
    expect(styledBox(ivory, 'announcements')!.find(e => e.binding)!.backdrop).toBe(true);
    expect(normalizeElements([{ ...byBinding(zmanim, 'zmanim') }])[0].backdrop).toBe(true);
  });

  it('takes turns, and its heading with it; nothing to take turns with is one content again', () => {
    const prayers = byBinding(ivory, 'prayers');
    const turns = setAlternates(ivory, prayers.id, ['announcements', 'lessons', 'prayers'], 30);
    const content = turns.find(e => e.id === prayers.id)!;
    expect(content.alternates).toEqual(['announcements', 'lessons']);
    expect(content.alternateSeconds).toBe(30);
    const heading = turns.find(e => e.name.startsWith('כותרת') && e.alternateTexts)!;
    expect(heading.alternateTexts).toEqual(['זמני תפילות', 'הודעות', 'שיעורי תורה']);
    expect(normalizeElements(turns).find(e => e.id === prayers.id)!.alternates).toEqual(['announcements', 'lessons']);
    expect([0, 30, 60, 90].map(s => turnOf(3, 30, new Date(s * 1000)))).toEqual([0, 1, 2, 0]);
    const back = setAlternates(turns, prayers.id, [], 30);
    expect(back.find(e => e.id === prayers.id)!.alternates).toBeUndefined();
    expect(normalizeElements(back).some(e => e.alternateTexts)).toBe(false);
  });

  it('lays a symbol over the arch of the heritage kit, which moves and hides with it', () => {
    const prayers = byBinding(heritage, 'prayers');
    expect(symbolChoices(heritage, prayers.id)!.choices.map(c => c.id)).toEqual(['none', 'book', 'scroll']);
    expect(symbolChoices(ivory, byBinding(ivory, 'prayers').id)).toBeNull();
    const plain = setSymbol(heritage, prayers.id, 'none');
    expect(plain).toHaveLength(heritage.length + 1);
    const over = plain.find(e => e.symbol)!;
    expect(sectionOf(plain, prayers.id)).toContain(over.id);
    expect(symbolChoices(plain, prayers.id)!.current).toBe('none');
    // Changed, not added twice; and back to the drawing's own.
    expect(setSymbol(plain, prayers.id, 'scroll').filter(e => e.symbol)).toHaveLength(1);
    expect(setSymbol(plain, prayers.id, '')).toEqual(heritage);
    // Sent to the other side, the symbol goes with its arch.
    const r = placeSection(plain, prayers.id, 'right');
    expect(r.elements.find(e => e.symbol)!.x - over.x).toBeCloseTo(r.elements.find(e => e.id === prayers.id)!.x - prayers.x);
  });

  it('names what a frame now stands over, so it can be replaced', () => {
    const copy = styledBox(ivory, 'announcements')!;
    const r = placeSection([...ivory, ...copy], copy[0].id, 'left');
    expect(r.result).toBe('covers');
    expect(r.otherIds).toEqual(sectionOf(ivory, byBinding(ivory, 'prayers').id));
  });
});

describe('stretching, the size of new content, and going back to the kit', () => {
  const ivory = PREMIUM_DESIGNS[1].values.elements!;
  const box = (x: number, y: number, width: number, height: number) => ({ ...newElement('box'), x, y, width, height });

  it('stretches and narrows from every side and corner, the parts inside keeping their share', () => {
    const a = box(10, 10, 20, 40), b = box(15, 20, 10, 10);
    const ids = [a.id, b.id];
    const right = resizeElements([a, b], ids, 'e', 20, 0);
    expect(right[0]).toMatchObject({ x: 10, width: 40 });
    expect(right[1]).toMatchObject({ x: 20, width: 20 });
    const top = resizeElements([a, b], ids, 'n', 0, 5);
    expect(top[0]).toMatchObject({ y: 15, height: 35 });
    const left = resizeElements([a, b], ids, 'w', -5, 0);
    expect(left[0]).toMatchObject({ x: 5, width: 25 });
    const corner = resizeElements([a, b], ids, 'se', 10, 10);
    expect(corner[0]).toMatchObject({ x: 10, y: 10, width: 30, height: 50 });
    // Never past the board, never thinner than 1%.
    expect(resizeElements([a], [a.id], 'e', 500, 0)[0].width).toBe(90);
    expect(resizeElements([a], [a.id], 'w', 500, 0)[0].width).toBeCloseTo(1);
    expect(resizeElements([{ ...a, locked: true }], [a.id], 'e', 5, 0)[0].width).toBe(20);
  });

  it('gives the day\'s times put in the parasha\'s frame its size, in rows that fit it', () => {
    const parasha = ivory.find(e => e.binding === 'parasha')!;
    const zmanim = setContent(ivory, parasha.id, 'zmanim').find(e => e.id === parasha.id)!;
    expect({ x: zmanim.x, y: zmanim.y, width: zmanim.width, height: zmanim.height }).toEqual({ x: parasha.x, y: parasha.y, width: parasha.width, height: parasha.height });
    expect(zmanim.rowsPerPage).toBeGreaterThanOrEqual(2);
    expect(zmanim.fontSize * zmanim.rowsPerPage! * 1.2).toBeLessThanOrEqual(zmanim.height);
    // And back to a line: the line's own size again, not the rows'.
    const back = setContent(setContent(ivory, parasha.id, 'zmanim'), parasha.id, 'parasha').find(e => e.id === parasha.id)!;
    expect(back.fontSize).toBeGreaterThan(zmanim.fontSize);
    // A list for a list keeps the size the gabbai gave it.
    const prayers = { ...ivory.find(e => e.binding === 'prayers')!, rowsPerPage: 7, fontSize: 2.2 };
    expect(fitContent(prayers, 'prayers', 'lessons')).toEqual({ rowsPerPage: 7, fontSize: 2.2 });
  });

  it('knows the kit a board came from, after changes too, and puts it back', () => {
    const kits = BUILTIN_DESIGNS.filter(d => d.values.elements?.length);
    expect(kits.length).toBeGreaterThan(10);
    for (const design of kits) {
      const config = applyDesign(structuredClone(DEFAULT_TV_CONFIG), design);
      const els = config.elements;
      const prayers = els.find(e => e.binding === 'prayers');
      const changed = { ...config, elements: [...(prayers ? setContent(els, prayers.id, 'zmanim') : els.slice(1)), ...(styledBox(els, 'announcements') ?? [])] };
      expect(kitOf(changed)?.id, design.name).toBe(design.id);
      expect(resetToKit(changed, kitOf(changed)!).elements).toEqual(config.elements);
    }
    expect(kitOf({ ...structuredClone(DEFAULT_TV_CONFIG), elements: [box(1, 1, 5, 5)] })).toBeNull();
  });
});
