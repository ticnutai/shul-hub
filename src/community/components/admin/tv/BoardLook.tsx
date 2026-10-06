import { Button } from "@/components/ui/button";
import {
  FRAME_RADIUS_MAX,
  SPACING_EDGES,
  SPACING_MAX,
  MAX_MY_BOARD_FRAMES,
  newMyBoardFrameId,
  type BoardFrame,
  type MyBoardFrame,
  type SpacingEdge,
  type TvConfig,
} from "@/tv/config";
import { useState, type ReactNode } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_BOARD_FRAME_TUNE, READY_PICTURE_BOARD_FRAMES, type BoardFrameTune } from "@/tv/boardFrame";
import { hideReady, isHiddenReady, showReady } from "@/tv/readyItems";
import { HiddenShelf, TileRemove } from "./ReadyShelf";
import { uploadImages } from "./uploadImages";
import { setFrameLook, type FrameId, type TitleStyle } from "@/tv/frameLooks";
import { BOARD_FRAME_CHOICES, FRAME_CHOICES, TITLE_STYLE_CHOICES } from "./tvChoices";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/**
 * The frames of the board - a frame for the whole board, the shape of the
 * boxes' corners, how their names are set - and the air around them.
 *
 * One set of controls, rendered in two places - the editor's own tab and the
 * panel that opens when the board itself is clicked - so the two can never
 * drift apart. `compact` is the second of those: the same controls, sized for
 * a floating window on a second screen.
 *
 * The frames and the corners are how the boxes look, and sit under "עיצוב";
 * the spacing is where they stand, and sits under "פריסה".
 */

/**
 * What each edge is when the board has not been told (tv.css): the slider
 * starts from there, and so does a drag in the composer's sketch.
 */
export const SPACING_FALLBACK: Record<SpacingEdge, number> = { top: 2.6, bottom: 1.6, sides: 3, gap: 2 };

/** The same, for a layout: the medallion leaves its own air above and below (tv.css). */
export function spacingFallback(layout: TvConfig["screenLayout"]): Record<SpacingEdge, number> {
  return layout === "medallion" ? { ...SPACING_FALLBACK, top: 2.4, bottom: 2.4 } : SPACING_FALLBACK;
}

const SPACING_LABELS: Record<SpacingEdge, { name: string; hint: string }> = {
  top: { name: "מרווח עליון", hint: "בין שורת הכותרת לבין התיבות. פחות מרווח = תיבות גבוהות יותר" },
  bottom: { name: "מרווח תחתון", hint: "בין התיבות לבין השורה התחתונה (הפרשה והנרות)" },
  sides: { name: "שוליים בצדדים", hint: "המרווח בין התיבות לקצה המסך" },
  gap: { name: "מרווח בין התיבות", hint: "המרווח בין תיבה לתיבה" },
};

/**
 * A frame for the whole board: columns at its sides, beams, a פרוכת, a carved
 * frame around the screen - or one of the shul's own: a ready one kept as it
 * was set (its size, place, sides), or a picture it uploaded. Like every
 * gallery here: a ready one is hidden with ✕ and brought back below; the
 * shul's own are saved, renamed, updated and deleted. `compact` (the board's
 * own panel) offers the choosing only.
 */
