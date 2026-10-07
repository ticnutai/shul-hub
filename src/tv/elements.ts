import type { CSSProperties } from 'react';
import { ZMAN_DISPLAY_KEYS } from '@/community/lib/zmanim';
/** Free elements share the board's config, undo history and renderer. Coordinates are percentages. */
export const ELEMENT_KINDS = ['column', 'ornament', 'frame', 'box', 'text', 'image'] as const;
export type ElementKind = typeof ELEMENT_KINDS[number];
export const ELEMENT_BINDINGS = ['clock', 'analog', 'prayers', 'lessons', 'title', 'date', 'zmanim', 'footer', 'logos', 'announcements', 'parasha', 'dafYomi', 'amudYomi', 'seasonal'] as const;
export type ElementBinding = typeof ELEMENT_BINDINGS[number];
export const ELEMENT_NAMES: Record<ElementKind, string> = { column: 'עמוד קלאסי', ornament: 'עיטור', frame: 'מסגרת', box: 'תיבה', text: 'טקסט', image: 'תמונה' };
export interface BoardElement {
  id: string; kind: ElementKind; name: string; x: number; y: number; width: number; height: number;
  color: string; fill: string; text: string; image: string; fontSize: number; opacity: number;
  rotation: number; locked: boolean; hidden: boolean; group: string | null;
  crop?: { x: number; y: number; width: number; height: number };
  /** Non-destructive source-pixel mask. Holes expose independent layers below. */
  sourceMask?: { width: number; height: number; path: string; holes: string[] };
  binding?: ElementBinding;
  rowsPerPage?: number;
  zmanKeys?: (typeof ZMAN_DISPLAY_KEYS)[number][];
  /**
   * Content longer than its frame, moved rather than shrunk or paged: the
   * board's own scrolling (AutoScroll) - stopping at the ends, or the endless
   * curtain. Absent: a notice is shrunk to fit, a list turns its pages.
   */
  scroll?: ElementScroll;
}
export type ElementScroll = 'pause' | 'loop';
/** The content that can move in its frame: lists and paragraphs. */
export const SCROLLABLE: ElementBinding[] = ['prayers', 'lessons', 'zmanim', 'announcements', 'footer'];
export const MAX_ELEMENTS = 80;
export const elementId = () => `el_${crypto.randomUUID()}`;
export function newElement(kind: ElementKind): BoardElement {
  return { id: elementId(), kind, name: ELEMENT_NAMES[kind], x: 10, y: 15,
    width: kind === 'column' ? 8 : 30, height: kind === 'column' ? 75 : kind === 'text' || kind === 'ornament' ? 12 : 35,
    color: '#c9a45d', fill: kind === 'box' ? '#fff8e8' : 'transparent', text: kind === 'text' ? 'טקסט חדש' : '', image: '',
    fontSize: 4, opacity: 1, rotation: 0, locked: false, hidden: false, group: null };
}
/**
 * A picture a board element may show: one of the artwork that ships with the
 * site (/new-shul-assets/...), or one uploaded to the synagogue's own picture
 * storage. Never a picture written into the settings themselves (a data URL):
 * the settings travel to every screen on every change, and a picture there
 * would make each of them megabytes. Imports upload their pictures first.
 */
export const STORAGE_IMAGE = /^https:\/\/[a-z0-9]{20}\.supabase\.co\/storage\/v1\/object\/public\/community-media\/[\w./-]{1,300}$/;
export const safeImage = (s: unknown): boolean =>
  typeof s === 'string' && s.length < 2000 && (/^\/new-shul-assets\/[a-zA-Z0-9._-]+$/.test(s) || STORAGE_IMAGE.test(s));
