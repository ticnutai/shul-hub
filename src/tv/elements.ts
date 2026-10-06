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
}
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
