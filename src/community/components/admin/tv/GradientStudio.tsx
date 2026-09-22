import { useEffect, useMemo, useState } from "react";
import { Check, Download, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { TvConfig } from "@/tv/config";
import {
  allGradients,
  isSafeGradient,
  newGradientId,
  TV_GRADIENTS,
  type TvGradient,
} from "@/tv/themes";

/**
 * Building and keeping gradients.
 *
 * Two colours, a direction and a live swatch cover what an admin actually
 * wants; an "advanced" field keeps any gradient CSS that the simple controls
 * cannot express (three stops, conic, transparency) exactly as written,
 * instead of flattening it. Saving to the library stores the CSS itself, so
 * deleting a saved gradient never changes a board that already uses it.
 */

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

const DEFAULT_ANGLE = 160;

/** Reads a simple two-stop gradient back into the controls; null when it is beyond them. */
function parseSimple(
  value: string | null | undefined,
): { kind: "linear" | "radial"; angle: number; from: string; to: string } | null {
  if (!value) return null;
  const linear = value.match(
    /^linear-gradient\(\s*(\d{1,3})deg\s*,\s*(#[0-9a-f]{6})\s*(?:\d+%)?\s*,\s*(#[0-9a-f]{6})\s*(?:\d+%)?\s*\)$/i,
  );
  if (linear) return { kind: "linear", angle: Number(linear[1]), from: linear[2], to: linear[3] };
  const radial = value.match(
    /^radial-gradient\(\s*ellipse at 50% 30%\s*,\s*(#[0-9a-f]{6})\s*(?:\d+%)?\s*,\s*(#[0-9a-f]{6})\s*(?:\d+%)?\s*\)$/i,
  );
  if (radial) return { kind: "radial", angle: DEFAULT_ANGLE, from: radial[1], to: radial[2] };
  return null;
}

function build(kind: "linear" | "radial", angle: number, from: string, to: string): string {
  return kind === "linear"
    ? `linear-gradient(${angle}deg, ${from}, ${to})`
    : `radial-gradient(ellipse at 50% 30%, ${from}, ${to})`;
}

export function GradientSwatch({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`block rounded-md border ${className}`}
      style={{ backgroundImage: value }}
    />
  );
}

export function GradientStudio({
  config,
  onEdit,
  /** Where "החלה" puts the gradient: the board's background, or a chosen element. */
  applyLabel,
  onApply,
  onPreview,
  current,
}: {
  config: TvConfig;
  onEdit: Edit;
  applyLabel: string;
  onApply: (value: string | null) => void;
  /**
   * Shows what is being built on the board itself, without saving it.
   * Must be stable, or the effect below fires on every render.
   */
  onPreview?: (value: string | null) => void;
  current: string | null;
}) {
  const simple = useMemo(() => parseSimple(current), [current]);
  const [kind, setKind] = useState<"linear" | "radial">(simple?.kind ?? "linear");
  const [angle, setAngle] = useState(simple?.angle ?? DEFAULT_ANGLE);
  const [from, setFrom] = useState(simple?.from ?? "#0b1628");
  const [to, setTo] = useState(simple?.to ?? "#1b3054");
  // Anything the two-colour controls cannot express is kept verbatim here.
  const [advanced, setAdvanced] = useState(current && !simple ? current : "");
  const [name, setName] = useState("");

  // Follow the board when the gradient changes elsewhere (a preset, an undo).
  useEffect(() => {
    const parsed = parseSimple(current);
    if (parsed) {
      setKind(parsed.kind);
      setAngle(parsed.angle);
      setFrom(parsed.from);
      setTo(parsed.to);
      setAdvanced("");
    } else if (current) setAdvanced(current);
  }, [current]);

  const built = advanced.trim() ? advanced.trim() : build(kind, angle, from, to);
  const valid = isSafeGradient(built);
  const saved = config.gradients;

  /**
   * Loads a ready-made gradient into the controls.
   *
   * The label under these says "לחיצה בוחרת" - clicking chooses - and now
   * that is what it does. It used to apply on the spot, which made the
   * choice and the commitment the same act: you could not look at one on
   * the board without already having taken it.
   */
  const pick = (value: string) => {
    setTouched(true);
    const parsed = parseSimple(value);
    if (parsed) {
      setKind(parsed.kind);
      setAngle(parsed.angle);
      setFrom(parsed.from);
      setTo(parsed.to);
      setAdvanced("");
    } else {
      setAdvanced(value);
    }
  };

  // Every turn of a dial reaches the board. Nothing is written down: this
  // is the board wearing it, so the judgement is made on the wall and not
  // on a twenty-pixel strip in a side panel.
  /**
   * Only after the first deliberate change.
   *
   * The controls hold a default gradient before anybody touches them, and
   * previewing that would paint the board the moment this tab is opened -
   * an edit nobody asked for, on a board that was fine.
   */
  const [touched, setTouched] = useState(false);

  const previewing = Boolean(onPreview) && touched && valid && built !== current;
  useEffect(() => {
    if (!touched) return;
    onPreview?.(valid ? built : null);
  }, [built, valid, touched, onPreview]);

  // Leaving the control puts the board back to what is actually saved.
  useEffect(() => () => onPreview?.(null), [onPreview]);

  const saveToLibrary = () => {
    const clean = name.trim().slice(0, 40);
    if (!clean) return toast.error("צריך לתת שם לגרדיאנט");
    if (!valid) return toast.error("הגרדיאנט אינו תקין");
    const existing = saved.find((g) => g.name === clean);
    onEdit("gradient-save", (c) => ({
      ...c,
      gradients: existing
        ? c.gradients.map((g) => (g.id === existing.id ? { ...g, value: built } : g))
        : [...c.gradients, { id: newGradientId(), name: clean, value: built }].slice(0, 40),
    }));
    toast.success(existing ? `הגרדיאנט "${clean}" עודכן` : `הגרדיאנט "${clean}" נשמר בספרייה`);
    setName("");
  };

  return (
    <div className="space-y-3">
      {/* the gradient being built, big enough to judge */}
      <div className="space-y-2">
        <div
          className="h-20 rounded-lg border shadow-inner"
          style={{ backgroundImage: valid ? built : undefined }}
        />
        {previewing && (
          <p className="text-[11px] leading-tight text-muted-foreground">
            כך זה נראה על הלוח עכשיו. עוד לא נשמר - ״{applyLabel}״ מקבע, ויציאה מכאן מחזירה את
            הקודם.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => onApply(built)} disabled={!valid}>
            <Check className="size-4" /> {applyLabel}
          </Button>
          {current && (
            <Button type="button" size="sm" variant="outline" onClick={() => onApply(null)}>
              <RotateCcw className="size-4" /> הסרת הגרדיאנט
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {valid ? "" : "הערך אינו גרדיאנט תקין"}
          </span>
        </div>
      </div>

      {/* the two-colour controls */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <div className="flex items-center gap-1">
          {(
            [
              ["linear", "ישר"],
              ["radial", "מעגלי"],
            ] as const
          ).map(([k, label]) => (
            <Button
              key={k}
              type="button"
              size="sm"
              variant={kind === k ? "default" : "outline"}
              aria-pressed={kind === k}
              onClick={() => {
                setTouched(true);
                setKind(k);
                setAdvanced("");
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          מ־
          <input
            type="color"
            aria-label="צבע ראשון"
            value={from}
            onChange={(e) => {
              setTouched(true);
              setFrom(e.target.value);
              setAdvanced("");
            }}
            className="size-8 cursor-pointer rounded border bg-transparent p-0.5"
          />
        </label>
        <label className="flex items-center gap-2">
          אל
          <input
            type="color"
            aria-label="צבע שני"
            value={to}
            onChange={(e) => {
              setTouched(true);
              setTo(e.target.value);
              setAdvanced("");
            }}
            className="size-8 cursor-pointer rounded border bg-transparent p-0.5"
          />
        </label>
        {kind === "linear" && (
          <label className="flex items-center gap-2">
            כיוון
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={angle}
              aria-label="זווית הגרדיאנט"
              onChange={(e) => {
                setTouched(true);
                setAngle(Number(e.target.value));
                setAdvanced("");
              }}
              className="w-28 accent-primary"
            />
            <span className="w-10 text-xs tabular-nums">{angle}°</span>
          </label>
        )}
      </div>

      {/* ready-made and saved gradients */}
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">
          מוכנים לשימוש · לחיצה בוחרת
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {allGradients(saved).map((g) => {
            const mine = !TV_GRADIENTS.some((b) => b.id === g.id);
            return (
              <div key={g.id} className="group relative">
                <button
                  type="button"
                  title={g.name}
                  aria-label={g.name}
                  onClick={() => pick(g.value)}
                  className={`block w-full overflow-hidden rounded-md border transition hover:ring-2 hover:ring-primary ${
                    current === g.value ? "ring-2 ring-primary ring-offset-1" : ""
                  }`}
                >
                  <GradientSwatch value={g.value} className="h-9 w-full border-0" />
                  <span className="block truncate bg-background/95 px-1 py-0.5 text-[10px]">
                    {g.name}
                  </span>
                </button>
                {mine && (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute end-0.5 top-0.5 size-5 opacity-0 transition group-hover:opacity-100"
                    aria-label={`מחיקת ${g.name}`}
                    onClick={() =>
                      onEdit("gradient-del", (c) => ({
                        ...c,
                        gradients: c.gradients.filter((x) => x.id !== g.id),
                      }))
                    }
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* keep it */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם לשמירה בספרייה"
          maxLength={40}
          aria-label="שם הגרדיאנט"
          className="h-8 w-48"
        />
        <Button type="button" size="sm" variant="outline" onClick={saveToLibrary} disabled={!valid}>
          <Plus className="size-4" /> שמירה בספרייה
        </Button>
        <span className="text-xs text-muted-foreground">
          שם קיים מעדכן את הגרדיאנט השמור. מחיקה מהספרייה לא משנה לוח שכבר משתמש בו.
        </span>
      </div>

      {/* raw CSS, for anything the controls above cannot express */}
      <details className="rounded-md border bg-muted/40 p-2">
        <summary className="cursor-pointer text-xs font-medium">
          CSS מתקדם (שלוש שכבות, שקיפות, conic…)
        </summary>
        <Input
          dir="ltr"
          value={advanced}
          onChange={(e) => {
            setTouched(true);
            setAdvanced(e.target.value);
          }}
          placeholder="linear-gradient(160deg, #0b1628 0%, #1b3054 55%, #16304f 100%)"
          className={`mt-2 h-8 font-mono text-xs ${
            advanced && !isSafeGradient(advanced) ? "border-destructive" : ""
          }`}
          aria-label="גרדיאנט CSS"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          מה שנכתב כאן נשמר בדיוק כפי שהוא. שינוי של אחד הבקרים שלמעלה מחליף אותו בגרדיאנט פשוט.
        </p>
      </details>
    </div>
  );
}

/* ------------------------------------------------ import / export UI -- */

export function TransferPanel({
  onExport,
  onImport,
}: {
  onExport: (what: "themes" | "gradients" | "all", how: "file" | "clipboard") => void;
  onImport: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">
          ייצוא — לגיבוי או להעברה לבית כנסת אחר
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "הכל"],
              ["themes", "ערכות נושא"],
              ["gradients", "גרדיאנטים"],
            ] as const
          ).map(([what, label]) => (
            <Button
              key={what}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onExport(what, "file")}
            >
              <Download className="size-4" /> {label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onExport("all", "clipboard")}
          >
            העתקה ללוח
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">ייבוא</div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" /> בחירת קובץ
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) onImport(await file.text());
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="size-4" /> : null} {open ? "סגירה" : "או הדבקת טקסט"}
          </Button>
        </div>
        {open && (
          <div className="space-y-2">
            <textarea
              dir="ltr"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              aria-label="תוכן הקובץ לייבוא"
              placeholder='{"kind":"shul-hub-tv-design", …}'
              className="w-full rounded-md border bg-background p-2 font-mono text-xs"
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" size="sm" disabled={!text.trim()}>
                  ייבוא
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>לייבא את העיצובים מהקובץ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    הערכות והגרדיאנטים יתווספו למה שקיים, בלי למחוק כלום. שם שכבר תפוס יקבל מספר.
                    הכל נשאר טיוטה עד "שמור ושדר".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      onImport(text);
                      setText("");
                    }}
                  >
                    ייבוא
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </div>
  );
}
