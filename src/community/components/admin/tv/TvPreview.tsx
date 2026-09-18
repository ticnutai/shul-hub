import { useState, type MouseEvent, type ReactNode } from "react";
import "./tvEdit.css";
import type { TvConfig } from "@/tv/config";
import { TvBoard } from "@/tv/TvBoard";
import type { BoardSlide } from "@/tv/useBoardData";
import { slideLabel, type useTvSlides } from "./tvPreviewData";
import { DeviceFrame, DeviceToolbar } from "./DevicePreview";
import { DEVICE_ORDER, DEVICES, useDeviceChoice, type DeviceView } from "./devices";
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
  ...props
}: BoardProps & { selected?: string | null; onSelect?: (key: string | null) => void }) {
  useTvFonts();
  const choice = useDeviceChoice();
  const [actualSize, setActualSize] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const editing = Boolean(props.editing);

  // Click-to-edit: the nearest element carrying data-edit wins, so clicking a
  // minyan's name edits the name and clicking its row edits the row.
  const keyAt = (target: EventTarget | null) =>
    target instanceof Element ? (target.closest<HTMLElement>("[data-edit]")?.dataset.edit ?? null) : null;
  const editHandlers = editing
    ? {
        onClickCapture: (e: MouseEvent) => {
          const key = keyAt(e.target);
          if (!key) return;
          e.preventDefault();
          e.stopPropagation();
          onSelect?.(key);
        },
        onMouseOver: (e: MouseEvent) => setHovered(keyAt(e.target)),
        onMouseLeave: () => setHovered(null),
      }
    : {};

  return (
    <div className={`space-y-3${editing ? " tv-edit-mode" : ""}`} {...editHandlers}>
      {editing && <EditHighlight hovered={hovered} selected={selected} />}
      <DeviceToolbar
        mode={choice.mode}
        view={choice.view}
        actualSize={actualSize}
        onMode={choice.setMode}
        onView={choice.setView}
        onActualSize={setActualSize}
      />
      {choice.mode === "all" ? (
        <div className="grid grid-cols-2 items-end gap-x-4 gap-y-5 rounded-xl bg-muted/30 p-3 sm:grid-cols-6">
          {DEVICE_ORDER.map((id) => (
            <figure
              key={id}
              className={`m-0 space-y-1.5 ${id === "tv" || id === "desktop" || id === "laptop" ? "col-span-2 sm:col-span-3" : id === "tablet" ? "col-span-1 sm:col-span-2" : "col-span-1"}`}
            >
              <DeviceFrame view={choice.views[id]} maxHeight={id === "tablet" ? 320 : id === "mobile" ? 300 : 240}>
                <BoardInFrame {...props} editing={editing} />
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
          <DeviceFrame view={choice.view as DeviceView} maxHeight={choice.view.device === "tv" ? 520 : 620} actualSize={actualSize}>
            <BoardInFrame {...props} editing={editing} />
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
