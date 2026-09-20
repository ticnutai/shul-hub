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

/**
 * Where each handle sits, which cursor it shows and which sides it pulls.
 * Edges are 6 px bands just inside the panel; corners are 14 px squares on
 * top of them, so a corner always wins over the two edges it touches.
 */
const HANDLES: Array<{
  name: string;
  label: string;
  className: string;
  cursor: string;
  edge: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };
}> = [
  {
    name: "n",
    label: "שינוי גובה מלמעלה",
    className: "inset-x-3 top-0 h-1.5",
    cursor: "ns-resize",
    edge: { top: true },
  },
  {
    name: "s",
    label: "שינוי גובה מלמטה",
    className: "inset-x-3 bottom-0 h-1.5",
    cursor: "ns-resize",
    edge: { bottom: true },
  },
  {
    name: "w",
    label: "שינוי רוחב משמאל",
    className: "inset-y-3 left-0 w-1.5",
    cursor: "ew-resize",
    edge: { left: true },
  },
  {
    name: "e",
    label: "שינוי רוחב מימין",
    className: "inset-y-3 right-0 w-1.5",
    cursor: "ew-resize",
    edge: { right: true },
  },
  {
    name: "nw",
    label: "שינוי גודל מהפינה השמאלית העליונה",
    className: "left-0 top-0 size-3.5",
    cursor: "nwse-resize",
    edge: { top: true, left: true },
  },
  {
    name: "ne",
    label: "שינוי גודל מהפינה הימנית העליונה",
    className: "right-0 top-0 size-3.5",
    cursor: "nesw-resize",
    edge: { top: true, right: true },
  },
  {
    name: "sw",
    label: "שינוי גודל מהפינה השמאלית התחתונה",
    className: "bottom-0 left-0 size-3.5",
    cursor: "nesw-resize",
    edge: { bottom: true, left: true },
  },
  {
    name: "se",
    label: "שינוי גודל מהפינה הימנית התחתונה",
    className: "bottom-0 right-0 size-3.5",
    cursor: "nwse-resize",
    edge: { bottom: true, right: true },
  },
];

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

  /**
   * One pointer gesture at a time: moving by the header, or resizing from any
   * edge or corner. An edge is described by which sides it pulls, so the same
   * handler serves all eight handles.
   */
  type Edge = { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };
  const gesture = useRef<{ kind: "move" | Edge; sx: number; sy: number; start: Box } | null>(null);
  const begin = (kind: "move" | Edge) => (e: PointerEvent<HTMLElement>) => {
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
    if (g.kind === "move") {
      setBox(fit({ ...s, x: s.x + dx, y: s.y + dy }));
      return;
    }
    // Dragging a left or top edge moves the panel as it resizes, so the
    // opposite edge stays where the eye expects it.
    const next = { ...s };
    if (g.kind.right) next.w = s.w + dx;
    if (g.kind.left) {
      next.w = Math.max(MIN_W, s.w - dx);
      next.x = s.x + (s.w - next.w);
    }
    if (g.kind.bottom) next.h = s.h + dy;
    if (g.kind.top) {
      next.h = Math.max(MIN_H, s.h - dy);
      next.y = s.y + (s.h - next.h);
    }
    setBox(fit(next));
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
          {/* Eight handles: four edges and four corners. */}
          {HANDLES.map((h) => (
            <div
              key={h.name}
              className={`absolute ${h.className}`}
              style={{ cursor: h.cursor, touchAction: "none" }}
              role="separator"
              aria-label={h.label}
              onPointerDown={begin(h.edge)}
              onPointerMove={onMove}
              onPointerUp={end}
              onPointerCancel={end}
            />
          ))}
          {/* the corner grips, drawn so the panel looks resizable */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0.5 left-0.5 size-3 border-b-2 border-l-2 border-muted-foreground/40"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0.5 right-0.5 size-3 border-b-2 border-r-2 border-muted-foreground/40"
          />
        </>
      )}
    </div>
  );
}
