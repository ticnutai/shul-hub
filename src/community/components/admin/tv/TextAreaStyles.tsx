import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ElementStyle, TvConfig } from "@/tv/config";
import { setElementStyle } from "@/tv/boardEdit";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/**
 * The board's text one area at a time - the name, the clock, every minyan
 * row at once - with sliders for size, weight and strength, and a colour.
 *
 * It writes the same per-element styling as clicking a line on the preview
 * (config.styles, boardEdit.ts), so the two are one setting reached from two
 * places. Which areas there are: textAreas.ts.
 */

const WEIGHTS: Array<{ value: number; label: string }> = [
  { value: 0, label: "כמו בעיצוב" },
  { value: 400, label: "רגיל" },
  { value: 600, label: "בינוני" },
  { value: 700, label: "מודגש" },
  { value: 900, label: "שחור" },
];

export function TextAreaControls({ config, onEdit, areaKey }: { config: TvConfig; onEdit: Edit; areaKey: string }) {
  const key = areaKey;
  const style: ElementStyle = config.styles[key] ?? {};
  const set = (patch: Partial<ElementStyle>, group: string) =>
    onEdit(`style:${group}:${key}`, (c) => setElementStyle(c, key, patch));
  const scale = style.scale ?? 1;
  const opacity = style.opacity ?? 1;
  const color = style.color && /^#[0-9a-f]{6}$/i.test(style.color) ? style.color : "#f0c35c";

  return (
    <div className="space-y-2" data-testid="text-areas">
      <label className="block text-xs">
        <span className="flex justify-between">
          <span>גודל</span>
          <span className="tabular-nums text-muted-foreground">{Math.round(scale * 100)}%</span>
        </span>
        <input
          type="range"
          aria-label="גודל הטקסט באזור"
          min={0.5}
          max={2}
          step={0.05}
          value={scale}
          onChange={(e) => set({ scale: Number(e.target.value) }, "scale")}
          className="w-full"
        />
      </label>

      <label className="block text-xs">
        <span className="flex justify-between">
          <span>עוצמה</span>
          <span className="tabular-nums text-muted-foreground">{Math.round(opacity * 100)}%</span>
        </span>
        <input
          type="range"
          aria-label="עוצמת הטקסט באזור"
          min={0.15}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => set({ opacity: Number(e.target.value) }, "opacity")}
          className="w-full"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span>עובי</span>
        {WEIGHTS.map((w) => (
          <button
            key={w.value}
            type="button"
            aria-pressed={(style.weight ?? 0) === w.value}
            onClick={() => set({ weight: w.value || undefined }, "weight")}
            className={`h-7 rounded-md border px-2 ${
              (style.weight ?? 0) === w.value ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50"
            }`}
            style={{ fontWeight: w.value || undefined }}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span>צבע</span>
        {/* Nothing set: a tap applies a colour first (a box already showing one cannot report it picked). */}
        {style.color ? (
          <span className="flex items-center gap-1.5">
            <input
              type="color"
              aria-label="צבע הטקסט באזור"
              value={color}
              onChange={(e) => set({ color: e.target.value }, "color")}
              className="h-7 w-9 cursor-pointer rounded border"
            />
            <button type="button" className="underline" onClick={() => set({ color: undefined }, "color")}>
              כמו בעיצוב
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label="הוספת צבע לטקסט באזור"
            className="inline-flex items-center gap-1 text-primary underline"
            onClick={() => set({ color: "#f0c35c" }, "color")}
          >
            <span className="inline-block size-3.5 rounded-sm border" style={{ background: "#f0c35c" }} />
            הוספה
          </button>
        )}
      </div>

      {config.styles[key] && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onEdit(`style:reset:${key}`, (c) => setElementStyle(c, key, null))}
        >
          <RotateCcw className="size-3.5" /> איפוס האזור
        </Button>
      )}
    </div>
  );
}
