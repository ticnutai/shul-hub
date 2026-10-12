/**
 * The small pieces every screen of the gabbai's area is built from, each
 * once: the save button, a choice drawn as a card, the phone/computer switch
 * over a preview, the line that says a list did not load, a slider with its
 * number, and a button that opens another section.
 *
 * Each of them had two to four copies that looked almost alike - a choice
 * ringed in gold in one screen and in the theme's colour in the next, a save
 * button that said "שומר…" in one form and nothing in another, "מובייל" over
 * one preview and "טלפון" over the other, in the other order.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Monitor, RotateCw, Smartphone, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { confirmLeave } from "@community/lib/unsavedChanges";

/* ------------------------------------------------------------ saving -- */

/** "שמירה", and while saving a spinner and "שומר…", not clickable - in every form. */
export function SaveButton({
  pending,
  disabled,
  onClick,
  label = "שמירה",
  className,
  testId,
}: {
  pending: boolean;
  disabled?: boolean;
  /** For a button outside a form; inside one it simply submits. */
  onClick?: () => void;
  label?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <Button
      type={onClick ? "button" : "submit"}
      disabled={pending || disabled}
      onClick={onClick}
      className={className}
      data-testid={testId}
      aria-busy={pending || undefined}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? "שומר…" : label}
    </Button>
  );
}

/* ----------------------------------------------------------- choices -- */

/** A row (or grid) of choice cards, one of them chosen. */
export function ChoiceGroup({ label, className, children, testId }: { label: string; className?: string; children: ReactNode; testId?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={className} data-testid={testId}>
      {children}
    </div>
  );
}

/** One choice, drawn as a card: ringed in the theme's colour when it is the one chosen. */
export function ChoiceCard({
  selected,
  onSelect,
  disabled,
  className,
  children,
  label,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  /** The accessible name, when the card shows a picture rather than words. */
  label?: string;
  /** Its name and a line under it - or `children`, for anything else. */
  title?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      disabled={disabled}
      onClick={() => !selected && onSelect()}
      className={cn(
        "rounded-xl border p-3 text-right transition disabled:opacity-60",
        selected ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border hover:border-primary/50 hover:bg-muted/50",
        className,
      )}
    >
      {title !== undefined && <span className="block text-sm font-semibold">{title}</span>}
      {description !== undefined && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
      {children}
    </button>
  );
}

/* ------------------------------------------------- phone or computer -- */

export type PreviewDevice = "phone" | "computer";

/** Over a preview: as a phone shows it, or as a computer does. Same words, same order, everywhere. */
export function PreviewDeviceToggle({ value, onChange }: { value: PreviewDevice; onChange: (device: PreviewDevice) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="תצוגה מקדימה בטלפון או במחשב">
      {([["phone", "טלפון", Smartphone], ["computer", "מחשב", Monitor]] as const).map(([id, label, Icon]) => (
        <Button
          key={id}
          type="button"
          size="sm"
          variant={value === id ? "default" : "outline"}
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
        >
          <Icon className="size-4" aria-hidden /> {label}
        </Button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------ did not load -- */

/** In place of a list that could not be read: what happened, and a way to try again. */
export function AdminError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-center gap-2 p-6 text-center text-sm text-destructive">
      <TriangleAlert className="size-4" aria-hidden />
      <span>לא הצלחנו לטעון את {what}.</span>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        <RotateCw className="size-4" aria-hidden /> ניסיון נוסף
      </Button>
    </div>
  );
}

/* ------------------------------------------------- a number, by hand -- */

/** A slider with its number beside it: drag, or type the exact value. */
export function SliderField({
  id,
  label,
  min,
  max,
  value,
  onChange,
  testId,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  testId?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2" dir="ltr">
        <Input
          type="range"
          aria-label={`שינוי ${label}`}
          min={min}
          max={max}
          step={1}
          value={String(value)}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-8 cursor-pointer px-0"
        />
        <Input
          id={id}
          data-testid={testId}
          type="number"
          min={min}
          max={max}
          step={1}
          value={String(value)}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
        />
      </div>
    </div>
  );
}

/* --------------------------------------------- to another section -- */

/** The steps inside a section, cleared when another section is opened. */
const STEP_PARAMS = ["cat", "prayer", "tvTab", "panel", "settingsTab", "focus", "details"];

/**
 * Opens another section of the gabbai's area (?tab=…), with whatever it should
 * open on (`extra`, e.g. focus=header). Asks first when a form has unsaved changes.
 */
export function useOpenSection() {
  const [params, setParams] = useSearchParams();
  return async (tab: string, extra: Record<string, string> = {}) => {
    if (!(await confirmLeave())) return false;
    const next = new URLSearchParams(params);
    for (const key of STEP_PARAMS) next.delete(key);
    next.set("tab", tab);
    for (const [key, value] of Object.entries(extra)) next.set(key, value);
    setParams(next);
    window.scrollTo({ top: 0 });
    return true;
  };
}

/** A short line pointing to where something related is set, with a button that goes there. */
export function SectionLink({
  hint,
  label,
  tab,
  extra,
  before,
  testId,
}: {
  hint: ReactNode;
  label: string;
  tab: string;
  extra?: Record<string, string>;
  /** Run before leaving, e.g. closing the window this stands in; false stays. */
  before?: () => boolean | Promise<boolean>;
  testId?: string;
}) {
  const open = useOpenSection();
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>{hint}</span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        data-testid={testId}
        onClick={async () => {
          if (before && !(await before())) return;
          await open(tab, extra);
        }}
      >
        {label}
      </Button>
    </p>
  );
}

/** Brings a panel into view when another section's link asked for it (?focus=name). */
/** `ready`: false while the panel is still loading and not drawn yet. */
export function useFocusTarget<T extends HTMLElement>(name: string, ready = true) {
  const ref = useRef<T>(null);
  const [params] = useSearchParams();
  const focus = params.get("focus");
  useEffect(() => {
    if (focus !== name || !ready) return;
    const frame = requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [focus, name, ready]);
  return ref;
}