const colour = (s: unknown, fallback: string) => typeof s === 'string' && /^(#[\da-f]{3,8}|transparent)$/i.test(s) ? s : fallback;
const n = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
const safePath = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 20000 && /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+\-]+$/.test(v);
function normalizeMask(v: unknown): BoardElement['sourceMask'] {
  if(!v || typeof v!=='object')return;
  const m=v as Record<string,unknown>;
  if(!safePath(m.path)||!Array.isArray(m.holes)||m.holes.length>50||!m.holes.every(safePath))return;
  if(typeof m.width!=='number'||typeof m.height!=='number'||!Number.isFinite(m.width)||!Number.isFinite(m.height)||m.width<1||m.height<1||m.width>8192||m.height>8192)return;
  return {width:m.width,height:m.height,path:m.path,holes:[...m.holes]};
}
export function normalizeElements(raw: unknown): BoardElement[] {
  const seen = new Set<string>();
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_ELEMENTS).flatMap((v) => {
    if (!v || typeof v !== 'object' || !ELEMENT_KINDS.includes(v.kind) || typeof v.id !== 'string' || !/^[\w-]{1,80}$/.test(v.id) || seen.has(v.id)) return [];
    seen.add(v.id);
    const d = newElement(v.kind);
    const width = n(v.width, d.width, 1, 100), height = n(v.height, d.height, 1, 100);
    const cropWidth = n(v.crop?.width, 100, 1, 100), cropHeight = n(v.crop?.height, 100, 1, 100);
    return [{ ...d, id: v.id, width, height, x: n(v.x, 0, 0, 100 - width), y: n(v.y, 0, 0, 100 - height),
      ...(v.crop && typeof v.crop === 'object' ? { crop: { x: n(v.crop.x, 0, 0, 100 - cropWidth), y: n(v.crop.y, 0, 0, 100 - cropHeight), width: cropWidth, height: cropHeight } } : {}),
      ...(normalizeMask(v.sourceMask) ? {sourceMask:normalizeMask(v.sourceMask)} : {}),
      ...(ELEMENT_BINDINGS.includes(v.binding) ? { binding: v.binding } : {}),
      ...(typeof v.rowsPerPage === 'number' ? { rowsPerPage: Math.round(n(v.rowsPerPage, 3, 1, 30)) } : {}),
      ...(v.scroll === 'pause' || v.scroll === 'loop' ? { scroll: v.scroll as ElementScroll } : {}),
      ...(Array.isArray(v.zmanKeys) ? {zmanKeys:[...new Set(v.zmanKeys.filter((k:unknown)=>ZMAN_DISPLAY_KEYS.includes(k as typeof ZMAN_DISPLAY_KEYS[number])))] as BoardElement['zmanKeys']} : {}),
      name: typeof v.name === 'string' ? v.name.slice(0, 80) : d.name, text: typeof v.text === 'string' ? v.text.slice(0, 2000) : '',
      color: colour(v.color, d.color), fill: colour(v.fill, d.fill), image: safeImage(v.image) ? v.image : '',
      fontSize: n(v.fontSize, 4, .5, 20), opacity: n(v.opacity, 1, 0, 1), rotation: n(v.rotation, 0, -180, 180),
      locked: v.locked === true, hidden: v.hidden === true, group: typeof v.group === 'string' && /^[\w-]{1,80}$/.test(v.group) ? v.group : null }];
  });
}
export function moveElements(all: BoardElement[], ids: string[], dx: number, dy: number) {
  const chosen = all.filter(e => ids.includes(e.id));
  if (!chosen.length || chosen.some(e => e.locked)) return all;
  dx = Math.max(-Math.min(...chosen.map(e => e.x)), Math.min(dx, 100 - Math.max(...chosen.map(e => e.x + e.width))));
  dy = Math.max(-Math.min(...chosen.map(e => e.y)), Math.min(dy, 100 - Math.max(...chosen.map(e => e.y + e.height))));
  return all.map(e => ids.includes(e.id) ? { ...e, x: e.x + dx, y: e.y + dy } : e);
}

