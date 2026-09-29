/**
 * The bar between the editor's preview and its controls, dragged to decide
 * which gets more room.
 *
 * A pointer drag, the arrow keys (5% a press), and a double click back to
 * where it started. What it moves is the caller's: it reports a position
 * along the container - a fraction across it, or pixels down it - and the
 * caller keeps it within its limits and remembers it.
 */
import { useRef, type KeyboardEvent, type PointerEvent } from "react";

export function SplitHandle({
  orientation,
  label,
  onDrag,
  onStep,
  onReset,
}: {
  /** "vertical": a bar between two columns. "horizontal": a bar between two rows. */
  orientation: "vertical" | "horizontal";
  label: string;
  /** Where the pointer is: clientX for a vertical bar, clientY for a horizontal one. */
  onDrag: (clientPos: number) => void;
  /** A key press: -1 or +1 (towards the start or the end of the screen). */
  onStep: (direction: -1 | 1) => void;
  onReset: () => void;
}) {
  const dragging = useRef(false);
  const vertical = orientation === "vertical";

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = vertical ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) onDrag(vertical ? e.clientX : e.clientY);
  };
  const up = () => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const back = vertical ? "ArrowLeft" : "ArrowUp";
    const forward = vertical ? "ArrowRight" : "ArrowDown";
    if (e.key === back || e.key === forward) {
      e.preventDefault();
      onStep(e.key === back ? -1 : 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      onReset();
    }
  };

  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={label}
      title={`${label} - גוררים כדי לשנות, לחיצה כפולה מחזירה לברירת המחדל`}
      tabIndex={0}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDoubleClick={onReset}
      onKeyDown={key}
      data-testid={`split-handle-${orientation}`}
      className={`group relative flex shrink-0 touch-none select-none items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
        vertical ? "w-3 cursor-col-resize self-stretch" : "h-3 w-full cursor-row-resize"
      }`}
    >
      <span
        aria-hidden
        className={`rounded-full bg-border transition-colors group-hover:bg-primary/60 group-active:bg-primary ${
          vertical ? "h-full w-1" : "h-1 w-full"
        }`}
      />
      <span
        aria-hidden
        className={`absolute flex items-center justify-center gap-0.5 rounded-md border bg-background shadow-sm group-hover:border-primary/60 ${
          vertical ? "h-10 w-3 flex-col" : "h-3 w-10"
        }`}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-0.5 rounded-full bg-muted-foreground" />
        ))}
      </span>
    </div>
  );
}
