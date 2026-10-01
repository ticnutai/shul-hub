import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Move } from "lucide-react";

import { BLOCK_BY_ID } from "@/tv/blocks";
import type { BlockId, ScreenRow } from "@/tv/config";
import { gridOf, moveBlock, percents, setHeight, setShare, tracks, type DropTarget, type PlacedRow } from "@/tv/grid";

/**
 * The composer's sketch of a screen, worked by hand: a block is dragged to
 * another place (beside another block, or a row of its own), the edge
 * between two blocks is dragged to give one more of the row, and the bottom
 * of a row to make it taller. A line under the sketch says what is about to
 * happen and what did, so a drop is never a surprise.
 *
 * The first touch turns the screen's automatic arrangement into a hand one
 * (Screen.grid); "סידור אוטומטי" gives it back. Every change goes through
 * `onChange` at once - the board beside it follows the drag - and the
 * editor's undo folds a drag into one step.
 */
export const SKETCH_HINT = "גררו מסגרת כדי להזיז אותה. משכו בקצה שבין שתי מסגרות כדי לשנות רוחב, ובקצה התחתון של שורה כדי לשנות גובה.";

type Indicator = { left: number; top: number; width: number; height: number };

export function SketchEditor({
  rows,
  manual,
  onChange,
  onMessage: setMessage,
}: {
  rows: PlacedRow[];
  /** The screen already has a hand arrangement. */
  manual: boolean;
  onChange: (grid: ScreenRow[]) => void;
  /** The line under the sketch: what is about to happen, and what did. */
  onMessage: (message: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ block: BlockId; x: number; y: number; indicator: Indicator | null } | null>(null);
  const pending = useRef<{ block: BlockId; x: number; y: number; started: boolean; target: DropTarget | null } | null>(null);
  const resizing = useRef<null | { kind: "width"; row: number; i: number; right: number; left: number; grid: ScreenRow[] } | { kind: "height"; row: number; px: number; y: number; grid: ScreenRow[] }>(null);

  const name = (id: BlockId) => `«${BLOCK_BY_ID[id].name}»`;
  const grid = gridOf(rows);

  /* ------------------------------------------------------- hit testing -- */
  const rowEls = () => [...(box.current?.querySelectorAll<HTMLElement>("[data-sketch-row]") ?? [])];
  const cellEls = (row: HTMLElement) => [...row.querySelectorAll<HTMLElement>("[data-sketch-cell]")];

  /** Where a block let go at (x, y) would land, and the line that shows it. */
  const targetAt = (x: number, y: number): { target: DropTarget; indicator: Indicator } | null => {
    const frame = box.current?.getBoundingClientRect();
    const els = rowEls();
    if (!frame || !els.length) return null;
    const line = (left: number, top: number, width: number, height: number): Indicator => ({
      left: left - frame.left,
      top: top - frame.top,
      width,
      height,
    });
    const between = (k: number) => {
      // A new row: a line across, above row k (or under the last).
      const above = els[k - 1]?.getBoundingClientRect();
      const below = els[k]?.getBoundingClientRect();
      const top = above && below ? (above.bottom + below.top) / 2 : below ? below.top - 3 : above!.bottom + 1;
      const ref = (below ?? above)!;
      return { target: { newRowAt: k } as DropTarget, indicator: line(ref.left, top - 2, ref.width, 4) };
    };
    for (let r = 0; r < els.length; r += 1) {
      const rect = els[r].getBoundingClientRect();
      if (y < rect.top) return between(r);
      if (y > rect.bottom) continue;
      const edge = Math.min(14, rect.height * 0.22);
      if (y < rect.top + edge) return between(r);
      if (y > rect.bottom - edge) return between(r + 1);
      const cells = cellEls(els[r]).map((c) => c.getBoundingClientRect());
      // Right to left: the slot is the number of blocks whose middle is to the pointer's right.
      const index = cells.filter((c) => c.left + c.width / 2 > x).length;
      const xLine =
        index === 0 ? cells[0].right + 1 : index === cells.length ? cells[cells.length - 1].left - 3 : (cells[index - 1].left + cells[index].right) / 2 - 1;
      return { target: { row: r, index }, indicator: line(xLine, rect.top, 4, rect.height) };
    }
    return between(els.length);
  };

  /** What a target means, in words. */
  const describe = (block: BlockId, target: DropTarget): string => {
    if ("newRowAt" in target) {
      const k = target.newRowAt;
      if (k === 0) return `בשורה חדשה, למעלה`;
      if (k >= rows.length) return `בשורה חדשה, למטה`;
      return `בשורה חדשה, בין שורה ${k} לשורה ${k + 1}`;
    }
    const others = grid[target.row].blocks.filter((b) => b !== block);
    const at = grid[target.row].blocks.indexOf(block);
    const index = at >= 0 && target.index > at ? target.index - 1 : target.index;
    const right = others[index - 1];
    const left = others[index];
    if (right) return `בשורה ${target.row + 1}, משמאל ל${name(right)}`;
    if (left) return `בשורה ${target.row + 1}, מימין ל${name(left)}`;
    return `בשורה ${target.row + 1}`;
  };

  /* -------------------------------------------------------------- move -- */
  const cellDown = (block: BlockId) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-sketch-handle]")) return;
    pending.current = { block, x: e.clientX, y: e.clientY, started: false, target: null };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const cellMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = pending.current;
    if (!p) return;
    if (!p.started && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return;
    p.started = true;
    const hit = targetAt(e.clientX, e.clientY);
    p.target = hit?.target ?? null;
    const result = hit ? moveBlock(grid, p.block, hit.target) : null;
    const same = result && JSON.stringify(result.map((r) => r.blocks)) === JSON.stringify(grid.map((r) => r.blocks));
    setMessage(
      !hit
        ? `גוררים את ${name(p.block)}`
        : !result
          ? `השורה הזו מלאה - שלוש מסגרות לכל היותר בשורה`
          : same
            ? `${name(p.block)} כבר נמצא כאן`
            : `שחררו כדי לשים את ${name(p.block)} ${describe(p.block, hit.target)}`,
    );
    setDrag({ block: p.block, x: e.clientX, y: e.clientY, indicator: result && !same ? hit!.indicator : null });
  };
  const cellUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = pending.current;
    pending.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDrag(null);
    if (!p?.started) return;
    const result = p.target ? moveBlock(grid, p.block, p.target) : null;
    if (!result) {
      setMessage(p.target ? "לא הוזז: השורה מלאה" : SKETCH_HINT);
      return;
    }
    if (JSON.stringify(result.map((r) => r.blocks)) === JSON.stringify(grid.map((r) => r.blocks))) {
      setMessage(SKETCH_HINT);
      return;
    }
    onChange(result);
    const row = result.findIndex((r) => r.blocks.includes(p.block));
    const blocks = result[row].blocks;
    const i = blocks.indexOf(p.block);
    const beside = blocks[i - 1] ? `, משמאל ל${name(blocks[i - 1])}` : blocks[i + 1] ? `, מימין ל${name(blocks[i + 1])}` : " - לבד בשורה";
    setMessage(`${name(p.block)} עבר לשורה ${row + 1}${beside}. אפשר לבטל ב"ביטול שינויים" או בחץ החזרה.`);
  };

  /* ------------------------------------------------------------ resize -- */
  const widthDown = (row: number, i: number) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const cells = cellEls(rowEls()[row]).map((c) => c.getBoundingClientRect());
    resizing.current = { kind: "width", row, i, right: cells[i].right, left: cells[i + 1].left, grid };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const heightDown = (row: number) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    resizing.current = { kind: "height", row, px: rowEls()[row].getBoundingClientRect().height, y: e.clientY, grid };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const resizeMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = resizing.current;
    if (!r) return;
    if (r.kind === "width") {
      const next = setShare(r.grid, r.row, r.i, (r.right - e.clientX) / Math.max(1, r.right - r.left));
      onChange(next);
      const p = percents(next[r.row].widths);
      setMessage(`רוחב בשורה ${r.row + 1}: ` + next[r.row].blocks.map((b, k) => `${name(b)} ${p[k]}%`).join(" · "));
    } else {
      const start = r.grid[r.row].height;
      const next = setHeight(r.grid, r.row, start * ((r.px + (e.clientY - r.y)) / Math.max(1, r.px)));
      onChange(next);
      const h = next[r.row].height;
      setMessage(`גובה שורה ${r.row + 1}: ${h === 1 ? "רגיל" : `פי ${h} מהרגיל`}`);
    }
  };
  const resizeUp = (e: PointerEvent<HTMLDivElement>) => {
    resizing.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const handle = { onPointerMove: resizeMove, onPointerUp: resizeUp, onPointerCancel: resizeUp };

  return (
    <div className="flex min-h-0 flex-col gap-1">
      <div ref={box} className="relative grid min-h-0 flex-1 gap-1.5" style={{ gridTemplateRows: tracks(rows.map((r) => r.height)) }}>
        {rows.map((row, r) => {
          const p = percents(row.widths);
          const even = p.every((v) => Math.abs(v - p[0]) <= 1);
          return (
            <div
              key={r}
              data-sketch-row={r}
              className="relative grid min-h-0 gap-1.5"
              style={{ gridTemplateColumns: tracks(row.widths) }}
            >
              {row.entries.map((e, i) => (
                <div
                  key={e.block}
                  data-sketch-cell={e.block}
                  role="button"
                  tabIndex={-1}
                  aria-label={`${BLOCK_BY_ID[e.block].name} - גררו כדי להזיז`}
                  className={`relative min-w-0 cursor-grab touch-none select-none rounded border border-[#f0c35c]/35 bg-white/5 px-2 py-1 text-[11px] transition-colors hover:border-[#f0c35c]/80 hover:bg-white/10 active:cursor-grabbing ${
                    drag?.block === e.block ? "opacity-40" : ""
                  }`}
                  onPointerDown={cellDown(e.block)}
                  onPointerMove={cellMove}
                  onPointerUp={cellUp}
                  onPointerCancel={cellUp}
                >
                  {/* The name is cut, not the cell: the handle on its edge stands half outside it. */}
                  <span className="block truncate">
                    <Move className="me-1 inline size-3 opacity-50" aria-hidden />
                    {BLOCK_BY_ID[e.block].name}
                    {!even && <span className="ms-1 opacity-60">{p[i]}%</span>}
                    {e.area && !manual && <span className="opacity-60"> · נעוץ</span>}
                  </span>
                  {/* The edge with the block to its left: one more, the other less. */}
                  {i < row.entries.length - 1 && (
                    <div
                      data-sketch-handle="width"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`רוחב ${BLOCK_BY_ID[e.block].name} מול ${BLOCK_BY_ID[row.entries[i + 1].block].name}`}
                      title="גררו כדי לחלק את השורה אחרת"
                      className="absolute -left-[7px] bottom-1 top-1 z-10 w-2.5 cursor-ew-resize rounded bg-[#f0c35c]/0 hover:bg-[#f0c35c]/70"
                      onPointerDown={widthDown(r, i)}
                      {...handle}
                    />
                  )}
                </div>
              ))}
              <div
                data-sketch-handle="height"
                role="separator"
                aria-orientation="horizontal"
                aria-label={`גובה שורה ${r + 1}`}
                title="גררו כדי לשנות את גובה השורה"
                className="absolute -bottom-[6px] left-[15%] right-[15%] z-10 h-2.5 cursor-ns-resize rounded bg-[#f0c35c]/0 hover:bg-[#f0c35c]/70"
                onPointerDown={heightDown(r)}
                {...handle}
              />
            </div>
          );
        })}
        {drag?.indicator && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-20 rounded bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,.9)]"
            style={drag.indicator as CSSProperties}
          />
        )}
      </div>
      {drag && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[70] -translate-x-1/2 -translate-y-1/2 rounded border border-sky-400 bg-[#0b1628]/90 px-2 py-1 text-[11px] text-[#f0c35c] shadow-lg"
          style={{ left: drag.x, top: drag.y }}
        >
          {BLOCK_BY_ID[drag.block].name}
        </div>
      )}
    </div>
  );
}