export type ElementAlignment = 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y';
/** Align the selection as one unit, preserving the spacing inside groups. */
export function alignElements(all: BoardElement[], ids: string[], alignment: ElementAlignment) {
  const selected = all.filter(e => ids.includes(e.id));
  if (!selected.length || selected.some(e => e.locked)) return all;
  const left = Math.min(...selected.map(e => e.x)), right = Math.max(...selected.map(e => e.x + e.width));
  const top = Math.min(...selected.map(e => e.y)), bottom = Math.max(...selected.map(e => e.y + e.height));
  const dx = alignment === 'left' ? -left : alignment === 'right' ? 100 - right : alignment === 'center-x' ? 50 - (left + right) / 2 : 0;
  const dy = alignment === 'top' ? -top : alignment === 'bottom' ? 100 - bottom : alignment === 'center-y' ? 50 - (top + bottom) / 2 : 0;
  return moveElements(all, ids, dx, dy);
}

/** What each live binding shows, in the gabbai's words. One list for the picker and for adding. */
export const BINDING_LABELS: Record<ElementBinding, string> = {
  zmanim: 'זמני היום', announcements: 'הודעות', prayers: 'תפילות היום', lessons: 'שיעורי היום',
  seasonal: 'תוספות בתפילה', dafYomi: 'דף יומי', amudYomi: 'עמוד יומי', footer: 'פרשה ולימוד יומי',
  logos: 'לוגואים', parasha: 'פרשת השבוע', date: 'תאריך עברי', title: 'שם בית הכנסת',
  clock: 'שעון דיגיטלי', analog: 'שעון מחוגים',
};

/**
 * A section of the board: a frame and everything standing inside it - the
 * frame of the prayers, its heading and the times themselves. A gabbai who
 * says "the prayers on the right" means all of them, never the text alone
 * floating off its frame. Sections are found by containment, so they work for
 * the art kits (cropped pieces), for drawn frames, and for boxes added here.
 */
export type ElementSide = 'right' | 'center' | 'left';
const CONTAINER_KINDS: ElementKind[] = ['image', 'frame', 'box', 'column'];
/** Half the board, in square percents: anything larger is a backdrop, not a section. */
const MAX_SECTION_AREA = 5000;
type Rect = { x: number; y: number; width: number; height: number };
const areaOf = (r: Rect) => r.width * r.height;
const inside = (a: Rect, b: Rect, t = .5) => a.x >= b.x - t && a.y >= b.y - t && a.x + a.width <= b.x + b.width + t && a.y + a.height <= b.y + b.height + t;
const holds = (c: BoardElement) => CONTAINER_KINDS.includes(c.kind) && areaOf(c) < MAX_SECTION_AREA;

export function sectionOf(all: BoardElement[], id: string): string[] {
  const at = all.findIndex(x => x.id === id), e = all[at];
  if (!e) return [];
  // Parts grouped by hand are a section as they are: the group says what belongs together.
  if (e.group) return all.filter(x => x.group === e.group).map(x => x.id);
  // What stands in a frame is drawn above it: a part laid later over others is not their content.
  const root = all.slice(0, at).filter(c => holds(c) && areaOf(c) >= areaOf(e) && inside(e, c))
    .reduce((best, c) => areaOf(c) > areaOf(best) ? c : best, e);
  const from = all.indexOf(root);
  const ids = new Set(holds(root) ? all.filter((x, i) => i >= from && inside(x, root)).map(x => x.id) : [root.id]);
  ids.add(e.id);
  const groups = new Set(all.filter(x => ids.has(x.id) && x.group).map(x => x.group));
  for (const x of all) if (x.group && groups.has(x.group)) ids.add(x.id);
  return all.filter(x => ids.has(x.id)).map(x => x.id);
}
export function boundsOf(all: BoardElement[], ids: string[]): Rect {
  const chosen = all.filter(e => ids.includes(e.id));
  const x = Math.min(...chosen.map(e => e.x)), y = Math.min(...chosen.map(e => e.y));
  return { x, y, width: Math.max(...chosen.map(e => e.x + e.width)) - x, height: Math.max(...chosen.map(e => e.y + e.height)) - y };
}
export const sideOf = (r: Rect): ElementSide => { const c = r.x + r.width / 2; return c < 40 ? 'left' : c > 60 ? 'right' : 'center'; };
const overlap = (a: Rect, b: Rect) => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x), h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h / (areaOf(a) + areaOf(b) - w * h) : 0;
};
export type PlaceResult = { elements: BoardElement[]; result: 'moved' | 'swapped' | 'covers' | 'already' | 'locked' | 'missing'; ids: string[]; other?: string };
/**
 * A section moved to a side of the board. Where another section already
 * stands there - the lessons, when the prayers go right - the two change
 * places, so the board stays whole instead of one frame over the other.
 * Where the place it leaves is not free (a box added over the middle), it
 * goes alone, and the result says what it now stands over.
 */
