import { useSyncExternalStore } from 'react';

/**
 * The editor's hold on the board's lists that turn their pages (prayers that do
 * not fit their container together, and take turns): held, every list stands
 * on the page with its "הבא בתור" - to dress the mark without waiting for it to
 * come round - and is turned by hand. Only the editor sets it; a screen's lists
 * turn as always.
 */
export interface ListPaging {
  paused: boolean;
  /** Pages turned by hand from the page of "הבא". */
  shift: number;
}

let state: ListPaging = { paused: false, shift: 0 };
const listeners = new Set<() => void>();

export function setListPaging(next: ListPaging | ((s: ListPaging) => ListPaging)) {
  state = typeof next === 'function' ? next(state) : next;
  listeners.forEach((l) => l());
}

export function useListPaging(): ListPaging {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** Which page a list shows: turning by the clock, or held on the page of "הבא" and turned by hand. */
export function listPage(pages: number, per: number, next: number, now: Date, paging: ListPaging): number {
  if (!paging.paused) return Math.floor(now.getTime() / 15000) % pages;
  const base = next >= 0 ? Math.floor(next / per) : 0;
  return (((base + paging.shift) % pages) + pages) % pages;
}
