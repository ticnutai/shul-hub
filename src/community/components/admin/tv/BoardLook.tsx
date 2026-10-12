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
import { useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmDialog";
import { GalleryGrid, GalleryTile, TilePicture, UploadTile } from "./GalleryTile";
import { NameForm, Range } from "./editorParts";
import { DEFAULT_BOARD_FRAME_TUNE, READY_PICTURE_BOARD_FRAMES, type BoardFrameTune } from "@/tv/boardFrame";
import { hideReady, isHiddenReady, showReady } from "@/tv/readyItems";
import { HiddenShelf } from "./ReadyShelf";
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
  // The worn one stays in sight even when hidden: what is on the board is always marked.
  const ready = BOARD_FRAME_CHOICES.filter((f) => f.id === null || f.id === config.boardFrame || !isHiddenReady(config, "boardframe", f.id));
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
  const previewOf = (m: MyBoardFrame) =>
    m.frame === "picture" && m.image ? (
      <span className="block size-full p-1">
        <TilePicture src={m.image} />
      </span>
    ) : (
      BOARD_FRAME_CHOICES.find((f) => f.id === m.frame)?.preview
    );

  const upload = async (files: File[]) => {
    if (!files.length) return;
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
      toast.success("המסגרת נשמרה בגלריה");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const name = (naming?.value ?? "").trim().slice(0, 40);
    if (!name || !config.boardFrame) return;
    const id = naming?.id;
    // The same name: asked, then replaced - as everywhere a thing is kept under a name.
    const same = config.myBoardFrames.find((m) => m.name === name && m.id !== id);
    if (same) {
      const ok = await confirmAction({
        title: `כבר יש מסגרת בשם „${name}”`,
        description: id ? "להחליף אותה במסגרת הזו?" : "להחליף אותה במסגרת שעל הלוח עכשיו?",
        confirmLabel: "החלפה",
        destructive: false,
      });
      if (!ok) return;
    }
    onEdit(`board-frame:${id ? "rename" : "save"}`, (c) => {
      const others = same ? c.myBoardFrames.filter((m) => m.id !== same.id) : c.myBoardFrames;
      return id
        ? { ...c, myBoardFrames: others.map((m) => (m.id === id ? { ...m, name } : m)) }
        : {
            ...c,
            myBoardFrames: [
              ...others,
              { id: newMyBoardFrameId(), name, frame: c.boardFrame!, tune: structuredClone(c.boardFrameTune), image: c.boardFrame === "picture" ? c.boardFrameImage : null },
            ].slice(0, MAX_MY_BOARD_FRAMES),
          };
    });
    setNaming(null);
  };
  const removeMine = async (m: MyBoardFrame) => {
    const ok = await confirmAction({
      title: `למחוק את „${m.name}”?`,
      description: "המסגרת יורדת מהמסגרות שלכם. לוח שמשתמש בה עכשיו לא ישתנה.",
      confirmLabel: "מחיקה",
    });
    if (ok) onEdit("board-frame:delete", (c) => ({ ...c, myBoardFrames: c.myBoardFrames.filter((x) => x.id !== m.id) }));
  };

  return (
    <div className="space-y-3">
      <GalleryGrid testId="board-frames" compact={compact}>
        {!compact && <UploadTile label="העלאת מסגרת" uploading={uploading} onFiles={(files) => void upload(files)} hint="תמונה משלכם סביב הלוח - נשמרת בגלריה" />}
        {ready.map((f) => (
          <GalleryTile
            key={f.id ?? "none"}
            name={f.name}
            hint={f.hint}
            compact={compact}
            // A frame of the shul's own being worn is marked there, not on the ready one it was made from.
            on={config.boardFrame === f.id && !worn}
            onPick={() => put("board-frame", { frame: f.id })}
            preview={f.preview}
            remove={!compact && f.id ? { ready: true, onClick: () => onEdit("board-frame:hide", (c) => hideReady(c, "boardframe", f.id!)) } : undefined}
          />
        ))}
        {READY_PICTURE_BOARD_FRAMES.filter((f) => (config.boardFrame === "picture" && config.boardFrameImage === f.image) || !isHiddenReady(config, "boardframe", f.id)).map((f) => (
          <GalleryTile
            key={f.id}
            testId="ready-picture-board-frame"
            name={f.name}
            compact={compact}
            on={config.boardFrame === "picture" && config.boardFrameImage === f.image && !worn}
            onPick={() => put("board-frame:ready-picture", { frame: "picture", image: f.image, tune: DEFAULT_BOARD_FRAME_TUNE })}
            padded
            preview={<TilePicture src={f.image} />}
            remove={!compact ? { ready: true, onClick: () => onEdit("board-frame:hide", (c) => hideReady(c, "boardframe", f.id)) } : undefined}
          />
        ))}
        {config.myBoardFrames.map((m) => (
          <GalleryTile
            key={m.id}
            testId="my-board-frame"
            name={m.name}
            compact={compact}
            on={wears(m)}
            onPick={() => put(`board-frame:mine:${m.id}`, m)}
            preview={previewOf(m)}
            remove={!compact ? { ready: false, onClick: () => void removeMine(m) } : undefined}
          />
        ))}
      </GalleryGrid>

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
            <NameForm
              label="שם המסגרת"
              value={naming.value}
              onChange={(value) => setNaming({ ...naming, value })}
              onSave={() => void save()}
              onCancel={() => setNaming(null)}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {config.boardFrame && !worn && (
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setNaming({ id: null, value: "" })}>
                  שמירה כמסגרת שלי
                </Button>
              )}
              {worn && (
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setNaming({ id: worn.id, value: worn.name })}>
                  שינוי שם ל„{worn.name}”
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
    ? [{ id: null, name: "כמו כולן", preview: <span className="text-white/60">-</span> }, ...shown]
    : shown;
  const pick = (id: TitleStyle | null) =>
    frame
      ? onEdit(`title-style:${frame}`, (c) => ({ ...c, frameLooks: setFrameLook(c.frameLooks, frame, { titleStyle: id }) }))
      : onEdit("title-style", (c) => ({ ...c, titleStyle: id ?? "plain" }));
  return (
    <div className="space-y-1.5">
      <GalleryGrid testId="title-styles">
        {choices.map((t) => (
          <GalleryTile
            key={t.id ?? "all"}
            name={t.name}
            ariaLabel={`כותרת: ${t.name}`}
            on={current === t.id}
            onPick={() => pick(t.id)}
            preview={<span className="flex size-full items-center justify-center text-[11px]">{t.preview}</span>}
            remove={t.id && t.id !== "plain" ? { ready: true, onClick: () => onEdit("title-style:hide", (c) => hideReady(c, "title", t.id!)) } : undefined}
          />
        ))}
      </GalleryGrid>
      <HiddenShelf
        testId="title-styles-hidden"
        items={TITLE_STYLE_CHOICES.filter((t) => isHiddenReady(config, "title", t.id)).map((t) => ({ key: t.id, name: t.name }))}
        onRestore={(id) => onEdit("title-style:show", (c) => showReady(c, "title", id))}
      />
    </div>
  );
}

/** A slider with a "רגיל" way back to the default: the editor's one slider, with its "רגיל". */
function AutoSlider({
  label,
  hint,
  value,
  max,
  fallback,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | null;
  max: number;
  fallback: number;
  onChange: (next: number | null) => void;
  compact?: boolean;
}) {
  return (
    <Range
      label={label}
      hint={hint}
      value={value ?? fallback}
      min={0}
      max={max}
      step={0.5}
      onChange={onChange}
      auto={{ isDefault: value === null, onToggle: () => onChange(value === null ? fallback : null) }}
    />
  );
}

/** A box's shape, drawn small in a gallery tile. */
export function ShapePreview({ css }: { css: CSSProperties }) {
  return (
    <span className="flex size-full items-center justify-center">
      <span className="block h-3/5 w-2/5 border-2 border-[#c9a227] bg-[#12243f]" style={css} />
    </span>
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
      <GalleryGrid testId="frame-shapes" compact={compact}>
        {shownShapes(config, config.frame.shape).map((fr) => (
          <GalleryTile
            key={fr.id}
            name={fr.name}
            hint={fr.hint}
            compact={compact}
            on={config.frame.shape === fr.id}
            onPick={() => onEdit("frame.shape", (c) => ({ ...c, frame: { ...c.frame, shape: fr.id } }))}
            preview={<ShapePreview css={fr.css} />}
            remove={!compact && fr.id !== "auto" ? { ready: true, onClick: () => onEdit("frame.shape:hide", (c) => hideReady(c, "shape", fr.id)) } : undefined}
          />
        ))}
      </GalleryGrid>
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
        <p className="text-[11px] text-muted-foreground">
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
        <p className="text-[11px] text-muted-foreground">
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

