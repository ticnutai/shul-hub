import { useRef, useState, type CSSProperties, type ReactNode } from "react";

export type FloatPos = { x: number; y: number };

/**
 * A floating button that can be dragged anywhere on the screen, by finger or
 * mouse, and stays where it was put (pos: its top-left corner as a share of
 * the screen, so it keeps its place when the screen turns). A tap is still a
 * tap; only a drag of more than a few pixels moves it, and that drag does not
 * also press the button. Until it is first moved it stands where `home` puts it.
 *
 * The movement is followed on the whole window from the press on: a quick
 * finger leaves the button's edge before the drag is recognised. (Capturing
 * the pointer instead would send the closing click to this wrapper, and a tap
 * would no longer press the button.)
 */
export function FloatingDraggable({
  pos,
  onMove,
  home,
  children,
}: {
  pos?: FloatPos;
  onMove: (pos: FloatPos) => void;
  home: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const justDragged = useRef(false);
  const [live, setLive] = useState<{ left: number; top: number } | null>(null);

  const clamp = (left: number, top: number) => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 56, h = el?.offsetHeight ?? 56;
    return { left: Math.min(Math.max(4, left), window.innerWidth - w - 4), top: Math.min(Math.max(4, top), window.innerHeight - h - 4) };
  };

  const placed = live ?? (pos ? clamp(pos.x * window.innerWidth, pos.y * window.innerHeight) : null);
  const style: CSSProperties = placed
    ? { position: "fixed", left: placed.left, top: placed.top, zIndex: 50, touchAction: "none" }
    : { position: "fixed", zIndex: 50, touchAction: "none", ...home };

  const start = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const r = ref.current!.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top, sx = e.clientX, sy = e.clientY;
    let moved = false;
    let last: { left: number; top: number } | null = null;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
      moved = true;
      ev.preventDefault();
      last = clamp(ev.clientX - dx, ev.clientY - dy);
      setLive(last);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (moved && last) {
        justDragged.current = true;
        // A click may not follow the drag at all: forget the guard soon after.
        window.setTimeout(() => (justDragged.current = false), 400);
        onMove({ x: last.left / window.innerWidth, y: last.top / window.innerHeight });
      }
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  return (
    <div
      ref={ref}
      style={style}
      onPointerDown={start}
      onClickCapture={(e) => {
        // The click that ends a drag does not press the button.
        if (justDragged.current) {
          justDragged.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {children}
    </div>
  );
}
