/**
 * The panel of what was chosen on the board: a container's board, its frame,
 * its shape, its text, a list's "הבא בתור", a decoration, or the main background - each with its
 * own choices only - docked beside the board where there is room for it, else
 * floating in a corner of the screen; dragged by its title anywhere, where it
 * stays next time (a double click on the title puts it back), folded to its
 * title - and shapes dragged from it onto the board as new containers. One rule behind it (containerParts.ts): every
 * container has one board and one frame, drawn or painted; the board takes a
 * colour or a background of the gallery, the frame is replaced, and the shape
 * changes the board and the frame together.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PART_PANEL_SLOT } from "../adminPath";
import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import type { TvConfig } from "@/tv/config";
import { useElementEditing } from "@/tv/elementEditing";
import { colourBoards, colourFrames, containersOf, paintBoards, roleOf, wearFrame } from "@/tv/containerParts";
import { newContainerParts, writeContainers } from "@/tv/containers";
import { MAX_ELEMENTS } from "@/tv/elements";
import type { PartShape } from "@/tv/partShapes";
import { BoardBackground } from "./TvEditInspector";
import { wearsPaint } from "@/tv/partPaint";
import { galleryOf } from "@/tv/backgrounds";
import { FRAME_PICTURES, FRAME_PICTURE_PREFIX, framePictureUrl } from "@/tv/framePictures";
import { PART_SHAPES } from "@/tv/partShapes";
import { setSectionShape } from "@/tv/sectionGeometry";
import type { BoardElement } from "@/tv/elements";
import { toast } from "sonner";
import { ColorPick } from "./ColorPick";
import { BackgroundTile } from "./LayerEditors";
import { NextMarkTools } from "./NextMarkTools";
import { ElementTextTools } from "./ElementTextTools";
import { marksNext } from "@/tv/nextMark";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;
type Tab = "background" | "board" | "frame" | "shape" | "text" | "ornament" | "next" | "add";

const TAB_NAMES: Record<Tab, string> = {
  background: "הרקע", board: "הלוח", frame: "המסגרת", shape: "הצורה", text: "טקסט", ornament: "העיטור", next: "סימון הבא", add: "הוספת קונטיינר",
};
/** Where the panel was dragged to, for next time (this browser). */
const PANEL_POS_KEY = "tv-part-panel-pos";
/** A shape dragged from the panel onto the board: a new container there. */
const DRAG_TYPE = "application/x-shul-container";
const tile = "flex h-14 w-16 flex-col items-center justify-center gap-0.5 rounded-md border text-[10px] leading-tight hover:border-primary/60";

/** A container's name: its own (containers), else its heading's or its board's words. */
function containerName(config: TvConfig, own: BoardElement[]): string {
  const group = own.find((e) => e.group)?.group;
  const named = config.containers.find((c) => c.id === group)?.name;
  if (named) return named;
  const e = own.find((x) => /^(כותרת|מילוי|מסגרת|תוכן) /.test(x.name)) ?? own[0];
  return e ? e.name.replace(/^(כותרת|מילוי|מסגרת|תוכן|תיבה) ?-? ?/, "") || e.name : "החלק";
}