export function BoardFramePicker({ config, onEdit, compact = false }: { config: TvConfig; onEdit: Edit; compact?: boolean }) {
  const [naming, setNaming] = useState<{ id: string | null; value: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const ready = BOARD_FRAME_CHOICES.filter((f) => f.id === null || !isHiddenReady(config, "boardframe", f.id));
  const wears = (m: MyBoardFrame) =>
    config.boardFrame === m.frame &&
    (m.frame !== "picture" || config.boardFrameImage === m.image) &&
    JSON.stringify(config.boardFrameTune) === JSON.stringify(m.tune);
  const worn = config.myBoardFrames.find(wears) ?? null;
  const put = (key: string, m: { frame: BoardFrame | null; tune?: BoardFrameTune; image?: string | null }) =>
    onEdit(key, (c) => ({
      ...c,
      boardFrame: m.frame,
      ...(m.tune ? { boardFrameTune: structuredClone(m.tune) } : {}),
      ...(m.image !== undefined ? { boardFrameImage: m.image } : {}),
    }));
  const tile = (on: boolean) =>
    `block w-full rounded-lg border p-1.5 text-right transition ${on ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"}`;
  const label = compact ? "text-[10px] leading-tight" : "text-xs";
  const previewOf = (m: MyBoardFrame) =>
    m.frame === "picture" && m.image ? (
      <img src={m.image} alt="" className="size-full object-contain" loading="lazy" />
    ) : (
      BOARD_FRAME_CHOICES.find((f) => f.id === m.frame)?.preview
    );

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const [url] = await uploadImages(files);
      if (!url) return;
      const mine: MyBoardFrame = { id: newMyBoardFrameId(), name: "מסגרת שהעליתי", frame: "picture", tune: DEFAULT_BOARD_FRAME_TUNE, image: url };
      onEdit("board-frame:upload", (c) => ({
        ...c,
        myBoardFrames: [...c.myBoardFrames, mine].slice(0, MAX_MY_BOARD_FRAMES),
        boardFrame: "picture",
        boardFrameImage: url,
        boardFrameTune: structuredClone(DEFAULT_BOARD_FRAME_TUNE),
      }));
      toast.success("המסגרת הועלתה ונשמרה ב\"המסגרות שלי\"");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    const name = (naming?.value ?? "").trim().slice(0, 40);
    if (!name || !config.boardFrame) return;
    const id = naming?.id;
    onEdit(`board-frame:${id ? "rename" : "save"}`, (c) =>
      id
        ? { ...c, myBoardFrames: c.myBoardFrames.map((m) => (m.id === id ? { ...m, name } : m)) }
        : {
            ...c,
            myBoardFrames: [
              ...c.myBoardFrames,
              { id: newMyBoardFrameId(), name, frame: c.boardFrame!, tune: structuredClone(c.boardFrameTune), image: c.boardFrame === "picture" ? c.boardFrameImage : null },
            ].slice(0, MAX_MY_BOARD_FRAMES),
          },
    );
    setNaming(null);
  };

  return (
    <div className="space-y-3">
      <div data-testid="board-frames" className={compact ? "grid grid-cols-4 gap-1.5" : "grid grid-cols-3 gap-2 sm:grid-cols-4"}>
        {ready.map((f) => {
          // A frame of the shul's own being worn is marked there, not on the ready one it was made from.
          const on = config.boardFrame === f.id && !worn;
          return (
            <div key={f.id ?? "none"} className="group relative">
              {!compact && f.id && !on && (
                <TileRemove name={f.name} ready onClick={() => onEdit("board-frame:hide", (c) => hideReady(c, "boardframe", f.id!))} />
              )}
              <button type="button" aria-pressed={on} title={f.hint} onClick={() => put("board-frame", { frame: f.id })} className={tile(on)}>
                <span className="mb-1 block aspect-[16/10] overflow-hidden rounded-md bg-[#0b1628]" aria-hidden>
                  {f.preview}
                </span>
                <span className={`block text-center font-medium ${label}`}>{f.name}</span>
              </button>
            </div>
          );
        })}
        {READY_PICTURE_BOARD_FRAMES.filter((f) => !isHiddenReady(config, "boardframe", f.id)).map((f) => {
          const on = config.boardFrame === "picture" && config.boardFrameImage === f.image && !worn;
          return (
            <div key={f.id} className="group relative" data-testid="ready-picture-board-frame">
              {!compact && !on && (
                <TileRemove name={f.name} ready onClick={() => onEdit("board-frame:hide", (c) => hideReady(c, "boardframe", f.id))} />
              )}
              <button type="button" aria-pressed={on} onClick={() => put("board-frame:ready-picture", { frame: "picture", image: f.image, tune: DEFAULT_BOARD_FRAME_TUNE })} className={tile(on)}>
                <span className="mb-1 block aspect-[16/10] overflow-hidden rounded-md bg-[#0b1628] p-1" aria-hidden>
                  <img src={f.image} alt="" className="size-full object-contain" loading="lazy" />
                </span>
                <span className={`block text-center font-medium ${label}`}>{f.name}</span>
              </button>
            </div>
          );
        })}
        {config.myBoardFrames.map((m) => {
          const on = wears(m);
          return (
            <div key={m.id} className="group relative" data-testid="my-board-frame">
              {!compact && (
                <TileRemove name={m.name} ready={false} onClick={() => onEdit("board-frame:delete", (c) => ({ ...c, myBoardFrames: c.myBoardFrames.filter((x) => x.id !== m.id) }))} />
              )}
              <button type="button" aria-pressed={on} onClick={() => put(`board-frame:mine:${m.id}`, m)} className={tile(on)}>
                <span className="mb-1 block aspect-[16/10] overflow-hidden rounded-md bg-[#0b1628]" aria-hidden>
                  {previewOf(m)}
                </span>
                <span className={`block truncate text-center font-medium ${label}`}>{m.name}</span>
              </button>
            </div>
          );
        })}
        {!compact && (
          <label
            className={`flex aspect-[16/12] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-[11px] hover:border-primary ${uploading ? "opacity-60" : ""}`}
          >
            <ImagePlus className="size-4" />
            {uploading ? "מעלה…" : "העלאת מסגרת ללוח"}
            <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => void upload(e.target.files)} />
          </label>
        )}
      </div>

      {!compact && (
        <>
          <HiddenShelf
            testId="board-frames-hidden"
            items={[
              ...BOARD_FRAME_CHOICES.filter((f) => f.id && isHiddenReady(config, "boardframe", f.id)).map((f) => ({ key: f.id!, name: f.name })),
              ...READY_PICTURE_BOARD_FRAMES.filter((f) => isHiddenReady(config, "boardframe", f.id)).map((f) => ({ key: f.id, name: f.name })),
            ]}
            onRestore={(id) => onEdit("board-frame:show", (c) => showReady(c, "boardframe", id))}
          />
          {naming ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <input
                aria-label="שם המסגרת"
                value={naming.value}
                maxLength={40}
                autoFocus
                onChange={(e) => setNaming({ ...naming, value: e.target.value })}
                className="h-8 flex-1 rounded-md border bg-background px-2 text-sm"
              />
              <Button type="submit" size="sm" disabled={!naming.value.trim()}>
                {naming.id ? "שינוי השם" : "שמירת המסגרת"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setNaming(null)}>
                ביטול
              </Button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {config.boardFrame && !worn && (
                <Button type="button" size="sm" variant="outline" onClick={() => setNaming({ id: null, value: "" })}>
                  שמירה כמסגרת שלי
                </Button>
              )}
              {worn && (
                <Button type="button" size="sm" variant="outline" onClick={() => setNaming({ id: worn.id, value: worn.name })}>
                  שינוי שם ל«{worn.name}»
                </Button>
              )}
              <span className="text-muted-foreground">
                {config.boardFrame
                  ? "כיוונתם גודל ומקום? שומרים בשם, והמסגרת נשמרת עם הכוונון."
                  : "בחרו מסגרת, או העלו תמונה משלכם."}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * How a box's name is set - for every box, or for one (`frame`), where
 * "כמו כולן" leaves it to every box's.
 */
export function TitleStylePicker({ config, onEdit, frame }: { config: TvConfig; onEdit: Edit; frame?: FrameId | null }) {
  const current = frame ? (config.frameLooks[frame]?.titleStyle ?? null) : config.titleStyle;
  const shown = TITLE_STYLE_CHOICES.filter((t) => t.id === "plain" || t.id === current || !isHiddenReady(config, "title", t.id));
  const choices: Array<{ id: TitleStyle | null; name: string; preview: ReactNode }> = frame
    ? [{ id: null, name: "כמו כולן", preview: <span className="text-white/60">—</span> }, ...shown]
    : shown;
  const pick = (id: TitleStyle | null) =>
    frame
      ? onEdit(`title-style:${frame}`, (c) => ({ ...c, frameLooks: setFrameLook(c.frameLooks, frame, { titleStyle: id }) }))
      : onEdit("title-style", (c) => ({ ...c, titleStyle: id ?? "plain" }));
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" data-testid="title-styles">
        {choices.map((t) => {
          const on = current === t.id;
          return (
            <div key={t.id ?? "all"} className="group relative">
              {t.id && t.id !== "plain" && !on && (
                <TileRemove name={t.name} ready onClick={() => onEdit("title-style:hide", (c) => hideReady(c, "title", t.id!))} />
              )}
              <button
                type="button"
                aria-pressed={on}
                aria-label={`כותרת: ${t.name}`}
                onClick={() => pick(t.id)}
                className={`block w-full rounded-lg border p-1.5 text-center ${on ? "ring-2 ring-primary ring-offset-1" : "hover:border-primary/50"}`}
              >
                <span className="mb-1 flex h-8 items-center justify-center rounded bg-[#12243f] text-[11px]" aria-hidden>
                  {t.preview}
                </span>
                <span className="block text-[11px] leading-tight">{t.name}</span>
              </button>
            </div>
          );
        })}
      </div>
      <HiddenShelf
        testId="title-styles-hidden"
        items={TITLE_STYLE_CHOICES.filter((t) => isHiddenReady(config, "title", t.id)).map((t) => ({ key: t.id, name: t.name }))}
        onRestore={(id) => onEdit("title-style:show", (c) => showReady(c, "title", id))}
      />
    </div>
  );
}

/** A slider with a "רגיל" way back to the default. */
function AutoSlider({
  label,
  hint,
  value,
  max,
  fallback,
  onChange,
  compact,
}: {
  label: string;
  hint?: string;
  value: number | null;
  max: number;
  fallback: number;
  onChange: (next: number | null) => void;
  compact: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "text-xs" : "gap-3 text-sm"}`} title={hint}>
      <span className={compact ? "w-24 shrink-0" : "w-28 shrink-0"}>{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        step={0.5}
        value={value ?? fallback}
        disabled={value === null}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`flex-1 accent-primary disabled:opacity-40 ${compact ? "h-1.5" : "h-2"}`}
      />
      <span className="w-8 text-end tabular-nums text-muted-foreground">
        {value === null ? "—" : value}
      </span>
      <Button
        type="button"
        size="sm"
        variant={value === null ? "default" : "outline"}
        className={compact ? "h-7 px-2 text-[11px]" : ""}
        aria-pressed={value === null}
        onClick={() => onChange(value === null ? fallback : null)}
      >
        רגיל
      </Button>
    </div>
  );
}

/** The shape of the frames' corners and how round they are (עיצוב › מסגרות). */
/** The shapes on offer: those not hidden, "רגיל", and whichever is worn now (BoardLook and one box's list). */
export function shownShapes(config: Pick<TvConfig, "hiddenReady">, current: string | null | undefined) {
  return FRAME_CHOICES.filter((f) => f.id === "auto" || f.id === current || !isHiddenReady(config, "shape", f.id));
}

export function FrameCorners({
  config,
  onEdit,
  compact = false,
}: {
  config: TvConfig;
  onEdit: Edit;
  compact?: boolean;
}) {
  const heading = compact ? "text-xs font-medium text-muted-foreground" : "text-sm font-medium";
  return (
    <div className="space-y-2">
      {compact && <div className={heading}>צורת התיבות</div>}
      <div
        data-testid="frame-shapes"
        className={compact ? "grid grid-cols-6 gap-1.5" : "grid grid-cols-3 gap-2 sm:grid-cols-6"}
      >
        {shownShapes(config, config.frame.shape).map((fr) => (
          <div key={fr.id} className="group relative">
          {!compact && fr.id !== "auto" && config.frame.shape !== fr.id && (
            <TileRemove name={fr.name} ready onClick={() => onEdit("frame.shape:hide", (c) => hideReady(c, "shape", fr.id))} />
          )}
          <button
            type="button"
            aria-pressed={config.frame.shape === fr.id}
            title={fr.hint}
            onClick={() => onEdit("frame.shape", (c) => ({ ...c, frame: { ...c.frame, shape: fr.id } }))}
            className={`block w-full rounded-lg border p-1.5 text-center transition ${
              config.frame.shape === fr.id
                ? "ring-2 ring-primary ring-offset-2"
                : "hover:border-primary/50"
            }`}
          >
            <span
              className={`mx-auto mb-1 block border-2 border-[#c9a227] bg-[#12243f] ${
                compact ? "h-6 w-8" : "h-10 w-14"
              }`}
              style={fr.css}
              aria-hidden
            />
            <span className="block text-[11px] font-medium leading-tight">{fr.name}</span>
          </button>
          </div>
        ))}
      </div>
      {!compact && (
        <HiddenShelf
          testId="frame-shapes-hidden"
          items={FRAME_CHOICES.filter((f) => isHiddenReady(config, "shape", f.id)).map((f) => ({ key: f.id, name: f.name }))}
          onRestore={(id) => onEdit("frame.shape:show", (c) => showReady(c, "shape", id))}
        />
      )}

      {(["top", "bottom"] as const).map((edge) => (
        <AutoSlider
          key={edge}
          label={edge === "top" ? "עיגול למעלה" : "עיגול למטה"}
          value={config.frame[edge]}
          max={FRAME_RADIUS_MAX}
          fallback={1.6}
          compact={compact}
          onChange={(next) =>
            onEdit(`frame.${edge}`, (c) => ({ ...c, frame: { ...c.frame, [edge]: next } }))
          }
        />
      ))}
      {!compact && (
        <p className="text-xs text-muted-foreground">
          כמה מעוגלות הפינות למעלה ולמטה. בצורות חתוכות (כיפה, משושה, מסולסל...) הצורה עצמה קובעת.
        </p>
      )}
    </div>
  );
}

/** The air around the frames (פריסה). */
export function FrameSpacing({
  config,
  onEdit,
  compact = false,
}: {
  config: TvConfig;
  onEdit: Edit;
  compact?: boolean;
}) {
  const heading = compact ? "text-xs font-medium text-muted-foreground" : "text-sm font-medium";
  return (
    <div className="space-y-2">
      <div className={`${heading} pt-1`}>מרווחים</div>
      {SPACING_EDGES.map((edge) => (
        <AutoSlider
          key={edge}
          label={SPACING_LABELS[edge].name}
          hint={SPACING_LABELS[edge].hint}
          value={config.spacing[edge]}
          max={SPACING_MAX}
          fallback={spacingFallback(config.screenLayout)[edge]}
          compact={compact}
          onChange={(next) =>
            onEdit(`spacing.${edge}`, (c) => ({ ...c, spacing: { ...c.spacing, [edge]: next } }))
          }
        />
      ))}

      {!compact && (
        <p className="text-xs text-muted-foreground">
          חל על כל התיבות בכל הפריסות - בטלוויזיה, בלפטופ ובנייד. מרווח קטן יותר מגביה את
          התיבות, ולפעמים מכניס שורה נוספת.
        </p>
      )}
    </div>
  );
}

/** Both, for the panel that opens when the board is clicked (one place on a second screen). */
export function FrameAndSpacing(props: { config: TvConfig; onEdit: Edit; compact?: boolean }) {
  return (
    <>
      <FrameCorners {...props} />
      <FrameSpacing {...props} />
    </>
  );
}

