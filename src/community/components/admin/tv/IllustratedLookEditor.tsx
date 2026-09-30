import { DEFAULT_ILLUSTRATED_STYLE, type IllustratedStyle, type TvConfig } from "@/tv/config";
import { ILLUSTRATED_PRESETS } from "@/tv/illustratedPresets";
import { illustrationDef } from "@/tv/illustrated";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;
type Props = { config: TvConfig; onEdit: Edit };

/**
 * The editing options of a painted board, one piece per layer of the board,
 * so each sits in the editor where that layer is edited:
 *
 *   PaintedPresets    ready palettes for the whole painting   (עיצוב › ערכת נושא)
 *   PaintedWall       the picture and its stones               (עיצוב › רקע)
 *   PaintedFrameLook  the frames' shape, fill, line and depth  (עיצוב › מסגרות)
 *   PaintedText       type size, the three inks, the titles    (עיצוב › טקסט)
 *   PaintedRows       how many minyanim a frame holds          (פריסה)
 *
 * The painting is one picture, so the wall and the frames are layers laid
 * over it (illustratedAdjust.ts); the text is drawn above them and none of
 * the picture's adjustments reach it.
 */

function useSet(onEdit: Edit) {
  return (patch: Partial<IllustratedStyle>) =>
    onEdit("illustrated-style", (c) => ({ ...c, illustratedStyle: { ...c.illustratedStyle, ...patch } }));
}

type SliderKey =
  | "scale"
  | "rows"
  | "brightness"
  | "saturation"
  | "hue"
  | "stoneTintStrength"
  | "frameFillOpacity"
  | "frameDepth"
  | "frameLineWidth";

