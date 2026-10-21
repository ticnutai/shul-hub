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
import { Hint } from "@/components/InfoTip";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PART_PANEL_SLOT } from "../adminPath";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, GripVertical, X } from "lucide-react";
import type { TvConfig } from "@/tv/config";
import { useElementEditing } from "@/tv/elementEditing";
import { colourBoards, colourFrames, containersOf, paintBoards, roleOf, wearFrame } from "@/tv/containerParts";
import { addContainer, addInside, addPictureAlone, containerTree, fitIntoContainer, moveChosenLayer, newContainerParts, type InsideKind } from "@/tv/containers";
import { MAX_ELEMENTS, elementId } from "@/tv/elements";
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
import { GalleryGrid, GalleryTile } from "./GalleryTile";
import { NextMarkTools } from "./NextMarkTools";
import { LiveListTools, liveParts } from "./LiveListTools";
import { ElementTextTools } from "./ElementTextTools";
import { marksNext } from "@/tv/nextMark";
import { ImagePick, InsideButtons, SaveToParts, type Picture } from "./ContainerAdd";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;
type Tab = "background" | "board" | "frame" | "shape" | "text" | "content" | "ornament" | "next" | "add";

const TAB_NAMES: Record<Tab, string> = {
  background: "הרקע", board: "הלוח", frame: "המסגרת", shape: "הצורה", text: "טקסט", content: "התוכן", ornament: "העיטור", next: "סימון הבא", add: "הוספה",
};
/** Where the panel was dragged to, for next time (this browser). */
const PANEL_POS_KEY = "tv-part-panel-pos";
/** Its size, once resized by its handles (this browser, and the gabbai's account - editorPrefs.ts). */
const PANEL_SIZE_KEY = "tv-part-panel-size";
const readSize = (): { w: number; h: number } | null => {
  try {
    const v = JSON.parse(localStorage.getItem(PANEL_SIZE_KEY) ?? "null");
    return v && Number.isFinite(v.w) && Number.isFinite(v.h) ? v : null;
  } catch {
    return null;
  }
};
/** The handles round the panel: its four sides and four corners. */
const HANDLES = [
  ["n", "inset-x-3 top-0 h-1.5 cursor-ns-resize"], ["s", "inset-x-3 bottom-0 h-1.5 cursor-ns-resize"],
  ["e", "inset-y-3 right-0 w-1.5 cursor-ew-resize"], ["w", "inset-y-3 left-0 w-1.5 cursor-ew-resize"],
  ["ne", "right-0 top-0 size-3 cursor-nesw-resize"], ["nw", "left-0 top-0 size-3 cursor-nwse-resize"],
  ["se", "right-0 bottom-0 size-3 cursor-nwse-resize"], ["sw", "left-0 bottom-0 size-3 cursor-nesw-resize"],
] as const;
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
    window.dispatchEvent(new Event(PANEL_POS_KEY));
  };
  const [size, setSize] = useState<{ w: number; h: number } | null>(readSize);
  const keepSize = (v: { w: number; h: number } | null) => {
    setSize(v);
    try {
      if (v) localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify(v));
      else localStorage.removeItem(PANEL_SIZE_KEY);
    } catch {
      /* private window */
    }
    window.dispatchEvent(new Event(PANEL_SIZE_KEY));
  };
  // Brought from the gabbai's account (another computer): taken here too.
  useEffect(() => {
    const pos = () => {
      try {
        const v = JSON.parse(localStorage.getItem(PANEL_POS_KEY) ?? "null");
        setMoved(v && Number.isFinite(v.x) && Number.isFinite(v.y) ? v : null);
      } catch {
        /* storage unavailable */
      }
    };
    const sz = () => setSize(readSize());
    window.addEventListener(`${PANEL_POS_KEY}:from-account`, pos);
    window.addEventListener(`${PANEL_SIZE_KEY}:from-account`, sz);
    return () => {
      window.removeEventListener(`${PANEL_POS_KEY}:from-account`, pos);
      window.removeEventListener(`${PANEL_SIZE_KEY}:from-account`, sz);
    };
  }, []);
  /**
   * A handle dragged: wider, narrower, taller, shorter - from any side or
   * corner. Where it stood beside the board or in the page, it comes out to
   * float where it is, and is then sized; both kept for next time.
   */
  const resize = (dir: string) => (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const r = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    let last = { x: r.left, y: r.top, w: r.width, h: r.height };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let { x, y, w, h } = { x: r.left, y: r.top, w: r.width, h: r.height };
      if (dir.includes("e")) w = r.width + dx;
      if (dir.includes("w")) w = r.width - dx;
      if (dir.includes("s")) h = r.height + dy;
      if (dir.includes("n")) h = r.height - dy;
      w = Math.min(Math.max(280, w), window.innerWidth - 8);
      h = Math.min(Math.max(120, h), window.innerHeight - 8);
      // The side dragged moves; the one across from it stays.
      if (dir.includes("w")) x = r.right - w;
      if (dir.includes("n")) y = r.bottom - h;
      x = Math.min(Math.max(0, x), window.innerWidth - w);
      y = Math.min(Math.max(0, y), window.innerHeight - 60);
      last = { x, y, w, h };
      setMoved({ x, y });
      setSize({ w, h });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      keep({ x: last.x, y: last.y });
      keepSize({ w: last.w, h: last.h });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
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
      newContainer(shape as PartShape, { x: Math.min(70, Math.max(0, x - 15)), y: Math.min(56, Math.max(0, y - 22)), width: 30, height: 44 });
    };
    host.addEventListener("dragover", over);
    host.addEventListener("drop", drop);
    return () => {
      host.removeEventListener("dragover", over);
      host.removeEventListener("drop", drop);
    };
  });
  /** Room for this many more parts on the board, else said so. */
  const room = (n: number) => {
    const have = configRef.current.elements.length;
    if (have + n <= MAX_ELEMENTS) return true;
    toast.error(`בלוח יש כבר ${have} חלקים - עד ${MAX_ELEMENTS}.`);
    return false;
  };
  /** A new container - in the middle, or where a shape was dropped; with a picture of one's own if given - chosen at once. */
  const newContainer = (shape: PartShape, at?: { x: number; y: number; width: number; height: number }, image?: Picture) => {
    if (!room(3)) return;
    const made = newContainerParts(at ?? { x: 35, y: 28, width: 30, height: 44 }, shape, image);
    onEdit(`ctx:container-new:${made.container.id}`, (c) => ({ ...c, ...addContainer(c, made) }));
    editing?.select(made.parts.map((e) => e.id));
    toast(image ? "נוסף קונטיינר עם התמונה, והוא בחור: גררו אותו למקום, ובלשונית \"הוספה\" מוסיפים לתוכו טקסט, תיבה ועוד." : "נוסף קונטיינר, והוא בחור: אפשר לגרור אותו, ולשנות לו לוח, מסגרת, צורה וטקסט.");
  };
  /** A picture alone on the board, no board or frame round it. */
  const pictureAlone = (image: Picture) => {
    if (!room(1)) return;
    const id = elementId();
    onEdit(`ctx:picture-alone:${id}`, (c) => ({ ...c, ...addPictureAlone(c, id, image) }));
    editing?.select([id]);
    toast(`"${image.name}" נוספה לבד - גררו אותה למקום, ושנו גודל בידיות.`);
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
  // A live list or paragraph chosen (or in the container chosen): its content - rows, turns, seconds, the times shown, where its words come from.
  const live = liveParts(config.elements.filter((e) => chosen.includes(e.id) || (!onlyTexts && own.some((o) => o.id === e.id))));
  const contentTab: Tab[] = live.length ? ["content"] : [];
  const nextTab: Tab[] = lists.length ? ["next"] : [];
  const tabs: Tab[] =
    role === "backdrop"
      ? ["background", "add"]
      : onlyTexts
        ? [...contentTab, ...textTab, ...nextTab, ...(board || frame ? (["board", "frame", "shape"] as Tab[]) : []), "add"]
        : decor && !board && !frame
          ? ["ornament", "add"]
          : ["board", "frame", "shape", ...contentTab, ...textTab, ...(decor ? (["ornament"] as Tab[]) : []), ...nextTab, "add"];
  // A live list clicked opens on its content (the rows and the turns); any other text on its letters.
  const liveChosen = chosen.length > 0 && chosen.every((id) => live.some((e) => e.id === id));
  const natural: Tab = role === "backdrop" ? "background" : liveChosen ? "content" : onlyTexts || (role === "text" && texts.length) ? tabs.includes("text") ? "text" : tabs[0] : role === "frame" ? "frame" : decor ? "ornament" : tabs[0];
  const tab: Tab = tabFor?.key === key && tabs.includes(tabFor.tab) ? tabFor.tab : natural;
  const title = role === "backdrop" ? "הרקע הראשי" : many ? `${containers.length} קונטיינרים` : decor && !board && !frame ? first.name : containerName(config, own);
  /** The painted decorations of the main container: pieces of the kit's picture that are no container's board or frame. */
  const paintedDecor = role === "backdrop"
    ? config.elements.filter((e) => e.kind === "image" && (e.crop || e.sourceMask) && roleOf(e) === "ornament" && !containersOf(config.elements, [e.id]).some((c) => c.board || c.frame))
    : [];
  const decorHidden = paintedDecor.length > 0 && paintedDecor.every((e) => e.hidden);
  const ornaments = config.elements.filter((e) => chosen.includes(e.id) && (roleOf(e) === "ornament" || roleOf(e) === "picture"));
  // A picture of one's own chosen alone: put into a container, where it fills it and goes with it as live content does.
  const picture = chosen.length === 1 && first.kind === "image" && roleOf(first) === "picture" ? first : null;
  const allContainers = picture ? containerTree(config.elements, config.containers ?? []).containers : [];
  const pictureIn = allContainers.find((c) => c.parts.includes(picture?.id ?? "") && c.parts.length > 1) ?? null;
  const intoTargets = allContainers.filter((c) => c.parts.some((id) => id !== picture?.id));
  /** Into a container: the picture its content now - its words hidden under it, to be shown again here. A fitting again leaves them as they are. */
  const putInto = (containerId: string) => {
    if (!picture) return;
    const again = pictureIn?.id === containerId;
    // What the container showed - its words and its decorations, not its board and its frame - hidden under the picture.
    const before = intoTargets.find((c) => c.id === containerId)?.parts ?? [];
    const shown = (e: BoardElement) => before.includes(e.id) && e.id !== picture.id && !["board", "frame", "backdrop"].includes(roleOf(e));
    onEdit(`ctx:into-container:${picture.id}:${containerId}`, (c) => {
      const fitted = { ...c, ...fitIntoContainer(c, picture.id, containerId) };
      return again ? fitted : { ...fitted, elements: fitted.elements.map((e) => (shown(e) ? { ...e, hidden: true } : e)) };
    });
    editing?.select([picture.id]);
    const name = intoTargets.find((c) => c.id === containerId)?.name ?? "הקונטיינר";
    if (!again) toast.success(`התמונה היא עכשיו התוכן של „${name}”: ממלאת אותו, וזזה וגדלה יחד איתו. מה שהיה בו (כתוב וקישוטים) הוסתר - אפשר להחזיר אותו כאן.`);
  };
  const pictureWords = pictureIn ? config.elements.filter((e) => pictureIn.parts.includes(e.id) && e.id !== picture?.id && !["board", "frame", "backdrop"].includes(roleOf(e))) : [];
  const wordsHidden = pictureWords.length > 0 && pictureWords.every((e) => e.hidden);
  // One container chosen: what is added in "הוספה" goes inside it.
  const tree = role === "backdrop" || many ? null : containerTree(config.elements, config.containers ?? []);
  const inside = tree?.containers.find((c) => c.parts.includes(first.id)) ?? null;
  const insideFrame = Boolean(inside && config.elements.some((e) => inside.parts.includes(e.id) && roleOf(e) === "frame"));
  const putInside = (kind: InsideKind, more?: Partial<BoardElement>) => {
    if (!inside || !room(1)) return;
    const id = elementId();
    onEdit(`ctx:inside:${inside.id}:${id}`, (c) => ({ ...c, ...addInside(c, inside.id, id, kind, more) }));
    editing?.select([id]);
  };
  // "שמירה בחלקים שלי": the whole of the containers chosen (with the containers inside them), else what was chosen - a picture alone, a text.
  const keepIds = role === "backdrop" ? [] : containers.length ? [...new Set(containers.flatMap((c) => c.ids))] : chosen;
  const keepEls = config.elements.filter((e) => keepIds.includes(e.id));
  const editEls = (k: string, f: (all: BoardElement[]) => BoardElement[]) => onEdit(`ctx:${k}:${key}`, (c) => ({ ...c, elements: f(c.elements) }));

  // Beside the board when there is room; where it was dragged to; else in its own place under the board, in the page -
  // pushing what is under it down rather than covering it (the text bar, the buttons under the board).
  const docked = place && !moved;
  const inPage = !docked && !moved ? document.getElementById(PART_PANEL_SLOT) : null;
  const panel = (
    <div
      ref={ref}
      className={`flex flex-col rounded-lg border bg-card text-sm ${docked ? "absolute z-50 shadow-xl" : inPage ? "relative mt-2 shadow-sm" : "fixed z-50 max-h-[45vh] w-[min(440px,calc(100vw-32px))] shadow-xl"}`}
      style={docked ? { top: place.top, height: folded ? undefined : place.height, width: place.width, ...(place.left ? { left: 6 } : { right: 6 }) } : inPage ? undefined : { left: moved!.x, top: moved!.y, ...(size ? { width: size.w, height: folded ? undefined : size.h, maxHeight: "none" } : {}) }}
      dir="rtl"
      data-testid="part-context-panel"
      data-place={docked ? "side" : inPage ? "page" : "float"}
    >
      {/* Its handles, on the frame and not in what scrolls: wider, narrower, taller, shorter, from any side. */}
      {!folded && HANDLES.map(([dir, at]) => (
        <span key={dir} aria-hidden data-resize-panel={dir} onPointerDown={resize(dir)} className={`absolute z-10 touch-none ${at}`} title="גרירה משנה את גודל החלון" />
      ))}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
      <div className="mb-2 flex cursor-move flex-wrap items-center gap-1.5 select-none" onPointerDown={drag} onDoubleClick={() => { keep(null); keepSize(null); }}
        title="גרירה מזיזה את החלון; לחיצה כפולה מחזירה אותו למקומו" data-testid="part-context-handle">
        <GripVertical className="size-4 text-muted-foreground" aria-hidden />
        <span className="font-semibold">נבחר: {title}</span>
        <span className="text-muted-foreground">←</span>
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t}
            className={`h-7 rounded-md border px-2 text-xs ${tab === t ? "border-primary bg-primary/10 font-semibold" : "hover:border-primary/50"}`}
            onClick={() => { setTabFor({ key, tab: t }); setFolded(false); }}>
            {t === "ornament" && picture ? "התמונה" : TAB_NAMES[t]}
          </button>
        ))}
        <span className="ms-auto flex flex-wrap items-center justify-end gap-1">
          {/* The layers: what is chosen, over or under its neighbours - a whole container, or one part inside its container. */}
          {role !== "backdrop" && (
            <span className="inline-flex items-center rounded-md border" role="group" aria-label="סדר השכבות" data-testid="ctx-layers">
              {([["up", true, ChevronsUp, "לראש השכבות - מעל כולם"], ["up", false, ArrowUp, "שכבה למעלה - מעל השכן"], ["down", false, ArrowDown, "שכבה למטה - מתחת לשכן"], ["down", true, ChevronsDown, "לתחתית השכבות - מתחת לכולם"]] as const).map(([dir, end, Icon, label]) => (
                <button key={label} type="button" aria-label={label} title={label} className="rounded p-1 hover:bg-muted"
                  onClick={() => onEdit(`ctx:layer:${dir}:${end}:${key}`, (c) => ({ ...c, ...moveChosenLayer(c, chosen, dir, end) }))}>
                  <Icon className="size-4" aria-hidden />
                </button>
              ))}
            </span>
          )}
          {keepEls.length > 0 && <SaveToParts key={keepIds.join(",")} config={config} onEdit={onEdit} elements={keepEls} name={title} compact />}
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
          <Hint>לחיצה כפולה על טקסט בלוח - כותבים בו ישירות. Enter לסיום, Esc לביטול.</Hint>
        </div>
      )}

      {tab === "content" && (
        <LiveListTools parts={live} config={config}
          onPatch={(id, p, what) => onEdit(`ctx:content:${what}:${id}`, (c) => ({ ...c, elements: c.elements.map((e) => (e.id === id && !e.locked ? { ...e, ...p } : e)) }))} />
      )}

      {tab === "next" && (
        <div data-testid="ctx-next">
          <NextMarkTools elements={config.elements} texts={lists}
            onPatch={(ids, p, what) => onEdit(`ctx:${what}:${ids.join(",")}`, (c) => ({ ...c, elements: c.elements.map((e) => (ids.includes(e.id) && !e.locked ? { ...e, ...p } : e)) }))} />
        </div>
      )}

      {tab === "ornament" && picture && intoTargets.length > 0 && (
        <div className="mb-2 space-y-1 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs" data-testid="ctx-into-container">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 font-medium">
              {pictureIn ? "בתוך:" : "הכנסה לקונטיינר:"}
              <select aria-label="הכנסה לקונטיינר" className="h-7 max-w-48 rounded border bg-background px-1" value={pictureIn?.id ?? ""}
                onChange={(e) => e.target.value && putInto(e.target.value)}>
                {!pictureIn && <option value="">בחירת קונטיינר…</option>}
                {intoTargets.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {pictureIn && (
              <button type="button" className="h-7 rounded-md border bg-background px-2 hover:border-primary/50" onClick={() => putInto(pictureIn.id)}
                title="התמונה ממלאת שוב את הקונטיינר - אחרי שהוא הוזז, הוגדל או קיבל צורה אחרת">
                התאמה מחדש לקונטיינר
              </button>
            )}
            {pictureWords.length > 0 && (
              <button type="button" className="h-7 rounded-md border bg-background px-2 hover:border-primary/50"
                onClick={() => editEls("picture-words", (all) => all.map((e) => (pictureWords.some((w) => w.id === e.id) ? { ...e, hidden: !wordsHidden } : e)))}>
                {wordsHidden ? "הצגת מה שהיה בקונטיינר" : "הסתרת מה שהיה בקונטיינר"}
              </button>
            )}
          </div>
          <Hint>התמונה נעשית התוכן של הקונטיינר: ממלאת אותו בצורה שלו, וזזה וגדלה יחד איתו - כמו תוכן חי. מה שהיה בו (כתוב וקישוטים) מוסתר, ואפשר להחזיר אותו.</Hint>
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
            {ornaments.every((e) => e.hidden) ? (picture ? "הצגת התמונה" : "הצגת העיטור") : (picture ? "הסתרת התמונה" : "הסתרת העיטור")}
          </button>
          <span className="text-muted-foreground">עיטורים חדשים מוסיפים ב"חלקים" ← "הוספת עיטור".</span>
        </div>
      )}

      {tab === "add" && (
        <div className="space-y-2.5" data-testid="ctx-add">
          {inside && (
            <div className="space-y-1 rounded-md border border-primary/30 bg-primary/5 p-2" data-testid="ctx-add-inside">
              <p className="text-xs font-medium">להוסיף לתוך „{inside.name}”</p>
              <InsideButtons name={inside.name} hasFrame={insideFrame} onAdd={putInside} />
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xs font-medium">קונטיינר חדש</p>
            <Hint>גוררים צורה אל הלוח - ונוצר שם קונטיינר שלם (לוח, מסגרת וכותרת) בצורה הזאת. לחיצה מוסיפה אותו באמצע.</Hint>
            <div className="flex flex-wrap gap-1.5">
              {PART_SHAPES.map((s) => (
                <button key={s.id} type="button" draggable aria-label={`קונטיינר חדש: ${s.name}`} title={`גרירה ללוח: קונטיינר ב${s.name}`}
                  className={`${tile} cursor-grab`}
                  onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, s.id); e.dataTransfer.effectAllowed = "copy"; }}
                  onClick={() => newContainer(s.id)}>
                  <svg viewBox="0 0 100 100" className="h-7 w-9" aria-hidden><path d={s.path} fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth="5" /></svg>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs" data-testid="ctx-add-picture">
            <span className="flex flex-wrap items-center gap-1" title="לוח, התמונה ומסגרת - קונטיינר שלם, ואפשר להוסיף לתוכו טקסט ותיבות">
              <ImagePick label="קונטיינר עם תמונה" what="קונטיינר חדש" onPick={(p) => newContainer("rounded", undefined, p)} />
            </span>
            <span className="flex flex-wrap items-center gap-1" title="התמונה לבד, בלי לוח ובלי מסגרת">
              <ImagePick label="תמונה לבד" what="תמונה לבד" onPick={pictureAlone} />
            </span>
          </div>
          <Hint>כל תמונה שמעלים נשמרת ב"התמונות שלי". כדי לשמור קונטיינר שלם או תמונה - בוחרים אותם ולוחצים "שמירה בחלקים שלי" למעלה.</Hint>
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
          {/* The gallery's own tiles, in the size chosen for every gallery. */}
          <div className="max-h-56 overflow-y-auto p-0.5">
            <GalleryGrid testId="ctx-board-gallery" compact>
              {galleryOf(config).map((b) => (
                <GalleryTile key={b.id} compact name={b.name} on={Boolean(board && wearsPaint(board, b))}
                  onPick={() => editEls("board-paint", (all) => paintBoards(all, chosen, b))} preview={<BackgroundTile b={b} />} />
              ))}
            </GalleryGrid>
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
          <div className="max-h-56 overflow-y-auto p-0.5">
            <GalleryGrid testId="ctx-frame-gallery" compact>
              <GalleryTile compact name="קו מצויר" on={Boolean(frame && frame.kind === "frame" && !frame.image)}
                onPick={() => editEls("frame-line", (all) => wearFrame(all, chosen, null).elements)}
                preview={<span className="absolute inset-[18%] rounded-sm border-2 border-[#c9a24a]" />} />
              {FRAME_PICTURES.map((f) => {
                const ref = FRAME_PICTURE_PREFIX + f.id;
                return (
                  <GalleryTile key={f.id} compact name={f.name} on={frame?.image === ref}
                    onPick={() => editEls("frame-picture", (all) => wearFrame(all, chosen, ref).elements)}
                    preview={<span className="absolute inset-[12%]" style={{ border: "7px solid transparent", borderImage: `url("${framePictureUrl(ref)}") ${f.slice}% / 7px stretch` }} />} />
                );
              })}
            </GalleryGrid>
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
    </div>
  );
  return inPage ? createPortal(panel, inPage) : panel;
}
