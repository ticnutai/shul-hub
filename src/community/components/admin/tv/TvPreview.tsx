import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import "./tvEdit.css";
import { configForDevice, type TvConfig } from "@/tv/config";
import { applyDayLook } from "@/tv/dayLooks";
import { classOfPreviewDevice } from "@/tv/devices";
import { TvBoard } from "@/tv/TvBoard";
import type { BoardSlide } from "@/tv/useBoardData";
import { slideLabel, type useTvSlides } from "./tvPreviewData";
import { DeviceFrame, DeviceToolbar } from "./DevicePreview";
import { setElementStyle, styleTargetKey } from "@/tv/boardEdit";
import { boardFrameVars, dragTune, readTuneFrom, type BoardFrameTune } from "@/tv/boardFrame";
import { snapOffset, snapTune } from "@/tv/snap";
import { DEVICE_ORDER, DEVICES, useDeviceChoice, type DeviceId, type DeviceMode, type DeviceView } from "./devices";
import { useTvFonts } from "./tvFonts";

/**
 * The real board component inside a 16:9 frame. Not a mock-up: TvBoard and
 * buildSlides are the exact code the TV runs, and tv.css sizes everything
 * from the frame's height (container units), so the picture is the TV's at
 * any width.
 */

export function TvPreview({
  config,
  slides,
  data,
  now,
  zmanim,
  index,
  paused = false,
  progress = 0,
  cycle = 0,
  overlay,
  label,
}: ReturnType<typeof useTvSlides> & {
  config: TvConfig;
  index: number;
  paused?: boolean;
  progress?: number;
  cycle?: number;
  overlay?: ReactNode;
  label?: string;
}) {
  useTvFonts();
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-black shadow-lg ring-1 ring-border"
      style={{ aspectRatio: "16 / 9" }}
      role="img"
      aria-label={label ?? "תצוגה מקדימה של לוח הטלוויזיה"}
      // Sits outside the site's own RTL/typography rules; the board sets its own.
      dir="rtl"
    >
      <TvBoard
        data={data}
        config={config}
        now={now}
        zmanim={zmanim}
        slides={slides}
        index={Math.min(Math.max(index, 0), Math.max(slides.length - 1, 0))}
        cycle={cycle}
        progress={progress}
        paused={paused}
        overlay={overlay}
      />
    </div>
  );
}

/** Small clickable slide list under a preview. */
export function SlideStrip({
  slides,
  index,
  onPick,
}: {
  slides: BoardSlide[];
  index: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="שקופיות">
      {slides.map((s, i) => (
        <button
          key={s.id + i}
          type="button"
          role="tab"
          aria-selected={i === index}
          onClick={() => onPick(i)}
          className={`rounded-full border px-2.5 py-1 text-xs transition ${
            i === index ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"
          }`}
        >
          {i + 1}. {slideLabel(s)}
        </button>
      ))}
    </div>
  );
}

/** The lines a dragged element snapped to: hidden, and placed and shown directly during a drag. */
function SnapGuides({ xRef, yRef }: { xRef: RefObject<HTMLDivElement>; yRef: RefObject<HTMLDivElement> }) {
  const line = "pointer-events-none fixed z-[70] border-pink-500";
  return (
    <>
      <div ref={xRef} aria-hidden data-testid="snap-guide" className={`${line} border-l-2 border-dashed`} style={{ display: "none" }} />
      <div ref={yRef} aria-hidden data-testid="snap-guide" className={`${line} border-t-2 border-dashed`} style={{ display: "none" }} />
    </>
  );
}

type BoardProps = ReturnType<typeof useTvSlides> & {
  config: TvConfig;
  index: number;
  paused?: boolean;
  progress?: number;
  cycle?: number;
  editing?: boolean;
};

function BoardInFrame({ config, slides, data, now, zmanim, index, paused = false, progress = 0, cycle = 0, editing = false }: BoardProps) {
  return (
    <div className="h-full w-full" dir="rtl">
      <TvBoard
        data={data}
        config={config}
        now={now}
        zmanim={zmanim}
        slides={slides}
        index={Math.min(Math.max(index, 0), Math.max(slides.length - 1, 0))}
        cycle={cycle}
        progress={progress}
        paused={paused}
        editing={editing}
        preview
      />
    </div>
  );
}

