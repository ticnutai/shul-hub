import { Button } from "@/components/ui/button";
import {
  FRAME_RADIUS_MAX,
  SPACING_EDGES,
  SPACING_MAX,
  type SpacingEdge,
  type TvConfig,
} from "@/tv/config";
import type { ReactNode } from "react";
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

const SPACING_LABELS: Record<SpacingEdge, { name: string; hint: string }> = {
  top: { name: "מרווח עליון", hint: "בין שורת הכותרת לבין הלוחות. פחות מרווח = לוחות גבוהים יותר" },
  bottom: { name: "מרווח תחתון", hint: "בין הלוחות לבין השורה התחתונה (הפרשה והנרות)" },
  sides: { name: "שוליים בצדדים", hint: "המרווח בין הלוחות לקצה המסך" },
  gap: { name: "מרווח בין הלוחות", hint: "המרווח בין לוח ללוח" },
};

/**
 * A frame for the whole board: columns at its sides, beams, a פרוכת, a carved
 * frame around the screen. One of them or none - not a frame for a box.
 */
export function BoardFramePicker({ config, onEdit, compact = false }: { config: TvConfig; onEdit: Edit; compact?: boolean }) {
  return (
    <div
      data-testid="board-frames"
      className={compact ? "grid grid-cols-4 gap-1.5" : "grid grid-cols-3 gap-2 sm:grid-cols-4"}
    >
      {BOARD_FRAME_CHOICES.map((f) => {
        const on = config.boardFrame === f.id;
        return (
          <button
            key={f.id ?? "none"}
            type="button"
            aria-pressed={on}
            title={f.hint}
            onClick={() => onEdit("board-frame", (c) => ({ ...c, boardFrame: f.id }))}
            className={`rounded-lg border p-1.5 text-right transition ${on ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"}`}
          >
            <span className="mb-1 block aspect-[16/10] overflow-hidden rounded-md bg-[#0b1628]" aria-hidden>
              {f.preview}
            </span>
            <span className={`block text-center font-medium ${compact ? "text-[10px] leading-tight" : "text-xs"}`}>{f.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * How a box's name is set - for every box, or for one (`frame`), where
 * "כמו כולן" leaves it to every box's.
 */
export function TitleStylePicker({ config, onEdit, frame }: { config: TvConfig; onEdit: Edit; frame?: FrameId | null }) {
  const current = frame ? (config.frameLooks[frame]?.titleStyle ?? null) : config.titleStyle;
  const choices: Array<{ id: TitleStyle | null; name: string; preview: ReactNode }> = frame
    ? [{ id: null, name: "כמו כולן", preview: <span className="text-white/60">—</span> }, ...TITLE_STYLE_CHOICES]
    : TITLE_STYLE_CHOICES;
  const pick = (id: TitleStyle | null) =>
    frame
      ? onEdit(`title-style:${frame}`, (c) => ({ ...c, frameLooks: setFrameLook(c.frameLooks, frame, { titleStyle: id }) }))
      : onEdit("title-style", (c) => ({ ...c, titleStyle: id ?? "plain" }));
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium">סגנון הכותרת של התיבה</div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" data-testid="title-styles">
        {choices.map((t) => {
          const on = current === t.id;
          return (
            <button
              key={t.id ?? "all"}
              type="button"
              aria-pressed={on}
              aria-label={`כותרת: ${t.name}`}
              onClick={() => pick(t.id)}
              className={`rounded-lg border p-1.5 text-center ${on ? "ring-2 ring-primary ring-offset-1" : "hover:border-primary/50"}`}
            >
              <span className="mb-1 flex h-8 items-center justify-center rounded bg-[#12243f] text-[11px]" aria-hidden>
                {t.preview}
              </span>
              <span className="block text-[11px] leading-tight">{t.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A slider with a "רגיל" way back to the default. */
function AutoSlider({
  label,
  hint,
  value,
  max,
  fallback,
  onChange,
  compact,
}: {
  label: string;
  hint?: string;
  value: number | null;
  max: number;
  fallback: number;
  onChange: (next: number | null) => void;
  compact: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "text-xs" : "gap-3 text-sm"}`} title={hint}>
      <span className={compact ? "w-24 shrink-0" : "w-28 shrink-0"}>{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        step={0.5}
        value={value ?? fallback}
        disabled={value === null}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`flex-1 accent-primary disabled:opacity-40 ${compact ? "h-1.5" : "h-2"}`}
      />
      <span className="w-8 text-end tabular-nums text-muted-foreground">
        {value === null ? "—" : value}
      </span>
      <Button
        type="button"
        size="sm"
        variant={value === null ? "default" : "outline"}
        className={compact ? "h-7 px-2 text-[11px]" : ""}
        aria-pressed={value === null}
        onClick={() => onChange(value === null ? fallback : null)}
      >
        רגיל
      </Button>
    </div>
  );
}

/** The shape of the frames' corners and how round they are (עיצוב › מסגרות). */
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
      <div className={heading}>{compact ? "צורת התיבות" : "צורה ופינות"}</div>
      <div
        data-testid="frame-shapes"
        className={compact ? "grid grid-cols-6 gap-1.5" : "grid grid-cols-3 gap-2 sm:grid-cols-6"}
      >
        {FRAME_CHOICES.map((fr) => (
          <button
            key={fr.id}
            type="button"
            aria-pressed={config.frame.shape === fr.id}
            title={fr.hint}
            onClick={() => onEdit("frame.shape", (c) => ({ ...c, frame: { ...c.frame, shape: fr.id } }))}
            className={`rounded-lg border p-1.5 text-center transition ${
              config.frame.shape === fr.id
                ? "ring-2 ring-primary ring-offset-2"
                : "hover:border-primary/50"
            }`}
          >
            <span
              className={`mx-auto mb-1 block border-2 border-[#c9a227] bg-[#12243f] ${
                compact ? "h-6 w-8" : "h-10 w-14"
              }`}
              style={fr.css}
              aria-hidden
            />
            <span className="block text-[11px] font-medium leading-tight">{fr.name}</span>
          </button>
        ))}
      </div>

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
        <p className="text-xs text-muted-foreground">
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
          fallback={SPACING_FALLBACK[edge]}
          compact={compact}
          onChange={(next) =>
            onEdit(`spacing.${edge}`, (c) => ({ ...c, spacing: { ...c.spacing, [edge]: next } }))
          }
        />
      ))}

      {!compact && (
        <p className="text-xs text-muted-foreground">
          חל על כל הלוחות בכל הפריסות - בטלוויזיה, בלפטופ ובנייד. מרווח קטן יותר מעלה את גובה
          הלוחות, ולפעמים מכניס שורה נוספת.
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

