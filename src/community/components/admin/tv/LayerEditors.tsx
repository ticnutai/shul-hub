import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FRAME_CHOICES } from "./tvChoices";
import { ImagePlus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TvConfig } from "@/tv/config";
import { frameLabel, setFrameLook, type BoxShape, type FrameId } from "@/tv/frameLooks";
import { DEFAULT_BACKGROUND_TUNE, DEFAULT_FRAME_STYLE, type BackgroundTune, type FrameStyle } from "@/tv/layers";
import { isPictureFill } from "@/tv/layerCss";
import { backdropUrl } from "@/tv/backdrops";
import { FRAME_PICTURES, framePictureRef } from "@/tv/framePictures";
import { THEME_VAR_LAYERS, TV_FONTS, isSafeGradient, type ThemeVar } from "@/tv/themes";
import { HiddenShelf, TileRemove } from "./ReadyShelf";
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
import { BoardFramePicker, FrameCorners, TitleStylePicker } from "./BoardLook";
import { BOARD_FRAME_KNOBS, BOARD_FRAME_LIMITS, DEFAULT_BOARD_FRAME_TUNE, type BoardFrameTune } from "@/tv/boardFrame";
import { GradientStudio } from "./GradientStudio";
import { TextAreaControls } from "./TextAreaStyles";
import { TEXT_AREAS } from "./textAreas";
import { uploadImages } from "./uploadImages";

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