function Range({
  look,
  set,
  label,
  k,
  min,
  max,
  step,
  show,
  note,
}: {
  look: IllustratedStyle;
  set: (patch: Partial<IllustratedStyle>) => void;
  label: string;
  k: SliderKey;
  min: number;
  max: number;
  step: number;
  show: (v: number) => string;
  note?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{show(look[k])}</span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={look[k]}
        onChange={(e) => set({ [k]: Number(e.target.value) })}
        className="w-full"
      />
      {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
    </label>
  );
}

/** Nothing chosen yet: one tap applies a suggested colour (a colour box already showing it could never fire). */
function Colour({
  look,
  set,
  label,
  k,
  fallback,
}: {
  look: IllustratedStyle;
  set: (patch: Partial<IllustratedStyle>) => void;
  label: string;
  k: "stoneTint" | "frameFill" | "frameLine";
  fallback: string;
}) {
  return look[k] ? (
    <span className="flex items-center gap-1 text-xs">
      <input
        type="color"
        aria-label={label}
        value={look[k]!}
        onChange={(e) => set({ [k]: e.target.value })}
        className="h-7 w-9 cursor-pointer rounded border"
      />
      <button type="button" className="underline" onClick={() => set({ [k]: null })}>
        ללא
      </button>
    </span>
  ) : (
    <button
      type="button"
      aria-label={`הוספת ${label}`}
      className="inline-flex items-center gap-1 text-xs text-primary underline"
      onClick={() => set({ [k]: fallback })}
    >
      <span className="inline-block size-3.5 rounded-sm border" style={{ background: fallback }} />
      הוספה
    </button>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Ready palettes for the whole painting: picture, stones, frames and - on the dark ones - the inks. */
export function PaintedPresets({ onEdit }: Pick<Props, "onEdit">) {
  const set = useSet(onEdit);
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium">עיצובים מוכנים ללוח המצויר</div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" data-testid="illustrated-presets">
        {ILLUSTRATED_PRESETS.map((pr) => (
          <button
            key={pr.id}
            type="button"
            onClick={() => set(pr.style)}
            className="flex items-center gap-1.5 rounded-md border p-1.5 text-right text-[11px] hover:bg-muted"
            title={`עיצוב ${pr.name}`}
          >
            <span className="relative inline-block h-6 w-8 shrink-0 overflow-hidden rounded" style={{ background: pr.swatch[0] }}>
              <span className="absolute inset-x-1.5 bottom-0 top-1.5 rounded-t" style={{ background: pr.swatch[1] }} />
            </span>
            {pr.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="text-xs underline"
        onClick={() => onEdit("illustrated-style", (c) => ({ ...c, illustratedStyle: DEFAULT_ILLUSTRATED_STYLE }))}
      >
        איפוס הלוח המצויר לעיצוב המקורי
      </button>
    </div>
  );
}

/** The painting as a whole, and the stones outside its frames: the painted board's background. */
export function PaintedWall({ config, onEdit }: Props) {
  const look = config.illustratedStyle;
  const set = useSet(onEdit);
  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid="painted-wall">
      <div className="text-sm font-medium">הקיר של הלוח המצויר</div>
      <p className="text-[11px] leading-tight text-muted-foreground">
        הציור הוא תמונה אחת, והקיר מצויר בה. כאן משנים אותו: צבע כללי, וגוון לאבנים שמחוץ למסגרות.
      </p>
      <Range look={look} set={set} label="בהירות" k="brightness" min={0.6} max={1.4} step={0.05} show={pct} />
      <Range look={look} set={set} label="רוויית צבע" k="saturation" min={0} max={2} step={0.05} show={pct} />
      <Range look={look} set={set} label="גוון" k="hue" min={-180} max={180} step={5} show={(v) => `${v}°`} />
      <div className="flex items-center justify-between pt-1 text-xs">
        <span>צבע האבנים (מחוץ למסגרות)</span>
        <Colour look={look} set={set} label="צבע האבנים" k="stoneTint" fallback="#c08a4a" />
      </div>
      {look.stoneTint && (
        <Range look={look} set={set} label="עוצמת הצבע" k="stoneTintStrength" min={0.05} max={1} step={0.05} show={pct} />
      )}
      <button
        type="button"
        className="text-xs underline"
        onClick={() => set({ brightness: 1, saturation: 1, hue: 0, stoneTint: null })}
      >
        איפוס הקיר
      </button>
    </div>
  );
}

/** The painted frames: their shape, their own background, a line around them and how much they stand out. */
export function PaintedFrameLook({ config, onEdit }: Props) {
  const look = config.illustratedStyle;
  const set = useSet(onEdit);
  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid="painted-frames">
      <div className="text-sm font-medium">המסגרות של הלוח המצויר</div>
      <label className="flex items-center justify-between text-xs">
        <span>צורת המסגרות</span>
        <select
          aria-label="צורת המסגרות"
          value={look.frameShape}
          onChange={(e) => set({ frameShape: e.target.value as IllustratedStyle["frameShape"] })}
          className="h-7 rounded-md border bg-background px-1 text-xs"
        >
          <option value="rect">מלבן</option>
          <option value="arch">קשת (כמו לוחות)</option>
        </select>
      </label>
      <div className="flex items-center justify-between text-xs">
        <span>רקע המסגרת</span>
        <Colour look={look} set={set} label="רקע המסגרת" k="frameFill" fallback="#f5ecd7" />
      </div>
      {look.frameFill && (
        <Range look={look} set={set} label="אטימות הרקע" k="frameFillOpacity" min={0.05} max={1} step={0.05} show={pct} />
      )}
      <div className="flex items-center justify-between text-xs">
        <span>קו מסביב</span>
        <Colour look={look} set={set} label="צבע הקו" k="frameLine" fallback="#b8912f" />
      </div>
      {look.frameLine && (
        <Range look={look} set={set} label="עובי הקו" k="frameLineWidth" min={0.5} max={6} step={0.5} show={(v) => String(v)} />
      )}
      <Range
        look={look}
        set={set}
        label="כמה המסגרת בולטת"
        k="frameDepth"
        min={0}
        max={1}
        step={0.05}
        show={(v) => (v === 0 ? "כמו בציור" : pct(v))}
      />
      <button
        type="button"
        className="text-xs underline"
        onClick={() => set({ frameFill: null, frameLine: null, frameDepth: 0 })}
      >
        איפוס המסגרות
      </button>
    </div>
  );
}

/** The painted board's text: its size, its three inks, and the titles over its two frames. */
export function PaintedText({ config, onEdit }: Props) {
  const look = config.illustratedStyle;
  const def = illustrationDef(config.illustration, config.customIllustrations);
  const set = useSet(onEdit);
  const setText = (key: string, value: string) =>
    onEdit(`text:${key}`, (c) => {
      const texts = { ...c.texts };
      if (value.trim()) texts[key] = value;
      else delete texts[key];
      return { ...c, texts };
    });
  const inks: Array<{ key: "ink" | "accent" | "clockInk"; label: string; own: string }> = [
    { key: "ink", label: "טקסט", own: def.ink },
    { key: "accent", label: "כותרות ושעות", own: def.accent },
    { key: "clockInk", label: "שעון", own: def.clockInk },
  ];
  return (
    <div className="space-y-3" data-testid="painted-text">
      <Range look={look} set={set} label="גודל הטקסט" k="scale" min={0.8} max={1.3} step={0.05} show={pct} />
      <div className="grid grid-cols-3 gap-2">
        {inks.map((ink) => (
          <label key={ink.key} className="block text-xs">
            <span className="mb-1 block">{ink.label}</span>
            <span className="flex items-center gap-1">
              <input
                type="color"
                aria-label={`צבע ${ink.label}`}
                value={/^#[0-9a-f]{6}$/i.test(look[ink.key] ?? ink.own) ? (look[ink.key] ?? ink.own) : "#888888"}
                onChange={(e) => set({ [ink.key]: e.target.value })}
                className="h-7 w-9 cursor-pointer rounded border"
              />
              {look[ink.key] && (
                <button type="button" className="text-[11px] underline" onClick={() => set({ [ink.key]: null })}>
                  כמו בציור
                </button>
              )}
            </span>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { key: "dash.prayers", label: "כותרת התפילות", fallback: "תפילות היום" },
          { key: "dash.zmanim", label: "כותרת הזמנים", fallback: "זמני היום" },
        ].map((t) => (
          <label key={t.key} className="block text-xs">
            <span className="mb-1 block">{t.label}</span>
            <input
              type="text"
              maxLength={40}
              value={config.texts[t.key] ?? ""}
              placeholder={t.fallback}
              onChange={(e) => setText(t.key, e.target.value)}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/** How many minyanim a painted frame shows: a question of where things stand, so it is under "פריסה". */
export function PaintedRows({ config, onEdit }: Props) {
  const set = useSet(onEdit);
  return (
    <Range
      look={config.illustratedStyle}
      set={set}
      label="לוח מצויר: שורות בכל מסגרת"
      k="rows"
      min={4}
      max={10}
      step={1}
      show={(v) => String(v)}
      note="כשיש יותר מניינים, המסגרת מציגה את זה שעבר ואת הבאים. שורות רבות עם טקסט גדול עלולות לא להיכנס."
    />
  );
}
