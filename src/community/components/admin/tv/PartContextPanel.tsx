/**
 * The panel of what was chosen on the board: a container's board, its frame,
 * its shape, its text, or the main background's - each with its own choices
 * only, right under the board. One rule behind it (containerParts.ts): every
 * container has one board and one frame, drawn or painted; the board takes a
 * colour or a background of the gallery, the frame is replaced, and the shape
 * changes the board and the frame together.
 */
import { useState } from "react";
import { X } from "lucide-react";
import type { TvConfig } from "@/tv/config";
import { useElementEditing } from "@/tv/elementEditing";
import { colourBoards, colourFrames, containersOf, paintBoards, roleOf, wearFrame, type PartRole } from "@/tv/containerParts";
import { wearsPaint } from "@/tv/partPaint";
import { galleryOf } from "@/tv/backgrounds";
import { FRAME_PICTURES, FRAME_PICTURE_PREFIX, framePictureUrl } from "@/tv/framePictures";
import { PART_SHAPES } from "@/tv/partShapes";
import { setSectionShape } from "@/tv/sectionGeometry";
import { normalizeElements, type BoardElement } from "@/tv/elements";
import { toast } from "sonner";
import { ColorPick } from "./ColorPick";
import { BackgroundTile } from "./LayerEditors";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;
type Tab = "board" | "frame" | "shape" | "text";

const TAB_NAMES: Record<Tab, string> = { board: "הלוח", frame: "המסגרת", shape: "הצורה", text: "הטקסט" };
const ROLE_TAB: Record<PartRole, Tab> = { board: "board", frame: "frame", text: "text", ornament: "board", picture: "board" };
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
  if (!editing || !first) return null;
  const containers = containersOf(config.elements, chosen);
  const own = config.elements.filter((e) => containers[0]?.ids.includes(e.id));
  const key = chosen.join(",");
  const tab: Tab = tabFor?.key === key ? tabFor.tab : ROLE_TAB[roleOf(first)];
  const many = containers.length > 1;
  const title = many ? `${containers.length} קונטיינרים` : containerName(config, own);
  const board = containers[0]?.board ?? null;
  const frame = containers[0]?.frame ?? null;
  const texts = config.elements.filter((e) => e.kind === "text" && containers.some((c) => c.ids.includes(e.id)));

  const editEls = (k: string, f: (all: BoardElement[]) => BoardElement[]) => onEdit(`ctx:${k}:${key}`, (c) => ({ ...c, elements: f(c.elements) }));

  return (
    // Over the board, on the side away from what was chosen: chosen low, it opens at the top.
    <div
      className={`absolute inset-x-2 z-30 max-h-[48%] overflow-y-auto rounded-lg border bg-card/95 p-2 text-sm shadow-lg backdrop-blur ${first.y + first.height / 2 > 50 ? "top-2" : "bottom-2"}`}
      dir="rtl"
      data-testid="part-context-panel"
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">נבחר: {title}</span>
        <span className="text-muted-foreground">←</span>
        {(Object.keys(TAB_NAMES) as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t}
            className={`h-7 rounded-md border px-2 text-xs ${tab === t ? "border-primary bg-primary/10 font-semibold" : "hover:border-primary/50"}`}
            onClick={() => setTabFor({ key, tab: t })}>
            {TAB_NAMES[t]}
          </button>
        ))}
        <button type="button" aria-label="סגירת החלון" className="ms-auto rounded p-1 hover:bg-muted" onClick={() => editing.select([])}>
          <X className="size-4" aria-hidden />
        </button>
      </div>

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
            {!board && <span className="text-muted-foreground">לקונטיינר הזה אין לוח.</span>}
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
                  onClick={() => {
                    const { curved } = wearFrame(config.elements, chosen, ref);
                    editEls("frame-picture", (all) => wearFrame(all, chosen, ref).elements);
                    if (curved) toast("מסגרת מתמונה נכנסת רק לצורה מלבנית או מעוגלת. בצורה הזאת המסגרת היא קו שעוקב אחרי הצורה - אפשר לשנות לו צבע, או לבחור צורה מעוגלת בלשונית \"הצורה\".");
                  }}>
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

      {tab === "text" && (
        <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="ctx-text">
          {texts.length ? (
            <>
              <label className="flex items-center gap-1.5">
                צבע הטקסט ({texts.length})
                <ColorPick label="צבע הטקסט בקונטיינר" className="h-7 w-9" value={/^#[\da-f]{6}$/i.test(texts[0].color) ? texts[0].color : "#3a2a12"}
                  onChange={(v) => editEls("text-colour", (all) => normalizeElements(all.map((e) => (texts.some((t) => t.id === e.id) ? { ...e, color: v } : e))))} />
              </label>
              <span className="text-muted-foreground">גופן, גודל ותוכן - בכלי הטקסט שמתחת.</span>
            </>
          ) : (
            <span className="text-muted-foreground">אין טקסט בקונטיינר הזה.</span>
          )}
        </div>
      )}
    </div>
  );
}
