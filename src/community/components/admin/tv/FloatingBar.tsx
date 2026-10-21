/**
 * A small bar floating over the page - it stays in sight as the page
 * scrolls - dragged by its handle to wherever the gabbai wants it, and kept
 * there for the next visit (a double click on the handle puts it back in the
 * corner at the foot of the screen). The editor's save bar is one.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GripVertical } from "lucide-react";

type Spot = { x: number; y: number };

const read = (key: string): Spot | null => {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? v : null;
  } catch {
    return null;
  }
};

export function FloatingBar({ children, storageKey, testId, label }: { children: ReactNode; storageKey: string; testId?: string; label: string }) {
  // Where it stands, as shares of the window (so it stays in place when the window changes size); null - the corner at the foot of the screen.
  const [spot, setSpot] = useState<Spot | null>(() => read(storageKey));
  const box = useRef<HTMLDivElement>(null);
  const [, redraw] = useState(0);
  useEffect(() => {
    const on = () => redraw((n) => n + 1);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const keep = (v: Spot | null) => {
    setSpot(v);
    try {
      if (v) localStorage.setItem(storageKey, JSON.stringify(v));
      else localStorage.removeItem(storageKey);
    } catch {
      /* a private window: for this visit only */
    }
    // Said aloud, for what keeps it with the gabbai's account too (editorPrefs.ts).
    window.dispatchEvent(new Event(storageKey));
  };
  // Brought from the gabbai's account (another computer moved it): taken here too.
  useEffect(() => {
    const on = () => setSpot(read(storageKey));
    window.addEventListener(`${storageKey}:from-account`, on);
    return () => window.removeEventListener(`${storageKey}:from-account`, on);
  }, [storageKey]);
  /** In pixels, kept inside the window whatever was stored. */
  const place = () => {
    const el = box.current;
    const w = el?.offsetWidth ?? 420, h = el?.offsetHeight ?? 44;
    if (!spot) return null;
    return {
      left: Math.min(Math.max(4, spot.x * window.innerWidth), Math.max(4, window.innerWidth - w - 4)),
      top: Math.min(Math.max(4, spot.y * window.innerHeight), Math.max(4, window.innerHeight - h - 4)),
    };
  };
  const drag = (e: React.PointerEvent) => {
    const el = box.current;
    if (!el) return;
    e.preventDefault();
    const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    let last: Spot = { x: r.left / window.innerWidth, y: r.top / window.innerHeight };
    const move = (ev: PointerEvent) => {
      last = { x: (ev.clientX - dx) / window.innerWidth, y: (ev.clientY - dy) / window.innerHeight };
      setSpot(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      keep(last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const at = place();
  return createPortal(
    <div
      ref={box}
      dir="rtl"
      role="toolbar"
      aria-label={label}
      data-testid={testId}
      data-floating-bar
      className="fixed z-[45] flex max-w-[calc(100vw-8px)] flex-wrap items-center gap-1 rounded-full border bg-background/95 py-1 pe-1.5 ps-1 shadow-lg backdrop-blur"
      style={at ? { left: at.left, top: at.top } : { right: 12, bottom: 12 }}
    >
      <span
        className="flex h-7 w-5 cursor-grab touch-none items-center justify-center rounded-full text-muted-foreground hover:bg-muted active:cursor-grabbing"
        onPointerDown={drag}
        onDoubleClick={() => keep(null)}
        title="גרירה מזיזה את השורה לכל מקום; לחיצה כפולה מחזירה אותה לפינה למטה"
        aria-hidden
      >
        <GripVertical className="size-4" />
      </span>
      {children}
    </div>,
    document.body,
  );
}
