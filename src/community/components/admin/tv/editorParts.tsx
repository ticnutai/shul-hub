/**
 * The small pieces the board editor is built of: a titled section, a number
 * with − and +, a colour with its value, the design tab's topics, copying
 * one box's design to others, and the choices of layout and clock.
 */
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Minus, PanelLeft, PanelRight, PanelsLeftRight, Plus, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TvConfig } from "@/tv/config";
import type { ElementBinding } from "@/tv/elements";
import { isSafeCssValue } from "@/tv/themes";
import { allFrameIds, frameLabel, type FrameId } from "@/tv/frameLooks";
import { ColorPick } from "./ColorPick";

/** The screen layouts, with a small sketch of each for the picker. */
export const LAYOUT_CHOICES: Array<{
  id: TvConfig["screenLayout"];
  name: string;
  hint: string;
  sketch: ReactNode;
}> = [
  {
    id: "rotate",
    name: "סבב שקפים",
    hint: "שקף אחד בכל פעם על כל המסך, מתחלף לפי הזמנים שקבעתם",
    sketch: (
      <>
        <i className="col-span-3 h-2 rounded-sm bg-current opacity-60" />
        <i className="col-span-3 row-span-3 rounded-sm bg-current opacity-30" />
      </>
    ),
  },
  {
    id: "split",
    name: "מפוצל",
    hint: "טור קבוע עם המניין הבא וזמני היום, ולידו השקפים מתחלפים",
    sketch: (
      <>
        <i className="col-span-3 h-2 rounded-sm bg-current opacity-60" />
        <i className="col-span-2 row-span-3 rounded-sm bg-current opacity-30" />
        <i className="row-span-3 rounded-sm bg-current opacity-55" />
      </>
    ),
  },
  {
    id: "dashboard",
    name: "לוח מלא",
    hint: "הכול בבת אחת, בלי החלפות: תפילות, שעון, זמנים, הודעות ושיעורים",
    sketch: (
      <>
        <i className="col-span-3 h-2 rounded-sm bg-current opacity-60" />
        <i className="row-span-2 rounded-sm bg-current opacity-40" />
        <i className="rounded-sm bg-current opacity-55" />
        <i className="row-span-2 rounded-sm bg-current opacity-40" />
        <i className="rounded-sm bg-current opacity-30" />
        <i className="col-span-3 h-1.5 rounded-sm bg-current opacity-60" />
      </>
    ),
  },
  {
    id: "medallion",
    name: "מדליון",
    hint: "שעון במדליון בין היום לתאריך, תפילות וזמנים בשתי מסגרות גדולות ופס למטה - כל חלק ניתן לעיצוב",
    sketch: (
      <>
        <i className="h-2 rounded-sm bg-current opacity-50" />
        <i className="mx-auto h-3 w-3 rounded-full bg-current opacity-70" />
        <i className="h-2 rounded-sm bg-current opacity-50" />
        <i className="col-span-3 row-span-2 grid grid-cols-2 gap-1">
          <i className="rounded-sm bg-current opacity-40" />
          <i className="rounded-sm bg-current opacity-40" />
        </i>
        <i className="col-span-3 h-1.5 rounded-sm bg-current opacity-60" />
      </>
    ),
  },
  {
    id: "composition",
    name: "ערכה מחלקים",
    hint: "גרפיקה מפורטת, טקסט ושעונים כחלקים עצמאיים. בוחרים ערכה בלשונית עיצוב.",
    sketch: <i className="col-span-3 row-span-3 rounded border-2 border-current" />,
  },
  // No painted template: a look is built from parts (backgrounds, boxes and
  // frames, text), and a painted board that arrives is rebuilt from them
  // (config.normalizeTvConfig). The medallion is its arrangement in frames.
];

export const CLOCK_CHOICES: Array<{ id: TvConfig["clockStyle"]; name: string }> = [
  { id: "digital", name: "ספרות" },
  { id: "analog", name: "שעון מחוגים" },
  { id: "both", name: "שניהם" },
];

