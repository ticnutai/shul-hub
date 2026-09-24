import type { TvConfig } from "@/tv/config";
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

      <button
        type="button"
        className="text-xs underline"
        onClick={() =>
          onEdit("illustrated-style", (c) => ({
            ...c,
            illustratedStyle: { scale: 1, rows: 7, ink: null, accent: null, clockInk: null },
          }))
        }
      >
        איפוס לעיצוב המקורי
      </button>
    </div>
  );
}
