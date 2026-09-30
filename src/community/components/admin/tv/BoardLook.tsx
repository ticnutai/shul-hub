import { Button } from "@/components/ui/button";
import {
  FRAME_RADIUS_MAX,
  SPACING_EDGES,
  SPACING_MAX,
  type SpacingEdge,
  type TvConfig,
} from "@/tv/config";
import { ILLUSTRATION_DEFS } from "@/tv/illustrated";
import { ILLUSTRATION_PICTURES } from "@/tv/illustrationPictures";
import { FRAME_CHOICES, SKIN_CHOICES } from "./tvChoices";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/**
 * The frames of the board - their style, the shape of their corners - and
 * the air around them.
 *
 * One set of controls, rendered in two places - the editor's own tab and the
 * panel that opens when the board itself is clicked - so the two can never
 * drift apart. `compact` is the second of those: the same controls, sized for
 * a floating window on a second screen.
 *
 * The style and the corners are how the frames look, and sit under "עיצוב ›
 * מסגרות"; the spacing is where they stand, and sits under "פריסה".
 */

/**
 * The layout a board takes when it leaves a painted board for a drawn style.
 *
 * A painted board shows everything at once, and so does "לוח מלא"; switching
 * to the rotating board instead would take half of what was on the wall off
 * it at the same moment the frames changed.
 */
const LEAVING_PAINTED: TvConfig["screenLayout"] = "dashboard";

const SPACING_LABELS: Record<SpacingEdge, { name: string; hint: string }> = {
  top: { name: "מרווח עליון", hint: "בין שורת הכותרת לבין הלוחות. פחות מרווח = לוחות גבוהים יותר" },
  sides: { name: "שוליים בצדדים", hint: "המרווח בין הלוחות לקצה המסך" },
  gap: { name: "מרווח בין הלוחות", hint: "המרווח בין לוח ללוח" },
};

export function StylePicker({
  config,
  onEdit,
  compact = false,
}: {
  config: TvConfig;
  onEdit: Edit;
  compact?: boolean;
}) {
  const painted = config.screenLayout === "illustrated";
  return (
    <div className="space-y-2">
      <div className={compact ? "text-xs font-medium text-muted-foreground" : "text-sm font-medium"}>
        {compact ? "סגנון תצוגה" : "מסגרות מעוצבות · על כל רקע"}
      </div>
      <div
        data-testid="skin-picker"
        className={
          compact
            ? "grid grid-cols-4 gap-1.5"
            : "grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5"
        }
      >
        {SKIN_CHOICES.map((sk) => (
          <button
            key={sk.id}
            type="button"
            aria-pressed={!painted && config.skin === sk.id}
            title={sk.hint}
            onClick={() =>
              onEdit("skin", (c) => ({
                ...c,
                skin: sk.id,
                ...(c.screenLayout === "illustrated" ? { screenLayout: LEAVING_PAINTED } : {}),
              }))
            }
            className={`rounded-lg border p-1.5 text-right transition ${
              !painted && config.skin === sk.id ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"
            }`}
          >
            <span
              className="mb-1 block aspect-[16/10] overflow-hidden rounded-md bg-[#0b1628]"
              aria-hidden
            >
              {sk.preview}
            </span>
            <span
              className={`block text-center font-medium ${compact ? "text-[10px] leading-tight" : "text-xs"}`}
            >
              {sk.name}
            </span>
          </button>
        ))}
      </div>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          הסגנון מתלבש על כל רקע, כל ערכת נושא וכל פריסה. "לוחות אבן" ו"קלף" הופכים את הלוחות
          לבהירים, והטקסט שבתוכם מתכהה בהתאם.
        </p>
      )}
    </div>
  );
}

/** A slider with a "לפי הסגנון" way back to the default. */
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
        לפי הסגנון
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
      <div className={heading}>{compact ? "מסגרות" : "צורת המסגרות"}</div>
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
          כשקובעים עיגול, הצורה של הסגנון (כיפה, קשת, קצה מסולסל) מוחלפת בפינה שנבחרה; החומרים
          והצבעים נשארים.
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
          fallback={edge === "gap" ? 2 : edge === "sides" ? 3 : 2.6}
          compact={compact}
          onChange={(next) =>
            onEdit(`spacing.${edge}`, (c) => ({ ...c, spacing: { ...c.spacing, [edge]: next } }))
          }
        />
      ))}

      {!compact && (
        <p className="text-xs text-muted-foreground">
          חל על כל הלוחות בכל הסגנונות - בטלוויזיה, בלפטופ ובנייד. מרווח קטן יותר מעלה את גובה
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

/**
 * The painted boards, offered as frames: a curtain with gold frames, stone
 * tablets, carved wood. Each is one picture with its wall painted in, so
 * picking one also brings its wall - which is then adjusted under "רקע".
 * Picking one switches the board to the painted layout; picking a drawn
 * style (StylePicker) switches it back.
 */
export function PaintedBoardsPicker({ config, onEdit }: { config: TvConfig; onEdit: Edit }) {
  const painted = config.screenLayout === "illustrated";
  const boards = [
    ...ILLUSTRATION_DEFS.map((d) => ({
      ...d,
      picture: ILLUSTRATION_PICTURES[d.id as keyof typeof ILLUSTRATION_PICTURES],
      custom: false,
    })),
    ...config.customIllustrations.map((d) => ({ ...d, picture: d.image, custom: true })),
  ];
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">מסגרות מצוירות · עם קיר משלהן</div>
      <div data-testid="painted-boards" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {boards.map((d) => {
          const on = painted && config.illustration === d.id;
          return (
            <div key={d.id} className="relative">
              <button
                type="button"
                aria-pressed={on}
                aria-label={`לוח מצויר: ${d.name}`}
                onClick={() =>
                  onEdit("illustration", (c) => ({ ...c, screenLayout: "illustrated", illustration: d.id }))
                }
                className={`w-full overflow-hidden rounded-lg border text-right transition ${
                  on ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"
                }`}
              >
                <img src={d.picture} alt="" className="aspect-video w-full object-cover" loading="lazy" />
                <span className="block px-2 pt-1 text-sm font-medium">{d.name}</span>
                <span className="block px-2 pb-1.5 text-[11px] leading-tight text-muted-foreground">
                  {d.custom ? d.hint || "יובאה מקובץ" : d.hint}
                </span>
              </button>
              {d.custom && (
                <button
                  type="button"
                  aria-label={`מחיקת ${d.name}`}
                  title="מחיקה"
                  onClick={() =>
                    onEdit("illustration-delete", (c) => ({
                      ...c,
                      customIllustrations: c.customIllustrations.filter((i) => i.id !== d.id),
                      ...(c.illustration === d.id ? { illustration: "curtain" } : {}),
                    }))
                  }
                  className="absolute left-1 top-1 rounded-md bg-background/90 px-1.5 text-xs shadow hover:text-destructive"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        הזמנים, התאריך והפרשה נכתבים בתוך המסגרות. כל ציור הוא תמונה אחת שהקיר מצויר בה, ולכן
        הקיר שלו מכוונן תחת "רקע".
      </p>
    </div>
  );
}