function Range({
  label,
  value,
  min,
  max,
  step,
  show,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  show: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{show(value)}</span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

/**
 * A colour that may be unset. Unset shows a one-tap "הוספה" with a suggested
 * colour: a colour box already showing a colour cannot report that same
 * colour being picked, so a first choice made on it was silently lost.
 */
function ColourChoice({
  label,
  value,
  fallback,
  unsetLabel,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  fallback: string;
  unsetLabel: string;
  onChange: (v: string | null) => void;
}) {
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span>{label}</span>
      {value ? (
        <span className="flex items-center gap-1.5">
          <input
            type="color"
            aria-label={label}
            value={hex ?? fallback}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-9 cursor-pointer rounded border"
          />
          <button type="button" className="underline" onClick={() => onChange(null)}>
            {unsetLabel}
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-label={`הוספת ${label}`}
          className="inline-flex items-center gap-1 text-primary underline"
          onClick={() => onChange(fallback)}
        >
          <span className="inline-block size-3.5 rounded-sm border" style={{ background: fallback }} />
          הוספה
        </button>
      )}
    </div>
  );
}

function Segments<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ id: T; name: string }>;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`h-8 rounded-md border px-3 text-xs ${
            value === o.id ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50"
          }`}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

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
      if (target === "board") return writeBoardBackground(c, value);
      const id = frameOf(target);
      if (id) return { ...c, frameLooks: setFrameLook(c.frameLooks, id, { bg: value }) };
      return { ...c, frameStyle: { ...c.frameStyle, fill: value } };
    },
    [target],
  );
  const apply = (value: string | null) => {
    setPreview(null);
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

  const [uploading, setUploading] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await uploadImages(files);
      if (!urls.length) return;
      // Every uploaded picture is kept in the gallery - an upload used to
      // replace the one before it, which was then gone from every list.
      onEdit("bg-gallery:upload", (c) => {
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
      });
      setSource("picture");
      apply(urls[0]!);
      toast.success(urls.length > 1 ? `${urls.length} תמונות הועלו ונשמרו בגלריה` : "התמונה הועלתה ונשמרה בגלריה");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
    }
  };

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
      <SubPart bare={!inParts} title="גלריית רקעים" hint="לחיצה מלבישה. צבעים, מעברי צבע ותמונות - מוכנים ושלכם; ✕ מסתיר או מוחק.">
      <BackgroundGallery
        testIds={onBoard ? "" : "box-"}
        saved={saved}
        onEdit={onEdit}
        look={look}
        uploading={uploading}
        onUpload={(files) => void upload(files)}
        isOn={(b) => (onBoard ? wears(saved, b) : current === (b.picture ?? b.fill))}
        onPick={(b) => {
          setPreview(null);
          setSource(kindOf(b));
          if (onBoard) onEdit("layer-bg:board", (c) => applyBackground(c, b));
          else apply(b.picture ?? b.fill);
        }}
      />
      </SubPart>

      <SubPart bare={!inParts} title="רקע משלכם" hint="צבע, מעבר צבעים או תמונה - בונים כאן ושומרים בגלריה.">
      <InnerCard testId={onBoard ? "background-now" : "box-background-now"} label={onBoard ? "הרקע של הלוח עכשיו" : "הרקע עכשיו"}>
        <Segments label="סוג הרקע" value={source} onChange={(v) => setSource(v as Source)} options={sources} />

        {source === "colour" && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="color"
              aria-label="צבע הרקע"
              value={flatNow ?? "#0b1628"}
              onChange={(e) => apply(onBoard ? flat(e.target.value) : e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border"
            />
            <span className="text-muted-foreground">צבע אחיד. לחיצה פותחת בוחר צבעים.</span>
          </div>
        )}
        {source === "gradient" && (
          <GradientStudio
            key={target}
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
              <p className="text-xs text-muted-foreground">בחרו תמונה בגלריה למעלה, או העלו תמונה משלכם - היא נשמרת בגלריה.</p>
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
          <button type="button" className="text-xs underline" onClick={() => setTune(DEFAULT_BACKGROUND_TUNE)}>
            איפוס הכוונון
          </button>
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
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => apply(null)}>
          <RotateCcw className="size-3.5" />
          {onBoard ? "רקע הלוח לפי צבעי הבסיס" : frame ? `${frameLabel(frame, saved.customBoxes)}: רקע כמו כל התיבות` : "התיבות: הרקע הרגיל"}
        </Button>
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
function BackgroundTile({ b }: { b: Look }) {
  const t = tileOf(b);
  return (
    <span className="relative block aspect-video w-full overflow-hidden bg-[#0b1628]" style={{ backgroundImage: t.fill ?? undefined }}>
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
  onUpload: (files: FileList | null) => void;
  uploading: boolean;
}) {
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [from, setFrom] = useState<string | null>(null);
  const [name, setName] = useState("");
  const all = galleryOf(saved);
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

  const keep = () => {
    const clean = name.trim().slice(0, 40) || KIND_NAMES[kindOf(look)];
    const id = newBackgroundId();
    onEdit("bg-gallery:keep", (c) => ({ ...c, backgrounds: [{ id, name: clean, ...look }, ...c.backgrounds].slice(0, MAX_BACKGROUNDS) }));
    setFrom(id);
    setName("");
    toast.success(`"${clean}" נשמר בגלריה`);
  };

  return (
    <div className="space-y-2" data-testid={`${testIds}background-gallery`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {GALLERY_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`h-7 rounded-full border px-3 text-xs ${filter === f.id ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50"}`}
          >
            {f.name}
            {f.id === "mine" && saved.backgrounds.length ? ` (${saved.backgrounds.length})` : ""}
          </button>
        ))}
      </div>
      <div className="grid max-h-80 grid-cols-3 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-5">
        <label
          className={`flex aspect-video cursor-pointer flex-col items-center justify-center gap-0.5 self-start rounded-md border border-dashed text-[11px] hover:border-primary ${uploading ? "opacity-60" : ""}`}
          title="העלאת תמונה משלכם - נשמרת בגלריה"
        >
          <ImagePlus className="size-4" />
          {uploading ? "מעלה…" : "העלאת תמונה"}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading} onChange={(e) => onUpload(e.target.files)} />
        </label>
        {shown.map((b) => {
          const on = isOn(b);
          const own = b.id.startsWith("b_");
          return (
            <div key={b.id} className="group relative">
              <button
                type="button"
                aria-pressed={on}
                aria-label={b.name}
                title={b.name}
                onClick={() => {
                  onPick(b);
                  setFrom(own ? b.id : null);
                }}
                className={`block w-full overflow-hidden rounded-md border text-start transition hover:ring-2 hover:ring-primary ${on ? "ring-2 ring-primary ring-offset-1" : ""}`}
              >
                <BackgroundTile b={b} />
                <span className="block truncate bg-background/95 px-1.5 py-0.5 text-[11px]">{b.name}</span>
              </button>
              <TileRemove
                name={b.name}
                ready={!own}
                onClick={() => {
                  if (own) onEdit("bg-gallery:delete", (c) => ({ ...c, backgrounds: c.backgrounds.filter((x) => x.id !== b.id) }));
                  else onEdit("bg-gallery:hide", (c) => hideReady(c, "bg", b.id));
                  if (from === b.id) setFrom(null);
                }}
              />
            </div>
          );
        })}
      </div>
      <HiddenShelf
        testId={`${testIds}background-hidden`}
        items={hiddenBackgrounds(saved).map((b) => ({ key: b.id, name: b.name }))}
        onRestore={(id) => onEdit("bg-gallery:show", (c) => showReady(c, "bg", id))}
      />
      {(!kept || changed) && Boolean(look.fill || look.picture) && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2 text-xs" data-testid={`${testIds}background-keep`}>
          <span>הרקע שעל הלוח עכשיו {changed && mine ? `שונה מ"${mine.name}"` : "לא שמור בגלריה"}:</span>
          {changed && mine && (
            <Button
              type="button"
              size="sm"
              className="h-7"
              onClick={() => {
                onEdit("bg-gallery:update", (c) => ({ ...c, backgrounds: c.backgrounds.map((x) => (x.id === mine.id ? { ...x, ...look } : x)) }));
                toast.success(`"${mine.name}" עודכן`);
              }}
            >
              עדכון "{mine.name}"
            </Button>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={KIND_NAMES[kindOf(look)]}
            maxLength={40}
            aria-label="שם לרקע בגלריה"
            className="h-7 w-36 rounded-md border bg-background px-2"
          />
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={keep}>
            שמירה כרקע חדש
          </Button>
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
      {mode === "colour" && (
        <label className="flex items-center gap-2 text-xs">
          צבע השכבה
          <input type="color" aria-label="צבע השכבה" value={hex} onChange={(e) => set(e.target.value)} className="h-8 w-11 cursor-pointer rounded border" />
        </label>
      )}
      {mode === "gradient" && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1">
            מ־
            <input type="color" aria-label="צבע ראשון של השכבה" value={a} onChange={(e) => set(gradient(angle, e.target.value, b))} className="h-8 w-11 cursor-pointer rounded border" />
          </label>
          <label className="flex items-center gap-1">
            אל
            <input type="color" aria-label="צבע שני של השכבה" value={b} onChange={(e) => set(gradient(angle, a, e.target.value))} className="h-8 w-11 cursor-pointer rounded border" />
          </label>
          <label className="flex items-center gap-1">
            כיוון
            <input type="range" aria-label="כיוון השכבה" min={0} max={360} step={5} value={angle} onChange={(e) => set(gradient(Number(e.target.value), a, b))} className="w-24" />
          </label>
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
    <div className="space-y-2 rounded-md border p-2" data-testid="board-frame-controls">
      <div className="text-xs font-medium">מיקום וגודל</div>
      {knobs.sides && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="באיזה צד">
          <span>באיזה צד:</span>
          {(
            [
              ["both", "שני הצדדים"],
              ["right", "רק ימין"],
              ["left", "רק שמאל"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={t.sides === id}
              onClick={() => set("sides", { sides: id })}
              className={`h-7 rounded-md border px-2 ${t.sides === id ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <Range label={knobs.size} value={t.size} min={L.size[0]} max={L.size[1]} step={0.05} show={pct} onChange={(v) => set("size", { size: v })} />
      {knobs.length && (
        <Range label={knobs.length} value={t.length} min={L.length[0]} max={L.length[1]} step={0.02} show={pct} onChange={(v) => set("length", { length: v })} />
      )}
      {knobs.x && <Range label={knobs.x} value={t.x} min={L.x[0]} max={L.x[1]} step={0.5} show={u} onChange={(v) => set("x", { x: v })} />}
      {knobs.y && <Range label={knobs.y} value={t.y} min={L.y[0]} max={L.y[1]} step={0.5} show={u} onChange={(v) => set("y", { y: v })} />}
      <button type="button" className="text-xs underline" onClick={() => set("reset", { ...DEFAULT_BOARD_FRAME_TUNE })}>
        חזרה לגודל ולמקום הרגילים
      </button>
    </div>
  );
}


/**
 * Everything about the boxes, in one place: ready boxes, a shape, a
 * background (from the same gallery as the board's), a line and how far they
 * stand out, and a frame picture - for every box, or for one box apart.
 * A box's background used to be under "רקעים" and its line here: two places
 * for one box.
 */
export type BoxPart = "shape" | "background" | "frames";

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

  /** The frame picture on every box, or on this one; null takes it off. */
  const wearPicture = (ref: string | null) => {
    if (frame) return setOwn("image", { image: ref });
    const ready = FRAME_PICTURES.find((f) => framePictureRef(f.id) === ref);
    setFs(ready ? { image: ref, imageSlice: ready.slice, imageWidth: ready.width } : { image: ref });
  };
  const wearing = frame ? own?.image ?? null : fs.image;

  const [uploading, setUploading] = useState(false);
  const uploadFrame = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await uploadImages(files);
      if (!urls.length) return;
      // Kept in the gallery of frames, whether a box wears it or not.
      onEdit("frame-uploads", (c) => ({ ...c, frameUploads: [...new Set([...urls, ...c.frameUploads])].slice(0, 40) }));
      wearPicture(urls[0]!);
      toast.success("המסגרת הועלתה ונשמרה בגלריה");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
    }
  };

  const pictures = [
    ...FRAME_PICTURES.filter((f) => !isHiddenReady(saved, "frame", framePictureRef(f.id))).map((f) => ({
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
        {frame ? (
          // The same tiles, names and order as for every box (FRAME_CHOICES); "רגיל" is the plain round corner.
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" data-testid="box-shapes">
            {[
              { id: null as BoxShape | null, name: "כמו כולן", hint: "הצורה של כל התיבות", css: { borderStyle: "dashed", borderRadius: 6 } as CSSProperties },
              ...FRAME_CHOICES.map((c) => ({ id: (c.id === "auto" ? "round" : c.id) as BoxShape | null, name: c.name, hint: c.hint, css: c.css })),
            ].map((choice) => {
              const on = (own?.shape ?? null) === choice.id;
              return (
                <button
                  key={choice.id ?? "all"}
                  type="button"
                  aria-pressed={on}
                  title={choice.hint}
                  onClick={() => setOwn("shape", { shape: choice.id })}
                  className={`rounded-lg border p-1.5 text-center transition ${on ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"}`}
                >
                  <span className="mx-auto mb-1 block h-10 w-14 border-2 border-[#c9a227] bg-[#12243f]" style={choice.css} aria-hidden />
                  <span className="block text-[11px] font-medium leading-tight">{choice.name}</span>
                </button>
              );
            })}
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
        <BackgroundLayer key={target} {...props} fixedTarget={target} />
        {!frame && <Folded label="צבע הבסיס של התיבות (כשאין להן רקע משלהן)">{colourFields(THEME_VAR_LAYERS.frames)}</Folded>}
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
        <Part title="קו ובליטה של התיבות" testId="frame-style" hint={frame ? "הבליטה ועובי מסגרת התמונה - משותפים לכל התיבות (בחרו \"הכול\" למעלה)." : undefined}>
          {frame ? (
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
              <button
                type="button"
                className="text-xs underline"
                onClick={() => setFs({ line: DEFAULT_FRAME_STYLE.line, lineWidth: DEFAULT_FRAME_STYLE.lineWidth, depth: DEFAULT_FRAME_STYLE.depth })}
              >
                איפוס הקו והבליטה
              </button>
            </>
          )}
        </Part>
      )}

      {show("frames") && (
      <Part
        title="מסגרת לתיבות"
        testId="frame-pictures"
        hint="הפינות נשמרות והצלעות נמתחות לאורך התיבה. לחיצה מלבישה או מסירה; מסגרת שהעליתם נשמרת כאן, ו-✕ מוחק אותה מהגלריה. בתיבה בצורה חתוכה (משושה, מתומן, כיפה...) המסגרת לא מוצגת - הקו מסביב עוקב אחרי הצורה במקומה."
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <label
            className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-dashed text-[11px] hover:border-primary ${uploading ? "opacity-60" : ""}`}
          >
            <ImagePlus className="size-4" />
            {uploading ? "מעלה…" : "העלאת מסגרת"}
            <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => void uploadFrame(e.target.files)} />
          </label>
          {pictures.map((f) => {
            const on = wearing === f.ref;
            return (
              <div key={f.ref} className="group relative">
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={f.name}
                  onClick={() => wearPicture(on ? null : f.ref)}
                  className={`block w-full overflow-hidden rounded-md border text-center text-[11px] ${on ? "ring-2 ring-primary ring-offset-1" : "hover:border-primary/50"}`}
                >
                  <span className="block aspect-square w-full bg-[#16304f] p-1">
                    <img src={f.url} alt="" className="size-full object-contain" loading="lazy" />
                  </span>
                  <span className="block truncate py-0.5">{f.name}</span>
                </button>
                <TileRemove
                  name={f.name}
                  ready={!f.uploaded}
                  onClick={() =>
                    f.uploaded
                      ? onEdit("frame-uploads:delete", (c) => ({ ...c, frameUploads: c.frameUploads.filter((u) => u !== f.ref) }))
                      : onEdit("frame-pictures:hide", (c) => hideReady(c, "frame", f.ref))
                  }
                />
              </div>
            );
          })}
        </div>
        <HiddenShelf
          testId="frame-hidden"
          items={FRAME_PICTURES.filter((f) => isHiddenReady(saved, "frame", framePictureRef(f.id))).map((f) => ({
            key: framePictureRef(f.id),
            name: f.name,
          }))}
          onRestore={(ref) => onEdit("frame-pictures:show", (c) => showReady(c, "frame", ref))}
        />
        {!frame && fs.image && (
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
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
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
                className="h-8 flex-1 rounded-md border bg-background px-2 text-sm"
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
                className="h-8 flex-1 rounded-md border bg-background px-2 text-sm"
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
            <div className="space-y-1">
              <Range
                label="מרווח אותיות בכותרות"
                value={saved.tracking ?? 0}
                min={0}
                max={0.24}
                step={0.01}
                show={(v) => (saved.tracking === null ? "רגיל" : `${v.toFixed(2)}em`)}
                onChange={(v) => onEdit("track", (c) => ({ ...c, tracking: v }))}
              />
              {saved.tracking !== null && (
                <button type="button" className="text-xs underline" onClick={() => onEdit("track", (c) => ({ ...c, tracking: null }))}>
                  מרווח רגיל
                </button>
              )}
            </div>
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
