/**
 * The pages of a board of parts.
 *
 * An ordinary board has screens that take turns; a board of parts was one
 * picture, always. Now it can be several: each page a board of its own - its
 * kit, its frames, what they show, its background - standing for its seconds,
 * then the next.
 *
 * Page 1 is the board itself, exactly as it was: a board with one page has
 * no trace of this, and every screen that never heard of pages still shows
 * it. Every other page keeps its whole look (`look`, the design keys) beside
 * it. Nothing is kept twice: page 1's look is the board's, and only there.
 *
 * Every screen in the hall shows the same page at the same time - the page
 * is read off the clock, not counted from when a screen was switched on.
 */
import { PAGE_LOOK_KEYS, type PartPage, type TvConfig } from './config';

export const MAX_PAGES = 12;
const DEFAULT_SECONDS = 30;

/** The pages, with page 1 always first - a board with none has the one. */
export function readPages(c: TvConfig): PartPage[] {
  return c.partPages.length > 1 ? c.partPages : [{ id: 'page1', name: 'עמוד 1', seconds: c.partPages[0]?.seconds ?? DEFAULT_SECONDS }];
}

const pick = (c: TvConfig): Partial<TvConfig> =>
  Object.fromEntries(PAGE_LOOK_KEYS.map(k => [k, structuredClone(c[k])])) as Partial<TvConfig>;

type Devices = TvConfig['perDevice'];
const isLook = (k: string) => PAGE_LOOK_KEYS.includes(k as keyof TvConfig);
/**
 * One screen kind's own settings, split: what is a page's look (its frames on
 * the phone, say) and what is the board's (its wording there).
 */
function split(devices: Devices, look: boolean): Devices {
  const out: Devices = {};
  for (const [d, o] of Object.entries(devices ?? {})) {
    if (!o) continue;
    const kept = Object.fromEntries(Object.entries(o).filter(([k]) => isLook(k) === look));
    if (Object.keys(kept).length) (out as Record<string, unknown>)[d] = kept;
  }
  return out;
}
function merge(a: Devices, b: Devices): Devices {
  const out: Devices = { ...a };
  for (const [d, o] of Object.entries(b ?? {})) (out as Record<string, unknown>)[d] = { ...(a as Record<string, object>)[d], ...o };
  return out;
}

/**
 * The board as page `i` shows it: page 1 is the board; any other, its look
 * over the board - and on each kind of screen, that page's own settings for it
 * (`devices`), never page 1's frames on a phone.
 */
export function pageLook(c: TvConfig, i: number): TvConfig {
  const page = i > 0 ? c.partPages[i] : undefined;
  if (!page?.look) return c;
  return { ...c, ...page.look, perDevice: merge(split(c.perDevice, false), page.devices ?? {}) };
}

/**
 * An edit made while working on page `i`: what it does to the look lands on
 * that page; the rest (texts, what is hidden, the content) on the board, as
 * any edit does. On page 1 it is simply the edit.
 */
export function editPage(c: TvConfig, i: number, update: (c: TvConfig) => TvConfig): TvConfig {
  if (i <= 0 || !c.partPages[i]) return update(c);
  const after = update(pageLook(c, i));
  const board = { ...after } as TvConfig;
  for (const k of PAGE_LOOK_KEYS) (board as unknown as Record<string, unknown>)[k] = c[k];
  // A screen kind's settings made on this page: its look stays with the page,
  // its wording goes to the board's, as from any page.
  board.perDevice = merge(split(after.perDevice, false), split(c.perDevice, true));
  const devices = split(after.perDevice, true);
  return { ...board, partPages: c.partPages.map((p, j) => (j === i ? { ...p, look: pick(after), devices } : p)) };
}

