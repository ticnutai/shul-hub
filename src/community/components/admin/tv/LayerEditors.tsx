import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TvConfig } from "@/tv/config";
import { FRAME_IDS, FRAME_LABELS, setFrameLook, type FrameId } from "@/tv/frameLooks";
import { DEFAULT_BACKGROUND_TUNE, DEFAULT_FRAME_STYLE, type BackgroundTune, type FrameStyle } from "@/tv/layers";
import { isPictureFill } from "@/tv/layerCss";
import { backdropUrl } from "@/tv/backdrops";
import { FRAME_PICTURES, framePictureRef, framePictureUrl } from "@/tv/framePictures";
import { THEME_VAR_LAYERS, TV_FONTS, isSafeGradient, type ThemeVar } from "@/tv/themes";
import { BackdropPicker } from "./BackdropPicker";
import { FrameCorners, PaintedBoardsPicker, StylePicker } from "./BoardLook";
import { leavingPainted } from "./leavingPainted";
import { GradientStudio } from "./GradientStudio";
import { PaintedFrameLook, PaintedText, PaintedWall } from "./IllustratedLookEditor";
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

type Option = { value: string; label: string };

function TargetPicker({
  label,
  value,
  onChange,
  top,
  groups,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  top: Option[];
  groups: Array<{ label: string; options: Option[] }>;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md bg-muted/60 p-2 text-sm">
      <span className="shrink-0 font-medium">למה:</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 flex-1 rounded-md border bg-background px-2 text-sm"
      >
        {top.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

const frameOptions = (config: TvConfig): Option[] =>
  FRAME_IDS.map((id) => ({ value: `frame:${id}`, label: `${FRAME_LABELS[id]}${config.frameLooks[id] ? " •" : ""}` }));

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

type Source = "colour" | "gradient" | "picture" | "painted";

export function BackgroundLayer({ config, saved, onEdit, setPreview, colourFields }: LayerProps) {
  const [target, setTarget] = useState("board");
  const frame = frameOf(target);
  const onBoard = target === "board";
  const painted = config.screenLayout === "illustrated";

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
  const [source, setSource] = useState<Source>(() => (painted ? "painted" : kind(current)));
  useEffect(() => {
    // A new target starts on the kind of background it has.
    setSource(onBoard && painted ? "painted" : kind(currentOf(saved)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  /** Writes a background into the target. null = back to what the theme / style draws. */
  const write = useCallback(
    (c: TvConfig, value: string | null): TvConfig => {
      if (target === "board") {
        if (value === null) return { ...c, backgroundGradient: null, backgroundImage: null };
        // A background of its own replaces the painting (which is its own wall).
        if (isPictureFill(value)) return { ...c, ...leavingPainted(c), backgroundImage: value };
        return { ...c, ...leavingPainted(c), backgroundGradient: value, backgroundImage: null };
      }
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
      const [url] = await uploadImages(files);
      if (url) apply(url);
      toast.success("התמונה הועלתה");
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
    { id: "gradient", name: "גרדיאנט" },
    { id: "picture", name: "תמונה" },
    ...(onBoard ? [{ id: "painted" as const, name: "ציור" }] : []),
  ];

  return (
    <div className="space-y-3" data-testid="layer-background">
      <TargetPicker
        label="רקע של"
        value={target}
        onChange={(v) => {
          setPreview(null);
          setTarget(v);
        }}
        top={[
          { value: "board", label: "כל הלוח" },
          { value: "frames", label: "כל המסגרות" },
        ]}
        groups={[{ label: "מסגרת אחת", options: frameOptions(config) }]}
      />

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
          config={config}
          onEdit={onEdit}
          applyLabel={onBoard ? "החלה על רקע הלוח" : frame ? `החלה על ${FRAME_LABELS[frame]}` : "החלה על כל המסגרות"}
          current={current && isSafeGradient(current) ? current : null}
          onPreview={preview}
          onApply={apply}
        />
      )}
      {source === "picture" && (
        <div className="space-y-2">
          <BackdropPicker key={target} config={config} current={current} onPreview={preview} onApply={apply} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
              <label className="cursor-pointer">
                <ImagePlus className="size-4" /> הוספת תמונה משלכם
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files)} />
              </label>
            </Button>
            {picture && shown && <img src={shown} alt="" className="h-10 w-16 rounded object-cover" />}
          </div>
        </div>
      )}
      {source === "painted" && onBoard && <PaintedBoardsPicker config={saved} onEdit={onEdit} />}

      {/* The sliders of this target's background. */}
      {onBoard && painted ? (
        <PaintedWall config={saved} onEdit={onEdit} />
      ) : onBoard ? (
        <div className="space-y-2 rounded-lg border p-3" data-testid="background-tune">
          <Range label="בהירות" value={tune.brightness} min={0.6} max={1.4} step={0.05} show={pct} onChange={(v) => setTune({ brightness: v })} />
          <Range label="רוויית צבע" value={tune.saturation} min={0} max={2} step={0.05} show={pct} onChange={(v) => setTune({ saturation: v })} />
          <Range label="גוון" value={tune.hue} min={-180} max={180} step={5} show={(v) => `${v}°`} onChange={(v) => setTune({ hue: v })} />
          <Range label="טשטוש" value={tune.blur} min={0} max={10} step={0.5} show={(v) => (v ? String(v) : "ללא")} onChange={(v) => setTune({ blur: v })} />
          {saved.backgroundImage && (
            <Range
              label="החשכת התמונה"
              value={saved.backgroundDim}
              min={0}
              max={0.95}
              step={0.05}
              show={pct}
              onChange={(v) => onEdit("dim", (c) => ({ ...c, backgroundDim: v }))}
            />
          )}
          <ColourChoice label="צבע מעל הרקע" value={tune.tint} fallback="#c08a4a" unsetLabel="ללא" onChange={(v) => setTune({ tint: v })} />
          {tune.tint && (
            <Range label="עוצמת הצבע" value={tune.tintStrength} min={0.05} max={1} step={0.05} show={pct} onChange={(v) => setTune({ tintStrength: v })} />
          )}
          <button type="button" className="text-xs underline" onClick={() => setTune(DEFAULT_BACKGROUND_TUNE)}>
            איפוס הסליידרים
          </button>
        </div>
      ) : current && !picture ? (
        <Range
          label="אטימות"
          value={frame ? saved.frameLooks[frame]?.bgOpacity ?? 1 : saved.frameStyle.fillOpacity}
          min={0.05}
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
          {onBoard ? "רקע הלוח לפי ערכת הנושא" : frame ? `${FRAME_LABELS[frame]}: רקע כמו כל המסגרות` : "המסגרות: רקע לפי הסגנון"}
        </Button>
      )}

      {onBoard && (
        <details className="rounded-md border p-2">
          <summary className="cursor-pointer text-xs font-medium">צבעי הרקע של ערכת הנושא</summary>
          <div className="mt-2">{colourFields(THEME_VAR_LAYERS.background)}</div>
        </details>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- מסגרות -- */

export function FramesLayer({ config, saved, onEdit, colourFields }: LayerProps) {
  const [target, setTarget] = useState("frames");
  const frame = frameOf(target);
  const painted = config.screenLayout === "illustrated";
  const fs = saved.frameStyle;
  const setFs = (patch: Partial<FrameStyle>) =>
    onEdit("layer-frames", (c) => ({ ...c, frameStyle: { ...c.frameStyle, ...patch } }));
  const [uploading, setUploading] = useState(false);
  const uploadFrame = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const [url] = await uploadImages(files);
      if (url) setFs({ image: url });
      toast.success("צורת המסגרת נוספה");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="layer-frames">
      <TargetPicker
        label="מסגרות של"
        value={target}
        onChange={setTarget}
        top={[{ value: "frames", label: "כל המסגרות" }]}
        groups={[{ label: "מסגרת אחת", options: frameOptions(config) }]}
      />

      {frame ? (
        <div className="space-y-2 rounded-lg border p-3">
          <ColourChoice
            label="קו מסביב"
            value={saved.frameLooks[frame]?.line}
            fallback="#c9a227"
            unsetLabel="כמו כל המסגרות"
            onChange={(v) => onEdit(`layer-frames:${frame}:line`, (c) => ({ ...c, frameLooks: setFrameLook(c.frameLooks, frame, { line: v }) }))}
          />
          {saved.frameLooks[frame]?.line && (
            <Range
              label="עובי הקו"
              value={saved.frameLooks[frame]?.lineWidth ?? 2}
              min={0.5}
              max={6}
              step={0.5}
              show={(v) => String(v)}
              onChange={(v) => onEdit(`layer-frames:${frame}:w`, (c) => ({ ...c, frameLooks: setFrameLook(c.frameLooks, frame, { lineWidth: v }) }))}
            />
          )}
          <p className="text-[11px] text-muted-foreground">
            הסגנון והצורה משותפים לכל המסגרות. הרקע של המסגרת הזו נבחר ב"רקעים", והטקסט שלה ב"טקסט".
          </p>
        </div>
      ) : (
        <>
          <StylePicker config={config} onEdit={onEdit} />
          <FrameCorners config={config} onEdit={onEdit} />
          {painted ? (
            <PaintedFrameLook config={saved} onEdit={onEdit} />
          ) : (
            <div className="space-y-2 rounded-lg border p-3" data-testid="frame-style">
              <ColourChoice label="קו מסביב" value={fs.line} fallback="#c9a227" unsetLabel="לפי הסגנון" onChange={(v) => setFs({ line: v })} />
              {fs.line && (
                <Range label="עובי הקו" value={fs.lineWidth} min={0.5} max={6} step={0.5} show={(v) => String(v)} onChange={(v) => setFs({ lineWidth: v })} />
              )}
              <Range
                label="כמה המסגרות בולטות"
                value={fs.depth}
                min={0}
                max={1}
                step={0.05}
                show={(v) => (v === 0 ? "לפי הסגנון" : pct(v))}
                onChange={(v) => setFs({ depth: v })}
              />
              <div className="space-y-2 border-t pt-2" data-testid="frame-pictures">
                <div className="text-xs font-medium">מסגרת מתמונה</div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  הפינות נשמרות, הצלעות נמתחות לאורך כל מסגרת. מוכנות (מהלוחות המצוירים), או תמונה משלכם.
                </p>
                <div className="flex flex-wrap gap-2">
                  {FRAME_PICTURES.map((f) => {
                    const on = fs.image === framePictureRef(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setFs(on ? { image: null } : { image: framePictureRef(f.id), imageSlice: f.slice, imageWidth: f.width })
                        }
                        className={`w-24 overflow-hidden rounded-md border text-center text-[11px] ${
                          on ? "ring-2 ring-primary ring-offset-1" : "hover:border-primary/50"
                        }`}
                      >
                        <img src={f.url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                        <span className="block py-0.5">{f.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                    <label className="cursor-pointer">
                      <ImagePlus className="size-4" /> הוספת צורה משלכם
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => void uploadFrame(e.target.files)} />
                    </label>
                  </Button>
                  {fs.image && (
                    <>
                      <img src={framePictureUrl(fs.image) ?? ""} alt="" className="h-10 w-16 rounded object-contain" />
                      <Button type="button" variant="ghost" size="sm" onClick={() => setFs({ image: null })}>
                        <Trash2 className="size-4" /> הסרה
                      </Button>
                    </>
                  )}
                </div>
                {fs.image && (
                  <>
                    <Range label="עובי המסגרת" value={fs.imageWidth} min={0.5} max={6} step={0.25} show={(v) => String(v)} onChange={(v) => setFs({ imageWidth: v })} />
                    <Range label="כמה מהתמונה היא המסגרת" value={fs.imageSlice} min={10} max={45} step={1} show={(v) => `${v}%`} onChange={(v) => setFs({ imageSlice: v })} />
                  </>
                )}
              </div>
              <button type="button" className="text-xs underline" onClick={() => setFs({ ...DEFAULT_FRAME_STYLE, fill: fs.fill, fillOpacity: fs.fillOpacity })}>
                איפוס הקו, הבליטה והצורה
              </button>
            </div>
          )}
          <details className="rounded-md border p-2">
            <summary className="cursor-pointer text-xs font-medium">צבעי המסגרות של ערכת הנושא</summary>
            <div className="mt-2">{colourFields(THEME_VAR_LAYERS.frames)}</div>
          </details>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- טקסט -- */

export function TextLayer({ config, saved, onEdit, colourFields }: LayerProps) {
  const [target, setTarget] = useState("board");
  const frame = frameOf(target);
  const area = target.startsWith("area:") ? target.slice(5) : null;
  const painted = config.screenLayout === "illustrated";

  return (
    <div className="space-y-3" data-testid="layer-text">
      <TargetPicker
        label="טקסט של"
        value={target}
        onChange={setTarget}
        top={[{ value: "board", label: "כל הלוח" }]}
        groups={[
          { label: "בתוך מסגרת", options: frameOptions(config) },
          {
            label: "אזור על הלוח",
            options: TEXT_AREAS.map((a) => ({ value: `area:${a.key}`, label: `${a.label}${config.styles[a.key] ? " •" : ""}` })),
          },
        ]}
      />

      {area ? (
        <>
          <TextAreaControls config={config} onEdit={onEdit} areaKey={area} />
          {painted && (
            <p className="text-[11px] text-muted-foreground">
              בלוח המצויר הטקסט נכתב בצבעי הציור (תחת "כל הלוח"). אזורים חלים על הלוחות הרגילים.
            </p>
          )}
        </>
      ) : frame ? (
        <div className="space-y-2 rounded-lg border p-3">
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
        </div>
      ) : (
        <>
          {painted && <PaintedText config={saved} onEdit={onEdit} />}
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
          {!painted && (
            <Range
              label="גודל הטקסט"
              value={saved.textScale}
              min={0.8}
              max={1.3}
              step={0.05}
              show={pct}
              onChange={(v) => onEdit("scale", (c) => ({ ...c, textScale: v }))}
            />
          )}
          <div className="space-y-1">
            <Range
              label="מרווח אותיות בכותרות"
              value={saved.tracking ?? 0}
              min={0}
              max={0.24}
              step={0.01}
              show={(v) => (saved.tracking === null ? "לפי הסגנון" : `${v.toFixed(2)}em`)}
              onChange={(v) => onEdit("track", (c) => ({ ...c, tracking: v }))}
            />
            {saved.tracking !== null && (
              <button type="button" className="text-xs underline" onClick={() => onEdit("track", (c) => ({ ...c, tracking: null }))}>
                מרווח לפי הסגנון
              </button>
            )}
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            {painted ? "צבעי הטקסט בלוחות הרגילים" : "צבעי הטקסט"}
          </div>
          {colourFields(THEME_VAR_LAYERS.text)}
        </>
      )}
    </div>
  );
}
