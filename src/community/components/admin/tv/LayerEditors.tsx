import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Hint } from "@/components/InfoTip";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ConfirmDialog";
import type { TvConfig } from "@/tv/config";
import { frameLabel, setFrameLook, type BoxShape, type FrameId } from "@/tv/frameLooks";
import { DEFAULT_BACKGROUND_TUNE, DEFAULT_FRAME_STYLE, type BackgroundTune, type FrameStyle } from "@/tv/layers";
import { isPictureFill } from "@/tv/layerCss";
import { backdropUrl } from "@/tv/backdrops";
import { FRAME_PICTURES, framePictureRef } from "@/tv/framePictures";
import { FRAME_CHOICES } from "./tvChoices";
import { THEME_VAR_LAYERS, TV_FONTS, isSafeGradient, type ThemeVar } from "@/tv/themes";
import { HiddenShelf } from "./ReadyShelf";
import { Folded, InnerCard, SubPart } from "./Parts";
import { hideReady, isHiddenReady, showReady } from "@/tv/readyItems";
import {
  MAX_BACKGROUNDS,
  hiddenBackgrounds,
  applyBackground,
  backgroundOf,
  writeBoardBackground,
  galleryOf,
  kindOf,
  newBackgroundId,
  tileOf,
  wears,
  type BackgroundKind,
  type SavedBackground,
} from "@/tv/backgrounds";
import { BoardFramePicker, FrameCorners, ShapePreview, TitleStylePicker, shownShapes } from "./BoardLook";
import { GalleryGrid, GalleryTile, NoneTilePreview, TilePicture, UploadTile } from "./GalleryTile";
import { ColourChoice, ColourRow, NameForm, Range, ResetButton, SELECT_CLASS, Segments } from "./editorParts";
import { BOARD_FRAME_KNOBS, BOARD_FRAME_LIMITS, DEFAULT_BOARD_FRAME_TUNE, type BoardFrameTune } from "@/tv/boardFrame";
import { GradientStudio } from "./GradientStudio";
import { TextAreaControls } from "./TextAreaStyles";
import { TEXT_AREAS } from "./textAreas";
import { useUpload } from "./Upload";
import { useElementEditing } from "@/tv/elementEditing";
import { wearsPaint } from "@/tv/partPaint";
import { colourBoards, containersOf, hideBackdrops, paintBoards } from "@/tv/containerParts";
import { PartColour, PartShapeGallery, PartsBoardNote, isPartsBoard, usePartFramePictures } from "./PartLooks";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/**
 * The design tab's three layers - רקעים, מסגרות, טקסט - each with the same
 * question first: for what. The whole board, every frame, one frame, or
 * (for text) one area. The controls under it are that layer's, for that
 * target, so each thing on the board is edited in exactly one place.
 *
 * `config` is what the board shows (the chosen screen, with anything being
 * tried out); `saved` is the same without the try-out, which is what the
 * pickers compare against and what a try-out is laid over.
 */
export type LayerProps = {
  config: TvConfig;
  saved: TvConfig;
  onEdit: Edit;
  setPreview: (p: Partial<TvConfig> | null) => void;
  /** The theme's colours for one layer (TvDesignPanel's colour fields). */
  colourFields: (vars: ThemeVar[]) => ReactNode;
};

/* ---------------------------------------------------------------- pieces -- */

