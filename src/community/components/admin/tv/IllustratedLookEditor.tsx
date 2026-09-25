import { DEFAULT_ILLUSTRATED_STYLE, type IllustratedStyle, type TvConfig } from "@/tv/config";
import { illustrationDef } from "@/tv/illustrated";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/**
 * The editing options of the painted board ("תבנית מאוירת"): type size,
 * how many minyanim a frame shows, the three inks, and the frame titles.
 * Everything else on the board - times, date, names - comes from the data.
 */
export function IllustratedLookEditor({ config, onEdit }: { config: TvConfig; onEdit: Edit }) {
  const look = config.illustratedStyle;
  const def = illustrationDef(config.illustration, config.customIllustrations);
  const set = (patch: Partial<TvConfig["illustratedStyle"]>) =>
    onEdit("illustrated-style", (c) => ({ ...c, illustratedStyle: { ...c.illustratedStyle, ...patch } }));
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
    <div className="mt-4 space-y-3 rounded-lg border p-3">
      <div className="text-sm font-medium">עריכת הלוח המצויר</div>

      <label className="block text-xs">
        <span className="flex justify-between">
          <span>גודל הטקסט</span>
          <span className="tabular-nums text-muted-foreground">{Math.round(look.scale * 100)}%</span>
        </span>
        <input
          type="range"
          min={0.8}
          max={1.3}
          step={0.05}
          value={look.scale}
          onChange={(e) => set({ scale: Number(e.target.value) })}
          className="w-full"
        />
      </label>

      <label className="block text-xs">
        <span className="flex justify-between">
          <span>שורות בכל מסגרת</span>
          <span className="tabular-nums text-muted-foreground">{look.rows}</span>
        </span>
        <input
          type="range"
          min={4}
          max={10}
          step={1}
          value={look.rows}
          onChange={(e) => set({ rows: Number(e.target.value) })}
          className="w-full"
        />
        <span className="text-[11px] text-muted-foreground">
          כשיש יותר מניינים, המסגרת מציגה את זה שעבר ואת הבאים. שורות רבות עם טקסט גדול עלולות לא להיכנס.
        </span>
      </label>

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

      <PictureAdjustments look={look} set={set} />

      <button
        type="button"
        className="text-xs underline"
        onClick={() =>
          onEdit("illustrated-style", (c) => ({
            ...c,
            illustratedStyle: DEFAULT_ILLUSTRATED_STYLE,
          }))
        }
      >
        איפוס לעיצוב המקורי
      </button>
    </div>
  );
}

/**
 * "התאמות תמונה": the picture is one image, so these are layers over it -
 * its brightness and colour, a colour over the stones, and the frames' own
 * background, line and depth (illustratedAdjust.ts). All neutral by default.
 */
function PictureAdjustments({
  look,
  set,
}: {
  look: IllustratedStyle;
  set: (patch: Partial<IllustratedStyle>) => void;
}) {
  const slider = (
    label: string,
    key: "brightness" | "saturation" | "hue" | "stoneTintStrength" | "frameFillOpacity" | "frameDepth" | "frameLineWidth",
    min: number,
    max: number,
    step: number,
    show: (v: number) => string,
  ) => (
    <label className="block text-xs">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{show(look[key])}</span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={look[key]}
        onChange={(e) => set({ [key]: Number(e.target.value) })}
        className="w-full"
      />
    </label>
  );
  // Nothing chosen yet: one tap applies a suggested colour (a colour box
  // already showing it could never fire a change for that same colour).
  const colour = (label: string, key: "stoneTint" | "frameFill" | "frameLine", fallback: string) =>
    look[key] ? (
      <span className="flex items-center gap-1 text-xs">
        <input
          type="color"
          aria-label={label}
          value={look[key]!}
          onChange={(e) => set({ [key]: e.target.value })}
          className="h-7 w-9 cursor-pointer rounded border"
        />
        <button type="button" className="underline" onClick={() => set({ [key]: null })}>
          ללא
        </button>
      </span>
    ) : (
      <button
        type="button"
        aria-label={`הוספת ${label}`}
        className="inline-flex items-center gap-1 text-xs text-primary underline"
        onClick={() => set({ [key]: fallback })}
      >
        <span className="inline-block size-3.5 rounded-sm border" style={{ background: fallback }} />
        הוספה
      </button>
    );
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <details className="rounded-md border p-2" open>
      <summary className="cursor-pointer text-sm font-medium">התאמות תמונה</summary>
      <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
        הציור הוא תמונה אחת, אז השינויים הם שכבות מעליו: צבע כללי, גוון לאבנים (מחוץ למסגרות), ורקע, קו ובליטה
        למסגרות. הטקסט לא מושפע.
      </p>

      <div className="mt-2 space-y-2">
        <div className="text-xs font-medium">התמונה כולה</div>
        {slider("בהירות", "brightness", 0.6, 1.4, 0.05, pct)}
        {slider("רוויית צבע", "saturation", 0, 2, 0.05, pct)}
        {slider("גוון", "hue", -180, 180, 5, (v) => `${v}°`)}

        <div className="pt-1 text-xs font-medium">צבע האבנים (הרקע שמחוץ למסגרות)</div>
        {colour("צבע האבנים", "stoneTint", "#c08a4a")}
        {look.stoneTint && slider("עוצמת הצבע", "stoneTintStrength", 0.05, 1, 0.05, pct)}

        <div className="pt-1 text-xs font-medium">המסגרות</div>
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
          {colour("רקע המסגרת", "frameFill", "#f5ecd7")}
        </div>
        {look.frameFill && slider("אטימות הרקע", "frameFillOpacity", 0.05, 1, 0.05, pct)}
        <div className="flex items-center justify-between text-xs">
          <span>קו מסביב</span>
          {colour("צבע הקו", "frameLine", "#b8912f")}
        </div>
        {look.frameLine && slider("עובי הקו", "frameLineWidth", 0.5, 6, 0.5, (v) => String(v))}
        {slider("כמה המסגרת בולטת", "frameDepth", 0, 1, 0.05, (v) => (v === 0 ? "כמו בציור" : pct(v)))}
      </div>

      <button
        type="button"
        className="mt-2 text-xs underline"
        onClick={() =>
          set({
            brightness: 1,
            saturation: 1,
            hue: 0,
            stoneTint: null,
            frameFill: null,
            frameLine: null,
            frameDepth: 0,
          })
        }
      >
        איפוס התאמות התמונה
      </button>
    </details>
  );
}
