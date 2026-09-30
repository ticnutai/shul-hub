import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ElementStyle, TvConfig } from "@/tv/config";
import { FAMILY_PREFIX, setElementStyle } from "@/tv/boardEdit";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/**
 * "עיצוב טקסט לפי אזור": the board's text, one area at a time - the name,
 * the clock, every minyan row at once - with sliders for size, weight and
 * how strong it is, and its own colour.
 *
 * It writes the same per-element styling as clicking a line on the preview
 * (config.styles, boardEdit.ts), so the two are one setting reached from two
 * places: what is set here shows in the inspector, and the other way round.
 * The "all rows" areas are the style families, so one rule holds for every
 * row, today's and tomorrow's.
 */
const AREAS: Array<{ key: string; label: string }> = [
  { key: "header.title", label: "שם בית הכנסת" },
  { key: "header.clock", label: "השעון" },
  { key: "header.date", label: "התאריך" },
  { key: "header.weekday", label: "היום בשבוע" },
  { key: "panel.minyanim", label: "כותרת המניינים" },
  { key: "panel.zmanim", label: "כותרת זמני היום" },
  { key: `${FAMILY_PREFIX}minyan`, label: "כל שורות המניינים" },
  { key: `${FAMILY_PREFIX}minyan:label`, label: "כל שמות המניינים" },
  { key: `${FAMILY_PREFIX}zman`, label: "כל שורות זמני היום" },
  { key: `${FAMILY_PREFIX}ann:title`, label: "כותרות המודעות" },
  { key: `${FAMILY_PREFIX}ann:body`, label: "גוף המודעות" },
  { key: `${FAMILY_PREFIX}shiur`, label: "שורות השיעורים" },
  { key: "ticker", label: "הסרגל הרץ" },
];

const WEIGHTS: Array<{ value: number; label: string }> = [
  { value: 0, label: "כמו בעיצוב" },
  { value: 400, label: "רגיל" },
  { value: 600, label: "בינוני" },
  { value: 700, label: "מודגש" },
  { value: 900, label: "שחור" },
];

export function TextAreaStyles({ config, onEdit, painted }: { config: TvConfig; onEdit: Edit; painted: boolean }) {
  const [key, setKey] = useState(AREAS[0].key);
  const style: ElementStyle = config.styles[key] ?? {};
  const set = (patch: Partial<ElementStyle>, group: string) =>
    onEdit(`style:${group}:${key}`, (c) => setElementStyle(c, key, patch));
  const scale = style.scale ?? 1;
  const opacity = style.opacity ?? 1;
  const color = style.color && /^#[0-9a-f]{6}$/i.test(style.color) ? style.color : "#ffffff";

  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid="text-areas">
      <div className="text-sm font-medium">עיצוב טקסט לפי אזור</div>
      <p className="text-[11px] leading-tight text-muted-foreground">
        {painted
          ? "חל על הלוחות הרגילים. בלוח המצויר הטקסט נכתב בצבעי הציור - הם למעלה, ובכל מסגרת בנפרד תחת \"מסגרות\"."
          : "אותו עיצוב כמו לחיצה על שורה בתצוגה. מה שנקבע כאן מופיע גם שם."}
      </p>
      <label className="flex items-center gap-2 text-xs">
        <span className="shrink-0">אזור</span>
        <select
          aria-label="אזור טקסט"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="h-8 flex-1 rounded-md border bg-background px-2 text-sm"
        >
          {AREAS.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
              {config.styles[a.key] ? " •" : ""}
            </option>
          ))}
        </select>
      </label>

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