/** Every page's look in order, the board's first: to reorder or remove pages without losing one. */
function looks(c: TvConfig) {
  return readPages(c).map((p, i) => ({
    page: p,
    look: i === 0 ? pick(c) : p.look ?? pick(c),
    devices: i === 0 ? split(c.perDevice, true) : p.devices ?? {},
  }));
}
function rebuild(c: TvConfig, list: ReturnType<typeof looks>): TvConfig {
  const [first, ...rest] = list;
  // The first page's screen settings are the board's; the board's own wording stays.
  const board = { ...c, ...first.look, perDevice: merge(split(c.perDevice, false), first.devices) } as TvConfig;
  const pages: PartPage[] = list.length < 2 ? [] : [
    { id: first.page.id, name: first.page.name, seconds: first.page.seconds },
    ...rest.map(({ page, look, devices }) => ({ id: page.id, name: page.name, seconds: page.seconds, look, ...(Object.keys(devices).length ? { devices } : {}) })),
  ];
  return { ...board, partPages: pages };
}

/**
 * Page `from` copied onto page `to`: its kit, frames, content and screen
 * settings - to start a page from another one already made.
 */
export function copyPage(c: TvConfig, from: number, to: number): TvConfig {
  const list = looks(c);
  if (!list[from] || !list[to] || from === to) return c;
  list[to] = { ...list[to], look: structuredClone(list[from].look), devices: structuredClone(list[from].devices) };
  return rebuild(c, list);
}

const newPageId = (c: TvConfig) => {
  const taken = new Set(readPages(c).map(p => p.id));
  let n = readPages(c).length + 1;
  while (taken.has(`page${n}`)) n++;
  return `page${n}`;
};

/**
 * A new page after the last, a copy of page `from` - its kit, frames and
 * content, to be changed from there. Its index, to open it.
 */
export function addPage(c: TvConfig, from: number): { config: TvConfig; index: number } {
  const list = looks(c);
  if (list.length >= MAX_PAGES) return { config: c, index: from };
  const source = list[Math.min(from, list.length - 1)];
  const page: PartPage = { id: newPageId(c), name: `עמוד ${list.length + 1}`, seconds: source.page.seconds };
  return { config: rebuild(c, [...list, { page, look: structuredClone(source.look), devices: structuredClone(source.devices) }]), index: list.length };
}

/** A page taken off. The first one taken off: the next becomes the board. */
export function removePage(c: TvConfig, i: number): TvConfig {
  const list = looks(c);
  if (list.length < 2 || !list[i]) return c;
  return rebuild(c, list.filter((_, j) => j !== i));
}

/** A page moved one place earlier (-1) or later (+1) in the turns. */
export function movePage(c: TvConfig, i: number, by: -1 | 1): TvConfig {
  const list = looks(c);
  const j = i + by;
  if (!list[i] || !list[j]) return c;
  [list[i], list[j]] = [list[j], list[i]];
  return rebuild(c, list);
}

/** A page's name or seconds. */
export function setPage(c: TvConfig, i: number, patch: { name?: string; seconds?: number }): TvConfig {
  const list = looks(c);
  if (!list[i]) return c;
  const p = list[i].page;
  list[i] = { ...list[i], page: { ...p, ...(patch.name !== undefined ? { name: patch.name.slice(0, 40) } : {}), ...(patch.seconds !== undefined ? { seconds: Math.round(Math.max(5, Math.min(3600, patch.seconds))) } : {}) } };
  // One page keeps its seconds too (for when a second one comes), so it is written down.
  return list.length < 2 ? { ...c, partPages: [list[0].page] } : rebuild(c, list);
}

/** The page on the wall now: the same on every screen, read off the clock. */
export function pageAt(c: TvConfig, now: Date): number {
  const pages = readPages(c);
  if (pages.length < 2) return 0;
  const total = pages.reduce((s, p) => s + p.seconds, 0);
  let t = Math.floor(now.getTime() / 1000) % total;
  for (let i = 0; i < pages.length; i++) {
    if (t < pages[i].seconds) return i;
    t -= pages[i].seconds;
  }
  return 0;
}