const frameOf = (target: string): FrameId | null =>
  target.startsWith("frame:") ? (target.slice(6) as FrameId) : null;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const FLAT = /^linear-gradient\(180deg, (#[0-9a-f]{6}), \1\)$/i;
const flat = (c: string) => `linear-gradient(180deg, ${c}, ${c})`;

/* --------------------------------------------------------------- רקעים -- */

type Source = "colour" | "gradient" | "picture";

export function BackgroundLayer({
  saved,
  onEdit,
  setPreview,
  colourFields,
  fixedTarget = "board",
}: LayerProps & {
  /**
   * Whose background: "board" (its own section), "frames" or "frame:<id>"
   * (a box's background, inside "תיבות ומסגרות" - with its shape, its line and
   * its frame, rather than in a second place). One gallery either way.
   */
  fixedTarget?: string;
}) {
  const target = fixedTarget;
  const frame = frameOf(target);
  const onBoard = target === "board";
  // The board's background is its own section, in parts; a box's sits inside its part, as cards.
  const inParts = onBoard;
  // The boards of a board of parts chosen: the background goes on them - one, or all - unless the whole board is asked for (as in "רקע הלוח" on the board).
  const editing = useElementEditing();
  const chosenParts = onBoard ? containersOf(saved.elements, editing?.selected ?? []).flatMap((c) => (c.board ? [c.board] : [])) : [];
  const [wholeBoard, setWholeBoard] = useState(false);
  const onParts = chosenParts.length > 0 && !wholeBoard;
  const partIds = chosenParts.map((e) => e.id);

  /** What this target's background is now: a colour, a gradient or a picture, or nothing. */
  const currentOf = (c: TvConfig): string | null =>
    onBoard
      ? c.backgroundImage ?? c.backgroundGradient
      : frame
        ? c.frameLooks[frame]?.bg ?? null
        : c.frameStyle.fill;
  const current = currentOf(saved);
  const kind = (v: string | null): Source =>
    !v ? "gradient" : isPictureFill(v) ? "picture" : isSafeGradient(v) && !FLAT.test(v) ? "gradient" : "colour";
  const [source, setSource] = useState<Source>(() => kind(current));
  useEffect(() => {
    // A new target starts on the kind of background it has.
    setSource(kind(currentOf(saved)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  /** Writes a background into the target. null = back to what the theme / style draws. */
  const write = useCallback(
    (c: TvConfig, value: string | null): TvConfig => {
      // A kit's painted background over the board's own is hidden, or nothing chosen would show (containerParts.ts).
      if (target === "board") return { ...writeBoardBackground(c, value), elements: hideBackdrops(c.elements) };
      const id = frameOf(target);
      if (id) return { ...c, frameLooks: setFrameLook(c.frameLooks, id, { bg: value }) };
      return { ...c, frameStyle: { ...c.frameStyle, fill: value } };
    },
    [target],
  );
  const apply = (value: string | null) => {
    setPreview(null);
    if (onParts) {
      const flatOne = value ? FLAT.exec(value)?.[1] ?? (/^#[0-9a-f]{6}$/i.test(value) ? value : null) : null;
      return onEdit("layer-bg:parts", (c) => ({
        ...c,
        elements: flatOne
          ? colourBoards(c.elements, partIds, flatOne)
          : paintBoards(c.elements, partIds, value ? { fill: isPictureFill(value) ? null : value, picture: isPictureFill(value) ? value : null, overlay: null, strength: 0.55 } : null),
      }));
    }
    onEdit(`layer-bg:${target}`, (c) => write(c, value));
  };
  // Try-outs are laid over what is saved; read through a ref so the callback
  // stays the same while the board changes under it (the pickers depend on it).
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const preview = useCallback(
    (value: string | null) => {
      if (value === null) return setPreview(null);
      const c = write(savedRef.current, value);
      setPreview(
        target === "board"
          ? { backgroundGradient: c.backgroundGradient, backgroundImage: c.backgroundImage, screenLayout: c.screenLayout }
          : target.startsWith("frame:")
            ? { frameLooks: c.frameLooks }
            : { frameStyle: c.frameStyle },
      );
    },
    [target, write, setPreview],
  );

  const { uploading, upload: uploadFiles } = useUpload();
  const upload = (files: File[]) =>
    uploadFiles(files, (urls) => {
      onEdit("bg-gallery:upload", (c) => withUploadedBackgrounds(c, urls));
      setSource("picture");
      apply(urls[0]!);
      toast.success(urls.length > 1 ? `${urls.length} תמונות נשמרו בגלריה` : "התמונה נשמרה בגלריה");
    });

  const tune = saved.backgroundTune;
  const setTune = (patch: Partial<BackgroundTune>) =>
    onEdit("layer-bg:tune", (c) => ({ ...c, backgroundTune: { ...c.backgroundTune, ...patch } }));
  const flatNow = current ? FLAT.exec(current)?.[1] ?? (/^#[0-9a-f]{6}$/i.test(current) ? current : null) : null;
  const picture = isPictureFill(current);
  const shown = current ? (isPictureFill(current) ? backdropUrl(current) : null) : null;

  const sources: Array<{ id: Source; name: string }> = [
    { id: "colour", name: "צבע" },
    { id: "gradient", name: "מעבר צבעים" },
    { id: "picture", name: "תמונה" },
  ];
  /** What this target wears now, as a gallery item would hold it. */
  const look = onBoard
    ? backgroundOf(saved)
    : { fill: picture ? null : current, picture: picture ? current : null, overlay: null, strength: saved.backgroundDim, tune: saved.backgroundTune };

  return (
    <div className={onBoard ? "space-y-5" : "space-y-3"} data-testid={onBoard ? "layer-background" : "box-layer-background"}>
      {chosenParts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="layer-background-target">
          <Segments
            label="על מה חל הרקע"
            value={onParts ? "parts" : "board"}
            onChange={(v) => setWholeBoard(v === "board")}
            options={[{ id: "parts", name: chosenParts.length === 1 ? `על החלק שנבחר: ${chosenParts[0].name}` : `על ${chosenParts.length} החלקים שנבחרו` }, { id: "board", name: "על רקע הלוח כולו" }]}
          />
        </div>
      )}
      <SubPart bare={!inParts} title="גלריית רקעים" hint="לחיצה מלבישה. צבעים, מעברי צבע ותמונות - מוכנים ושלכם; ✕ מסתיר או מוחק.">
      <BackgroundGallery
        testIds={onBoard ? "" : "box-"}
        saved={saved}
        onEdit={onEdit}
        look={look}
        uploading={uploading}
        onUpload={(files) => void upload(files)}
        isOn={(b) => (onParts ? wearsPaint(chosenParts[0], b) : onBoard ? wears(saved, b) : current === (b.picture ?? b.fill))}
        onPick={(b) => {
          setPreview(null);
          setSource(kindOf(b));
          if (onParts) onEdit("layer-bg:parts", (c) => ({ ...c, elements: paintBoards(c.elements, partIds, b) }));
          else if (onBoard) onEdit("layer-bg:board", (c) => ({ ...applyBackground(c, b), elements: hideBackdrops(c.elements) }));
          else apply(b.picture ?? b.fill);
        }}
      />
      </SubPart>

      <SubPart bare={!inParts} title="רקע משלכם" hint="צבע, מעבר צבעים או תמונה - בונים כאן ושומרים בגלריה.">
      <InnerCard testId={onBoard ? "background-now" : "box-background-now"} label={onBoard ? "הרקע של הלוח עכשיו" : "הרקע עכשיו"}>
        <Segments label={onBoard ? "סוג הרקע של הלוח" : "סוג הרקע של התיבות"} value={source} onChange={(v) => setSource(v as Source)} options={sources} />

        {source === "colour" && (
          <ColourRow label="צבע הרקע" value={flatNow ?? "#0b1628"} onChange={(v) => apply(onBoard ? flat(v) : v)} />
        )}
        {source === "gradient" && (
          <GradientStudio
            key={target}
            of={onBoard ? "הלוח" : "התיבות"}
            applyLabel={onBoard ? "החלה על רקע הלוח" : frame ? `החלה על ${frameLabel(frame, saved.customBoxes)}` : "החלה על כל התיבות"}
            current={current && isSafeGradient(current) ? current : null}
            onPreview={preview}
            onApply={apply}
          />
        )}
        {source === "picture" && (
          <div className="space-y-2">
            {picture && shown ? (
              <img src={shown} alt="" className="h-16 w-28 rounded object-cover" />
            ) : (
              <Hint>בחרו תמונה בגלריה למעלה, או העלו תמונה משלכם - היא נשמרת בגלריה.</Hint>
            )}
            {onBoard && picture && <PictureLayer saved={saved} onEdit={onEdit} />}
          </div>
        )}
      </InnerCard>
      </SubPart>

      {/* The sliders of this target's background. */}
      {onBoard ? (
        <SubPart bare={!inParts} title="כוונון" hint="בהירות, רוויה, גוון וטשטוש של הרקע, וצבע מעליו.">
        <InnerCard testId="background-tune">
          <Range label="בהירות" value={tune.brightness} min={0.6} max={1.4} step={0.05} show={pct} onChange={(v) => setTune({ brightness: v })} />
          <Range label="רוויית צבע" value={tune.saturation} min={0} max={2} step={0.05} show={pct} onChange={(v) => setTune({ saturation: v })} />
          <Range label="גוון" value={tune.hue} min={-180} max={180} step={5} show={(v) => `${v}°`} onChange={(v) => setTune({ hue: v })} />
          <Range label="טשטוש" value={tune.blur} min={0} max={10} step={0.5} show={(v) => (v ? String(v) : "ללא")} onChange={(v) => setTune({ blur: v })} />
          <ColourChoice label="צבע מעל הרקע" value={tune.tint} fallback="#c08a4a" unsetLabel="ללא" onChange={(v) => setTune({ tint: v })} />
          {tune.tint && (
            <Range label="עוצמת הצבע" value={tune.tintStrength} min={0.05} max={1} step={0.05} show={pct} onChange={(v) => setTune({ tintStrength: v })} />
          )}
          <ResetButton onClick={() => setTune(DEFAULT_BACKGROUND_TUNE)}>חזרה לכוונון הרגיל</ResetButton>
        </InnerCard>
        </SubPart>
      ) : !picture ? (
        // Always for a box, also on the theme's own colour: how much of what is
        // behind it shows through. 100% blocks it; less lets the background in.
        <Range
          label="אטימות - 100% חוסם, פחות = רואים דרך התיבה"
          value={frame ? saved.frameLooks[frame]?.bgOpacity ?? 1 : saved.frameStyle.fillOpacity}
          min={0}
          max={1}
          step={0.05}
          show={pct}
          onChange={(v) =>
            onEdit(`layer-bg:opacity:${target}`, (c) =>
              frame
                ? { ...c, frameLooks: setFrameLook(c.frameLooks, frame, { bgOpacity: v }) }
                : { ...c, frameStyle: { ...c.frameStyle, fillOpacity: v } },
            )
          }
        />
      ) : null}

      {current && (
        <ResetButton onClick={() => apply(null)}>
          {onBoard ? "חזרה לצבעי הבסיס של הלוח" : frame ? `חזרה לרקע של כל התיבות (${frameLabel(frame, saved.customBoxes)})` : "חזרה לרקע הרגיל של התיבות"}
        </ResetButton>
      )}

      {onBoard && (
        <SubPart bare={!inParts} title="צבעי הבסיס" hint="מה שרואים כשללוח אין רקע משלו.">
          <Folded label="צבעי הבסיס של רקע הלוח">{colourFields(THEME_VAR_LAYERS.background)}</Folded>
        </SubPart>
      )}
    </div>
  );
}

/* ------------------------------------------------- the background gallery -- */

type Look = Omit<SavedBackground, "id" | "name">;
type GalleryFilter = "all" | BackgroundKind | "mine";
const GALLERY_FILTERS: Array<{ id: GalleryFilter; name: string }> = [
  { id: "all", name: "הכול" },
  { id: "colour", name: "צבעים" },
  { id: "gradient", name: "מעברי צבע" },
  { id: "picture", name: "תמונות" },
  { id: "mine", name: "שלי" },
];
const KIND_NAMES: Record<BackgroundKind, string> = { colour: "צבע שלי", gradient: "מעבר צבעים שלי", picture: "תמונה שלי" };

/** A background as a small picture of itself: its fill, its picture, the layer over the picture. */
/**
 * Uploaded pictures, kept in the gallery of backgrounds - every one: an
 * upload used to replace the one before it, which was then gone from every
 * list. The same from the design tab and from the board clicked on.
 */
export function withUploadedBackgrounds(c: TvConfig, urls: string[]): TvConfig {
  const items = urls.map((url, i) => ({
    id: newBackgroundId(),
    name: `תמונה שלי ${c.backgrounds.length + i + 1}`,
    fill: null,
    picture: url,
    overlay: null,
    strength: c.backgroundDim,
    tune: DEFAULT_BACKGROUND_TUNE,
  }));
  return { ...c, backgrounds: [...items, ...c.backgrounds].slice(0, MAX_BACKGROUNDS) };
}

/** One background, drawn inside a gallery tile (here, and in the panel of the board clicked on). */
export function BackgroundTile({ b }: { b: Look }) {
  const t = tileOf(b);
  return (
    <span className="absolute inset-0" style={{ backgroundImage: t.fill ?? undefined }}>
      {t.thumb && <img src={t.thumb} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />}
      {t.picture && t.overlay && <span className="absolute inset-0" style={{ background: t.overlay, opacity: t.strength }} />}
    </span>
  );
}

/**
 * Every background, in one place: the ready-made colours, gradients and
 * pictures and the shul's own, side by side. A click puts one on (it is a
 * draft until "שמור ושדר", and undo takes it back); what is on now can be
 * kept as a new one, or written back into the one of the shul's own it came
 * from. An uploaded picture lands here by itself.
 */
function BackgroundGallery({
  saved,
  onEdit,
  look,
  isOn,
  onPick,
  onUpload,
  uploading,
  testIds = "",
}: {
  /** Before its test ids: "" for the board's, "box-" for a box's. */
  testIds?: string;
  saved: TvConfig;
  onEdit: Edit;
  look: Look;
  isOn: (b: SavedBackground) => boolean;
  onPick: (b: SavedBackground) => void;
  onUpload: (files: File[]) => void;
  uploading: boolean;
}) {
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [from, setFrom] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  // The one worn stays in sight even when hidden: what is on the board is always marked.
  const all = [...galleryOf(saved), ...hiddenBackgrounds(saved).filter(isOn)];
  const shown = all.filter((b) =>
    filter === "all" ? true : filter === "mine" ? saved.backgrounds.includes(b) : kindOf(b) === filter,
  );
  const mine = saved.backgrounds.find((b) => b.id === from) ?? null;
  const sameLook = (b: SavedBackground) => {
    const { id: _id, name: _name, ...rest } = b;
    return JSON.stringify(rest) === JSON.stringify(look);
  };
  const kept = all.some((b) => isOn(b) && (!b.id.startsWith("b_") || sameLook(b)));
  const changed = Boolean(mine && !sameLook(mine));

  /** A name not yet taken, to start from: "צבע שלי 3". */
  const freeName = () => {
    const base = KIND_NAMES[kindOf(look)];
    let i = saved.backgrounds.length + 1;
    while (saved.backgrounds.some((b) => b.name === `${base} ${i}`)) i++;
    return `${base} ${i}`;
  };
  const keep = async () => {
    const clean = (name ?? "").trim().slice(0, 40) || KIND_NAMES[kindOf(look)];
    // The same name: asked, then replaced - as everywhere a thing is kept under a name.
    const same = saved.backgrounds.find((b) => b.name === clean);
    if (same) {
      const ok = await confirmAction({
        title: `כבר יש רקע בשם „${clean}”`,
        description: "להחליף אותו ברקע שעל הלוח עכשיו?",
        confirmLabel: "החלפה",
        destructive: false,
      });
      if (!ok) return;
      onEdit("bg-gallery:update", (c) => ({ ...c, backgrounds: c.backgrounds.map((x) => (x.id === same.id ? { ...x, ...look } : x)) }));
      setFrom(same.id);
    } else {
      const id = newBackgroundId();
      onEdit("bg-gallery:keep", (c) => ({ ...c, backgrounds: [{ id, name: clean, ...look }, ...c.backgrounds].slice(0, MAX_BACKGROUNDS) }));
      setFrom(id);
    }
    setName(null);
    toast.success(`"${clean}" נשמר בגלריה`);
  };

  const remove = async (b: SavedBackground, own: boolean) => {
    if (own) {
      const ok = await confirmAction({
        title: `למחוק את „${b.name}” מהגלריה?`,
        description: "לוח שמשתמש בו עכשיו לא ישתנה.",
        confirmLabel: "מחיקה",
      });
      if (!ok) return;
      onEdit("bg-gallery:delete", (c) => ({ ...c, backgrounds: c.backgrounds.filter((x) => x.id !== b.id) }));
    } else onEdit("bg-gallery:hide", (c) => hideReady(c, "bg", b.id));
    if (from === b.id) setFrom(null);
  };

  return (
    <div className="space-y-2" data-testid={`${testIds}background-gallery`}>
      <Segments
        label="אילו רקעים להראות"
        value={filter}
        onChange={(v) => setFilter(v as GalleryFilter)}
        options={GALLERY_FILTERS.map((f) => ({
          id: f.id,
          name: f.id === "mine" && saved.backgrounds.length ? `${f.name} (${saved.backgrounds.length})` : f.name,
        }))}
      />
      <GalleryGrid scroll>
        <UploadTile label="העלאת תמונה" multiple uploading={uploading} onFiles={onUpload} hint="העלאת תמונה משלכם - נשמרת בגלריה" />
        {shown.map((b) => {
          const own = b.id.startsWith("b_");
          return (
            <GalleryTile
              key={b.id}
              name={b.name}
              on={isOn(b)}
              onPick={() => {
                onPick(b);
                setFrom(own ? b.id : null);
              }}
              preview={<BackgroundTile b={b} />}
              remove={{ ready: !own, onClick: () => void remove(b, own) }}
            />
          );
        })}
      </GalleryGrid>
      <HiddenShelf
        testId={`${testIds}background-hidden`}
        items={hiddenBackgrounds(saved).map((b) => ({ key: b.id, name: b.name }))}
        onRestore={(id) => onEdit("bg-gallery:show", (c) => showReady(c, "bg", id))}
      />
      {(!kept || changed) && Boolean(look.fill || look.picture) && (
        <div className="space-y-2 rounded-md bg-muted/50 p-2 text-xs" data-testid={`${testIds}background-keep`}>
          <div className="flex flex-wrap items-center gap-2">
            <span>הרקע שעל הלוח עכשיו {changed && mine ? `שונה מ"${mine.name}"` : "לא שמור בגלריה"}:</span>
            {changed && mine && (
              <Button
                type="button"
                size="sm"
                className="h-8"
                onClick={() => {
                  onEdit("bg-gallery:update", (c) => ({ ...c, backgrounds: c.backgrounds.map((x) => (x.id === mine.id ? { ...x, ...look } : x)) }));
                  toast.success(`"${mine.name}" עודכן`);
                }}
              >
                עדכון "{mine.name}"
              </Button>
            )}
            {name === null && (
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setName(freeName())}>
                שמירה כרקע חדש
              </Button>
            )}
          </div>
          {name !== null && (
            <NameForm
              label="שם לרקע בגלריה"
              value={name}
              placeholder={KIND_NAMES[kindOf(look)]}
              onChange={setName}
              onSave={() => void keep()}
              onCancel={() => setName(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

const TWO_STOPS = /^linear-gradient\((\d{1,3})deg, (#[0-9a-f]{6}), (#[0-9a-f]{6})\)$/i;

/**
 * What lies over the picture: the theme's own colour (as the board always
 * darkened a picture), a colour of its own, or a gradient - and how strongly.
 */
function PictureLayer({ saved, onEdit }: { saved: TvConfig; onEdit: Edit }) {
  const overlay = saved.backgroundOverlay;
  const two = overlay ? TWO_STOPS.exec(overlay) : null;
  const mode: "theme" | "colour" | "gradient" = !overlay ? "theme" : isSafeGradient(overlay) ? "gradient" : "colour";
  const set = (v: string | null) => onEdit("bg-overlay", (c) => ({ ...c, backgroundOverlay: v }));
  const angle = two ? Number(two[1]) : 180;
  const a = two?.[2] ?? "#0b1628";
  const b = two?.[3] ?? "#1b3054";
  const gradient = (deg: number, x: string, y: string) => `linear-gradient(${deg}deg, ${x}, ${y})`;
  const hex = overlay && /^#[0-9a-f]{6}$/i.test(overlay) ? overlay : "#0b1628";
  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-2" data-testid="picture-layer">
      <Segments
        label="שכבה מעל התמונה"
        value={mode}
        onChange={(v) => set(v === "theme" ? null : v === "colour" ? hex : gradient(angle, a, b))}
        options={[
          { id: "theme", name: "צבע הבסיס" },
          { id: "colour", name: "צבע" },
          { id: "gradient", name: "מעבר צבעים" },
        ]}
      />
      {mode === "colour" && <ColourRow label="צבע השכבה" value={hex} onChange={set} />}
      {mode === "gradient" && (
        <div className="space-y-2">
          <ColourRow label="צבע ראשון של השכבה" value={a} onChange={(v) => set(gradient(angle, v, b))} />
          <ColourRow label="צבע שני של השכבה" value={b} onChange={(v) => set(gradient(angle, a, v))} />
          <Range label="כיוון השכבה" value={angle} min={0} max={360} step={5} show={(v) => `${v}°`} onChange={(v) => set(gradient(v, a, b))} />
        </div>
      )}
      <Range
        label="עוצמת השכבה"
        value={saved.backgroundDim}
        min={0}
        max={0.95}
        step={0.05}
        show={pct}
        onChange={(v) => onEdit("dim", (c) => ({ ...c, backgroundDim: v }))}
      />
    </div>
  );
}

/* -------------------------------------------------------------- מסגרות -- */

/**
 * The board's frame moved and sized by hand: thicker, longer, further from
 * the side, up or down, on one side or both - each knob named for the frame
 * chosen (boardFrame.BOARD_FRAME_KNOBS). The content makes room by itself.
 */
function BoardFrameControls({ config, onEdit }: { config: TvConfig; onEdit: LayerProps["onEdit"] }) {
  const frame = config.boardFrame;
  if (!frame) return null;
  const knobs = BOARD_FRAME_KNOBS[frame];
  const t = config.boardFrameTune;
  const set = (key: string, patch: Partial<BoardFrameTune>) =>
    onEdit(`board-frame-tune:${key}`, (c) => ({ ...c, boardFrameTune: { ...c.boardFrameTune, ...patch } }));
  const L = BOARD_FRAME_LIMITS;
  const u = (v: number) => `${v}`;
  return (
    <InnerCard label="מיקום וגודל" testId="board-frame-controls">
      {knobs.sides && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>באיזה צד</span>
          <Segments
            label="באיזה צד"
            value={t.sides}
            onChange={(id) => set("sides", { sides: id })}
            options={[
              { id: "both", name: "שני הצדדים" },
              { id: "right", name: "רק ימין" },
              { id: "left", name: "רק שמאל" },
            ]}
          />
        </div>
      )}
      <Range label={knobs.size} value={t.size} min={L.size[0]} max={L.size[1]} step={0.05} show={pct} onChange={(v) => set("size", { size: v })} />
      {knobs.length && (
        <Range label={knobs.length} value={t.length} min={L.length[0]} max={L.length[1]} step={0.02} show={pct} onChange={(v) => set("length", { length: v })} />
      )}
      {knobs.x && <Range label={knobs.x} value={t.x} min={L.x[0]} max={L.x[1]} step={0.5} show={u} onChange={(v) => set("x", { x: v })} />}
      {knobs.y && <Range label={knobs.y} value={t.y} min={L.y[0]} max={L.y[1]} step={0.5} show={u} onChange={(v) => set("y", { y: v })} />}
      <ResetButton onClick={() => set("reset", { ...DEFAULT_BOARD_FRAME_TUNE })}>חזרה לגודל ולמקום הרגילים</ResetButton>
    </InnerCard>
  );
}


/**
 * Everything about the boxes, in one place: ready boxes, a shape, a
 * background (from the same gallery as the board's), a line and how far they
 * stand out, and a frame picture - for every box, or for one box apart.
 * A box's background used to be under "רקעים" and its line here: two places
 * for one box.
 */
type BoxPart = "shape" | "background" | "frames";

export function FramesLayer(
  props: LayerProps & {
    /** Every box ("frames") or one ("frame:<id>"), chosen once at the top of the tab. */
    target: string;
    /** Which part of the box this section shows; all of them when not given. */
    part?: BoxPart;
  },
) {
  const { config, saved, onEdit, colourFields } = props;
  const target = props.target;
  const show = (p: BoxPart) => !props.part || props.part === p;
  const Part = SubPart;
  const frame = frameOf(target);
  const fs = saved.frameStyle;
  const own = frame ? saved.frameLooks[frame] : undefined;
  const setFs = (patch: Partial<FrameStyle>) =>
    onEdit("layer-frames", (c) => ({ ...c, frameStyle: { ...c.frameStyle, ...patch } }));
  const setOwn = (key: string, patch: Parameters<typeof setFrameLook>[2]) =>
    frame && onEdit(`layer-frames:${frame}:${key}`, (c) => ({ ...c, frameLooks: setFrameLook(c.frameLooks, frame, patch) }));

  // On a board of parts the same galleries dress the parts chosen on it (PartLooks.tsx).
  const parts = isPartsBoard(config);
  const partFrames = usePartFramePictures(config, onEdit);
  /** The frame picture on every box, or on this one; null takes it off. */
  const wearPicture = (ref: string | null, name = "") => {
    if (parts) return partFrames.wear(ref, name);
    if (frame) return setOwn("image", { image: ref });
    const ready = FRAME_PICTURES.find((f) => framePictureRef(f.id) === ref);
    setFs(ready ? { image: ref, imageSlice: ready.slice, imageWidth: ready.width } : { image: ref });
  };
  const wearing = parts ? partFrames.wearing : frame ? own?.image ?? null : fs.image;

  const { uploading, upload } = useUpload();
  const uploadFrame = (files: File[]) =>
    upload(files, (urls) => {
      // Kept in the gallery of frames, whether a box wears it or not.
      onEdit("frame-uploads", (c) => ({ ...c, frameUploads: [...new Set([...urls, ...c.frameUploads])].slice(0, 40) }));
      wearPicture(urls[0]!, "שהעליתם");
      toast.success("המסגרת נשמרה בגלריה");
    });

  const pictures = [
    // The worn one stays in sight even when hidden: what is on the board is always marked.
    ...FRAME_PICTURES.filter((f) => framePictureRef(f.id) === wearing || !isHiddenReady(saved, "frame", framePictureRef(f.id))).map((f) => ({
      ref: framePictureRef(f.id),
      name: f.name,
      url: f.url,
      uploaded: false,
    })),
    ...saved.frameUploads.map((u, i) => ({ ref: u, name: `מסגרת שלי ${i + 1}`, url: u, uploaded: true })),
  ];

  return (
    <div className="space-y-5" data-testid={props.part ? `box-part-${props.part}` : "layer-frames"}>

      {show("shape") && (
      <Part title="צורה ופינות" testId="box-shape">
        {parts ? (
          <PartShapeGallery config={config} onEdit={onEdit} />
        ) : frame ? (
          // The same tiles, names and order as for every box (FRAME_CHOICES); "רגיל" is the plain round corner.
          <div className="space-y-2">
            <GalleryGrid testId="box-shapes">
              {[
                { id: null as BoxShape | null, name: "כמו כולן", hint: "הצורה של כל התיבות", css: null as CSSProperties | null },
                ...shownShapes(saved, own?.shape === "round" ? "auto" : own?.shape).map((c) => ({ id: (c.id === "auto" ? "round" : c.id) as BoxShape | null, name: c.name, hint: c.hint, css: c.css as CSSProperties | null })),
              ].map((choice) => {
                const on = (own?.shape ?? null) === choice.id;
                const ready = choice.id && choice.id !== "round" ? choice.id : null;
                return (
                  <GalleryTile
                    key={choice.id ?? "all"}
                    name={choice.name}
                    hint={choice.hint}
                    on={on}
                    onPick={() => setOwn("shape", { shape: choice.id })}
                    preview={choice.css ? <ShapePreview css={choice.css} /> : <NoneTilePreview />}
                    remove={ready ? { ready: true, onClick: () => onEdit("frame.shape:hide", (c) => hideReady(c, "shape", ready)) } : undefined}
                  />
                );
              })}
            </GalleryGrid>
            <HiddenShelf
              testId="box-shapes-hidden"
              items={FRAME_CHOICES.filter((f) => isHiddenReady(saved, "shape", f.id)).map((f) => ({ key: f.id, name: f.name }))}
              onRestore={(id) => onEdit("frame.shape:show", (c) => showReady(c, "shape", id))}
            />
          </div>
        ) : (
          <FrameCorners config={config} onEdit={onEdit} />
        )}
      </Part>

      )}

      {show("background") && (
      <Part
        title="רקע התיבה"
        testId="box-background"
        hint='צבע, מעבר צבעים או תמונה מאותה גלריה של הרקעים - ו"אטימות": 100% חוסם, פחות - רואים את רקע הלוח דרך התיבה.'
      >
        {parts ? (
          <PartColour config={config} onEdit={onEdit} what="fill" />
        ) : (
          <>
            <BackgroundLayer key={target} {...props} fixedTarget={target} />
            {!frame && <Folded label="צבע הבסיס של התיבות (כשאין להן רקע משלהן)">{colourFields(THEME_VAR_LAYERS.frames)}</Folded>}
          </>
        )}
      </Part>
      )}

      {/* Not a box's frame: one for the whole board - columns, beams, a פרוכת, a frame around the screen. */}
      {show("frames") && !frame && (
        <Part title="מסגרת ללוח כולו" testId="board-frame" hint="חלה על כל המסך, לא על תיבה. הצבעים והחומרים של התיבות נשארים כפי שבחרתם.">
          <BoardFramePicker config={config} onEdit={onEdit} />
          <BoardFrameControls config={saved} onEdit={onEdit} />
        </Part>
      )}

      {show("frames") && (
        <Part title={parts ? "הקו של התיבות והמסגרות" : "קו ובליטה של התיבות"} testId="frame-style" hint={frame ? "הבליטה ועובי מסגרת התמונה - משותפים לכל התיבות (בחרו \"הכול\" למעלה)." : undefined}>
          {parts ? (
            <PartColour config={config} onEdit={onEdit} what="line" />
          ) : frame ? (
            <>
              <ColourChoice
                label="קו מסביב"
                value={own?.line}
                fallback="#c9a227"
                unsetLabel="כמו כל התיבות"
                onChange={(v) => setOwn("line", { line: v })}
              />
              {own?.line && (
                <Range label="עובי הקו" value={own.lineWidth ?? 2} min={0.5} max={6} step={0.5} show={(v) => String(v)} onChange={(v) => setOwn("w", { lineWidth: v })} />
              )}
            </>
          ) : (
            <>
              <ColourChoice label="קו מסביב" value={fs.line} fallback="#c9a227" unsetLabel="בלי קו" onChange={(v) => setFs({ line: v })} />
              {fs.line && (
                <Range label="עובי הקו" value={fs.lineWidth} min={0.5} max={6} step={0.5} show={(v) => String(v)} onChange={(v) => setFs({ lineWidth: v })} />
              )}
              <Range
                label="כמה התיבות בולטות"
                value={fs.depth}
                min={0}
                max={1}
                step={0.05}
                show={(v) => (v === 0 ? "רגיל" : pct(v))}
                onChange={(v) => setFs({ depth: v })}
              />
              <ResetButton onClick={() => setFs({ line: DEFAULT_FRAME_STYLE.line, lineWidth: DEFAULT_FRAME_STYLE.lineWidth, depth: DEFAULT_FRAME_STYLE.depth })}>
                חזרה לקו ולבליטה הרגילים
              </ResetButton>
            </>
          )}
        </Part>
      )}

      {show("frames") && (
      <Part
        title={parts ? "מסגרת למסגרות שבחרתם" : "מסגרת לתיבות"}
        testId="frame-pictures"
        hint="הפינות נשמרות והצלעות נמתחות לאורך התיבה. לחיצה מלבישה, ו&quot;בלי&quot; מסירה; מסגרת שהעליתם נשמרת כאן, ו-✕ מוחק אותה מהגלריה. בתיבה בצורה חתוכה (משושה, מתומן, כיפה...) המסגרת לא מוצגת - הקו מסביב עוקב אחרי הצורה במקומה."
      >
        {parts && <PartsBoardNote count={partFrames.count} kind="frame" />}
        <GalleryGrid>
          <UploadTile label="העלאת מסגרת" uploading={uploading} onFiles={(files) => void uploadFrame(files)} hint="העלאת מסגרת משלכם - נשמרת בגלריה" />
          {/* Taking it off is a tile of its own: a second click on the worn one never takes it off. */}
          <GalleryTile
            name={frame ? "כמו כל התיבות" : parts ? "קו מצויר" : "בלי מסגרת"}
            hint={frame ? "המסגרת של כל התיבות" : "התיבות בלי מסגרת מתמונה"}
            on={wearing === null}
            onPick={() => wearPicture(null)}
            preview={<NoneTilePreview />}
          />
          {pictures.map((f) => (
            <GalleryTile
              key={f.ref}
              name={f.name}
              on={wearing === f.ref}
              onPick={() => wearPicture(f.ref, f.name)}
              padded
              preview={<TilePicture src={f.url} />}
              remove={{
                ready: !f.uploaded,
                onClick: async () => {
                  if (!f.uploaded) return onEdit("frame-pictures:hide", (c) => hideReady(c, "frame", f.ref));
                  const ok = await confirmAction({
                    title: `למחוק את „${f.name}” מהגלריה?`,
                    description: "תיבה שמשתמשת בה עכשיו לא תשתנה.",
                    confirmLabel: "מחיקה",
                  });
                  if (ok) onEdit("frame-uploads:delete", (c) => ({ ...c, frameUploads: c.frameUploads.filter((u) => u !== f.ref) }));
                },
              }}
            />
          ))}
        </GalleryGrid>
        <HiddenShelf
          testId="frame-hidden"
          items={FRAME_PICTURES.filter((f) => isHiddenReady(saved, "frame", framePictureRef(f.id))).map((f) => ({
            key: framePictureRef(f.id),
            name: f.name,
          }))}
          onRestore={(ref) => onEdit("frame-pictures:show", (c) => showReady(c, "frame", ref))}
        />
        {!frame && !parts && fs.image && (
          <>
            <Range label="עובי המסגרת" value={fs.imageWidth} min={0.5} max={6} step={0.25} show={(v) => String(v)} onChange={(v) => setFs({ imageWidth: v })} />
            <Range label="כמה מהתמונה היא המסגרת" value={fs.imageSlice} min={10} max={45} step={1} show={(v) => `${v}%`} onChange={(v) => setFs({ imageSlice: v })} />
          </>
        )}
      </Part>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- טקסט -- */

export function TextLayer({
  config,
  saved,
  onEdit,
  colourFields,
  target: given,
}: LayerProps & {
  /** Every box ("frames": the board's text) or one ("frame:<id>"), chosen once at the top of the tab. */
  target: string;
}) {
  // With the box chosen at the top: optionally one element of the board (the clock's time, a title...).
  const [element, setElement] = useState("");
  const target = element ? `area:${element}` : given === "frames" ? "board" : given;
  const frame = frameOf(target);
  const area = target.startsWith("area:") ? target.slice(5) : null;

  return (
    <div className="space-y-5" data-testid="layer-text">
      {/* One part of the board's text: offered for the whole board, where it belongs. */}
      {given === "frames" && (
        <SubPart title="איזה טקסט" hint="כל הטקסט בלוח, או חלק אחד ממנו (השעה, שם בית הכנסת, כותרת...).">
          <select
            aria-label="חלק מסוים בטקסט"
            value={element}
            onChange={(e) => setElement(e.target.value)}
            className={`${SELECT_CLASS} w-full`}
          >
            <option value="">כל הטקסט בלוח</option>
            {TEXT_AREAS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
                {config.styles[a.key] ? " •" : ""}
              </option>
            ))}
          </select>
        </SubPart>
      )}

      {area ? (
        <SubPart title="עיצוב החלק שנבחר">
          <TextAreaControls config={config} onEdit={onEdit} areaKey={area} />
        </SubPart>
      ) : frame ? (
        <>
          <SubPart title="גופן וגודל">
            {/* Its own font and size: for this box only, over the board's. */}
            <label className="flex items-center gap-2 text-xs">
              <span className="shrink-0">גופן</span>
              <select
                aria-label="גופן התיבה"
                value={saved.frameLooks[frame]?.font ?? ""}
                onChange={(e) =>
                  onEdit(`layer-text:${frame}:font`, (c) => ({
                    ...c,
                    frameLooks: setFrameLook(c.frameLooks, frame, { font: (e.target.value || null) as TvConfig["font"] | null }),
                  }))
                }
                className={`${SELECT_CLASS} flex-1`}
              >
                <option value="">כמו כל הלוח</option>
                {TV_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <Range
              label="גודל הטקסט בתיבה"
              value={saved.frameLooks[frame]?.textScale ?? 1}
              min={0.6}
              max={1.8}
              step={0.05}
              show={pct}
              onChange={(v) =>
                onEdit(`layer-text:${frame}:scale`, (c) => ({ ...c, frameLooks: setFrameLook(c.frameLooks, frame, { textScale: v === 1 ? null : v }) }))
              }
            />
          </SubPart>
          <SubPart title="סגנון הכותרת">
            <TitleStylePicker config={saved} onEdit={onEdit} frame={frame} />
          </SubPart>
          <SubPart title="צבעי הטקסט">
            <ColourChoice
              label="טקסט"
              value={saved.frameLooks[frame]?.text}
              fallback="#ffffff"
              unsetLabel="כמו כל הלוח"
              onChange={(v) => onEdit(`layer-text:${frame}:text`, (c) => ({ ...c, frameLooks: setFrameLook(c.frameLooks, frame, { text: v }) }))}
            />
            <ColourChoice
              label="כותרות ושעות"
              value={saved.frameLooks[frame]?.accent}
              fallback="#f0c35c"
              unsetLabel="כמו כל הלוח"
              onChange={(v) => onEdit(`layer-text:${frame}:accent`, (c) => ({ ...c, frameLooks: setFrameLook(c.frameLooks, frame, { accent: v }) }))}
            />
          </SubPart>
        </>
      ) : (
        <>
          <SubPart title="גופן וגודל">
            <label className="flex items-center gap-2 text-xs">
              <span className="shrink-0">גופן</span>
              <select
                aria-label="גופן"
                value={saved.font}
                onChange={(e) => onEdit("font", (c) => ({ ...c, font: e.target.value as TvConfig["font"] }))}
                className={`${SELECT_CLASS} flex-1`}
              >
                {TV_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <Range
              label="גודל הטקסט"
              value={saved.textScale}
              min={0.8}
              max={1.3}
              step={0.05}
              show={pct}
              onChange={(v) => onEdit("scale", (c) => ({ ...c, textScale: v }))}
            />
            {/* In hundredths of the letters' size, shown as a share; "רגיל" leaves it to the board. */}
            <Range
              label="מרווח אותיות בכותרות"
              value={saved.tracking ?? 0}
              min={0}
              max={0.24}
              step={0.01}
              show={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => onEdit("track", (c) => ({ ...c, tracking: v }))}
              auto={{ isDefault: saved.tracking === null, onToggle: () => onEdit("track", (c) => ({ ...c, tracking: c.tracking === null ? 0 : null })) }}
            />
          </SubPart>
          <SubPart title="סגנון הכותרת">
            <TitleStylePicker config={saved} onEdit={onEdit} />
          </SubPart>
          <SubPart title="צבעי הטקסט">{colourFields(THEME_VAR_LAYERS.text)}</SubPart>
        </>
      )}
    </div>
  );
}