export function PartContextPanel({ config, onEdit }: { config: TvConfig; onEdit: Edit }) {
  const editing = useElementEditing();
  const chosen = (editing?.selected ?? []).filter((id) => config.elements.some((e) => e.id === id));
  const first = config.elements.find((e) => e.id === chosen[0]);
  const [tabFor, setTabFor] = useState<{ key: string; tab: Tab } | null>(null);
  const [folded, setFolded] = useState(false);
  /** Where it was dragged to (the window's corner, in pixels), kept for next time; null - its own place. */
  const [moved, setMoved] = useState<{ x: number; y: number } | null>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(PANEL_POS_KEY) ?? "null");
      return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? v : null;
    } catch {
      return null;
    }
  });
  const keep = (v: { x: number; y: number } | null) => {
    setMoved(v);
    try {
      if (v) localStorage.setItem(PANEL_POS_KEY, JSON.stringify(v));
      else localStorage.removeItem(PANEL_POS_KEY);
    } catch {
      /* private window: it stays where it is for this visit */
    }
  };
  /** Kept on the screen: dragged too far, it stops at the edge. */
  const clamp = (x: number, y: number, el: HTMLElement | null) => {
    const w = el?.offsetWidth ?? 420, h = el?.offsetHeight ?? 120;
    return { x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - w)), y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - Math.min(h, 60))) };
  };
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, select, input, label")) return;
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    const box = el.getBoundingClientRect(), dx = e.clientX - box.left, dy = e.clientY - box.top;
    let last = { x: box.left, y: box.top };
    const move = (ev: PointerEvent) => {
      last = clamp(ev.clientX - dx, ev.clientY - dy, el);
      setMoved(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      keep(last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const ref = useRef<HTMLDivElement>(null);
  /** Beside the board when there is room for it (the board's own height), else a strip at its foot. */
  const [place, setPlace] = useState<{ top: number; height: number; width: number; left: boolean } | null>(null);
  const shown = Boolean(editing && first);
  useLayoutEffect(() => {
    const host = document.querySelector<HTMLElement>("[data-board-preview]");
    if (!shown || !host) return;
    const measure = () => {
      const frame = host.querySelector(".tv-frame");
      if (!frame) return setPlace(null);
      const h = host.getBoundingClientRect(), f = frame.getBoundingClientRect();
      const left = f.left - h.left, right = h.right - f.right, room = Math.max(left, right) - 12;
      setPlace(room >= 260 ? { top: f.top - h.top, height: f.height, width: Math.min(room, 440), left: left >= right } : null);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(host);
    return () => watch.disconnect();
  }, [shown]);
  // A shape dropped on the board: a new container where it fell.
  const configRef = useRef(config);
  configRef.current = config;
  useLayoutEffect(() => {
    const host = document.querySelector<HTMLElement>("[data-board-preview]");
    if (!shown || !host) return;
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(DRAG_TYPE)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const shape = e.dataTransfer?.getData(DRAG_TYPE);
      const root = host.querySelector(".tv-frame .tv-root") ?? host.querySelector(".tv-frame");
      if (!shape || !root) return;
      e.preventDefault();
      const r = root.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100, y = ((e.clientY - r.top) / r.height) * 100;
      addContainer(shape as PartShape, { x: Math.min(70, Math.max(0, x - 15)), y: Math.min(56, Math.max(0, y - 22)), width: 30, height: 44 });
    };
    host.addEventListener("dragover", over);
    host.addEventListener("drop", drop);
    return () => {
      host.removeEventListener("dragover", over);
      host.removeEventListener("drop", drop);
    };
  });
  /** A new container - in the middle, or where a shape was dropped - chosen at once. */
  const addContainer = (shape: PartShape, at = { x: 35, y: 28, width: 30, height: 44 }) => {
    if (configRef.current.elements.length + 3 > MAX_ELEMENTS) return void toast.error(`בלוח יש כבר ${configRef.current.elements.length} חלקים - עד ${MAX_ELEMENTS}.`);
    const { container, parts } = newContainerParts(at, shape);
    onEdit(`ctx:container-new:${container.id}`, (c) => {
      const w = writeContainers(c);
      return { ...c, elements: [...w.elements, ...parts], containers: [...w.containers, container] };
    });
    editing?.select(parts.map((e) => e.id));
    toast("נוסף קונטיינר, והוא בחור: אפשר לגרור אותו, ולשנות לו לוח, מסגרת, צורה וטקסט.");
  };
  // Texts alone: the panel too, its "טקסט" first - the one place of a text's letters (the bar under the board is gone).
  const onlyTexts = chosen.length > 0 && chosen.every((id) => config.elements.find((e) => e.id === id)?.kind === "text");
  if (!editing || !first) return <div ref={ref} hidden />;
  const role = roleOf(first);
  const containers = role === "backdrop" ? [] : containersOf(config.elements, chosen);
  const own = config.elements.filter((e) => containers[0]?.ids.includes(e.id));
  const key = chosen.join(",");
  const many = containers.length > 1;
  const board = containers[0]?.board ?? null;
  const frame = containers[0]?.frame ?? null;
  const decor = role === "ornament" || role === "picture";
  // The container's list with times (prayers, lessons, the day's times): its "הבא בתור" here too, not only in the text bar below.
  const lists = config.elements.filter((e) => (own.some((o) => o.id === e.id) || chosen.includes(e.id)) && e.kind === "text" && marksNext(e.binding) && !e.locked);
  // Only what applies: the main background its background (and its frame there); a decoration on its own its look; a container its board, frame, shape and text.
  // The texts its "טקסט" edits: those chosen, else the container's own (its heading and its content).
  const texts = config.elements.filter((e) => e.kind === "text" && !e.locked && (chosen.includes(e.id) || (!onlyTexts && own.some((o) => o.id === e.id))));
  const textTab: Tab[] = texts.length ? ["text"] : [];
  const nextTab: Tab[] = lists.length ? ["next"] : [];
  const tabs: Tab[] =
    role === "backdrop"
      ? ["background", "add"]
      : onlyTexts
        ? [...textTab, ...nextTab, ...(board || frame ? (["board", "frame", "shape"] as Tab[]) : []), "add"]
        : decor && !board && !frame
          ? ["ornament", "add"]
          : ["board", "frame", "shape", ...textTab, ...(decor ? (["ornament"] as Tab[]) : []), ...nextTab, "add"];
  const natural: Tab = role === "backdrop" ? "background" : onlyTexts || (role === "text" && texts.length) ? tabs.includes("text") ? "text" : tabs[0] : role === "frame" ? "frame" : decor ? "ornament" : tabs[0];
  const tab: Tab = tabFor?.key === key && tabs.includes(tabFor.tab) ? tabFor.tab : natural;
  const title = role === "backdrop" ? "הרקע הראשי" : many ? `${containers.length} קונטיינרים` : decor && !board && !frame ? first.name : containerName(config, own);
  /** The painted decorations of the main container: pieces of the kit's picture that are no container's board or frame. */
  const paintedDecor = role === "backdrop"
    ? config.elements.filter((e) => e.kind === "image" && (e.crop || e.sourceMask) && roleOf(e) === "ornament" && !containersOf(config.elements, [e.id]).some((c) => c.board || c.frame))
    : [];
  const decorHidden = paintedDecor.length > 0 && paintedDecor.every((e) => e.hidden);
  const ornaments = config.elements.filter((e) => chosen.includes(e.id) && (roleOf(e) === "ornament" || roleOf(e) === "picture"));
  const editEls = (k: string, f: (all: BoardElement[]) => BoardElement[]) => onEdit(`ctx:${k}:${key}`, (c) => ({ ...c, elements: f(c.elements) }));

  // Beside the board when there is room; where it was dragged to; else in its own place under the board, in the page -
  // pushing what is under it down rather than covering it (the text bar, the buttons under the board).
  const docked = place && !moved;
  const inPage = !docked && !moved ? document.getElementById(PART_PANEL_SLOT) : null;
  const panel = (
    <div
      ref={ref}
      className={`overflow-y-auto rounded-lg border bg-card p-2 text-sm ${docked ? "absolute z-50 shadow-xl" : inPage ? "mt-2 shadow-sm" : "fixed z-50 max-h-[45vh] w-[min(440px,calc(100vw-32px))] shadow-xl"}`}
      style={docked ? { top: place.top, height: folded ? undefined : place.height, width: place.width, ...(place.left ? { left: 6 } : { right: 6 }) } : inPage ? undefined : { left: moved!.x, top: moved!.y }}
      dir="rtl"
      data-testid="part-context-panel"
      data-place={docked ? "side" : inPage ? "page" : "float"}
    >
      <div className="mb-2 flex cursor-move flex-wrap items-center gap-1.5 select-none" onPointerDown={drag} onDoubleClick={() => keep(null)}
        title="גרירה מזיזה את החלון; לחיצה כפולה מחזירה אותו למקומו" data-testid="part-context-handle">
        <GripVertical className="size-4 text-muted-foreground" aria-hidden />
        <span className="font-semibold">נבחר: {title}</span>
        <span className="text-muted-foreground">←</span>
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t}
            className={`h-7 rounded-md border px-2 text-xs ${tab === t ? "border-primary bg-primary/10 font-semibold" : "hover:border-primary/50"}`}
            onClick={() => { setTabFor({ key, tab: t }); setFolded(false); }}>
            {TAB_NAMES[t]}
          </button>
        ))}
        <span className="ms-auto flex items-center">
          <button type="button" aria-label={folded ? "פתיחת החלון" : "מזעור החלון"} className="rounded p-1 hover:bg-muted" onClick={() => setFolded((f) => !f)}>
            {folded ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
          </button>
          <button type="button" aria-label="סגירת החלון" className="rounded p-1 hover:bg-muted" onClick={() => editing.select([])}>
            <X className="size-4" aria-hidden />
          </button>
        </span>
      </div>
      {!folded && <>

      {tab === "background" && (
        <div data-testid="ctx-background">
          {/* The board's own background and frame: the one editor of them, the same as a click on the board opens. */}
          <BoardBackground config={config} onEdit={onEdit} />
          {/* A kit painted from one picture covers the board in decorations (curtains, columns, arches): the main container's, hidden together to see its background. */}
          {paintedDecor.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-[11px]" data-testid="painted-decor">
              בערכה {paintedDecor.length} עיטורים מצוירים (וילונות, עמודים, קשתות) שמכסים את רוב הרקע.
              <button type="button" className="h-6 rounded border bg-background px-2 hover:border-primary/50"
                onClick={() => editEls("decor-toggle", (all) => all.map((e) => (paintedDecor.some((d) => d.id === e.id) ? { ...e, hidden: !decorHidden } : e)))}>
                {decorHidden ? "החזרת העיטורים המצוירים" : "הסתרת העיטורים המצוירים"}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "text" && (
        <div data-testid="preview-text-tools">
          <ElementTextTools elements={config.elements} ids={texts.map((e) => e.id)} withNextMark={false}
            onPatch={(ids, p, what) => onEdit(`element-text:${ids.join(",")}:${what}`, (c) => ({ ...c, elements: c.elements.map((e) => (ids.includes(e.id) && !e.locked ? { ...e, ...p } : e)) }))} />
          <p className="mt-1 text-[11px] text-muted-foreground">לחיצה כפולה על טקסט בלוח - כותבים בו ישירות. Enter לסיום, Esc לביטול.</p>
        </div>
      )}

      {tab === "next" && (
        <div data-testid="ctx-next">
          <NextMarkTools elements={config.elements} texts={lists}
            onPatch={(ids, p, what) => onEdit(`ctx:${what}:${ids.join(",")}`, (c) => ({ ...c, elements: c.elements.map((e) => (ids.includes(e.id) && !e.locked ? { ...e, ...p } : e)) }))} />
        </div>
      )}

      {tab === "ornament" && (
        <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="ctx-ornament">
          {ornaments.some((e) => e.kind === "ornament" || e.kind === "column") && (
            <label className="flex items-center gap-1.5">
              צבע העיטור
              <ColorPick label="צבע העיטור" className="h-7 w-9" value={/^#[\da-f]{6}$/i.test(ornaments[0]?.color ?? "") ? ornaments[0].color : "#c9a24a"}
                onChange={(v) => editEls("ornament-colour", (all) => all.map((e) => (ornaments.some((o) => o.id === e.id) && (e.kind === "ornament" || e.kind === "column") ? { ...e, color: v } : e)))} />
            </label>
          )}
          <button type="button" className="h-7 rounded-md border px-2 hover:border-primary/50"
            onClick={() => editEls("ornament-hide", (all) => all.map((e) => (ornaments.some((o) => o.id === e.id) ? { ...e, hidden: !e.hidden } : e)))}>
            {ornaments.every((e) => e.hidden) ? "הצגת העיטור" : "הסתרת העיטור"}
          </button>
          <span className="text-muted-foreground">עיטורים חדשים מוסיפים ב"חלקים" ← "הוספת עיטור".</span>
        </div>
      )}

      {tab === "add" && (
        <div className="space-y-1" data-testid="ctx-add">
          <p className="text-xs text-muted-foreground">גוררים צורה אל הלוח - ונוצר שם קונטיינר שלם (לוח, מסגרת וכותרת) בצורה הזאת. לחיצה מוסיפה אותו באמצע.</p>
          <div className="flex flex-wrap gap-1.5">
            {PART_SHAPES.map((s) => (
              <button key={s.id} type="button" draggable aria-label={`קונטיינר חדש: ${s.name}`} title={`גרירה ללוח: קונטיינר ב${s.name}`}
                className={`${tile} cursor-grab`}
                onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, s.id); e.dataTransfer.effectAllowed = "copy"; }}
                onClick={() => addContainer(s.id)}>
                <svg viewBox="0 0 100 100" className="h-7 w-9" aria-hidden><path d={s.path} fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth="5" /></svg>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "board" && (
        <div className="space-y-2" data-testid="ctx-board">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5">
              צבע הלוח
              <ColorPick label="צבע הלוח" className="h-7 w-9" value={board && /^#[\da-f]{6}$/i.test(board.fill) ? board.fill : "#fff5dc"}
                onChange={(v) => editEls("board-colour", (all) => colourBoards(all, chosen, v))} />
            </label>
            <button type="button" className="h-7 rounded-md border px-2 hover:border-primary/50" onClick={() => editEls("board-plain", (all) => paintBoards(all, chosen, null))}>
              בלי רקע מהגלריה
            </button>
          </div>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto" data-testid="ctx-board-gallery">
            {galleryOf(config).map((b) => (
              <button key={b.id} type="button" aria-label={b.name} title={b.name} aria-pressed={Boolean(board && wearsPaint(board, b))}
                className={`${tile} ${board && wearsPaint(board, b) ? "ring-2 ring-primary" : ""}`}
                onClick={() => editEls("board-paint", (all) => paintBoards(all, chosen, b))}>
                <span className="relative block h-8 w-14 overflow-hidden rounded"><BackgroundTile b={b} /></span>
                <span className="w-full truncate">{b.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "frame" && (
        <div className="space-y-2" data-testid="ctx-frame">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span>{frame ? "החלפת המסגרת - היא נשארת בצורה של הקונטיינר" : "לקונטיינר אין מסגרת - בחירה מוסיפה אחת סביב הלוח שלו"}</span>
            <label className="flex items-center gap-1.5">
              צבע הקו
              <ColorPick label="צבע קו המסגרת" className="h-7 w-9" value={frame && /^#[\da-f]{6}$/i.test(frame.color) ? frame.color : "#c9a24a"}
                onChange={(v) => editEls("frame-colour", (all) => colourFrames(all, chosen, v))} />
            </label>
            {frame && (
              <button type="button" className="h-7 rounded-md border px-2 hover:border-primary/50"
                onClick={() => editEls("frame-off", (all) => all.map((e) => (e.id === frame.id ? { ...e, hidden: true } : e)))}>
                הסתרת המסגרת
              </button>
            )}
          </div>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto" data-testid="ctx-frame-gallery">
            <button type="button" className={tile} aria-label="קו מצויר" onClick={() => editEls("frame-line", (all) => wearFrame(all, chosen, null).elements)}>
              <span className="h-7 w-10 rounded-sm border-2 border-current" />
              קו מצויר
            </button>
            {FRAME_PICTURES.map((f) => {
              const ref = FRAME_PICTURE_PREFIX + f.id;
              return (
                <button key={f.id} type="button" aria-label={f.name} title={f.name} aria-pressed={frame?.image === ref}
                  className={`${tile} ${frame?.image === ref ? "ring-2 ring-primary" : ""}`}
                  onClick={() => editEls("frame-picture", (all) => wearFrame(all, chosen, ref).elements)}>
                  <span className="h-8 w-12" style={{ border: "7px solid transparent", borderImage: `url("${framePictureUrl(ref)}") ${f.slice}% / 7px stretch` }} />
                  <span className="w-full truncate">{f.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === "shape" && (
        <div className="space-y-1" data-testid="ctx-shape">
          <p className="text-xs text-muted-foreground">הצורה של הקונטיינר כולו: הלוח, המסגרת והטקסט משתנים יחד.</p>
          <div className="flex flex-wrap gap-1.5">
            {PART_SHAPES.map((s) => (
              <button key={s.id} type="button" aria-label={`צורה: ${s.name}`} title={s.name}
                className={`${tile} ${(board?.shape ?? (frame?.kind === "frame" ? frame.shape : undefined)) === s.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => editEls("shape", (all) => containers.reduce((acc, c) => setSectionShape(acc, (c.board ?? c.frame ?? { id: c.ids[0] }).id, s.id), all))}>
                <svg viewBox="0 0 100 100" className="h-7 w-9" aria-hidden><path d={s.path} fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth="5" /></svg>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
      </>}
    </div>
  );
  return inPage ? createPortal(panel, inPage) : panel;
}
