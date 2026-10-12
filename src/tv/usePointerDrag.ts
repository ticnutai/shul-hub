import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";

/**
 * One drag with the pointer, the one way: the left button (or a finger)
 * goes down, the element holds the pointer until it is let go, every move
 * is reported with how far it came from where it began, and letting go -
 * or the browser taking the pointer away - ends it.
 *
 * It was written out by hand in the bar between the preview and the
 * controls, the handles around the board, the floating panel of the live
 * window, the colour dials, the joystick and the strip in the composer's
 * sketch: six copies of the same three handlers, each forgetting a
 * different part (one never let the pointer go, one never checked the
 * button). The board's own dragging of parts (TvPreview, BoardElements,
 * SketchEditor) is its own, with snapping and selection, and is not this.
 *
 *   const drag = usePointerDrag({ start: (edge, e) => ({ edge, w }), move: (s, at) => ... });
 *   <div {...drag("left")} />
 *
 * `start` answers whether this press is a drag at all (null: it is not -
 * the press is left to the page), and what to remember for it.
 */
export function usePointerDrag<A, S>({
  start,
  move,
  end,
  cursor,
}: {
  start: (arg: A, e: ReactPointerEvent<HTMLElement>) => S | null;
  move: (state: S, at: { x: number; y: number; dx: number; dy: number }, e: ReactPointerEvent<HTMLElement>) => void;
  end?: (state: S) => void;
  /** The page's cursor while dragging (the text under it is not selected meanwhile either). */
  cursor?: string;
}) {
  const latest = useRef({ start, move, end, cursor });
  latest.current = { start, move, end, cursor };
  const gesture = useRef<{ state: S; x: number; y: number } | null>(null);

  return useCallback((arg: A) => {
    const finish = (e: ReactPointerEvent<HTMLElement>) => {
      const g = gesture.current;
      if (!g) return;
      gesture.current = null;
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      latest.current.end?.(g.state);
    };
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        const state = latest.current.start(arg, e);
        if (state === null) return;
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* the pointer is already gone; the drag still works without holding it */
        }
        gesture.current = { state, x: e.clientX, y: e.clientY };
        if (latest.current.cursor) document.body.style.cursor = latest.current.cursor;
        document.body.style.userSelect = "none";
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        const g = gesture.current;
        if (!g) return;
        latest.current.move(g.state, { x: e.clientX, y: e.clientY, dx: e.clientX - g.x, dy: e.clientY - g.y }, e);
      },
      onPointerUp: finish,
      onPointerCancel: finish,
    };
  }, []);
}
