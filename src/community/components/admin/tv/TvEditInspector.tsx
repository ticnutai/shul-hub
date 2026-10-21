import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Bold,
  Crosshair,
  Eye,
  EyeOff,
  Globe,
  Move,
  MousePointerClick,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EDITABLE,
  FAMILY_PREFIX,
  familyKey,
  isHidden,
  resolveElementStyle,
  setElementStyle,
  setHidden,
  setText,
  STYLE_FAMILIES,
  styleTargetKey,
  toggleFlip,
} from "@/tv/boardEdit";
import type { ElementStyle, FlipArea, RecordTable, TvConfig } from "@/tv/config";
import { applyBackground, galleryOf, writeBoardBackground, wears } from "@/tv/backgrounds";
import { usePointerDrag } from "@/tv/usePointerDrag";
import { BoardFramePicker, FrameAndSpacing } from "./BoardLook";
import type { BoardData } from "@/tv/useBoardData";
import { moveAnnouncement, withRecordEdit } from "./tvRecords";
import { ColorPick } from "./ColorPick";
import { ColourChoice, MoveButtons, Range, SELECT_CLASS, Segments, Stepper } from "./editorParts";
import { GalleryGrid, GalleryTile, UploadTile } from "./GalleryTile";
import { BackgroundTile, withUploadedBackgrounds } from "./LayerEditors";
import { HiddenShelf } from "./ReadyShelf";
import { useUpload } from "./Upload";
import { useElementEditing } from "@/tv/elementEditing";
import { wearsPaint } from "@/tv/partPaint";
import { colourBoards, containersOf, hideBackdrops, isBackdrop, paintBoards, showBackdrops } from "@/tv/containerParts";
import { Notice } from "./Notice";

/**
 * The form for whatever the admin clicked on the board. Every change goes
 * into the editor's draft (undo/redo, discard) and reaches the screens only
 * with "שמור ושדר".
 */

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

const FLIP_LABELS: Record<FlipArea, string> = {
  header: "החלפת צד: שם בית הכנסת ↔ שעון",
  prayer: "החלפת צד: מניינים ↔ זמני היום",
  learning: "היפוך סדר הכרטיסים",
};

const RECORD_RE = /^(ann|shiur|minyan):([0-9a-f-]{8,})(?::([a-z_]+))?$/i;
const TABLE_OF = { ann: "announcements", shiur: "shiurim", minyan: "minyanim" } as const;
const FIELD_LABELS: Record<string, string> = {
  title: "כותרת",
  body: "תוכן",
  teacher: "מגיד השיעור",
  label: "שם המניין",
};
const KIND_LABELS = { ann: "מודעה", shiur: "שיעור", minyan: "מניין" } as const;
/** A whole prayer panel - a category, e.g. "סליחות" - taken off the board. */
const CATEGORY_RE = /^cat:([0-9a-zA-Z_-]{2,})$/;

export function TvEditInspector({
  selected,
  config,
  data,
  onEdit,
  onSelect,
}: {
  selected: string | null;
  config: TvConfig;
  data: BoardData;
  onEdit: Edit;
  onSelect: (key: string | null) => void;
}) {
  const hiddenList = [
    ...config.hidden,
    ...(!config.header.parasha ? ["header.parasha"] : []),
    ...(!config.header.dafYomi ? ["header.daf"] : []),
    ...(!config.header.logo ? ["header.logo"] : []),
    ...(!config.ticker.enabled && config.ticker.text ? ["ticker"] : []),
  ];

  return (
    <div className="rounded-xl border-2 border-primary/40 bg-card p-3 shadow-sm" dir="rtl">
      {selected ? (
        <Selected
          key={selected}
          k={selected}
          config={config}
          data={data}
          onEdit={onEdit}
          onClose={() => onSelect(null)}
        />
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MousePointerClick className="size-4 shrink-0" />
          לחצו על כל טקסט או אזור בלוח כדי לערוך, להסתיר או להזיז אותו. זה עובד בכל אחד מהמכשירים
          שבתפריט המכשיר.
        </p>
      )}

      {/* What was taken off the board: on the one shelf every list keeps its hidden ones on. */}
      <div className="mt-3">
        <HiddenShelf
          testId="board-hidden"
          title="מוסתרים מהלוח"
          restoreLabel="הצגה"
          restoreAria={(name) => `הצגת ${name}`}
          defaultOpen
          items={hiddenList.map((k) => ({ key: k, name: describeKey(k, data) }))}
          onRestore={(k) =>
            onEdit(`hide:${k}`, (c) =>
              k === "ticker" ? { ...c, ticker: { ...c.ticker, enabled: true } } : setHidden(c, k, false),
            )
          }
        />
      </div>
    </div>
  );
}