/**
 * The editor's preview: the board on a TV, a computer, a laptop, a tablet or
 * a phone - or all of them side by side - rendered at each one's real
 * viewport. Every edit shows on every device at once.
 */
export function TvDeviceStudio({
  selected = null,
  onSelect,
  onEdit,
  large = false,
  fullscreen = false,
  onDeviceChange,
  preview,
  fitHeight,
  toolbarExtra,
  bare = false,
  onResize,
  onResizeReset,
  onRequestEdit,
  dayLook = false,
  ...props
}: BoardProps & {
  /**
   * The board as the screens wear it at this moment: with the design of the
   * occasion that is on (dayLooks.ts), as TvApp and the connected-screens tab
   * draw it. Off, the board is the one being edited, without it.
   */
  dayLook?: boolean;
  /**
   * A double click on the board while it is not being edited: the editor
   * opens editing, on the spot that was clicked. The board does not mark
   * its parts outside editing, so the place is passed, not the part.
   */
  onRequestEdit?: (x: number, y: number) => void;
  /** The board without the drawn TV around it (DevicePreview's `bare`). */
  bare?: boolean;
  /** Handles around the board, and what a drag on them asks for (DevicePreview's `onResize`). */
  onResize?: (size: { width: number; height: number }) => void;
  onResizeReset?: () => void;
  /**
   * The whole studio - its toolbar and the framed board - fits this many
   * pixels of height. The editor's "תצוגה למעלה" gives it the height its bar
   * was dragged to, and the board takes all of it rather than a width that
   * happened to be left over.
   */
  fitHeight?: number;
  /** Buttons that belong on the toolbar's row (the editor's layout switches). */
  toolbarExtra?: ReactNode;
  /** The live editor window: the board alone on the whole screen, no device frame. */
  fullscreen?: boolean;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  /** The editor's draft updater; enables drag-to-move of the selected element. */
  onEdit?: (key: string, update: (c: TvConfig) => TvConfig) => void;
  /** Expanded / full-screen editing: the preview takes most of the viewport. */
  large?: boolean;
  /**
   * Tells the editor which screen is being looked at, so that choosing a
   * device here is also choosing what the controls edit. One switcher, not
   * two: the single most common complaint about editors that have both is
   * changing something and not seeing it, because it went to the other one.
   */
  onDeviceChange?: (mode: DeviceMode) => void;
  /**
   * Something being tried out: laid over every frame for display only, and
   * after the per-screen resolution, so that adjusting a colour is visible
   * even on a screen that has a colour of its own.
   */
  preview?: Partial<TvConfig> | null;
}) {
  useTvFonts();
  const choice = useDeviceChoice();
  /**
   * "כל המסכים" means the edits go everywhere; it does not have to mean
   * looking at five boards at once. Opening onto five postage stamps is
   * worse than opening onto the board, so the comparison is a thing you
   * ask for - and then it is genuinely useful, because each frame shows
   * that screen's own board and the disagreements are visible at a glance.
   */
  const [compare, setCompare] = useState(false);

  useEffect(() => {
    onDeviceChange?.(choice.mode);
  }, [choice.mode, onDeviceChange]);

  /** The board as one particular screen shows it. */
  // An occasion's own screen is drawn in its design, always - that is its look.
  const shownId = props.slides[props.index]?.id ?? null;
  const occasionSlideId = shownId?.startsWith("occasion:") ? shownId : null;
  const boardFor = (id: DeviceId) => {
    const own = configForDevice(props.config, classOfPreviewDevice(id));
    const c = dayLook || occasionSlideId ? applyDayLook(own, props.now, props.data.settings, occasionSlideId) : own;
    return preview ? { ...c, ...preview } : c;
  };
  const [actualSize, setActualSize] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const editing = Boolean(props.editing);
  // The toolbar row (32px), the gap under it (12px), the frame's padding (24px).
  const maxH = fitHeight
    ? Math.max(120, fitHeight - 72)
    : large
      ? Math.max(360, (typeof window === "undefined" ? 900 : window.innerHeight) - 220)
      : undefined;

  // Drag-to-move. The delta is converted to percent of the board's frame
  // (cqw / cqh), which is what ElementStyle stores, so it lands in the same
  // relative place on every device - whatever scale the preview is drawn at.
  const drag = useRef<{
    key: string;
    elementKey?: string;
    frame: DOMRect;
    startX: number;
    startY: number;
    x0: number;
    y0: number;
    /** Where the element's middle stands with no offset, in percent of the board. */
    cx: number;
    cy: number;
    moved: boolean;
    /** The element on every board in sight, moved directly while the drag lasts. */
    nodes: HTMLElement[];
    /** Where it is now, written to the board on release. */
    last: { x: number; y: number } | null;
  } | null>(null);
  /**
   * The lines an element snapped to while it is dragged (snap.ts). Drawn
   * directly, like the move itself: a state change here re-rendered every
   * board in the studio on every move, and a drag ran at some 20 frames a
   * second (measured, 50 ms a move).
   */
  const guideX = useRef<HTMLDivElement>(null);
  const guideY = useRef<HTMLDivElement>(null);
  const showGuides = (g: { frame: DOMRect; x: number | null; y: number | null } | null) => {
    const vx = guideX.current;
    const vy = guideY.current;
    if (vx) {
      vx.style.display = g && g.x !== null ? "block" : "none";
      if (g && g.x !== null) Object.assign(vx.style, { left: `${g.frame.left + (g.frame.width * g.x) / 100}px`, top: `${g.frame.top}px`, height: `${g.frame.height}px` });
    }
    if (vy) {
      vy.style.display = g && g.y !== null ? "block" : "none";
      if (g && g.y !== null) Object.assign(vy.style, { top: `${g.frame.top + (g.frame.height * g.y) / 100}px`, left: `${g.frame.left}px`, width: `${g.frame.width}px` });
    }
  };
  // The board's frame - columns, beams, a curtain - is grabbed and stretched
  // by hand: a drag on a piece moves it, a drag on one of its handles makes
  // it longer or thicker (boardFrame.dragTune). The pointer is measured in
  // --u of that board, so it means the same at any preview scale.
  const frameDrag = useRef<{
    piece: string;
    handle: string | null;
    root: HTMLElement;
    t0: BoardFrameTune;
    u: number;
    width: number;
    height: number;
    fromRight: boolean;
    fromBottom: boolean;
    startX: number;
    startY: number;
    moved: boolean;
    /** Every board in sight, whose frame follows the drag directly. */
    roots: HTMLElement[];
    last: BoardFrameTune | null;
  } | null>(null);
  const startFrameDrag = (e: PointerEvent): boolean => {
    const target = e.target instanceof Element ? e.target : null;
    const piece = target?.closest<HTMLElement>(".tv-board-frame > i");
    const root = piece?.closest<HTMLElement>(".tv-root");
    if (!piece || !root) return false;
    const box = root.getBoundingClientRect();
    frameDrag.current = {
      piece: piece.className,
      handle: target?.closest<HTMLElement>("[data-bf-handle]")?.dataset.bfHandle ?? null,
      root,
      t0: readTuneFrom(root),
      u: box.height / 100,
      width: box.width,
      height: box.height,
      fromRight: e.clientX > box.left + box.width / 2,
      fromBottom: e.clientY > box.top + box.height / 2,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      roots: [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(".tv-root.has-board-frame")],
      last: null,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    e.preventDefault();
    return true;
  };
  const moveFrameDrag = (e: PointerEvent): boolean => {
    const d = frameDrag.current;
    if (!d) return false;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 3) return true;
    d.moved = true;
    const raw = dragTune(d.piece, d.handle, d.t0, { dx, dy, u: d.u, width: d.width, height: d.height, fromRight: d.fromRight, fromBottom: d.fromBottom });
    const next = e.ctrlKey ? raw : snapTune(raw);
    d.last = next;
    for (const r of d.roots) for (const [k, v] of Object.entries(boardFrameVars(next))) r.style.setProperty(k, v);
    return true;
  };

  const onPointerDown = (e: PointerEvent) => {
    // Alt + click is an ordinary click on the board (the skill's escape hatch).
    if (!editing || !onEdit || e.button !== 0 || e.altKey) return;
    if (startFrameDrag(e)) return;
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-edit]") : null;
    const frame = el?.closest<HTMLElement>(".tv-frame");
    if (!el || !frame) return;
    // The board behind everything is selected, never dragged.
    if (el.dataset.edit === "board.background") return;
    // Same scope the inspector shows: the element's own rule, or its
    // family's when that is the one that exists.
    const key = styleTargetKey(props.config, el.dataset.edit!);
    const s = props.config.styles[key];
    // No pointer capture yet: a captured pointer retargets the click to the
    // wrapper, and a plain click must still select the element under it.
    const box = frame.getBoundingClientRect();
    const own = el.getBoundingClientRect();
    const studio = e.currentTarget as HTMLElement;
    const x0 = s?.x ?? 0;
    const y0 = s?.y ?? 0;
    drag.current = {
      key,
      elementKey: el.dataset.edit!,
      frame: box,
      startX: e.clientX,
      startY: e.clientY,
      x0,
      y0,
      cx: ((own.left + own.width / 2 - box.left) / box.width) * 100 - x0,
      cy: ((own.top + own.height / 2 - box.top) / box.height) * 100 - y0,
      moved: false,
      nodes: [...studio.querySelectorAll<HTMLElement>(`[data-edit="${CSS.escape(el.dataset.edit!)}"]`)],
      last: null,
    };
  };
  const onPointerMove = (e: PointerEvent) => {
    if (moveFrameDrag(e)) return;
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) {
      // A real drag from here on: keep the pointer even if it leaves the board.
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    d.moved = true;
    let x = Math.round((d.x0 + (dx / d.frame.width) * 100) * 10) / 10;
    let y = Math.round((d.y0 + (dy / d.frame.height) * 100) * 10) / 10;
    // Lines things up: back on its place, or its middle on the board's; Ctrl drags freely.
    if (!e.ctrlKey) {
      const sx = snapOffset(x, d.cx);
      const sy = snapOffset(y, d.cy);
      x = sx.value;
      y = sy.value;
      showGuides({ frame: d.frame, x: sx.line, y: sy.line });
    } else showGuides(null);
    x = Math.max(-50, Math.min(50, x));
    y = Math.max(-50, Math.min(50, y));
    d.last = { x, y };
    // On the page only, every frame of it at once; the board is written on release.
    for (const n of d.nodes) n.style.transform = x || y ? `translate(${x}cqw, ${y}cqh)` : "";
  };
  const onPointerUp = (e: PointerEvent) => {
    showGuides(null);
    const f = frameDrag.current;
    if (f) {
      frameDrag.current = null;
      if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      // The click that ends a drag selects nothing; a click without one opens the board's own panel.
      if (f.moved) suppressClick.current = true;
      // Written once, where it was let go: one step to undo.
      const t = f.last;
      if (t) onEdit!("board-frame-drag", (c) => ({ ...c, boardFrameTune: { ...t, sides: c.boardFrameTune.sides } }));
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (d.moved && d.last) {
      const { x, y } = d.last;
      onEdit!(`style:pos:${d.key}`, (c) => setElementStyle(c, d.key, { x, y }));
    }
    if (d.moved) {
      // The click that ends a drag must not change the selection; selection
      // is by element, even when the drag wrote to the family rule.
      onSelect?.(d.key.startsWith("kind:") ? (d.elementKey ?? d.key) : d.key);
      suppressClick.current = true;
    }
  };
  const suppressClick = useRef(false);

  // Click-to-edit: the nearest element carrying data-edit wins, so clicking a
  // minyan's name edits the name and clicking its row edits the row.
  const keyAt = (target: EventTarget | null) =>
    target instanceof Element ? (target.closest<HTMLElement>("[data-edit]")?.dataset.edit ?? null) : null;
  const editHandlers = editing
    ? {
        onClickCapture: (e: MouseEvent) => {
          if (e.altKey) return;
          const key = keyAt(e.target);
          if (!key) return;
          e.preventDefault();
          e.stopPropagation();
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onSelect?.(key);
        },
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: () => {
          drag.current = null;
          frameDrag.current = null;
          showGuides(null);
        },
        onMouseOver: (e: MouseEvent) => setHovered(keyAt(e.target)),
        onMouseLeave: () => setHovered(null),
      }
    : {};

  if (fullscreen) {
    return (
      <div className={`fixed inset-0 z-[60] bg-black${editing ? " tv-edit-mode" : ""}`} {...editHandlers}>
        {editing && <EditHighlight hovered={hovered} selected={selected} />}
        {editing && <SnapGuides xRef={guideX} yRef={guideY} />}
        <BoardInFrame {...props} editing={editing} />
      </div>
    );
  }

  return (
    <div className={`space-y-3${editing ? " tv-edit-mode" : ""}`} {...editHandlers}>
      {editing && <EditHighlight hovered={hovered} selected={selected} />}
      {editing && <SnapGuides xRef={guideX} yRef={guideY} />}
      <div className="flex flex-wrap items-center gap-2">
        <DeviceToolbar
          compare={compare}
          onCompare={setCompare}
          mode={choice.mode}
          view={choice.view}
          actualSize={actualSize}
          onMode={choice.setMode}
          onView={choice.setView}
          onActualSize={setActualSize}
        />
        {toolbarExtra && <div className="ms-auto flex flex-wrap items-center gap-2">{toolbarExtra}</div>}
      </div>
      {choice.mode === "all" && compare ? (
        <div className="grid grid-cols-2 items-end gap-x-4 gap-y-5 rounded-xl bg-muted/30 p-3 sm:grid-cols-6">
          {DEVICE_ORDER.map((id) => (
            <figure
              key={id}
              className={`m-0 space-y-1.5 ${id === "tv" || id === "desktop" || id === "laptop" ? "col-span-2 sm:col-span-3" : id === "tablet" ? "col-span-1 sm:col-span-2" : "col-span-1"}`}
            >
              <DeviceFrame view={choice.views[id]} maxHeight={large ? (id === "tablet" || id === "mobile" ? 520 : 400) : id === "tablet" ? 320 : id === "mobile" ? 300 : 240}>
                {/* Each one is that screen's real board, differences and all,
                    so "כל המסכים" is a comparison rather than the same
                    picture repeated at five sizes. */}
                <BoardInFrame {...props} config={boardFor(id)} editing={editing} />
              </DeviceFrame>
              <figcaption className="text-center text-xs text-muted-foreground">
                <button type="button" className="underline-offset-2 hover:underline" onClick={() => choice.setMode(id)}>
                  {DEVICES[id].label}
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div
          className="group relative rounded-xl bg-muted/30 p-3"
          onDoubleClick={!editing && onRequestEdit ? (e) => onRequestEdit(e.clientX, e.clientY) : undefined}
        >
          {!editing && onRequestEdit && (
            <div
              aria-hidden
              data-testid="edit-hint"
              className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              לחיצה כפולה על חלק בלוח - כדי להזיז, להגדיל או לערוך אותו
            </div>
          )}
          <DeviceFrame
            view={choice.view as DeviceView}
            maxHeight={maxH ?? (choice.view.device === "tv" ? 520 : 620)}
            actualSize={actualSize}
            bare={bare}
            onResize={onResize}
            onResizeReset={onResizeReset}
          >
            <BoardInFrame
              {...props}
              config={boardFor(choice.mode === "all" ? "tv" : (choice.mode as DeviceId))}
              editing={editing}
            />
          </DeviceFrame>
        </div>
      )}
    </div>
  );
}

/** Outlines the hovered and selected element on every device at once. */
function EditHighlight({ hovered, selected }: { hovered: string | null; selected: string | null }) {
  const sel = (k: string) => `.tv-edit-mode [data-edit="${CSS.escape(k)}"]`;
  const rules = [
    hovered && hovered !== selected && `${sel(hovered)} { outline-color: rgb(59 130 246 / 0.9); background-color: rgb(59 130 246 / 0.08); }`,
    selected && `${sel(selected)} { outline: calc(3px / var(--ps, 1)) solid rgb(37 99 235) !important; background-color: rgb(59 130 246 / 0.12); }`,
  ].filter(Boolean);
  return <style>{rules.join(" ")}</style>;
}
