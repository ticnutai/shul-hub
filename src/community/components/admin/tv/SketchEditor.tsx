import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Move } from "lucide-react";

import { BLOCK_BY_ID } from "@/tv/blocks";
import type { BlockId, ScreenRow } from "@/tv/config";
import {
  gridOf,
  moveBlock,
  percents,
  setRowShare,
  setShare,
  tracks,
  type DropTarget,
  type PlacedRow,
} from "@/tv/grid";
import { SPACING_MAX } from "@/tv/config";

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
export const SKETCH_HINT =
  "גררו מסגרת כדי להזיז אותה. משכו בקו שבין שתי מסגרות כדי לשנות רוחב, ובקו שבין שתי שורות כדי לשנות גובה. הקו שמעל השורה הראשונה ומתחת לאחרונה - המרווח מלמעלה ומלמטה.";

type Indicator = { left: number; top: number; width: number; height: number };

type Edge = "top" | "bottom";

export function SketchEditor({
  rows,
  manual,
  onChange,
  onMessage: setMessage,
  spacing,
  onSpacing,
}: {
  rows: PlacedRow[];
  /** The screen already has a hand arrangement. */
  manual: boolean;
  onChange: (grid: ScreenRow[]) => void;
  /** The line under the sketch: what is about to happen, and what did. */
  onMessage: (message: string) => void;
  /**
   * The air above the first row and under the last, in board units (the
   * board's "מרווח עליון" / "מרווח תחתון"): what is set, and what the board
   * draws when nothing is. Drawn in the sketch to scale, and dragged there.
   */
  spacing: { top: number | null; bottom: number | null; fallback: Record<Edge, number> };
  /** A new value for an edge; null hands it back to the design. */
  onSpacing: (edge: Edge, value: number | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  /**
   * The whole board's height in the sketch, in pixels (100 board units),
   * read when a drag starts. The air itself is drawn in cqh of the sketch
   * (ScreenComposer makes it a size container), so it is in place from the
   * first paint - a measured size arrived a moment later and moved every row
   * under a pointer that had already aimed at it.
   */
  const boardPx = () => area.current?.closest<HTMLElement>("[data-testid='composer-sketch']")?.clientHeight ?? 0;
  const air = (edge: Edge) => spacing[edge] ?? spacing.fallback[edge];
  const [drag, setDrag] = useState<{
    block: BlockId;
    x: number;
    y: number;
    indicator: Indicator | null;
  } | null>(null);
  const pending = useRef<{
    block: BlockId;
    x: number;
    y: number;
    started: boolean;
    target: DropTarget | null;
  } | null>(null);
  const resizing = useRef<
    | null
    | { kind: "width"; row: number; i: number; right: number; left: number; grid: ScreenRow[] }
    | { kind: "rows"; row: number; top: number; bottom: number; grid: ScreenRow[] }
    | { kind: "space"; edge: Edge; y: number; start: number; px: number }
  >(null);

  const name = (id: BlockId) => `«${BLOCK_BY_ID[id].name}»`;
  const grid = gridOf(rows);

  /* ------------------------------------------------------- hit testing -- */
  const rowEls = () => [...(box.current?.querySelectorAll<HTMLElement>("[data-sketch-row]") ?? [])];
  const cellEls = (row: HTMLElement) => [
    ...row.querySelectorAll<HTMLElement>("[data-sketch-cell]"),
  ];

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
      const top =
        above && below ? (above.bottom + below.top) / 2 : below ? below.top - 3 : above!.bottom + 1;
      const ref = (below ?? above)!;
      return {
        target: { newRowAt: k } as DropTarget,
        indicator: line(ref.left, top - 2, ref.width, 4),
      };
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
        index === 0
          ? cells[0].right + 1
          : index === cells.length
          ? cells[cells.length - 1].left - 3
          : (cells[index - 1].left + cells[index].right) / 2 - 1;
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
    // Focused for the arrow keys, but without the browser's scroll-into-view:
    // that moved the whole sketch under a pointer that had already aimed.
    e.currentTarget.focus({ preventScroll: true });
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
    const same =
      result &&
      JSON.stringify(result.map((r) => r.blocks)) === JSON.stringify(grid.map((r) => r.blocks));
    setMessage(
      !hit
        ? `גוררים את ${name(p.block)}`
        : !result
        ? `השורה הזו מלאה - שלוש מסגרות לכל היותר בשורה`
        : same
        ? `${name(p.block)} כבר נמצא כאן`
        : `שחררו כדי לשים את ${name(p.block)} ${describe(p.block, hit.target)}`,
    );
    setDrag({
      block: p.block,
      x: e.clientX,
      y: e.clientY,
      indicator: result && !same ? hit!.indicator : null,
    });
  };
  const cellUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = pending.current;
    pending.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
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
    const beside = blocks[i - 1]
      ? `, משמאל ל${name(blocks[i - 1])}`
      : blocks[i + 1]
      ? `, מימין ל${name(blocks[i + 1])}`
      : " - לבד בשורה";
    setMessage(
      `${name(p.block)} עבר לשורה ${row + 1}${beside}. אפשר לבטל ב"ביטול שינויים" או בחץ החזרה.`,
    );
  };

  /* ------------------------------------------------------------ resize -- */
  const widthDown = (row: number, i: number) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const cells = cellEls(rowEls()[row]).map((c) => c.getBoundingClientRect());
    resizing.current = {
      kind: "width",
      row,
      i,
      right: cells[i].right,
      left: cells[i + 1].left,
      grid,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  /** The line between row `row` and the next: the two share their height between them. */
  const rowsDown = (row: number) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const els = rowEls();
    resizing.current = {
      kind: "rows",
      row,
      top: els[row].getBoundingClientRect().top,
      bottom: els[row + 1].getBoundingClientRect().bottom,
      grid,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  /** Above the first row, or under the last: the board's air at that edge. */
  const spaceDown = (edge: Edge) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    resizing.current = { kind: "space", edge, y: e.clientY, start: air(edge), px: boardPx() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const spaceMessage = (edge: Edge, value: number | null) =>
    `${edge === "top" ? "מרווח עליון (מעל הלוחות)" : "מרווח תחתון (מתחת ללוחות)"}: ${
      value === null ? "כמו בעיצוב" : value
    }`;
  const rowsMessage = (next: ScreenRow[], row: number) => {
    const p = percents([next[row].height, next[row + 1].height]);
    return `גובה: שורה ${row + 1} - ${p[0]}% · שורה ${row + 2} - ${p[1]}% (מהשתיים)`;
  };
  const resizeMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = resizing.current;
    if (!r) return;
    if (r.kind === "width") {
      const next = setShare(
        r.grid,
        r.row,
        r.i,
        (r.right - e.clientX) / Math.max(1, r.right - r.left),
      );
      onChange(next);
      const p = percents(next[r.row].widths);
      setMessage(
        `רוחב בשורה ${r.row + 1}: ` +
          next[r.row].blocks.map((b, k) => `${name(b)} ${p[k]}%`).join(" · "),
      );
    } else if (r.kind === "rows") {
      const next = setRowShare(r.grid, r.row, (e.clientY - r.top) / Math.max(1, r.bottom - r.top));
      onChange(next);
      setMessage(rowsMessage(next, r.row));
    } else {
      if (!r.px) return;
      // Down opens the top and closes the bottom; 100 units are the board's height.
      const units = ((e.clientY - r.y) * 100) / r.px;
      const raw = r.edge === "top" ? r.start + units : r.start - units;
      const value = Math.round(Math.min(SPACING_MAX, Math.max(0, raw)) * 10) / 10;
      onSpacing(r.edge, value);
      setMessage(spaceMessage(r.edge, value));
    }
  };
  const resizeUp = (e: PointerEvent<HTMLDivElement>) => {
    resizing.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const handle = { onPointerMove: resizeMove, onPointerUp: resizeUp, onPointerCancel: resizeUp };

  /* ---------------------------------------------------------- keyboard -- */
  /**
   * The same, without a mouse: a block in focus moves with the arrows - right
   * and left along its row, up and down between rows - and with Shift the
   * arrows size it: right and left its width against its neighbour, up and
   * down its row's height. The focus stays on the block where it went.
   */
  const [focusBlock, setFocusBlock] = useState<BlockId | null>(null);
  // The focus put back after a move is not news: it must not replace the line saying where the block went.
  const restoring = useRef(false);
  useEffect(() => {
    const el = focusBlock
      ? box.current?.querySelector<HTMLElement>(`[data-sketch-cell="${focusBlock}"]`)
      : null;
    if (!el || el === document.activeElement) return;
    restoring.current = true;
    el.focus();
    restoring.current = false;
  }, [focusBlock, rows]);

  const keyDown = (block: BlockId, r: number, i: number) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const row = grid[r];
    if (e.shiftKey) {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        // Taller (down) or shorter (up), against the row it shares a line with.
        if (grid.length < 2) return setMessage("שורה אחת תופסת את כל הגובה");
        const pair = r < grid.length - 1 ? r : r - 1;
        const share = grid[pair].height / (grid[pair].height + grid[pair + 1].height);
        const taller = e.key === "ArrowDown" ? 0.05 : -0.05;
        const next = setRowShare(grid, pair, share + (pair === r ? taller : -taller));
        onChange(next);
        setMessage(rowsMessage(next, pair));
        return;
      }
      // Its width against the block to its left, or - for the last - to its right.
      const pair = i < row.blocks.length - 1 ? i : i - 1;
      if (pair < 0) return setMessage(`${name(block)} לבד בשורה, ותופס את כל הרוחב`);
      const share = row.widths[pair] / (row.widths[pair] + row.widths[pair + 1]);
      // Growing this block: towards the side the arrow points to, which is its neighbour.
      const grow = (e.key === "ArrowLeft") === (pair === i);
      const delta = (grow ? 1 : -1) * (pair === i ? 0.05 : -0.05);
      const next = setShare(grid, r, pair, share + delta);
      onChange(next);
      const p = percents(next[r].widths);
      setMessage(
        `רוחב בשורה ${r + 1}: ` + next[r].blocks.map((b, k) => `${name(b)} ${p[k]}%`).join(" · "),
      );
      return;
    }
    let target: DropTarget | null = null;
    if (e.key === "ArrowRight") target = i > 0 ? { row: r, index: i - 1 } : null;
    if (e.key === "ArrowLeft") target = i < row.blocks.length - 1 ? { row: r, index: i + 2 } : null;
    if (e.key === "ArrowUp") {
      if (r > 0 && grid[r - 1].blocks.length < 3)
        target = { row: r - 1, index: grid[r - 1].blocks.length };
      else if (row.blocks.length > 1 || r > 0)
        target = { newRowAt: r > 0 && row.blocks.length === 1 ? r - 1 : r };
    }
    if (e.key === "ArrowDown") {
      if (r < grid.length - 1 && grid[r + 1].blocks.length < 3)
        target = { row: r + 1, index: grid[r + 1].blocks.length };
      else if (row.blocks.length > 1 || r < grid.length - 1)
        target = { newRowAt: row.blocks.length === 1 ? r + 2 : r + 1 };
    }
    const result = target ? moveBlock(grid, block, target) : null;
    if (
      !result ||
      JSON.stringify(result.map((x) => x.blocks)) === JSON.stringify(grid.map((x) => x.blocks))
    ) {
      setMessage(`${name(block)} כבר בקצה`);
      return;
    }
    onChange(result);
    setFocusBlock(block);
    const at = result.findIndex((x) => x.blocks.includes(block));
    const blocks = result[at].blocks;
    const k = blocks.indexOf(block);
    const beside = blocks[k - 1]
      ? `, משמאל ל${name(blocks[k - 1])}`
      : blocks[k + 1]
      ? `, מימין ל${name(blocks[k + 1])}`
      : " - לבד בשורה";
    setMessage(`${name(block)} בשורה ${at + 1}${beside}`);
  };

  /** A handle across the sketch: above the first row, under the last, or between two rows. */
  const lineHandle = (props: {
    id: string;
    label: string;
    title: string;
    className: string;
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
    onDoubleClick?: () => void;
  }) => (
    <div
      data-sketch-handle={props.id}
      role="separator"
      aria-orientation="horizontal"
      aria-label={props.label}
      title={props.title}
      className={`absolute left-[12%] right-[12%] z-10 h-2.5 cursor-ns-resize rounded bg-[#f0c35c]/0 hover:bg-[#f0c35c]/70 ${props.className}`}
      onPointerDown={props.onPointerDown}
      onDoubleClick={props.onDoubleClick}
      {...handle}
    />
  );

  return (
    <div
      ref={area}
      className="relative flex min-h-0 flex-1 flex-col"
      // The air above and below, to scale: what the board will leave empty.
      style={{ paddingTop: `${air("top")}cqh`, paddingBottom: `${air("bottom")}cqh` }}
    >
      {lineHandle({
        id: "space-top",
        label: "מרווח מעל הלוחות",
        title: "גררו למטה כדי להוריד את כל הלוחות; לחיצה כפולה - כמו בעיצוב",
        className: "top-0",
        onPointerDown: spaceDown("top"),
        onDoubleClick: () => {
          onSpacing("top", null);
          setMessage(spaceMessage("top", null));
        },
      })}
      <div
        ref={box}
        className="relative grid min-h-0 flex-1 gap-1.5"
        style={{ gridTemplateRows: tracks(rows.map((r) => r.height)) }}
      >
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
                  tabIndex={0}
                  aria-label={`${
                    BLOCK_BY_ID[e.block].name
                  } - גררו כדי להזיז, או חיצים (עם Shift: גודל)`}
                  onKeyDown={keyDown(e.block, r, i)}
                  onFocus={() => {
                    if (!restoring.current)
                      setMessage(
                        `${BLOCK_BY_ID[e.block].name}: חיצים מזיזים, Shift וחיצים משנים גודל`,
                      );
                  }}
                  className={`relative min-w-0 cursor-grab touch-none select-none rounded outline-none focus-visible:ring-2 focus-visible:ring-sky-400 border border-[#f0c35c]/35 bg-white/5 px-2 py-1 text-[11px] transition-colors hover:border-[#f0c35c]/80 hover:bg-white/10 active:cursor-grabbing ${
                    drag?.block === e.block ? "opacity-40" : ""
                  }`}
                  onPointerDown={cellDown(e.block)}
                  // The press itself does not focus (and scroll); cellDown does, in place.
                  onMouseDown={(ev) => ev.preventDefault()}
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
                      aria-label={`רוחב ${BLOCK_BY_ID[e.block].name} מול ${
                        BLOCK_BY_ID[row.entries[i + 1].block].name
                      }`}
                      title="גררו כדי לחלק את השורה אחרת"
                      className="absolute -left-[7px] bottom-1 top-1 z-10 w-2.5 cursor-ew-resize rounded bg-[#f0c35c]/0 hover:bg-[#f0c35c]/70"
                      onPointerDown={widthDown(r, i)}
                      {...handle}
                    />
                  )}
                </div>
              ))}
              {/* The line under this row, shared with the next: one grows by what the other gives. */}
              {r < rows.length - 1 &&
                lineHandle({
                  id: "rows",
                  label: `הקו בין שורה ${r + 1} לשורה ${r + 2}`,
                  title: "גררו כדי לחלק את הגובה בין שתי השורות",
                  className: "-bottom-[6px]",
                  onPointerDown: rowsDown(r),
                })}
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
      {lineHandle({
        id: "space-bottom",
        label: "מרווח מתחת ללוחות",
        title: "גררו למעלה כדי להרחיק את הלוחות מהשורה התחתונה; לחיצה כפולה - כמו בעיצוב",
        className: "bottom-0",
        onPointerDown: spaceDown("bottom"),
        onDoubleClick: () => {
          onSpacing("bottom", null);
          setMessage(spaceMessage("bottom", null));
        },
      })}
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
