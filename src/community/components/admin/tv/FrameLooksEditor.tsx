import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TvConfig } from "@/tv/config";
import { FRAME_IDS, FRAME_LABELS, setFrameLook, type FrameId, type FrameLook } from "@/tv/frameLooks";
import { allGradients } from "@/tv/themes";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/**
 * "מסגרת אחת בעיצוב משלה": pick a frame - the prayers, the zmanim, the
 * clock... - and give it its own background, text, titles and line, while
 * every other frame keeps the board's style. See frameLooks.ts.
 */
export function FrameLooksEditor({ config, onEdit }: { config: TvConfig; onEdit: Edit }) {
  const [id, setId] = useState<FrameId>("prayers");
  const look: FrameLook = config.frameLooks[id] ?? {};
  const set = (patch: Partial<Record<keyof FrameLook, string | null>>, group = "look") =>
    onEdit(`frame-look:${id}:${group}`, (c) => ({ ...c, frameLooks: setFrameLook(c.frameLooks, id, patch) }));
  const gradients = allGradients(config.gradients);
  const isHex = (v: string | undefined): v is string => Boolean(v && /^#[0-9a-f]{6}$/i.test(v));

  /*
   * Nothing set yet: one tap applies a suggested colour, then the colour box
   * appears. A colour box already showing a colour cannot report that same
   * colour being picked - so the first choice, made on a box showing the
   * suggestion, was silently lost.
   */
  const colour = (label: string, k: "text" | "accent" | "line", fallback: string) => (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span>{label}</span>
      {look[k] ? (
        <span className="flex items-center gap-1.5">
          <input
            type="color"
            aria-label={`${FRAME_LABELS[id]}: ${label}`}
            value={isHex(look[k]) ? look[k] : fallback}
            onChange={(e) => set({ [k]: e.target.value }, k)}
            className="h-7 w-9 cursor-pointer rounded border"
          />
          <button type="button" className="underline" onClick={() => set({ [k]: null }, k)}>
            כמו כל הלוח
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-label={`${FRAME_LABELS[id]}: הוספת ${label}`}
          className="inline-flex items-center gap-1 text-primary underline"
          onClick={() => set({ [k]: fallback }, k)}
        >
          <span className="inline-block size-3.5 rounded-sm border" style={{ background: fallback }} />
          הוספה
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid="frame-looks">
      <div className="text-sm font-medium">מסגרת אחת בעיצוב משלה</div>
      <p className="text-[11px] leading-tight text-muted-foreground">
        בוחרים מסגרת ונותנים לה רקע, טקסט וקו משלה. שאר המסגרות נשארות כמו הלוח. הבחירה עוברת
        איתה בין הפריסות, גם ללוח המצויר.
      </p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="איזו מסגרת">
        {FRAME_IDS.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={id === f}
            onClick={() => setId(f)}
            className={`h-7 rounded-md border px-2 text-xs transition ${
              id === f ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50"
            }`}
          >
            {FRAME_LABELS[f]}
            {config.frameLooks[f] ? " •" : ""}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-medium">רקע המסגרת</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-pressed={!look.bg}
            aria-label={`${FRAME_LABELS[id]}: רקע כמו כל הלוח`}
            onClick={() => set({ bg: null }, "bg")}
            className={`h-8 rounded-md border px-2 text-[11px] ${!look.bg ? "ring-2 ring-primary ring-offset-1" : "hover:border-primary/50"}`}
          >
            כמו כל הלוח
          </button>
          {isHex(look.bg) ? (
            <label className="flex h-8 cursor-pointer items-center gap-1 rounded-md border px-2 text-[11px] ring-2 ring-primary ring-offset-1">
              צבע
              <input
                type="color"
                aria-label={`${FRAME_LABELS[id]}: צבע רקע`}
                value={look.bg}
                onChange={(e) => set({ bg: e.target.value }, "bg")}
                className="size-5 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>
          ) : (
            <button
              type="button"
              aria-label={`${FRAME_LABELS[id]}: רקע בצבע אחיד`}
              onClick={() => set({ bg: "#5a1a2a" }, "bg")}
              className="flex h-8 items-center gap-1 rounded-md border px-2 text-[11px] hover:border-primary/50"
            >
              <span className="inline-block size-3.5 rounded-sm border" style={{ background: "#5a1a2a" }} />
              צבע
            </button>
          )}
          {gradients.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={look.bg === g.value}
              // Named for the frame: the board's own background offers the same gradients.
              aria-label={`${FRAME_LABELS[id]}: רקע ${g.name}`}
              title={g.name}
              onClick={() => set({ bg: g.value }, "bg")}
              className={`h-8 w-12 rounded-md border ${look.bg === g.value ? "ring-2 ring-primary ring-offset-1" : "hover:border-primary/50"}`}
              style={{ backgroundImage: g.value }}
            />
          ))}
        </div>
      </div>

      {colour("טקסט", "text", "#ffffff")}
      {colour("כותרות ושעות", "accent", "#f0c35c")}
      {colour("קו מסביב", "line", "#c9a227")}

      {config.frameLooks[id] && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onEdit(`frame-look:${id}:reset`, (c) => {
            const frameLooks = { ...c.frameLooks };
            delete frameLooks[id];
            return { ...c, frameLooks };
          })}
        >
          <RotateCcw className="size-3.5" /> החזרת "{FRAME_LABELS[id]}" לעיצוב של הלוח
        </Button>
      )}
    </div>
  );
}
