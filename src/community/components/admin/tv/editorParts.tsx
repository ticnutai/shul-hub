/**
 * The small pieces the board editor is built of: a titled section, a number
 * with − and +, a colour with its value, the design tab's topics, copying
 * one box's design to others, and the choices of layout and clock.
 */
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TvConfig } from "@/tv/config";
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
    hint: "הכל בבת אחת, בלי החלפות: תפילות, שעון, זמנים, הודעות ושיעורים",
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
  { id: 'composition', name: 'ערכה מחלקים', hint: 'גרפיקה מפורטת, טקסט ושעונים כשכבות עצמאיות. בחרו ערכה מקורית בלשונית עיצוב.', sketch: <i className="col-span-3 row-span-3 rounded border-2 border-current" /> },
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
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
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
        className="h-8 rounded-md border bg-background px-2 text-xs"
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
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
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
      <span
        className="min-w-14 px-1 text-center text-sm tabular-nums"
        tabIndex={0}
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(clamp(value + step));
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(clamp(value - step));
          }
        }}
      >
        {format(value)}
      </span>
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
  return (
    <div className="flex items-center gap-2">
      {isHex ? (
        <ColorPick label={label} value={value} onChange={onChange} />
      ) : (
        <span title="ערך עם שקיפות - עריכה בטקסט" className="size-9 shrink-0 rounded border opacity-40" style={{ background: value }} aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm">{label}</div>
        <Input
          dir="ltr"
          value={text}
          aria-label={`${label} (ערך)`}
          aria-invalid={!valid}
          className={`h-7 font-mono text-xs ${valid ? "" : "border-destructive"}`}
          onChange={(e) => {
            setText(e.target.value);
            if (isSafeCssValue(e.target.value)) onChange(e.target.value.trim());
          }}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label={`החזרת ${label} לצבע הבסיס`}
        title={`צבע הבסיס: ${themeValue}`}
        disabled={!overridden}
        onClick={onReset}
      >
        <RotateCcw className="size-3.5" />
      </Button>
    </div>
  );
}