/** Human name of an element key, for the hidden list and the inspector title. */
function describeKey(key: string, data: BoardData): string {
  if (EDITABLE[key]) return EDITABLE[key].label;
  const cat = CATEGORY_RE.exec(key);
  if (cat) {
    const row = (data.categories ?? []).find((c) => c.id === cat[1]);
    return `לוח תפילות${row ? `: ${String(row.name).slice(0, 40)}` : ""}`;
  }
  const m = key.match(RECORD_RE);
  if (!m) return key;
  const kind = m[1] as keyof typeof KIND_LABELS;
  const row = findRow(data, kind, m[2]);
  const name = row ? String(row.title ?? row.label ?? "") : "";
  return `${KIND_LABELS[kind]}${name ? `: ${name.slice(0, 40)}` : ""}${
    m[3] ? ` · ${FIELD_LABELS[m[3]] ?? m[3]}` : ""
  }`;
}

function findRow(
  data: BoardData,
  kind: "ann" | "shiur" | "minyan",
  id: string,
): Record<string, unknown> | undefined {
  const rows =
    kind === "ann" ? data.announcements : kind === "shiur" ? data.shiurim : data.minyanim;
  return (rows ?? []).find((r) => r.id === id) as Record<string, unknown> | undefined;
}

function Selected({
  k,
  config,
  data,
  onEdit,
  onClose,
}: {
  k: string;
  config: TvConfig;
  data: BoardData;
  onEdit: Edit;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
          עריכה
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{describeKey(k, data)}</h3>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onClose}>
          <X className="size-4" /> סגירה
        </Button>
      </div>
      {CATEGORY_RE.test(k) ? (
        <PrayerPanelElement k={k} config={config} data={data} onEdit={onEdit} onClose={onClose} />
      ) : k === "board.background" ? (
        <BoardBackground config={config} onEdit={onEdit} />
      ) : (
        <>
          {EDITABLE[k] ? (
            <BoardElement k={k} config={config} data={data} onEdit={onEdit} />
          ) : (
            <RecordElement k={k} config={config} data={data} onEdit={onEdit} onClose={onClose} />
          )}
          <ElementLook k={k} config={config} onEdit={onEdit} />
        </>
      )}
    </div>
  );
}

/**
 * A whole prayer panel: the times of one category, as one block.
 *
 * This is how a board is kept current without touching the website - סליחות
 * comes off the wall the day after Yom Kippur, and the panels that remain
 * widen to fill the board (see DashboardStage). The category itself, and
 * everyone's ability to see it on the site, is untouched.
 */
function PrayerPanelElement({
  k,
  config,
  data,
  onEdit,
  onClose,
}: {
  k: string;
  config: TvConfig;
  data: BoardData;
  onEdit: Edit;
  onClose: () => void;
}) {
  const id = CATEGORY_RE.exec(k)?.[1] ?? "";
  const category = (data.categories ?? []).find((c) => c.id === id);
  const rows = (data.minyanim ?? []).filter((m) => m.category_id === id).length;
  const hidden = isHidden(config, k);

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-muted-foreground">
        כל לוח ה{category ? `״${category.name}״` : "תפילות"} - {rows} מניינים. הסתרה מורידה את
        הלוח כולו מהמסך, והלוחות שנשארו מתרחבים למלא את מקומו. באתר עצמו שום דבר לא משתנה, ואפשר
        להחזיר בכל רגע.
      </p>
      <Button
        type="button"
        variant={hidden ? "default" : "outline"}
        size="sm"
        onClick={() => {
          onEdit(`hide:${k}`, (c) => setHidden(c, k, !hidden));
          if (!hidden) onClose();
        }}
      >
        {hidden ? (
          <>
            <Eye className="size-4" /> החזרה ללוח
          </>
        ) : (
          <>
            <EyeOff className="size-4" /> הסתרת הלוח מהמסך
          </>
        )}
      </Button>
    </div>
  );
}

/* ------------------------------------------------ the board itself ----- */

/**
 * What the board looks like as a whole: its style, the shape of its corners
 * and the background behind everything. It is reached by clicking any empty
 * part of the board, so the live editor on a second screen can change the
 * whole look without going back to the admin page.
 */
