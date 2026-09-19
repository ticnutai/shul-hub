import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  PanelLeft,
  PanelRight,
  PencilRuler,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The live editor's floating panel over the full-screen board: dragged by
 * its header, resized from its bottom corners, docked to either side,
 * collapsed to its header, or hidden behind a small button so the board can
 * be seen whole. Position and size are remembered in this browser only.
 *
 * Marked data-design-mode-ui, so the board's click-to-edit never picks the
 * panel's own controls.
 */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  collapsed: boolean;
  hidden: boolean;
}

const KEY = "shul-tv-studio-panel-v1";
const MIN_W = 380;
const MIN_H = 260;
const GAP = 12;
/** Below these a saved layout is treated as accidental and restored to the default size. */
const USEFUL_W = 460;
const USEFUL_H = 560;

function defaultBox(): Box {
  const w = Math.min(560, window.innerWidth - GAP * 2);
  return {
    x: window.innerWidth - w - GAP,
    y: GAP,
    w,
    h: window.innerHeight - GAP * 2,
    collapsed: false,
    hidden: false,
  };
}

/** Keeps the panel usable and on screen after a reload on a smaller window. */
function fit(b: Box): Box {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(Math.max(MIN_W, b.w), vw - GAP * 2);
  const h = Math.min(Math.max(MIN_H, b.h), vh - GAP * 2);
  return {
    ...b,
    w,
    h,
    x: Math.min(Math.max(GAP, b.x), vw - w - GAP),
    y: Math.min(Math.max(GAP, b.y), vh - 48),
  };
}

function load(): Box {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (
      raw &&
      [raw.x, raw.y, raw.w, raw.h].every((n) => typeof n === "number" && Number.isFinite(n))
    ) {
      // A layout saved in a small window is migrated back up to a useful size.
      const d = defaultBox();
      const w = raw.w < USEFUL_W ? d.w : raw.w;
      const h = raw.h < Math.min(USEFUL_H, d.h) ? d.h : raw.h;
      return fit({ ...d, ...raw, w, h, x: raw.w < USEFUL_W ? d.x : raw.x });
    }
  } catch {
    /* private window or blocked storage: defaults */
  }
  return defaultBox();
}

export function StudioPanel({
  title,
  status,
  children,
}: {
  title: string;
  status?: ReactNode;
  children: ReactNode;
}) {
  const [box, setBox] = useState<Box>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(box));
    } catch {
      /* not critical */
    }
  }, [box]);
  useEffect(() => {
    const onResize = () => setBox((b) => fit(b));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // One pointer gesture at a time: move (header) or resize (a corner).
  const gesture = useRef<{
    kind: "move" | "resize-l" | "resize-r";
    sx: number;
    sy: number;
    start: Box;
  } | null>(null);
  const begin = (kind: "move" | "resize-l" | "resize-r") => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    if (kind === "move" && (e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    gesture.current = { kind, sx: e.clientX, sy: e.clientY, start: box };
  };
  const onMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    const s = g.start;
    if (g.kind === "move") setBox(fit({ ...s, x: s.x + dx, y: s.y + dy }));
    else if (g.kind === "resize-r") setBox(fit({ ...s, w: s.w + dx, h: s.h + dy }));
    else {
      const w = Math.max(MIN_W, s.w - dx);
      setBox(fit({ ...s, w, x: s.x + (s.w - w), h: s.h + dy }));
    }
  }, []);
  const end = () => {
    gesture.current = null;
  };
  const dock = (side: "left" | "right") =>
    setBox((b) =>
      fit({
        ...b,
        x: side === "left" ? GAP : window.innerWidth - b.w - GAP,
        y: GAP,
        h: window.innerHeight - GAP * 2,
        collapsed: false,
      }),
    );

  if (box.hidden) {
    return (
      <button
        type="button"
        data-design-mode-ui
        onClick={() => setBox((b) => ({ ...b, hidden: false }))}
        className="fixed bottom-4 right-4 z-[80] flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-2xl ring-4 ring-primary/30"
        aria-label="פתיחת העורך"
      >
        <PencilRuler className="size-5" /> פתיחת העורך
      </button>
    );
  }

  return (
    <div
      data-design-mode-ui
      dir="rtl"
      role="dialog"
      aria-label={title}
      className="fixed z-[80] flex flex-col overflow-hidden rounded-xl border bg-background text-foreground shadow-2xl"
      style={{ left: box.x, top: box.y, width: box.w, height: box.collapsed ? "auto" : box.h }}
    >
      <div
        className="flex cursor-move select-none items-center gap-1 border-b bg-muted/60 px-2 py-1.5"
        onPointerDown={begin("move")}
        onPointerMove={onMove}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={() => setBox((b) => ({ ...b, collapsed: !b.collapsed }))}
        title="גררו כדי להזיז · לחיצה כפולה: כיווץ"
      >
        <GripHorizontal className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{title}</span>
        <span className="ms-2 min-w-0 truncate text-xs text-muted-foreground">{status}</span>
        <span className="ms-auto flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="הצמדה לימין"
            title="הצמדה לימין"
            onClick={() => dock("right")}
          >
            <PanelRight className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="הצמדה לשמאל"
            title="הצמדה לשמאל"
            onClick={() => dock("left")}
          >
            <PanelLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={box.collapsed ? "הרחבת העורך" : "כיווץ העורך"}
            title={box.collapsed ? "הרחבה" : "כיווץ לשורת הכותרת"}
            onClick={() => setBox((b) => ({ ...b, collapsed: !b.collapsed }))}
          >
            {box.collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="הסתרת העורך"
            title="הסתרה - לראות את הלוח במלואו"
            onClick={() => setBox((b) => ({ ...b, hidden: true }))}
          >
            <X className="size-4" />
          </Button>
        </span>
      </div>
      {!box.collapsed && (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">{children}</div>
          {/* resize from either bottom corner */}
          <div
            className="absolute bottom-0 left-0 size-4 cursor-nesw-resize"
            aria-hidden
            onPointerDown={begin("resize-l")}
            onPointerMove={onMove}
            onPointerUp={end}
            onPointerCancel={end}
            style={{
              background:
                "linear-gradient(45deg, hsl(var(--muted-foreground) / 0.5) 0 2px, transparent 2px 5px, hsl(var(--muted-foreground) / 0.5) 5px 7px, transparent 7px)",
            }}
          />
          <div
            className="absolute bottom-0 right-0 size-4 cursor-nwse-resize"
            aria-hidden
            onPointerDown={begin("resize-r")}
            onPointerMove={onMove}
            onPointerUp={end}
            onPointerCancel={end}
            style={{
              background:
                "linear-gradient(-45deg, hsl(var(--muted-foreground) / 0.5) 0 2px, transparent 2px 5px, hsl(var(--muted-foreground) / 0.5) 5px 7px, transparent 7px)",
            }}
          />
        </>
      )}
    </div>
  );
}
