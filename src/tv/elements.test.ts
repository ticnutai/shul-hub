import { describe, it, expect } from 'vitest';
import { newElement, normalizeElements, moveElements, alignElements, normalizeElementLibrary, exportElementSet, importElementSet } from './elements';
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