/** The colour of a "flat" background, i.e. a gradient from a colour to itself. */
function flatColour(gradient: string | null): string | null {
  const match = /^linear-gradient\(180deg, (#[0-9a-f]{6}), \1\)$/i.exec(gradient ?? "");
  return match ? match[1] : null;
}

/**
 * The board's background, from a click on the board: the same gallery as
 * "רקעים" (the ready colours, gradients and pictures and the shul's own),
 * written the same way - a colour after a picture takes the picture off,
 * "רקע בסיס" takes everything off - through writeBoardBackground, as the
 * design tab does, so the same click does the same thing in both.
 */
export function BoardBackground({ config, onEdit }: { config: TvConfig; onEdit: Edit }) {
  const gallery = galleryOf(config);
  // The boards of a board of parts chosen (its boxes): the gallery and the colour go on them - one, or all - unless the whole board is asked for.
  const editing = useElementEditing();
  const chosenParts = containersOf(config.elements, editing?.selected ?? []).flatMap((c) => (c.board ? [c.board] : []));
  const allBoxes = config.elements.filter((e) => e.kind === "box" || (e.kind === "image" && e.name.startsWith("מילוי ")));
  const [wholeBoard, setWholeBoard] = useState(false);
  const onParts = chosenParts.length > 0 && !wholeBoard;
  const ids = chosenParts.map((e) => e.id);
  const first = chosenParts[0];
  const own = onParts ? !first.paint : !config.backgroundGradient && !config.backgroundImage;
  // The board's own background chosen: a kit's painted one over it is hidden, or nothing chosen would show.
  const bare = (c: TvConfig): TvConfig => ({ ...c, elements: hideBackdrops(c.elements) });
  const backdrops = config.elements.filter(isBackdrop);
  const backdropShown = backdrops.some((e) => !e.hidden);
  const pick = (b: Parameters<typeof applyBackground>[1] & { name?: string }) =>
    onParts ? onEdit("part.paint", (c) => ({ ...c, elements: paintBoards(c.elements, ids, b) })) : onEdit("bg.gallery", (c) => bare(applyBackground(c, b)));
  // An upload lands in the same gallery as one from the design tab, and goes on the board.
  const { uploading, upload } = useUpload();
  const uploadPictures = (files: File[]) =>
    upload(files, (urls) => {
      onEdit("bg.gallery", (c) => {
        const next = withUploadedBackgrounds(c, urls);
        return onParts ? { ...next, elements: paintBoards(next.elements, ids, next.backgrounds[0]!) } : bare(applyBackground(next, next.backgrounds[0]!));
      });
      toast.success(urls.length > 1 ? `${urls.length} תמונות נשמרו בגלריה` : "התמונה נשמרה בגלריה");
    });
  return (
    <div className="space-y-3" data-testid="board-background">
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">מסגרת ללוח כולו</div>
        <BoardFramePicker config={config} onEdit={onEdit} compact />
      </div>

      <FrameAndSpacing config={config} onEdit={onEdit} compact />

      <div className="space-y-1.5">
        {/* Whose background, when boards are chosen: theirs, or the whole board's. */}
        {chosenParts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]" data-testid="background-target">
            <Segments
              label="על מה חל הרקע"
              value={onParts ? "parts" : "board"}
              onChange={(v) => setWholeBoard(v === "board")}
              options={[{ id: "parts", name: chosenParts.length === 1 ? `על החלק שנבחר: ${first.name}` : `על ${chosenParts.length} החלקים שנבחרו` }, { id: "board", name: "על רקע הלוח כולו" }]}
            />
          </div>
        )}
        {!onParts && backdrops.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-[11px]" data-testid="backdrop-note">
            {backdropShown
              ? "בערכה יש רקע מצויר מעל רקע הלוח. בחירה כאן מסתירה אותו (לא מוחקת), כדי שמה שבוחרים ייראה."
              : "הרקע המצויר של הערכה מוסתר."}
            {!backdropShown && (
              <button type="button" className="h-6 rounded border bg-background px-2 hover:border-primary/50" onClick={() => onEdit("bg.backdrop", (c) => ({ ...c, elements: showBackdrops(c.elements) }))}>
                החזרת הרקע המצויר
              </button>
            )}
          </div>
        )}
        {/* One line: what it is for, its own choices, and all the boards at once. */}
        <div className="flex flex-wrap items-center gap-1.5" data-testid="background-line">
          <span className="text-xs font-medium text-muted-foreground" title={onParts ? undefined : "חל על רקע הלוח כולו. לשנות לוח אחד - בוחרים אותו על הלוח."}>
            {onParts ? (chosenParts.length === 1 ? `רקע של ${first.name}` : `רקע ל־${chosenParts.length} לוחות`) : "רקע הלוח"}
          </span>
          <button
            type="button"
            aria-pressed={own}
            title={onParts ? "בלי רקע מהגלריה: הצבע של החלק עצמו" : "בלי רקע משלו: צבעי הבסיס של הלוח"}
            onClick={() => (onParts ? onEdit("part.paint", (c) => ({ ...c, elements: paintBoards(c.elements, ids, null) })) : onEdit("bg.gallery", (c) => bare(writeBoardBackground(c, null))))}
            className={`h-8 rounded-md border px-2 text-[11px] transition ${own ? "ring-2 ring-primary ring-offset-1" : "hover:border-primary/50"}`}
          >
            רקע בסיס
          </button>
          <label
            className="flex h-8 cursor-pointer items-center gap-1 rounded-md border px-2 text-[11px] hover:border-primary/50"
            title="צבע אחיד לכל הרקע"
          >
            צבע
            <ColorPick
              label={onParts ? "צבע החלקים שנבחרו" : "צבע רקע אחיד"}
              className="h-6 w-8"
              value={onParts ? (/^#[\da-f]{6}$/i.test(first.fill) ? first.fill : "#fff8e8") : (!config.backgroundImage && flatColour(config.backgroundGradient)) || "#0b1628"}
              onChange={(v) => (onParts ? onEdit("part.colour", (c) => ({ ...c, elements: colourBoards(c.elements, ids, v) })) : onEdit("bg.colour", (c) => bare(writeBoardBackground(c, `linear-gradient(180deg, ${v}, ${v})`))))}
            />
          </label>
          {editing && allBoxes.length > 0 && chosenParts.length < allBoxes.length && (
            <button type="button" className="h-8 rounded-md border px-2 text-[11px] hover:border-primary/50" onClick={() => { setWholeBoard(false); editing.select(allBoxes.map((e) => e.id)); }}>
              בחירת כל הלוחות ({allBoxes.length})
            </button>
          )}
        </div>
        {/* The design tab's gallery, in the small tiles of this panel: the upload first, as in every gallery. */}
        <div className="max-h-56 overflow-y-auto p-0.5">
          <GalleryGrid testId="board-background-gallery" compact>
            <UploadTile label="העלאה" multiple uploading={uploading} onFiles={(files) => void uploadPictures(files)} hint="העלאת תמונה משלכם - נשמרת בגלריה ונלבשת על הלוח" />
            {gallery.map((b) => (
              <GalleryTile
                key={b.id}
                compact
                name={b.name}
                on={onParts ? wearsPaint(first, b) : wears(config, b)}
                onPick={() => pick(b)}
                preview={<BackgroundTile b={b} />}
              />
            ))}
          </GalleryGrid>
        </div>
        <p className="text-[11px] leading-tight text-muted-foreground">
          {onParts
            ? "לחיצה מלבישה את הרקע רק על הלוחות שנבחרו. כל לוח אחר נשאר כמו שהוא."
            : 'כמו בחלק "רקע" בלשונית העיצוב: לחיצה מלבישה את הרקע על הלוח כולו. שכבה מעל תמונה, מחוונים ושמירה בגלריה - בלשונית "עיצוב".'}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------ size, colour and position -- */

/** The text weights, one list wherever a weight is chosen (700 and 800 both, for what was stored before). */
const TEXT_WEIGHTS: Array<{ value: number; label: string }> = [
  { value: 300, label: "דק" },
  { value: 400, label: "רגיל" },
  { value: 600, label: "בינוני" },
  { value: 700, label: "מודגש" },
  { value: 800, label: "מודגש מאוד" },
  { value: 900, label: "שחור" },
];

/**
 * The look of the selected element on its own: text size, colour and a
 * nudge from its natural place. Stored per element in tv_config.styles and
 * rendered the same way on the TV (boardEdit.elementStyleCss). Dragging the
 * element in the preview edits the same x / y.
 */
/**
 * How one element looks - its size, colour, weight, background and
 * see-through, for itself or its family, in every theme or one - and, on the
 * board, where it stands. One editor for it, reached two ways: clicking the
 * element on the board, and "טקסט ← אזור על הלוח". They were two editors
 * writing the same setting with different weights and different names.
 */
export function ElementLook({
  k,
  config,
  onEdit,
  position = true,
}: {
  k: string;
  config: TvConfig;
  onEdit: Edit;
  /** Where it stands (the arrows for moving, the arrow keys): on the board only. */
  position?: boolean;
}) {
  // Which entry the controls write to: this element, or its family.
  const target = styleTargetKey(config, k);
  const fk = familyKey(k);
  const familyLabel = fk ? STYLE_FAMILIES[fk.slice(FAMILY_PREFIX.length)] : null;
  const onFamily = target === fk;
  const style = config.styles[target];
  // What the board actually shows here (family rule + this element's own).
  const effective = resolveElementStyle(config, k);
  const inherited =
    !onFamily && fk && config.styles[fk] ? STYLE_FAMILIES[fk.slice(FAMILY_PREFIX.length)] : null;

  /** Moves the styling between "this element" and "all of its kind". */
  const setScope = (toFamily: boolean) =>
    onEdit(`style:scope:${k}`, (c) => {
      if (!fk) return c;
      const from = toFamily ? k : fk;
      const to = toFamily ? fk : k;
      const moving = c.styles[from];
      if (!moving) return { ...c, styles: { ...c.styles, [to]: c.styles[to] ?? {} } };
      const styles = { ...c.styles, [to]: { ...c.styles[to], ...moving } };
      delete styles[from];
      return { ...c, styles };
    });
  const scale = effective?.scale ?? 1;
  const set = (patch: Partial<ElementStyle>, group = "look") =>
    onEdit(`style:${group}:${k}`, (c) => setElementStyle(c, styleTargetKey(c, k), patch));
  const changed = Boolean(style && Object.keys(style).filter((f) => f !== "theme").length);
  const bold = (effective?.weight ?? 400) >= 700;
  const [step, setStep] = useState("1");
  // Moves read the latest draft, so a held knob or key accumulates.
  const nudge = (dx: number, dy: number) =>
    onEdit(`style:pos:${k}`, (c) => {
      const t = styleTargetKey(c, k);
      const cur = c.styles[t];
      const clamp = (v: number) => Math.round(Math.min(50, Math.max(-50, v)) * 10) / 10;
      return setElementStyle(c, t, { x: clamp((cur?.x ?? 0) + dx), y: clamp((cur?.y ?? 0) + dy) });
    });

  // Keyboard: arrows move the selected element (Shift: 4x), unless typing.
  const nudgeRef = useRef(nudge);
  nudgeRef.current = nudge;
  const stepRef = useRef(Number(step));
  stepRef.current = Number(step);
  useEffect(() => {
    if (!position) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      const d = stepRef.current * (e.shiftKey ? 4 : 1);
      const move: Record<string, [number, number]> = {
        ArrowLeft: [-d, 0],
        ArrowRight: [d, 0],
        ArrowUp: [0, -d],
        ArrowDown: [0, d],
      };
      const m = move[e.key];
      if (!m) return;
      e.preventDefault();
      nudgeRef.current(m[0], m[1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [position]);

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Move className="size-3.5" /> עיצוב החלק הזה בלבד
        {changed && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ms-auto h-7 text-xs"
            onClick={() =>
              onEdit(`style:reset:${k}`, (c) => setElementStyle(c, styleTargetKey(c, k), null))
            }
          >
            <RotateCcw className="size-3.5" /> {onFamily ? `איפוס ${familyLabel}` : "איפוס העיצוב"}
          </Button>
        )}
      </div>

      {/* what this edit applies to: one element or its whole kind, and in
          which themes - the two questions that keep a board tidy */}
      <div data-testid="style-scope" className="space-y-1.5 rounded-md bg-muted/50 p-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span className="font-medium">חל על:</span>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name={`scope-${k}`}
              checked={!onFamily}
              onChange={() => setScope(false)}
            />
            החלק הזה בלבד
          </label>
          {familyLabel && (
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name={`scope-${k}`}
                checked={onFamily}
                onChange={() => setScope(true)}
              />
              {familyLabel}
            </label>
          )}
          {!familyLabel && (
            <span className="text-muted-foreground">(חלק יחיד בלוח - אין חלקים דומים)</span>
          )}
        </div>
        <p className="text-[11px] leading-tight text-muted-foreground">
          השינוי מוחל על המסכים שנבחרו בפס למעלה ("כל המסכים", או סוג מסך אחד) - ובכל הפריסות.
        </p>
        {inherited && (
          <Notice variant="warning" className="p-2 text-[11px]">
            לחלק הזה יש גם עיצוב מ״{inherited}״. מה שנקבע כאן גובר עליו.
          </Notice>
        )}
        {/* Set once for one theme only; there is no choosing themes any more, so it can be made to show. */}
        {style?.theme && style.theme !== config.theme && (
          <Notice
            variant="warning"
            className="p-2 text-[11px]"
            actions={
              <button type="button" className="underline" onClick={() => set({ theme: undefined }, "theme-scope")}>
                להציג אותו
              </button>
            }
          >
            העיצוב הזה נקבע פעם לצבעי בסיס אחרים, ולכן אינו מוצג.
          </Notice>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          גודל טקסט
          <Stepper
            label="גודל טקסט של החלק"
            value={Math.round(scale * 100)}
            min={50}
            max={200}
            step={5}
            format={(v) => `${v}%`}
            onChange={(v) => set({ scale: v / 100 }, "scale")}
          />
        </label>
        {/* Bold, as in the bar of a part's text; the finer weights in the list beside it. */}
        <button
          type="button"
          aria-pressed={bold}
          aria-label="מודגש"
          title="מודגש"
          onClick={() => set({ weight: bold ? undefined : 700 }, "weight")}
          className={`grid size-8 place-items-center rounded border ${bold ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:border-primary"}`}
        >
          <Bold className="size-4" aria-hidden />
        </button>
        <label className="flex items-center gap-2">
          עובי
          <select
            aria-label="עובי הגופן של החלק"
            value={effective?.weight ?? ""}
            onChange={(e) =>
              set({ weight: e.target.value ? Number(e.target.value) : undefined }, "weight")
            }
            className={SELECT_CLASS}
          >
            <option value="">רגיל</option>
            {TEXT_WEIGHTS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* The colour and the background, unset until chosen: the code of either is typed in its panel. */}
      <div className="grid gap-2 sm:grid-cols-2">
        <ColourChoice
          label="צבע החלק"
          value={effective?.color}
          fallback="#ffffff"
          unsetLabel="רגיל"
          anyCode
          onChange={(v) => set({ color: v ?? undefined }, "color")}
        />
        <ColourChoice
          label="רקע החלק"
          value={effective?.bg}
          fallback="#000000"
          unsetLabel="בלי רקע"
          anyCode
          onChange={(v) => set({ bg: v ?? undefined }, "bg")}
        />
      </div>
      <Range
        label="אטימות"
        value={Math.round((effective?.opacity ?? 1) * 100)}
        min={15}
        max={100}
        step={5}
        show={(v) => `${v}%`}
        hint="100% - מלא; פחות - רואים דרכו"
        onChange={(v) => set({ opacity: v / 100 }, "opacity")}
      />
      {position && (
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Joystick onNudge={nudge} step={Number(step)} onReset={() => set({ x: 0, y: 0 }, "pos")} />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            מיקום:
            <span className="font-mono text-xs tabular-nums" aria-live="polite" dir="ltr">
              {effective?.x ?? 0}% , {effective?.y ?? 0}%
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            צעד:
            <Segments
              label="גודל הצעד"
              value={step}
              onChange={setStep}
              options={[
                { id: "0.5", name: "0.5%" },
                { id: "1", name: "1%" },
                { id: "5", name: "5%" },
              ]}
            />
          </div>
          <p className="max-w-56 text-xs text-muted-foreground">
            גררו את הכפתור שבמרכז חצי ההזזה (רחוק יותר = מהר יותר), לחצו על החצים, השתמשו בחצי
            המקלדת (Shift = צעד גדול) או גררו את החלק עצמו בלוח. ההזזה באחוזי מסך, כך שהיא נכונה
            בכל גודל מסך.
          </p>
        </div>
      </div>
      )}
    </div>
  );
}

/**
 * The arrows for moving the selected part ("חצי הזזה"): drag the knob and the
 * part glides in that direction - the further from the centre, the faster -
 * and the knob springs back on release. The arrows step once per click (and
 * keep stepping while held); the centre resets the position.
 */
function Joystick({
  onNudge,
  step,
  onReset,
}: {
  onNudge: (dx: number, dy: number) => void;
  step: number;
  onReset: () => void;
}) {
  const RADIUS = 34;
  const MAX_SPEED = 18; // % of the screen per second at full deflection
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const knobRef = useRef(knob);
  const nudgeRef = useRef(onNudge);
  nudgeRef.current = onNudge;
  const frame = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const stopLoop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };
  useEffect(() => stopLoop, []);

  const loop = (last: number) => (t: number) => {
    const dt = Math.min(0.1, (t - last) / 1000);
    const { x, y } = knobRef.current;
    if (x || y) nudgeRef.current((x / RADIUS) * MAX_SPEED * dt, (y / RADIUS) * MAX_SPEED * dt);
    frame.current = requestAnimationFrame(loop(t));
  };

  // The knob, dragged away from the centre (usePointerDrag): how far it went is how fast the part glides.
  const knobDrag = usePointerDrag<null, true>({
    start: () => {
      stopLoop();
      frame.current = requestAnimationFrame(loop(performance.now()));
      setDragging(true);
      return true;
    },
    move: (_, { dx, dy }) => {
      const len = Math.hypot(dx, dy);
      const k = len > RADIUS ? RADIUS / len : 1;
      knobRef.current = { x: dx * k, y: dy * k };
      setKnob(knobRef.current);
    },
    end: () => {
      setDragging(false);
      knobRef.current = { x: 0, y: 0 };
      setKnob({ x: 0, y: 0 });
      stopLoop();
    },
  });

  // Arrow buttons: one step per click, repeating while held.
  const repeat = useRef<number | null>(null);
  const hold = (dx: number, dy: number) => ({
    onPointerDown: () => {
      nudgeRef.current(dx * step, dy * step);
      repeat.current = window.setInterval(() => nudgeRef.current(dx * step, dy * step), 120);
    },
    onPointerUp: () => repeat.current !== null && window.clearInterval(repeat.current),
    onPointerLeave: () => repeat.current !== null && window.clearInterval(repeat.current),
  });
  const arrow =
    "absolute grid size-8 place-items-center rounded-full bg-background/90 text-foreground shadow ring-1 ring-border hover:bg-secondary";

  return (
    <div
      className="relative size-36 shrink-0 select-none rounded-full bg-gradient-to-b from-muted to-muted/40 ring-1 ring-border"
      role="group"
      aria-label="חצי הזזה של החלק"
    >
      <button
        type="button"
        aria-label="הזזה למעלה"
        className={`${arrow} left-1/2 top-1 -translate-x-1/2`}
        {...hold(0, -1)}
      >
        <ArrowUp className="size-4" />
      </button>
      <button
        type="button"
        aria-label="הזזה למטה"
        className={`${arrow} bottom-1 left-1/2 -translate-x-1/2`}
        {...hold(0, 1)}
      >
        <ArrowDown className="size-4" />
      </button>
      <button
        type="button"
        aria-label="הזזה שמאלה"
        className={`${arrow} left-1 top-1/2 -translate-y-1/2`}
        {...hold(-1, 0)}
      >
        <ArrowLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label="הזזה ימינה"
        className={`${arrow} right-1 top-1/2 -translate-y-1/2`}
        {...hold(1, 0)}
      >
        <ArrowRight className="size-4" />
      </button>
      <button
        type="button"
        aria-label="ידית ההזזה - גררו כדי להזיז; לחיצה כפולה מאפסת את המיקום"
        title="גררו כדי להזיז · לחיצה כפולה: חזרה למקום המקורי"
        className="absolute left-1/2 top-1/2 grid size-12 cursor-grab touch-none place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/25 active:cursor-grabbing"
        style={{
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
          transition: dragging ? "none" : "transform 160ms ease-out",
        }}
        {...knobDrag(null)}
        onDoubleClick={onReset}
      >
        <Crosshair className="size-5" />
      </button>
    </div>
  );
}

/* --------------------------------------------- board wording and layout -- */

function BoardElement({
  k,
  config,
  data,
  onEdit,
}: {
  k: string;
  config: TvConfig;
  data: BoardData;
  onEdit: Edit;
}) {
  const spec = EDITABLE[k];
  const isTicker = k === "ticker";
  const siteValue = spec.siteField ? String(data.settings?.[spec.siteField] ?? "") : "";
  const fallback = spec.siteField ? siteValue : spec.text ?? "";
  const value = isTicker ? config.ticker.text : config.texts[k] ?? fallback;
  const overridden = !isTicker && config.texts[k] !== undefined && config.texts[k] !== fallback;
  const hidden = isTicker ? !config.ticker.enabled : isHidden(config, k);
  const Field = spec.multiline ? Textarea : Input;

  const change = (v: string) =>
    onEdit(`txt:${k}`, (c) =>
      isTicker
        ? { ...c, ticker: { ...c.ticker, text: v.slice(0, 400) } }
        : setText(c, k, v === fallback ? null : v),
    );

  return (
    <div className="space-y-3">
      {spec.text !== undefined && (
        <div className="space-y-1.5">
          <Field
            value={value}
            dir="rtl"
            aria-label={spec.label}
            placeholder={fallback || "טקסט"}
            onChange={(e: { target: { value: string } }) => change(e.target.value)}
            className={spec.multiline ? "min-h-20" : undefined}
          />
          <p className="text-xs text-muted-foreground">
            {spec.hint
              ? spec.hint
              : spec.siteField
              ? 'משנה רק את הלוח. כדי לשנות גם באתר - הכפתור "גם באתר".'
              : isTicker
              ? "שורה שרצה בתחתית המסך. (התנועה הרציפה מעמיסה על מעבד הקופסה.)"
              : "משנה את הנוסח בלוח בלבד."}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {spec.hideable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onEdit(`hide:${k}`, (c) =>
                isTicker
                  ? { ...c, ticker: { ...c.ticker, enabled: hidden } }
                  : setHidden(c, k, !hidden),
              )
            }
          >
            {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}{" "}
            {hidden ? "הצגה" : "הסתרה"}
          </Button>
        )}
        {spec.flip && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(`flip:${spec.flip}`, (c) => toggleFlip(c, spec.flip!))}
          >
            <ArrowLeftRight className="size-4" /> {FLIP_LABELS[spec.flip]}
          </Button>
        )}
        {overridden && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(`txt:${k}`, (c) => setText(c, k, null))}
          >
            <RotateCcw className="size-4" /> חזרה לנוסח המקורי
          </Button>
        )}
        {spec.siteField && data.settings && overridden && value.trim() && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="השם יתעדכן בכל האתר, והלוח יציג אותו משם"
            onClick={() =>
              onEdit(`site:${k}`, (c) =>
                setText(
                  withRecordEdit(c, {
                    table: "settings",
                    id: String(data.settings!.id),
                    field: spec.siteField!,
                    value: value.trim(),
                  }),
                  k,
                  null,
                ),
              )
            }
          >
            <Globe className="size-4" /> גם באתר
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ content records -- */

function RecordElement({
  k,
  config,
  data,
  onEdit,
  onClose,
}: {
  k: string;
  config: TvConfig;
  data: BoardData;
  onEdit: Edit;
  onClose: () => void;
}) {
  const m = k.match(RECORD_RE);
  if (!m) return <p className="text-sm text-muted-foreground">אי אפשר לערוך את החלק הזה.</p>;
  const kind = m[1] as keyof typeof TABLE_OF;
  const id = m[2];
  const field = m[3];
  const table: RecordTable = TABLE_OF[kind];
  const row = findRow(data, kind, id);
  if (!row) return <p className="text-sm text-muted-foreground">הפריט כבר לא קיים.</p>;

  const elementKey = `${kind}:${id}`;
  const hidden = config.hidden.includes(elementKey);
  const multiline = field === "body";
  const Field = multiline ? Textarea : Input;
  const ordered = (data.announcements ?? []).filter((a) => !config.hidden.includes(`ann:${a.id}`));
  const pos = ordered.findIndex((a) => a.id === id);

  return (
    <div className="space-y-3">
      {field && (
        <div className="space-y-1.5">
          <Field
            value={String(row[field] ?? "")}
            dir="rtl"
            aria-label={FIELD_LABELS[field] ?? field}
            onChange={(e: { target: { value: string } }) =>
              onEdit(`rec:${k}`, (c) =>
                withRecordEdit(c, {
                  table,
                  id,
                  field,
                  value: e.target.value.slice(0, multiline ? 4000 : 200),
                }),
              )
            }
            className={multiline ? "min-h-28" : undefined}
          />
          <p className="text-xs text-muted-foreground">
            זה אותו {KIND_LABELS[kind]} שמופיע באתר: השינוי יחול גם שם, בלחיצה על "שמור ושדר".
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={hidden ? "default" : "outline"}
          size="sm"
          aria-pressed={hidden}
          onClick={() => onEdit(`hide:${elementKey}`, (c) => setHidden(c, elementKey, !hidden))}
        >
          {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />} {hidden ? "הצגה" : "הסתרה"}
        </Button>
        {kind === "ann" && (
          <>
            <MoveButtons
              name="המודעה"
              words
              first={pos <= 0}
              last={pos < 0 || pos >= ordered.length - 1}
              onMove={(by) => onEdit(`move:${id}`, (c) => moveAnnouncement(c, data.announcements ?? [], ordered, id, by))}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={async () => {
                const ok = await confirmAction({
                  title: "למחוק את המודעה לגמרי?",
                  description: `המודעה "${String(row.title ?? "")}" תימחק מהאתר ומכל המסכים בלחיצה על "שמור ושדר". עד אז אפשר לבטל (Ctrl+Z). אם רוצים רק להוריד אותה מהלוח - "הסתרה".`,
                  confirmLabel: "מחיקה",
                });
                if (!ok) return;
                onEdit(`del:${id}`, (c) => withRecordEdit(c, { table: "announcements", id, delete: true }));
                onClose();
              }}
            >
              <Trash2 className="size-4" /> מחיקת המודעה
            </Button>
          </>
        )}
      </div>
      {kind === "minyan" && (
        <p className="text-xs text-muted-foreground">
          שעות המניין נקבעות בלשונית "מניינים" (שעה קבועה או לפי זמני היום).
        </p>
      )}
    </div>
  );
}