export function placeSection(all: BoardElement[], id: string, side: ElementSide): PlaceResult {
  const ids = sectionOf(all, id);
  if (!ids.length) return { elements: all, result: 'missing', ids };
  if (all.some(e => ids.includes(e.id) && e.locked)) return { elements: all, result: 'locked', ids };
  const box = boundsOf(all, ids), from = sideOf(box);
  if (from === side) return { elements: all, result: 'already', ids };
  const x = side === 'center' ? 50 - box.width / 2 : from !== 'center' ? 100 - box.x - box.width : side === 'right' ? 98 - box.width : 2;
  const target = { ...box, x };
  // The sections standing elsewhere, each once, and the one that stands where this one goes.
  const seen = new Set<string>();
  const others: { ids: string[]; box: Rect }[] = [];
  // A frame hidden there leaves its place: a section sent there takes it exactly.
  const empty: { ids: string[]; box: Rect }[] = [];
  for (const e of all) {
    if (ids.includes(e.id) || seen.has(e.id)) continue;
    const other = sectionOf(all, e.id);
    if (other.some(o => ids.includes(o))) continue;
    const off = all.every(x => !other.includes(x.id) || x.hidden);
    if (e.hidden && !off) continue;
    other.forEach(o => seen.add(o));
    const b = boundsOf(all, other);
    if (areaOf(b) < MAX_SECTION_AREA) (off ? empty : others).push({ ids: other, box: b });
  }
  const best = others.map(o => ({ ...o, score: overlap(target, o.box) })).filter(o => o.score >= .3).sort((a, b) => b.score - a.score)[0];
  if (!best) {
    const slot = empty.map(o => ({ ...o, score: overlap(target, o.box) })).filter(o => o.score >= .3).sort((a, b) => b.score - a.score)[0];
    const to = slot ? slot.box.x + slot.box.width / 2 - box.width / 2 : x;
    return { elements: moveElements(all, ids, to - box.x, 0), result: 'moved', ids };
  }
  const name = all.find(e => e.id === best.ids[0])?.name;
  const dx = (best.box.x + best.box.width / 2) - (box.x + box.width / 2);
  // The two change places only where the place left behind is free: the
  // lessons go where the prayers were, never over the clock in the middle.
  const left = { ...best.box, x: best.box.x - dx };
  const blocked = others.some(o => o !== best && (() => {
    const w = Math.min(left.x + left.width, o.box.x + o.box.width) - Math.max(left.x, o.box.x), h = Math.min(left.y + left.height, o.box.y + o.box.height) - Math.max(left.y, o.box.y);
    return w > 0 && h > 0 && w * h > .2 * Math.min(areaOf(left), areaOf(o.box));
  })());
  if (blocked) return { elements: moveElements(all, ids, x - box.x, 0), result: 'covers', ids, other: name };
  if (all.some(e => best.ids.includes(e.id) && e.locked)) return { elements: all, result: 'locked', ids, other: name };
  return { elements: moveElements(moveElements(all, ids, dx, 0), best.ids, -dx, 0), result: 'swapped', ids, other: name };
}

/**
 * Live content in a frame of its own: the day's times, the announcements,
 * the logos - anything the board knows. Lists get a heading above them; a
 * single line (a clock, a date) fills its frame. One group, so the box moves
 * as one, and alone - never with a frame it was dropped onto.
 */
