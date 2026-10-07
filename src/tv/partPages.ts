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

/** The board as page `i` shows it: page 1 is the board; any other, its look over the board. */
export function pageLook(c: TvConfig, i: number): TvConfig {
  const page = i > 0 ? c.partPages[i] : undefined;
  if (!page?.look) return c;
  // The page's look on every kind of screen: a phone's own copy of page 1's frames is page 1's.
  const perDevice = Object.fromEntries(Object.entries(c.perDevice).map(([d, o]) =>
    [d, o && Object.fromEntries(Object.entries(o).filter(([k]) => !PAGE_LOOK_KEYS.includes(k as keyof TvConfig)))])) as TvConfig['perDevice'];
  return { ...c, ...page.look, perDevice };
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
  board.perDevice = c.perDevice;
  return { ...board, partPages: c.partPages.map((p, j) => (j === i ? { ...p, look: pick(after) } : p)) };
}

/** Every page's look in order, the board's first: to reorder or remove pages without losing one. */
function looks(c: TvConfig) {
  return readPages(c).map((p, i) => ({ page: p, look: i === 0 ? pick(c) : p.look ?? pick(c) }));
}
function rebuild(c: TvConfig, list: ReturnType<typeof looks>): TvConfig {
  const [first, ...rest] = list;
  const board = { ...c, ...first.look } as TvConfig;
  const pages: PartPage[] = list.length < 2 ? [] : [
    { id: first.page.id, name: first.page.name, seconds: first.page.seconds },
    ...rest.map(({ page, look }) => ({ id: page.id, name: page.name, seconds: page.seconds, look })),
  ];
  return { ...board, partPages: pages };
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
  return { config: rebuild(c, [...list, { page, look: structuredClone(source.look) }]), index: list.length };
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
