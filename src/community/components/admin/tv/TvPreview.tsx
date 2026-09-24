import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import "./tvEdit.css";
import { configForDevice, type TvConfig } from "@/tv/config";
import { classOfPreviewDevice } from "@/tv/devices";
import { TvBoard } from "@/tv/TvBoard";
import type { BoardSlide } from "@/tv/useBoardData";
import { slideLabel, type useTvSlides } from "./tvPreviewData";
import { DeviceFrame, DeviceToolbar } from "./DevicePreview";
import { setElementStyle, styleTargetKey } from "@/tv/boardEdit";
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
  ...props
}: BoardProps & {
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
  const boardFor = (id: DeviceId) => {
    const c = configForDevice(props.config, classOfPreviewDevice(id));
    return preview ? { ...c, ...preview } : c;
  };
  const [actualSize, setActualSize] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const editing = Boolean(props.editing);
  const maxH = large ? Math.max(360, (typeof window === "undefined" ? 900 : window.innerHeight) - 220) : undefined;

  // Drag-to-move. The delta is converted to percent of the board's frame
  // (cqw / cqh), which is what ElementStyle stores, so it lands in the same
  // relative place on every device - whatever scale the preview is drawn at.
  const drag = useRef<{ key: string; elementKey?: string; frame: DOMRect; startX: number; startY: number; x0: number; y0: number; moved: boolean } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    // Alt + click is an ordinary click on the board (the skill's escape hatch).
    if (!editing || !onEdit || e.button !== 0 || e.altKey) return;
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
    drag.current = { key, elementKey: el.dataset.edit!, frame: frame.getBoundingClientRect(), startX: e.clientX, startY: e.clientY, x0: s?.x ?? 0, y0: s?.y ?? 0, moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
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
    const x = Math.round((d.x0 + (dx / d.frame.width) * 100) * 10) / 10;
    const y = Math.round((d.y0 + (dy / d.frame.height) * 100) * 10) / 10;
    onEdit!(`style:pos:${d.key}`, (c) => setElementStyle(c, d.key, { x: Math.max(-50, Math.min(50, x)), y: Math.max(-50, Math.min(50, y)) }));
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
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
        },
        onMouseOver: (e: MouseEvent) => setHovered(keyAt(e.target)),
        onMouseLeave: () => setHovered(null),
      }
    : {};

  if (fullscreen) {
    return (
      <div className={`fixed inset-0 z-[60] bg-black${editing ? " tv-edit-mode" : ""}`} {...editHandlers}>
        {editing && <EditHighlight hovered={hovered} selected={selected} />}
        <BoardInFrame {...props} editing={editing} />
      </div>
    );
  }

  return (
    <div className={`space-y-3${editing ? " tv-edit-mode" : ""}`} {...editHandlers}>
      {editing && <EditHighlight hovered={hovered} selected={selected} />}
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
        <div className="rounded-xl bg-muted/30 p-3">
          <DeviceFrame view={choice.view as DeviceView} maxHeight={maxH ?? (choice.view.device === "tv" ? 520 : 620)} actualSize={actualSize}>
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