export function liveBox(binding: ElementBinding): BoardElement[] {
  const label = BINDING_LABELS[binding];
  const tall = ({ zmanim: 66, prayers: 50, lessons: 50, announcements: 34, analog: 24, seasonal: 20, logos: 18 } as Partial<Record<ElementBinding, number>>)[binding] ?? 14;
  const headed = ['zmanim', 'prayers', 'lessons', 'announcements', 'seasonal'].includes(binding);
  const base = { x: 34, y: Math.max(2, 50 - tall / 2), width: 32, height: tall };
  const group = elementId();
  const fill = { ...newElement('box'), ...base, name: `מילוי ${label}`, fill: '#122333', color: 'transparent', group };
  const frame = { ...newElement('frame'), ...base, name: `מסגרת ${label}`, color: '#d5b675', group };
  const heading = { ...newElement('text'), x: base.x + 2, y: base.y + 2, width: base.width - 4, height: 5, name: `כותרת ${label}`, text: label, fontSize: 3, color: '#f5dfad', group };
  const content: BoardElement = { ...newElement('text'), name: `תוכן ${label}`, binding, text: '', color: '#fff5de', group,
    ...(headed ? { x: base.x + 2, y: base.y + 9, width: base.width - 4, height: base.height - 11 } : { x: base.x + 2, y: base.y + 1.5, width: base.width - 4, height: base.height - 3 }),
    fontSize: binding === 'zmanim' ? 1.8 : headed ? 2.6 : binding === 'analog' ? 4 : 3,
    ...(['zmanim', 'prayers', 'lessons'].includes(binding) ? { rowsPerPage: binding === 'zmanim' ? 13 : 6 } : {}),
    ...(binding === 'zmanim' ? { zmanKeys: [...ZMAN_DISPLAY_KEYS] } : {}) };
  return [fill, frame, ...(headed ? [heading] : []), content];
}

/** The heading a frame gets for what it shows. */
export const BINDING_HEADINGS: Record<ElementBinding, string> = { ...BINDING_LABELS, prayers: 'זמני תפילות', lessons: 'שיעורי תורה' };
/** Content that is a list or a paragraph: what a tall, headed frame is for. */
const FRAME_CONTENT: ElementBinding[] = ['prayers', 'lessons', 'zmanim', 'announcements', 'seasonal'];
const LISTS: ElementBinding[] = ['prayers', 'lessons', 'zmanim'];

/** A section's own parts: its one live content, its one heading, and the frame they stand in. */
function frameParts(all: BoardElement[], ids: string[]) {
  const mine = all.filter(x => ids.includes(x.id));
  const bound = mine.filter(x => x.binding);
  const headings = mine.filter(x => x.kind === 'text' && !x.binding);
  const frames = mine.filter(holds).sort((a, b) => areaOf(b) - areaOf(a));
  return { own: bound.length === 1, heading: headings.length === 1 ? headings[0] : undefined, frame: frames[0] };
}

function retarget(e: BoardElement, binding: ElementBinding): BoardElement {
  const { zmanKeys: _z, rowsPerPage, ...rest } = e;
  return { ...rest, binding, name: BINDING_LABELS[binding], ...(LISTS.includes(binding) ? { rowsPerPage: rowsPerPage ?? (binding === 'zmanim' ? 6 : 4) } : {}) };
}

/**
 * A frame of the board made to show something else: the arch of the prayers
 * showing the day's times. The frame and its look stay; the content changes,
 * and with it the heading, when the frame is the content's own.
 */
export function setContent(all: BoardElement[], id: string, binding: ElementBinding): BoardElement[] {
  const e = all.find(x => x.id === id);
  if (!e?.binding || e.binding === binding) return all;
  const { own, heading, frame } = frameParts(all, sectionOf(all, id));
  return all.map(x =>
    x.id === e.id ? retarget(x, binding)
    : own && x.id === heading?.id ? { ...x, text: BINDING_HEADINGS[binding], name: `כותרת ${BINDING_LABELS[binding]}` }
    : own && x.id === frame?.id && x.id !== e.id ? { ...x, name: `מסגרת ${BINDING_LABELS[binding]}` }
    : x);
}

