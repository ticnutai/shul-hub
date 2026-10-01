import { BLOCK_BY_ID } from "./blocks";
import type { BlockEntry, BlockId, ScreenRow } from "./config";
import { place } from "./screens";

/**
 * A screen's blocks as rows: either as the gabbai arranged them by hand in
 * the composer's sketch (Screen.grid), or as the areas place them.
 *
 * The hand arrangement is a list of rows, top to bottom, each with up to
 * three blocks right to left, a width for each and a height for the row.
 * It is kept to that shape on purpose: rows that fill the screen are what
 * every TV, from the phone-sized preview to a 65" wall, draws the same way;
 * free rectangles would overlap or leave holes at another size.
 *
 * What is on the screen decides, not the arrangement: a block switched off
 * drops out of its row (and an emptied row goes), a block switched on that
 * the arrangement does not know joins at the bottom, placed as before.
 */
export interface PlacedRow {
  entries: BlockEntry[];
  widths: number[];
  height: number;
}

export const MAX_PER_ROW = 3;
const MIN_SHARE = 0.15;
const MIN_HEIGHT = 0.4;
const MAX_HEIGHT = 3;

const isMain = (id: BlockId) => BLOCK_BY_ID[id]?.zone === "main";

export function arrange(blocks: BlockEntry[], grid?: ScreenRow[]): PlacedRow[] {
  const main = blocks.filter((e) => isMain(e.block));
  const auto = (entries: BlockEntry[]): PlacedRow[] =>
    place(entries).map((row) => ({ entries: row, widths: row.map(() => 1), height: 1 }));
  if (!grid?.length) return auto(main);

  const used = new Set<BlockId>();
  const rows: PlacedRow[] = [];
  for (const row of grid) {
    const entries: BlockEntry[] = [];
    const widths: number[] = [];
    row.blocks.forEach((id, i) => {
      const entry = main.find((e) => e.block === id);
      if (!entry || used.has(id)) return;
      used.add(id);
      entries.push(entry);
      widths.push(row.widths[i] ?? 1);
    });
    if (entries.length) rows.push({ entries, widths, height: row.height });
  }
  return [...rows, ...auto(main.filter((e) => !used.has(e.block)))];
}

/** The rows as a hand arrangement, to be edited and stored. */
export function gridOf(rows: PlacedRow[]): ScreenRow[] {
  return rows.map((r) => ({ blocks: r.entries.map((e) => e.block), widths: [...r.widths], height: r.height }));
}

/** Where a dragged block lands: beside others in a row, or a row of its own. */
export type DropTarget = { row: number; index: number } | { newRowAt: number };

/**
 * The arrangement with `block` moved to `target`, or null when it cannot go
 * there (a row of three is full). The block keeps its width when it stays in
 * its row; in another row it takes the average width there, so the others
 * keep the proportions they had.
 */
export function moveBlock(grid: ScreenRow[], block: BlockId, target: DropTarget): ScreenRow[] | null {
  const from = grid.findIndex((r) => r.blocks.includes(block));
  if (from < 0) return null;
  const rows = grid.map((r) => ({ ...r, blocks: [...r.blocks], widths: [...r.widths] }));
  const fromRow = rows[from];
  const at = fromRow.blocks.indexOf(block);
  const ownWidth = fromRow.widths[at];

  if ("newRowAt" in target) {
    fromRow.blocks.splice(at, 1);
    fromRow.widths.splice(at, 1);
    rows.splice(target.newRowAt, 0, { blocks: [block], widths: [1], height: fromRow.height });
    return rows.filter((r) => r.blocks.length);
  }

  const same = target.row === from;
  const dest = rows[target.row];
  if (!dest) return null;
  if (!same && dest.blocks.length >= MAX_PER_ROW) return null;
  fromRow.blocks.splice(at, 1);
  fromRow.widths.splice(at, 1);
  // Moving along its own row, the slots after it shifted by one.
  const index = same && target.index > at ? target.index - 1 : target.index;
  const width = same ? ownWidth : dest.widths.length ? dest.widths.reduce((a, b) => a + b, 0) / dest.widths.length : 1;
  dest.blocks.splice(index, 0, block);
  dest.widths.splice(index, 0, width);
  return rows.filter((r) => r.blocks.length);
}

/**
 * The boundary between block `i` and block `i + 1` of a row moved: `share`
 * is how much of the two blocks' width goes to the first. Neither goes under
 * 15% of the two, or it would be a sliver nobody can read.
 */
export function setShare(grid: ScreenRow[], row: number, i: number, share: number): ScreenRow[] {
  return grid.map((r, k) => {
    if (k !== row || i + 1 >= r.widths.length) return r;
    const pair = r.widths[i] + r.widths[i + 1];
    const s = Math.min(1 - MIN_SHARE, Math.max(MIN_SHARE, share));
    const widths = [...r.widths];
    widths[i] = round(pair * s);
    widths[i + 1] = round(pair - widths[i]);
    return { ...r, widths };
  });
}

/**
 * The line between row `row` and the row under it moved: `share` is how much
 * of the two rows' height goes to the upper one. What one gains the other
 * gives up, so the rest of the screen stays where it was. Neither goes under
 * 15% of the two.
 */
export function setRowShare(grid: ScreenRow[], row: number, share: number): ScreenRow[] {
  if (row < 0 || row + 1 >= grid.length) return grid;
  const pair = grid[row].height + grid[row + 1].height;
  const s = Math.min(1 - MIN_SHARE, Math.max(MIN_SHARE, share));
  const upper = round(pair * s);
  return grid.map((r, k) => (k === row ? { ...r, height: upper } : k === row + 1 ? { ...r, height: round(pair - upper) } : r));
}

/** A row's height against the others, between 0.4 and 3. */
export function setHeight(grid: ScreenRow[], row: number, height: number): ScreenRow[] {
  return grid.map((r, k) => (k === row ? { ...r, height: round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height))) } : r));
}

/** Each block's share of its row, as whole percents (for the composer's messages). */
export function percents(widths: number[]): number[] {
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  const out = widths.map((w) => Math.round((w / total) * 100));
  // Whatever the rounding, they add up to the whole row.
  if (out.length) out[out.length - 1] = 100 - out.slice(0, -1).reduce((a, b) => a + b, 0);
  return out;
}

/** CSS grid tracks for the widths or heights. */
export function tracks(sizes: number[]): string {
  return sizes.map((s) => `minmax(0, ${s}fr)`).join(" ");
}

const round = (v: number) => Math.round(v * 100) / 100;
