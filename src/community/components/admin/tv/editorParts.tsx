/**
 * The small pieces the board editor is built of: a titled section, a number
 * with − and +, a colour with its value, the design tab's topics, copying
 * one box's design to others, and the choices of layout and clock.
 */
import { InfoTip } from "@/components/InfoTip";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, Grid2x2, Grid3x3, LayoutGrid, Square, Columns3, Eye, EyeOff, Lock, Minus, PanelLeft, PanelRight, PanelsLeftRight, Plus, Rows3, RotateCcw, StretchHorizontal, Unlock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TvConfig } from "@/tv/config";
import type { ElementBinding } from "@/tv/elements";
import { allFrameIds, frameLabel, type FrameId } from "@/tv/frameLooks";
import { ColorPick } from "./ColorPick";
import { DESIGN_TOPICS, useDesignTopics, type DesignView } from "./designTopics";

/** The screen layouts, with a small sketch of each for the picker. */
export const LAYOUT_CHOICES: Array<{
  id: TvConfig["screenLayout"];
  name: string;
  hint: string;
  sketch: ReactNode;
}> = [
  {
    id: "rotate",
    name: "סבב מסכים",
    hint: "מסך אחד בכל פעם על כל הלוח, מתחלף לפי הזמנים שקבעתם",
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
    hint: "טור קבוע עם המניין הבא וזמני היום, ולידו המסכים מתחלפים",
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

/**
 * The folded layout ("כותרות מתקפלות"): every section of a tab a title in
 * sight, opened and closed by a click - which are open, kept by the editor.
 * Null in the other layouts: every section open as always.
 */
export const FoldedSections = createContext<{ open: string[]; toggle: (id: string) => void } | null>(null);

export function Section({ title, hint, children, id, hidden, aside }: { title: string; hint?: string; children: ReactNode; id?: string; hidden?: boolean;
  /** On the title's own line, at its far end: a few controls, not a line of their own under it. */
  aside?: ReactNode }) {
  const fold = useContext(FoldedSections);
  const folded = Boolean(fold && id);
  const open = !folded || fold!.open.includes(id!);
  return (
    // Hidden, not removed: what was typed in a topic stays when another is shown.
    <section id={id} hidden={hidden} data-folded={folded ? (open ? "open" : "closed") : undefined}
      className={`scroll-mt-44 rounded-xl border bg-card shadow-sm ${folded ? "p-0" : "p-4"}`}>
      {/* The explanation behind an ⓘ beside the title: a line of the page less. */}
      <div className={`flex flex-wrap items-center gap-1.5 ${folded ? "px-4 py-2.5" : ""}`}>
        {folded ? (
          <button type="button" aria-expanded={open} onClick={() => fold!.toggle(id!)}
            className="flex flex-1 items-center gap-1.5 text-start">
            <ChevronDown className={`size-4 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden />
            <h3 className="text-base font-semibold">{title}</h3>
          </button>
        ) : (
          <h3 className="text-base font-semibold">{title}</h3>
        )}
        {hint && <InfoTip>{hint}</InfoTip>}
        {aside}
      </div>
      <div className={folded ? "space-y-3 px-4 pb-4" : "mt-3 space-y-3"} hidden={!open}>{children}</div>
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
 * The design tab's topics, side by side at the top. One at a time (the
 * default): a click swaps the topic shown. Or all down the page: a click
 * jumps to its section, and the one on screen is marked as the page scrolls.
 */
export function DesignTopics({ withView = true }: { withView?: boolean } = {}) {
  const { view, topic, setTopic, setView } = useDesignTopics();
  useEffect(() => {
    if (view !== "scroll") return;
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = DESIGN_TOPICS.find((t) => seen.get(t.id));
        if (first) setTopic(first.id);
      },
      { rootMargin: "-180px 0px -45% 0px" },
    );
    for (const t of DESIGN_TOPICS) {
      const el = document.getElementById(t.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  return (
    <div className="space-y-1.5">
      <nav aria-label="נושאי העיצוב" className="flex flex-wrap gap-1.5" data-testid="design-topics">
        {DESIGN_TOPICS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={topic === t.id ? "true" : undefined}
            onClick={() => {
              setTopic(t.id);
              const el = document.getElementById(t.id);
              // One at a time: the new topic stands where the old one did - back to its top only when scrolled past it.
              if (view === "scroll") el?.scrollIntoView({ block: "start" });
              else window.requestAnimationFrame(() => {
                const top = document.getElementById(t.id)?.getBoundingClientRect().top ?? 0;
                if (top < 0) document.getElementById(t.id)?.scrollIntoView({ block: "start" });
              });
            }}
            className={`h-9 flex-1 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition ${
              topic === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {withView && <TopicsViewToggle />}
    </div>
  );
}

/** One topic at a time, or all of them down the page: small, on the one line of how the editor looks. */
export function TopicsViewToggle() {
  const { view, setView } = useDesignTopics();
  const choices = [
    ["switch", "נושא אחד", "לחיצה על נושא מחליפה את מה שמוצג, בלי לגלול"],
    ["scroll", "הכול ברצף", "כל הנושאים זה מתחת לזה, ולחיצה גוללת אל הנושא"],
  ] as const;
  return (
    <span className="flex items-center gap-1.5">
      נושאים:
      <span className="inline-flex rounded-md border bg-background p-0.5" role="radiogroup" aria-label="הצגת הנושאים">
        {choices.map(([id, name, hint]) => (
          <button key={id} type="button" role="radio" aria-checked={view === id} title={hint} onClick={() => setView(id as DesignView)}
            className={`inline-flex h-6 items-center rounded px-2 text-[11px] font-medium ${view === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {name}
          </button>
        ))}
      </span>
    </span>
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
      {/* Typed into as well as stepped: a page of an hour was 360 clicks of +10. It reads
          as it is read ("30 שניות"); focused, all of it is selected, and what is typed over
          it is read for its number alone (the words and "%" around it are let go). Focusing
          changes nothing in the field: a re-render then dropped the selection, and what was
          typed landed after the old number. An empty or wrong entry leaves the value as it
          was; one out of range is brought into it. */}
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
          const field = e.target;
          field.select();
          requestAnimationFrame(() => field.select());
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number((draft ?? "").replace(",", ".").replace(/[^\d.-]/g, ""));
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
  // The one colour row, a base colour's: its code - a colour with transparency too - is typed in its panel.
  return (
    <ColourRow
      label={label}
      value={value}
      anyCode
      onChange={onChange}
      reset={{
        label: "כמו הבסיס",
        ariaLabel: `החזרת ${label} לצבע הבסיס`,
        title: `צבע הבסיס: ${themeValue}`,
        disabled: !overridden,
        onClick: onReset,
      }}
    />
  );
}

/* ------------------------------------------------- one look per control -- */

/** Every select in the editor: one height, one border, one size of letters. */
export const SELECT_CLASS = "h-8 rounded-md border bg-background px-2 text-sm";
/** Every plain field beside them (a name, a date, a time): the same height, border and letters. */
export const INPUT_CLASS = SELECT_CLASS;

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
  anyCode = false,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  reset?: { label: string; onClick: () => void; disabled?: boolean; title?: string; ariaLabel?: string };
  /** A colour with transparency may be typed in the panel (ColorPick's `anyCode`). */
  anyCode?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0">{label}</span>
      <span className="flex items-center gap-2">
        <ColorPick label={label} value={value} onChange={onChange} anyCode={anyCode} />
        {reset && (
          <ResetLink label={reset.label} onClick={reset.onClick} disabled={reset.disabled} title={reset.title} ariaLabel={reset.ariaLabel} />
        )}
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
  anyCode = false,
}: {
  label: string;
  value: string | null | undefined;
  fallback: string;
  /** The way back, as a "כמו …" ("כמו כל הלוח", "בלי קו"). */
  unsetLabel: string;
  onChange: (v: string | null) => void;
  /** A colour with transparency may be typed in the panel (ColorPick's `anyCode`). */
  anyCode?: boolean;
}) {
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
  if (value)
    return (
      <ColourRow
        label={label}
        value={hex ?? (anyCode ? value : fallback)}
        anyCode={anyCode}
        onChange={(v) => onChange(v)}
        reset={{ label: unsetLabel, onClick: () => onChange(null) }}
      />
    );
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
/**
 * How the sliders stand: each under its name ("stack"), the name, the slider and
 * its value in one line ("row") - half the height, or upright side by side
 * ("vertical") - a few in the width of one. The gabbai's choice, kept in this
 * browser and the same for every slider of the editor (SliderLayoutToggle).
 */
type SliderLayout = "stack" | "row" | "vertical";
const SLIDER_LAYOUTS: SliderLayout[] = ["stack", "row", "vertical"];

/**
 * A choice of how the editor looks to this gabbai (the sliders, the size of the
 * galleries' tiles): kept in this browser, the same everywhere in the editor,
 * and changed in every place at once when changed in one.
 */
function useViewChoice<T extends string>(key: string, values: readonly T[], fallback: T): [T, (v: T) => void] {
  const read = (): T => {
    try {
      const v = localStorage.getItem(key);
      return values.includes(v as T) ? (v as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const [value, setValue] = useState<T>(read);
  useEffect(() => {
    const on = () => setValue(read());
    window.addEventListener(key, on);
    return () => window.removeEventListener(key, on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (v: T) => {
    try {
      localStorage.setItem(key, v);
    } catch {
      /* a private window: for this visit only */
    }
    setValue(v);
    window.dispatchEvent(new Event(key));
  };
  return [value, set];
}
const useSliderLayout = () => useViewChoice<SliderLayout>("tv-slider-layout", SLIDER_LAYOUTS, "stack");

/** How big the tiles of every gallery are (GalleryGrid): small ones fit many in a row. */
export type TileSize = "small" | "medium" | "large";
const TILE_SIZES: TileSize[] = ["small", "medium", "large"];
export const useTileSize = () => useViewChoice<TileSize>("tv-tile-size", TILE_SIZES, "medium");

/**
 * How big the kits and parts in a library are drawn: six to a row, four,
 * three (as they were) or two - kept, the same in every library.
 */
export const LIBRARY_VIEWS = ["xs", "small", "medium", "large"] as const;
export type LibraryView = (typeof LIBRARY_VIEWS)[number];
export const useLibraryView = () => useViewChoice<LibraryView>("tv-library-view", LIBRARY_VIEWS, "medium");
export const LIBRARY_GRID: Record<LibraryView, string> = {
  xs: "grid grid-cols-3 gap-1.5 sm:grid-cols-6",
  small: "grid grid-cols-2 gap-2 sm:grid-cols-4",
  medium: "grid grid-cols-2 gap-2 sm:grid-cols-3",
  large: "grid grid-cols-1 gap-3 sm:grid-cols-2",
};

/** The size of a library's kits and parts: one small button, its four choices in a row. */
export function LibraryViewToggle() {
  const [view, setView] = useLibraryView();
  const choices = [
    ["xs", Grid3x3, "קטן מאוד - שש בשורה"],
    ["small", LayoutGrid, "קטן - ארבע בשורה"],
    ["medium", Grid2x2, "בינוני - שלוש בשורה"],
    ["large", Square, "גדול - שתיים בשורה"],
  ] as const;
  return (
    <span className="inline-flex h-8 items-center rounded-md border bg-background p-0.5" role="radiogroup" aria-label="גודל התצוגה של הערכות" data-testid="library-view">
      {choices.map(([id, Icon, label]) => (
        <button key={id} type="button" role="radio" aria-checked={view === id} aria-label={label} title={label}
          onClick={() => setView(id)}
          className={`inline-flex size-7 items-center justify-center rounded ${view === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </span>
  );
}

/** The small switch of how the sliders stand: three, side by side - under the name, in one line, upright. */
export function SliderLayoutToggle() {
  const [layout, setLayout] = useSliderLayout();
  const choices = [
    ["stack", Rows3, "כל סליידר מתחת לשם שלו"],
    ["row", StretchHorizontal, "השם, הסליידר והערך בשורה אחת"],
    ["vertical", Columns3, "סליידרים עומדים, זה לצד זה - הכי מעט מקום"],
  ] as const;
  return (
    <span className="inline-flex rounded-md border p-0.5" role="radiogroup" aria-label="פריסת הסליידרים" data-testid="slider-layout">
      {choices.map(([id, Icon, label]) => (
        <button key={id} type="button" role="radio" aria-checked={layout === id} aria-label={label} title={label}
          onClick={() => setLayout(id)}
          className={`inline-flex size-6 items-center justify-center rounded ${layout === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </span>
  );
}

/** The size of the galleries' tiles - backgrounds, frames, shapes, pictures - three, side by side. */
export function TileSizeToggle() {
  const [size, setSize] = useTileSize();
  const choices = [["small", "משבצות קטנות", "ק"], ["medium", "משבצות בינוניות", "ב"], ["large", "משבצות גדולות", "ג"]] as const;
  return (
    <span className="inline-flex rounded-md border p-0.5" role="radiogroup" aria-label="גודל המשבצות בגלריות" data-testid="tile-size">
      {choices.map(([id, label, short]) => (
        <button key={id} type="button" role="radio" aria-checked={size === id} aria-label={label} title={label}
          onClick={() => setSize(id)}
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-[11px] font-medium ${size === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {short}
        </button>
      ))}
    </span>
  );
}

/** How the editor looks, in one line - the galleries' tiles and the sliders - wherever it stands, once. */
export function EditorViewBar() {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1" data-testid="editor-view-bar">
      <span className="flex items-center gap-1.5">גלריות: <TileSizeToggle /></span>
      <span className="flex items-center gap-1.5">סליידרים: <SliderLayoutToggle /></span>
    </span>
  );
}

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
  const [layout] = useSliderLayout();
  const slider = (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={resting}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full min-w-0 accent-primary disabled:opacity-40"
    />
  );
  const readout = (
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
  );
  // Upright, side by side with the next ones: the name over it, the value under it.
  if (layout === "vertical")
    return (
      <div className="me-3 mb-2 !mt-0 inline-flex w-[4.75rem] flex-col items-center gap-1 align-top text-[11px]" title={hint} data-slider-layout="vertical">
        <span className="line-clamp-2 h-[2.5em] text-center leading-tight">{label}</span>
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={resting}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ writingMode: "vertical-lr", direction: "rtl" }}
          className="h-24 w-5 accent-primary disabled:opacity-40"
        />
        {/* Its value, or - left to the board - only the "רגיל" that says so and lets go of it. */}
        <span className="flex flex-col items-center gap-1">
          {!resting && <span className="tabular-nums text-muted-foreground">{show(value)}</span>}
          {auto ? (
            <button type="button" aria-pressed={resting} title={resting ? "כרגע לפי הלוח - לחיצה מאפשרת לכוונן" : "חזרה למה שהלוח קובע"} onClick={auto.onToggle}
              className={`h-6 rounded-md border px-2 text-[11px] ${resting ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50"}`}>
              רגיל
            </button>
          ) : resting && <span className="text-muted-foreground">רגיל</span>}
        </span>
      </div>
    );
  // One line: the name, the slider, its value.
  if (layout === "row")
    return (
      <div className="grid grid-cols-[minmax(5.5rem,8rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs" title={hint} data-slider-layout="row">
        <span className="truncate">{label}</span>
        {slider}
        {readout}
      </div>
    );
  return (
    <div className="space-y-1 text-xs" title={hint}>
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {readout}
      </div>
      {slider}
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
  note,
  disabled = false,
  id,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (on: boolean) => void;
  hint?: string;
  ariaLabel?: string;
  /** A second, quiet line under the label. */
  note?: ReactNode;
  disabled?: boolean;
  /** The switch's own id, where something finds it by it. */
  id?: string;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "" : "cursor-pointer"}`}>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={ariaLabel} disabled={disabled} />
      <span className="min-w-0">
        {label}
        {note && <span className="block text-[11px] leading-tight text-muted-foreground">{note}</span>}
      </span>
      {/* What it does, behind an ⓘ - a hover title is never seen on a phone. */}
      {hint && <InfoTip>{hint}</InfoTip>}
    </label>
  );
}

/**
 * Earlier or later in an order - the occasions, the pages, the notices, the
 * logos - the one pair, with the same words and arrows everywhere. (The
 * layers of the free parts are another thing, up and down over each other,
 * and say so: "שכבה למעלה", "שכבה למטה".)
 */
export function MoveButtons({
  name,
  first,
  last,
  onMove,
  words = false,
  stacked = false,
}: {
  /** What moves, for the reader of the page: "הקדמת {name}". */
  name: string;
  first: boolean;
  last: boolean;
  onMove: (by: -1 | 1) => void;
  /** The words beside the arrows, where there is room. */
  words?: boolean;
  /** One over the other, in a narrow row of a list. */
  stacked?: boolean;
}) {
  const cls = words
    ? "flex h-8 items-center gap-1 rounded-md border bg-background px-2 text-xs hover:border-primary disabled:opacity-40"
    : "grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30";
  return (
    <span className={`flex shrink-0 ${stacked ? "flex-col" : "items-center gap-1"}`} role="group" aria-label={`הסדר של ${name}`}>
      <button type="button" className={cls} disabled={first} onClick={() => onMove(-1)} aria-label={`הקדמת ${name}`} title="הקדמה - לפני מה שלפניו">
        <ArrowUp className="size-3.5" aria-hidden />
        {words && "הקדמה"}
      </button>
      <button type="button" className={cls} disabled={last} onClick={() => onMove(1)} aria-label={`העברת ${name} אחורה`} title="העברה אחורה - אחרי מה שאחריו">
        <ArrowDown className="size-3.5" aria-hidden />
        {words && "העברה אחורה"}
      </button>
    </span>
  );
}

/**
 * Shown or hidden, locked or free: the one pair of small icon switches in a
 * row of a list (the free parts, the frames of a board of parts). Pressed is
 * hidden, or locked; the name says what a press will do.
 */
export function HideToggle({ hidden, name, onToggle }: { hidden: boolean; name: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={hidden}
      aria-label={`${hidden ? "הצגת" : "הסתרת"} ${name}`}
      title={hidden ? "מוסתר - לחיצה מציגה" : "הסתרה - לא נמחק, אפשר להחזיר"}
      onClick={onToggle}
      className={sideButtonClass(hidden)}
    >
      {hidden ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
    </button>
  );
}
export function LockToggle({ locked, name, onToggle }: { locked: boolean; name: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={locked}
      aria-label={`${locked ? "שחרור" : "נעילת"} ${name}`}
      title={locked ? "נעול - לחיצה משחררת" : "נעילה - לא זז ולא משתנה בטעות"}
      onClick={onToggle}
      className={sideButtonClass(locked)}
    >
      {locked ? <Lock className="size-4" aria-hidden /> : <Unlock className="size-4" aria-hidden />}
    </button>
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
  saveLabel = "שמירה",
  extra,
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
  /** What the save says, where it says more than "שמירה" ("שמירת הערכה"). */
  saveLabel?: string;
  /** More of the same form under the name (what a kit holds), before its buttons. */
  extra?: ReactNode;
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
      {extra && <div className="w-full">{extra}</div>}
      <Button type="submit" size="sm" className="h-8" disabled={!value.trim()}>
        {saveLabel}
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onCancel}>
        ביטול
      </Button>
      {hint && <InfoTip>{hint}</InfoTip>}
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
 * "כשהתוכן לא נכנס", in the same three words wherever it is asked - for the
 * board's boxes (the layout tab) and for one part (the list of parts, the
 * frames of a board of parts). The first did not move and had three names
 * ("בלי גלילה", "הקטנה כדי שייכנס", "דפדוף בין עמודים"): it is one name now,
 * and what not moving does there is said in its hint.
 */
const MOVES = {
  pause: { name: "גלילה עם עצירות", hint: "עומד למעלה, גולל לאט, עומד למטה וחוזר" },
  loop: { name: "וילון רציף", hint: "רץ בלי הפסקה; ההתחלה באה אחרי הסוף" },
} as const;
/** The board's boxes. */
export const OVERFLOW_CHOICES = [
  { id: "off", name: "בלי גלילה", hint: "חלון סביב המניין הבא, והשאר נחתך" },
  { id: "pause", ...MOVES.pause },
  { id: "loop", ...MOVES.loop },
] as const;
/** One part: a notice not moving is made smaller to fit; a list turns its pages. */
export const FIT_CHOICES = (binding: ElementBinding) =>
  [
    {
      id: "",
      name: "בלי גלילה",
      hint: binding === "announcements" || binding === "footer" ? "התוכן מוקטן כדי שייכנס" : "הרשימה מתחלקת לעמודים שמתחלפים",
    },
    { id: "pause", ...MOVES.pause },
    { id: "loop", ...MOVES.loop },
  ] as const;
/** How fast it moves, the same two wherever it is asked. */
export const SPEED_CHOICES = [
  { id: "slow", name: "איטית" },
  { id: "normal", name: "רגילה" },
] as const;