/**
 * A new frame in the board's own look: a copy of its finest frame that holds
 * a list (the arch of the prayers, say), showing the content asked for, in
 * the middle of the board to be sent to its place. Null when the board has no
 * such frame to copy - then a plain box (liveBox) it is.
 */
export function styledBox(all: BoardElement[], binding: ElementBinding): BoardElement[] | null {
  const source = all
    .filter(e => e.binding && FRAME_CONTENT.includes(e.binding) && !e.hidden)
    .map(e => ({ e, ids: sectionOf(all, e.id) }))
    .filter(({ ids }) => { const p = frameParts(all, ids); return p.own && p.frame; })
    .sort((a, b) => areaOf(boundsOf(all, b.ids)) - areaOf(boundsOf(all, a.ids)))[0];
  if (!source) return null;
  const { heading } = frameParts(all, source.ids);
  const box = boundsOf(all, source.ids);
  const dx = 50 - box.width / 2 - box.x;
  const group = elementId();
  return all.filter(x => source.ids.includes(x.id)).map(x => {
    const copy: BoardElement = { ...structuredClone(x), id: elementId(), group, hidden: false, locked: false, x: x.x + dx };
    if (x.id === source.e.id) return retarget(copy, binding);
    if (x.id === heading?.id) return { ...copy, text: BINDING_HEADINGS[binding], name: `כותרת ${BINDING_LABELS[binding]}` };
    return { ...copy, name: `${x.name} (${BINDING_LABELS[binding]})` };
  });
}

/** New content on the board: in the board's look when it has one to copy, otherwise in a box of its own. */
export const addContent = (all: BoardElement[], binding: ElementBinding) => styledBox(all, binding) ?? liveBox(binding);

export interface SavedElementSet { id: string; name: string; elements: BoardElement[] }
export const MAX_ELEMENT_SETS = 24;
export function normalizeElementLibrary(raw: unknown): SavedElementSet[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.slice(0, MAX_ELEMENT_SETS).flatMap(v => {
    if (!v || typeof v !== 'object' || typeof v.id !== 'string' || !/^[\w-]{1,80}$/.test(v.id) || seen.has(v.id) || typeof v.name !== 'string' || !v.name.trim()) return [];
    const elements = normalizeElements(v.elements);
    if (!elements.length) return [];
    seen.add(v.id);
    return [{ id: v.id, name: v.name.trim().slice(0, 80), elements }];
  });
}

export function exportElementSet(elements: BoardElement[]) {
  return JSON.stringify({ format: 'new-shul-elements', version: elements.some(e=>e.zmanKeys || ['parasha','dafYomi','amudYomi','seasonal'].includes(e.binding??''))?3:elements.some(e=>e.sourceMask)?2:1, elements: normalizeElements(elements) }, null, 2);
}
export function importElementSet(text: string): BoardElement[] {
  if (text.length > 15_000_000) throw new Error('חבילת האלמנטים גדולה מדי');
  const raw = JSON.parse(text);
  if (raw?.format !== 'new-shul-elements' || ![1,2,3].includes(raw?.version) || !Array.isArray(raw.elements)) throw new Error('זה אינו קובץ חלקים של הלוח');
  const elements = normalizeElements(raw.elements);
  if (!elements.length || elements.length !== raw.elements.length) throw new Error('חבילת האלמנטים אינה תקינה');
  const groups = new Map<string, string>();
  return elements.map(e => {
    if (e.group && !groups.has(e.group)) groups.set(e.group, elementId());
    return { ...e, id: elementId(), group: e.group ? groups.get(e.group)! : null };
  });
}

export function elementStyle(e: BoardElement): CSSProperties {
  return { position: 'absolute', left: `${e.x}%`, top: `${e.y}%`, width: `${e.width}%`, height: `${e.height}%`, opacity: e.opacity, transform: `rotate(${e.rotation}deg)`, color: e.color, display: e.hidden ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' };
}
