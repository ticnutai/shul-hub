/**
 * The boxes and frames topics, on a board of parts: the same galleries as on
 * an ordinary board, applied to the parts chosen on the board - one system,
 * not two. Nothing chosen: a tile adds a new part in that shape (or frame),
 * chosen at once, to drag into place.
 */
import { toast } from "sonner";
import type { TvConfig } from "@/tv/config";
import { MAX_ELEMENTS, newElement, normalizeElements, type BoardElement } from "@/tv/elements";
import { useElementEditing } from "@/tv/elementEditing";
import { PART_SHAPES, type PartShape } from "@/tv/partShapes";
import { setSectionShape } from "@/tv/sectionGeometry";
import { GalleryGrid, GalleryTile } from "./GalleryTile";
import { ColourRow } from "./editorParts";
import { Notice } from "./Notice";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/** The shapes whose edges are straight: a frame of a picture goes on them. */
const STRAIGHT: readonly PartShape[] = ["rectangle", "rounded"];

/** A board of parts: its boxes and frames are parts, not the ordinary board's boxes. */
export const isPartsBoard = (c: TvConfig) => c.screenLayout === "composition";

/** The parts chosen on the board, as these topics read them. */
export function usePartTargets(config: TvConfig) {
  const editing = useElementEditing();
  const selected = editing?.selected ?? [];
  const chosen = config.elements.filter((e) => selected.includes(e.id) && !e.locked);
  return {
    select: (ids: string[]) => editing?.select(ids),
    /** Boxes and frames: what takes a shape, a line and a fill. */
    boxes: chosen.filter((e) => e.kind === "box" || e.kind === "frame"),
    /** Frames: what wears a frame of the gallery. */
    frames: chosen.filter((e) => e.kind === "frame"),
    /** What takes a shape: boxes, frames, and pictures of one's own (not pieces of a kit's painting). */
    shaped: chosen.filter((e) => e.kind === "box" || e.kind === "frame" || (e.kind === "image" && e.image && !e.crop && !e.sourceMask)),
  };
}

/** A new part in the middle of the board, chosen - over the others, to drag into place. */
function addPart(onEdit: Edit, select: (ids: string[]) => void, part: Partial<BoardElement> & { kind: BoardElement["kind"] }, what: string) {
  const e = { ...newElement(part.kind), ...part, x: 35, y: 30, width: 30, height: 40 };
  onEdit(`part-add:${e.id}`, (c) => (c.elements.length >= MAX_ELEMENTS ? c : { ...c, elements: normalizeElements([...c.elements, e]) }));
  select([e.id]);
  toast(`נוספה ${what} באמצע הלוח, והיא בחורה: גררו אותה למקום, או שנו לה צורה ומסגרת כאן.`);
}

/** The line at the top of each topic: what the galleries below do on this board. */
export function PartsBoardNote({ count, kind }: { count: number; kind: "box" | "frame" }) {
  const name = kind === "frame" ? "מסגרת" : "תיבה";
  return (
    <Notice variant="neutral" data-testid="parts-board-note">
      הלוח הזה בנוי מחלקים, ולכן מה שבוחרים כאן חל על החלקים שבחרתם בלוח
      {count ? ` - נבחרו ${count}.` : `. אין ${name} בחורה: לחיצה על אפשרות מוסיפה ${name} חדשה.`} חלקים מצוירים מתמונה (הקשתות והעמודים של ערכה) לא מקבלים
      צורה וצבע - רק תיבות ומסגרות שמוסיפים. לבחירת כמה יחד: "כל התיבות" או "כל המסגרות" למעלה.
    </Notice>
  );
}

