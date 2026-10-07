import { describe, it, expect } from 'vitest';
import { newElement, normalizeElements, moveElements, alignElements, normalizeElementLibrary, exportElementSet, importElementSet, placeSection, sectionOf, sideOf, boundsOf, styledBox, setContent, addContent, type BoardElement } from './elements';
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