/* --------------------------------------------------------- small inputs -- */

export function Section({ title, hint, children, id }: { title: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-44 rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="text-base font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/**
 * One box's whole design - its shape, background, frame and text - put on
 * another box, or on all of them, in one click. A box with no design of its
 * own passes that on: the others go back to looking like every box.
 */
export function CopyBoxLook({
  from,
  looks,
  customBoxes,
  onCopy,
}: {
  from: FrameId;
  looks: TvConfig["frameLooks"];
  customBoxes: TvConfig["customBoxes"];
  onCopy: (to: FrameId[], from: FrameId) => void;
}) {
  const label = (id: FrameId) => frameLabel(id, customBoxes);
  const others = allFrameIds(customBoxes).filter((id) => id !== from);
  const [to, setTo] = useState<string>("all");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2 text-xs" data-testid="copy-box-look">
      <span className="font-medium">העתקת העיצוב של {label(from)} אל:</span>
      <select
        aria-label="העתקה אל"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="all">כל שאר התיבות</option>
        {others.map((id) => (
          <option key={id} value={id}>
            {label(id)}
            {looks[id] ? " •" : ""}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8"
        onClick={() => {
          const targets = to === "all" ? others : [to as FrameId];
          onCopy(targets, from);
          toast.success(
            `העיצוב של ${label(from)} הועתק ${to === "all" ? "לכל שאר התיבות" : `ל${label(to as FrameId)}`}.`,
          );
        }}
      >
        העתקה
      </Button>
    </div>
  );
}

/**
 * The design tab's topics, side by side at the top: a click jumps to its
 * section. Which one is on screen is marked as the page scrolls.
 */
const DESIGN_TOPICS = [
  { id: "design-sets", label: "ערכות" },
  { id: "design-background", label: "רקע" },
  { id: "design-boxes", label: "תיבות" },
  { id: "design-frames", label: "מסגרות" },
  { id: "design-text", label: "טקסט" },
  { id: "design-elements", label: "חלקים" },
] as const;

export function DesignTopics() {
  const [current, setCurrent] = useState<string>(DESIGN_TOPICS[0].id);
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = DESIGN_TOPICS.find((t) => seen.get(t.id));
        if (first) setCurrent(first.id);
      },
      { rootMargin: "-180px 0px -45% 0px" },
    );
    for (const t of DESIGN_TOPICS) {
      const el = document.getElementById(t.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return (
    <nav aria-label="נושאי העיצוב" className="flex flex-wrap gap-1.5" data-testid="design-topics">
      {DESIGN_TOPICS.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-current={current === t.id ? "true" : undefined}
          onClick={() => {
            setCurrent(t.id);
            // Instant: a smooth scroll does not run while the window is in the background.
            document.getElementById(t.id)?.scrollIntoView({ block: "start" });
          }}
          className={`h-9 flex-1 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition ${
            current === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

/** Number with visible −/+ and ArrowUp/ArrowDown (the "spinner" users asked for). */
export function Stepper({
  value,
  min,
  max,
  step,
  onChange,
  label,
  format = (v) => String(v),
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
}) {
  // Kept to a thousandth (no float dust), not snapped to the step: a size of 2.3 grows to 2.55, not 2.5.
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 1000) / 1000));
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div
      className="inline-flex items-center rounded-md border bg-background"
      role="group"
      aria-label={label}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={`הקטנת ${label}`}
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
      >
        <Minus className="size-3.5" />
      </Button>
      {/* Typed into as well as stepped: a page of an hour was 360 clicks of +10. While
          typing, the number alone; otherwise as it is read ("30 שניות"). An empty or
          wrong entry leaves the value as it was; one out of range is brought into it. */}
      <input
        type="text"
        inputMode="decimal"
        dir="ltr"
        className="w-16 bg-transparent px-1 text-center text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary"
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        value={draft ?? format(value)}
        onFocus={(e) => {
          setDraft(String(value));
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number((draft ?? "").replace(",", "."));
          if (draft !== null && draft.trim() !== "" && Number.isFinite(n) && n !== value) onChange(clamp(n));
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(null);
            requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setDraft(null);
            onChange(clamp(value + step));
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setDraft(null);
            onChange(clamp(value - step));
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={`הגדלת ${label}`}
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

export function ColorField({
  label,
  value,
  themeValue,
  overridden,
  onChange,
  onReset,
}: {
  label: string;
  value: string;
  themeValue: string;
  overridden: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const isHex = /^#[0-9a-f]{6}$/i.test(value);
  const valid = isSafeCssValue(text);
  // The one colour row: its name, its swatch (and here its code, for a colour with transparency), and the way back.
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="min-w-0 flex-1">{label}</span>
      {isHex ? (
        <ColorPick label={label} value={value} onChange={onChange} />
      ) : (
        <span title="ערך עם שקיפות - עריכה בקוד" className="h-8 w-11 shrink-0 rounded border-2 opacity-60" style={{ background: value }} aria-hidden />
      )}
      <Input
        dir="ltr"
        value={text}
        aria-label={`${label} (ערך)`}
        aria-invalid={!valid}
        className={`h-8 w-28 font-mono text-xs ${valid ? "" : "border-destructive"}`}
        onChange={(e) => {
          setText(e.target.value);
          if (isSafeCssValue(e.target.value)) onChange(e.target.value.trim());
        }}
      />
      <ResetLink
        label="כמו הבסיס"
        ariaLabel={`החזרת ${label} לצבע הבסיס`}
        title={`צבע הבסיס: ${themeValue}`}
        disabled={!overridden}
        onClick={onReset}
      />
    </div>
  );
}

/* ------------------------------------------------- one look per control -- */

/** Every select in the editor: one height, one border, one size of letters. */
export const SELECT_CLASS = "h-8 rounded-md border bg-background px-2 text-sm";

/** The small "כמו …" link beside a colour or a value: back to what it follows. */
function ResetLink({
  label,
  onClick,
  disabled,
  title,
  ariaLabel,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className="shrink-0 text-xs text-primary underline-offset-2 hover:underline disabled:pointer-events-none disabled:text-muted-foreground disabled:opacity-50"
    >
      {label}
    </button>
  );
}

/**
 * A colour, the one way it is shown everywhere: its name, its swatch, and
 * when it follows something else, a "כמו …" link back to that.
 */
export function ColourRow({
  label,
  value,
  onChange,
  reset,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  reset?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0">{label}</span>
      <span className="flex items-center gap-2">
        <ColorPick label={label} value={value} onChange={onChange} />
        {reset && <ResetLink label={reset.label} onClick={reset.onClick} disabled={reset.disabled} />}
      </span>
    </div>
  );
}

/**
 * A colour that may be unset - it follows something else until chosen. Unset,
 * its swatch is an empty dashed box that puts a suggested colour on: a colour
 * box already showing a colour cannot report that same colour being picked,
 * so a first choice made on it was silently lost.
 */
export function ColourChoice({
  label,
  value,
  fallback,
  unsetLabel,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  fallback: string;
  /** The way back, as a "כמו …" ("כמו כל הלוח", "בלי קו"). */
  unsetLabel: string;
  onChange: (v: string | null) => void;
}) {
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
  if (value)
    return <ColourRow label={label} value={hex ?? fallback} onChange={(v) => onChange(v)} reset={{ label: unsetLabel, onClick: () => onChange(null) }} />;
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0">{label}</span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`הוספת ${label}`}
          title={`הוספת ${label}`}
          onClick={() => onChange(fallback)}
          className="grid h-8 w-11 shrink-0 place-items-center rounded border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
        <span className="text-xs text-muted-foreground">{unsetLabel}</span>
      </span>
    </div>
  );
}

/**
 * A number on a slider, the one way: its name and its value above, the slider
 * under them. With `auto`, the value can also be left to the board ("רגיל"):
 * the slider rests until "רגיל" is let go.
 */
export function Range({
  label,
  value,
  min,
  max,
  step,
  show = (v) => String(v),
  onChange,
  hint,
  auto,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  show?: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
  auto?: { isDefault: boolean; onToggle: () => void };
}) {
  const resting = Boolean(auto?.isDefault);
  return (
    <div className="space-y-1 text-xs" title={hint}>
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums text-muted-foreground">{resting ? "רגיל" : show(value)}</span>
          {auto && (
            <button
              type="button"
              aria-pressed={resting}
              title={resting ? "כרגע לפי הלוח - לחיצה מאפשרת לכוונן" : "חזרה למה שהלוח קובע"}
              onClick={auto.onToggle}
              className={`h-6 rounded-md border px-2 text-[11px] ${resting ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50"}`}
            >
              רגיל
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={resting}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary disabled:opacity-40"
      />
    </div>
  );
}

/** A choice of a few, side by side - the one way, wherever there is one. */
export function Segments<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ id: T; name: string; hint?: string }>;
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
          title={o.hint}
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

/** On or off, the one way: a switch and what it does. */
export function SwitchRow({
  label,
  checked,
  onChange,
  hint,
  ariaLabel,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (on: boolean) => void;
  hint?: string;
  ariaLabel?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm" title={hint}>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={ariaLabel} />
      <span>{label}</span>
    </label>
  );
}

/** "חזרה ל…": every way back to the default looks the same. */
export function ResetButton({ children, onClick, title }: { children: ReactNode; onClick: () => void; title?: string }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" title={title} onClick={onClick}>
      <RotateCcw className="size-3.5" aria-hidden /> {children}
    </Button>
  );
}

/**
 * Keeping something under a name, the one way: the name, "שמירה", "ביטול".
 * A name already taken is asked about by the caller (confirmAction), then replaced.
 */
export function NameForm({
  label,
  value,
  onChange,
  onSave,
  onCancel,
  placeholder,
  maxLength = 40,
  hint,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder?: string;
  maxLength?: number;
  hint?: ReactNode;
  testId?: string;
}) {
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      data-testid={testId}
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Input
        autoFocus
        aria-label={label}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-0 flex-1 basis-40 text-sm"
      />
      <Button type="submit" size="sm" className="h-8" disabled={!value.trim()}>
        שמירה
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onCancel}>
        ביטול
      </Button>
      {hint && <p className="w-full text-[11px] text-muted-foreground">{hint}</p>}
    </form>
  );
}

/* ------------------------------------------------ the parts of a board -- */

/** Right, middle, left: the one group of side buttons, in the list of parts and in the layout tab. */
export const SIDE_CHOICES = [
  ["right", "ימין", PanelRight],
  ["center", "אמצע", PanelsLeftRight],
  ["left", "שמאל", PanelLeft],
] as const;
export const SIDE_BUTTON =
  "grid size-8 place-items-center rounded-md border border-transparent text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-40";
export const sideButtonClass = (on: boolean) =>
  `grid size-8 place-items-center rounded-md border ${on ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground"} hover:border-primary hover:text-foreground disabled:opacity-40`;

/**
 * "כשהתוכן לא נכנס", in the same words wherever it is asked: a notice
 * shrinks, a list turns its pages - or either moves, as the board's own
 * boxes do (the layout tab's "גלילה עם עצירות", "וילון רציף").
 */
export const FIT_CHOICES = (binding: ElementBinding) =>
  [
    ["", binding === "announcements" || binding === "footer" ? "הקטנה כדי שייכנס" : "דפדוף בין עמודים"],
    ["pause", "גלילה עם עצירות"],
    ["loop", "וילון רציף"],
  ] as const;