/** The shapes, on the parts chosen - or a new box in the shape chosen. */
export function PartShapeGallery({ config, onEdit }: { config: TvConfig; onEdit: Edit }) {
  const { shaped: boxes, select } = usePartTargets(config);
  const worn = boxes.length && boxes.every((e) => e.shape === boxes[0].shape) ? boxes[0].shape : null;
  const wear = (shape: PartShape, name: string) => {
    if (!boxes.length) return addPart(onEdit, select, { kind: "box", shape, fill: "#fff5dc", name: `תיבה - ${name}` }, `תיבה בצורת ${name}`);
    const ids = boxes.map((e) => e.id);
    onEdit(`part-shape:${ids.join(",")}:${shape}`, (c) => ({ ...c, elements: ids.reduce((all, id) => setSectionShape(all, id, shape), c.elements) }));
  };
  return (
    <div className="space-y-2" data-testid="part-shapes">
      <PartsBoardNote count={boxes.length} kind="box" />
      <GalleryGrid testId="part-shape-tiles">
        {PART_SHAPES.map((s) => (
          <GalleryTile
            key={s.id}
            name={s.name}
            on={worn === s.id}
            onPick={() => wear(s.id, s.name)}
            preview={
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mx-auto h-3/5 w-3/5" aria-hidden>
                <path d={s.path} fill="#15233f" stroke="#c9a227" strokeWidth={3} vectorEffect="non-scaling-stroke" />
              </svg>
            }
          />
        ))}
      </GalleryGrid>
    </div>
  );
}

/** The colour of the parts chosen: the line of a box or a frame, or the fill of a box. */
export function PartColour({ config, onEdit, what }: { config: TvConfig; onEdit: Edit; what: "line" | "fill" }) {
  const { boxes } = usePartTargets(config);
  const targets = what === "fill" ? boxes.filter((e) => e.kind === "box") : boxes;
  if (!targets.length) return <p className="text-[11px] text-muted-foreground">בחרו בלוח {what === "fill" ? "תיבה" : "תיבה או מסגרת"} כדי לשנות לה צבע.</p>;
  const ids = targets.map((e) => e.id);
  const set = (patch: Partial<BoardElement>) =>
    onEdit(`part-${what}:${ids.join(",")}`, (c) => ({ ...c, elements: normalizeElements(c.elements.map((e) => (ids.includes(e.id) ? { ...e, ...patch } : e))) }));
  const first = targets[0];
  return what === "fill" ? (
    <ColourRow
      label={`מילוי ${targets.length > 1 ? `${targets.length} התיבות שבחרתם` : "התיבה שבחרתם"}`}
      value={first.fill === "transparent" ? "#ffffff" : first.fill}
      onChange={(v) => set({ fill: v })}
      reset={{ label: "בלי מילוי", onClick: () => set({ fill: "transparent" }), disabled: targets.every((e) => e.fill === "transparent") }}
    />
  ) : (
    <ColourRow label={`הקו של ${targets.length > 1 ? `${targets.length} החלקים שבחרתם` : "החלק שבחרתם"}`} value={first.color} onChange={(v) => set({ color: v })} />
  );
}

/**
 * The frames of the gallery, on the frames chosen: what they wear now, and
 * wearing one (a ref of the gallery or an uploaded picture; null - the drawn
 * line again). Nothing chosen: a new frame wearing it.
 */
export function usePartFramePictures(config: TvConfig, onEdit: Edit) {
  const { frames, select } = usePartTargets(config);
  const wearing = frames.length && frames.every((e) => e.image === frames[0].image) ? frames[0].image || null : null;
  const wear = (ref: string | null, name: string) => {
    if (!frames.length) {
      if (ref) addPart(onEdit, select, { kind: "frame", image: ref, name: `מסגרת - ${name}` }, `מסגרת "${name}"`);
      return;
    }
    // The frame keeps its board's shape: a picture's straight edges go on a straight one only - on a
    // cut shape (a dome, a scallop...) the line follows the shape instead, as on an ordinary board.
    const fits = frames.filter((e) => !ref || !e.shape || STRAIGHT.includes(e.shape));
    if (fits.length < frames.length)
      toast(`מסגרת מתמונה נכנסת רק לתבנית מלבנית או מעוגלת. ${frames.length - fits.length} מהמסגרות שבחרתם בצורה אחרת, ושם הקו עוקב אחרי הצורה - אפשר לשנות לו צבע למטה.`);
    if (!fits.length) return;
    const ids = fits.map((e) => e.id);
    // On a straight board the picture is the frame's look; "קו מצויר" takes it off, and the shape stays.
    onEdit(`part-frame:${ids.join(",")}`, (c) => ({
      ...c,
      elements: normalizeElements(c.elements.map((e) => (ids.includes(e.id) ? { ...e, image: ref ?? "", shape: ref ? undefined : e.shape } : e))),
    }));
  };
  return { count: frames.length, wearing, wear };
}
