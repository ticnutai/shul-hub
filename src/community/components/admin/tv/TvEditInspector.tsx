import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Eye,
  EyeOff,
  Globe,
  Minus,
  Move,
  MousePointerClick,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  EDITABLE,
  FAMILY_PREFIX,
  familyKey,
  isHidden,
  resolveElementStyle,
  setElementStyle,
  setHidden,
  setText,
  STYLE_FAMILIES,
  styleTargetKey,
  toggleFlip,
} from "@/tv/boardEdit";
import type { ElementStyle, FlipArea, RecordTable, TvConfig } from "@/tv/config";
import { getTheme, isSafeCssValue } from "@/tv/themes";
import type { BoardData } from "@/tv/useBoardData";
import { moveAnnouncement, withRecordEdit } from "./tvRecords";

/**
 * The form for whatever the admin clicked on the board. Every change goes
 * into the editor's draft (undo/redo, discard) and reaches the screens only
 * with "שמור ושדר".
 */

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

const FLIP_LABELS: Record<FlipArea, string> = {
  header: "החלפת צד: שם בית הכנסת ↔ שעון",
  prayer: "החלפת צד: מניינים ↔ זמני היום",
  learning: "היפוך סדר הכרטיסים",
};

const RECORD_RE = /^(ann|shiur|minyan):([0-9a-f-]{8,})(?::([a-z_]+))?$/i;
const TABLE_OF = { ann: "announcements", shiur: "shiurim", minyan: "minyanim" } as const;
const FIELD_LABELS: Record<string, string> = {
  title: "כותרת",
  body: "תוכן",
  teacher: "מגיד השיעור",
  label: "שם המניין",
};
const KIND_LABELS = { ann: "מודעה", shiur: "שיעור", minyan: "מניין" } as const;

export function TvEditInspector({
  selected,
  config,
  data,
  onEdit,
  onSelect,
}: {
  selected: string | null;
  config: TvConfig;
  data: BoardData;
  onEdit: Edit;
  onSelect: (key: string | null) => void;
}) {
  const hiddenList = [
    ...config.hidden,
    ...(!config.header.parasha ? ["header.parasha"] : []),
    ...(!config.header.dafYomi ? ["header.daf"] : []),
    ...(!config.header.logo ? ["header.logo"] : []),
    ...(!config.ticker.enabled && config.ticker.text ? ["ticker"] : []),
  ];

  return (
    <div className="rounded-xl border-2 border-primary/40 bg-card p-3 shadow-sm" dir="rtl">
      {selected ? (
        <Selected
          key={selected}
          k={selected}
          config={config}
          data={data}
          onEdit={onEdit}
          onClose={() => onSelect(null)}
        />
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MousePointerClick className="size-4 shrink-0" />
          לחצו על כל טקסט או אזור בלוח כדי לערוך, להסתיר או להזיז אותו. זה עובד בכל אחד מהמכשירים
          שלמעלה.
        </p>
      )}

      {hiddenList.length > 0 && (
        <div className="mt-3 border-t pt-2">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            מוסתרים מהלוח ({hiddenList.length}) · לחיצה מחזירה
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hiddenList.map((k) => (
              <button
                key={k}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs hover:bg-secondary"
                onClick={() =>
                  onEdit(`hide:${k}`, (c) =>
                    k === "ticker"
                      ? { ...c, ticker: { ...c.ticker, enabled: true } }
                      : setHidden(c, k, false),
                  )
                }
              >
                <Eye className="size-3" /> {describeKey(k, data)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Human name of an element key, for the hidden list and the inspector title. */
function describeKey(key: string, data: BoardData): string {
  if (EDITABLE[key]) return EDITABLE[key].label;
  const m = key.match(RECORD_RE);
  if (!m) return key;
  const kind = m[1] as keyof typeof KIND_LABELS;
  const row = findRow(data, kind, m[2]);
  const name = row ? String(row.title ?? row.label ?? "") : "";
  return `${KIND_LABELS[kind]}${name ? `: ${name.slice(0, 40)}` : ""}${
    m[3] ? ` · ${FIELD_LABELS[m[3]] ?? m[3]}` : ""
  }`;
}

function findRow(
  data: BoardData,
  kind: "ann" | "shiur" | "minyan",
  id: string,
): Record<string, unknown> | undefined {
  const rows =
    kind === "ann" ? data.announcements : kind === "shiur" ? data.shiurim : data.minyanim;
  return (rows ?? []).find((r) => r.id === id) as Record<string, unknown> | undefined;
}

function Selected({
  k,
  config,
  data,
  onEdit,
  onClose,
}: {
  k: string;
  config: TvConfig;
  data: BoardData;
  onEdit: Edit;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
          עריכה
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{describeKey(k, data)}</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="סגירה"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>
      {EDITABLE[k] ? (
        <BoardElement k={k} config={config} data={data} onEdit={onEdit} />
      ) : (
        <RecordElement k={k} config={config} data={data} onEdit={onEdit} onClose={onClose} />
      )}
      <ElementLook k={k} config={config} onEdit={onEdit} />
    </div>
  );
}

/* ------------------------------------------ size, colour and position -- */

function NumStep({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
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
        className="size-7"
        aria-label={`הקטנת ${label}`}
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
      >
        <Minus className="size-3.5" />
      </Button>
      <span
        className="min-w-12 px-1 text-center text-xs tabular-nums"
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
      >
        {format(value)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={`הגדלת ${label}`}
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

/**
 * The look of the selected element on its own: text size, colour and a
 * nudge from its natural place. Stored per element in tv_config.styles and
 * rendered the same way on the TV (boardEdit.elementStyleCss). Dragging the
 * element in the preview edits the same x / y.
 */
function ElementLook({ k, config, onEdit }: { k: string; config: TvConfig; onEdit: Edit }) {
  // Which entry the controls write to: this element, or its family.
  const target = styleTargetKey(config, k);
  const fk = familyKey(k);
  const familyLabel = fk ? STYLE_FAMILIES[fk.slice(FAMILY_PREFIX.length)] : null;
  const onFamily = target === fk;
  const style = config.styles[target];
  // What the board actually shows here (family rule + this element's own).
  const effective = resolveElementStyle(config, k);
  const themeName = getTheme(config.theme, config.customThemes).name;
  const inherited =
    !onFamily && fk && config.styles[fk] ? STYLE_FAMILIES[fk.slice(FAMILY_PREFIX.length)] : null;

  /** Moves the styling between "this element" and "all of its kind". */
  const setScope = (toFamily: boolean) =>
    onEdit(`style:scope:${k}`, (c) => {
      if (!fk) return c;
      const from = toFamily ? k : fk;
      const to = toFamily ? fk : k;
      const moving = c.styles[from];
      if (!moving) return { ...c, styles: { ...c.styles, [to]: c.styles[to] ?? {} } };
      const styles = { ...c.styles, [to]: { ...c.styles[to], ...moving } };
      delete styles[from];
      return { ...c, styles };
    });
  const scale = effective?.scale ?? 1;
  const [colorText, setColorText] = useState(effective?.color ?? "");
  useEffect(() => setColorText(effective?.color ?? ""), [effective?.color]);
  const set = (patch: Partial<ElementStyle>, group = "look") =>
    onEdit(`style:${group}:${k}`, (c) => setElementStyle(c, styleTargetKey(c, k), patch));
  const changed = Boolean(style && Object.keys(style).filter((f) => f !== "theme").length);
  const isHex = /^#[0-9a-f]{6}$/i.test(effective?.color ?? "");
  const bgHex = /^#[0-9a-f]{6}$/i.test(effective?.bg ?? "");
  const [step, setStep] = useState(1);
  // Moves read the latest draft, so a held joystick or key accumulates.
  const nudge = (dx: number, dy: number) =>
    onEdit(`style:pos:${k}`, (c) => {
      const t = styleTargetKey(c, k);
      const cur = c.styles[t];
      const clamp = (v: number) => Math.round(Math.min(50, Math.max(-50, v)) * 10) / 10;
      return setElementStyle(c, t, { x: clamp((cur?.x ?? 0) + dx), y: clamp((cur?.y ?? 0) + dy) });
    });

  // Keyboard: arrows move the selected element (Shift: 4x), unless typing.
  const nudgeRef = useRef(nudge);
  nudgeRef.current = nudge;
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      const d = stepRef.current * (e.shiftKey ? 4 : 1);
      const move: Record<string, [number, number]> = {
        ArrowLeft: [-d, 0],
        ArrowRight: [d, 0],
        ArrowUp: [0, -d],
        ArrowDown: [0, d],
      };
      const m = move[e.key];
      if (!m) return;
      e.preventDefault();
      nudgeRef.current(m[0], m[1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Move className="size-3.5" /> עיצוב הרכיב הזה בלבד
        {changed && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ms-auto h-7 text-xs"
            onClick={() =>
              onEdit(`style:reset:${k}`, (c) => setElementStyle(c, styleTargetKey(c, k), null))
            }
          >
            <RotateCcw className="size-3.5" /> {onFamily ? `איפוס ${familyLabel}` : "איפוס העיצוב"}
          </Button>
        )}
      </div>

      {/* what this edit applies to: one element or its whole kind, and in
          which themes - the two questions that keep a board tidy */}
      <div className="space-y-1.5 rounded-md bg-muted/50 p-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span className="font-medium">חל על:</span>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name={`scope-${k}`}
              checked={!onFamily}
              onChange={() => setScope(false)}
            />
            הרכיב הזה בלבד
          </label>
          {familyLabel && (
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name={`scope-${k}`}
                checked={onFamily}
                onChange={() => setScope(true)}
              />
              {familyLabel}
            </label>
          )}
          {!familyLabel && (
            <span className="text-muted-foreground">(רכיב יחיד בלוח - אין רכיבים דומים)</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span className="font-medium">בערכות נושא:</span>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name={`theme-scope-${k}`}
              checked={!style?.theme}
              onChange={() => set({ theme: undefined }, "theme-scope")}
            />
            בכולן
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name={`theme-scope-${k}`}
              checked={Boolean(style?.theme)}
              onChange={() => set({ theme: config.theme }, "theme-scope")}
            />
            רק ב״{themeName}״
          </label>
        </div>
        <p className="text-[11px] leading-tight text-muted-foreground">
          השינוי מוחל בכל המסכים - טלוויזיה, מחשב, לפטופ, טאבלט ונייד - ובכל הפריסות.
        </p>
        {inherited && (
          <p className="text-[11px] leading-tight text-amber-700 dark:text-amber-400">
            לרכיב הזה יש גם עיצוב מ״{inherited}״. מה שנקבע כאן גובר עליו.
          </p>
        )}
        {style?.theme && style.theme !== config.theme && (
          <p className="text-[11px] leading-tight text-amber-700 dark:text-amber-400">
            העיצוב הזה מוגדר לערכה אחרת, ולכן אינו מוצג כרגע.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          גודל טקסט
          <NumStep
            label="גודל טקסט של הרכיב"
            value={Math.round(scale * 100)}
            min={50}
            max={200}
            step={5}
            format={(v) => `${v}%`}
            onChange={(v) => set({ scale: v / 100 }, "scale")}
          />
        </label>
        <label className="flex items-center gap-2">
          צבע
          <input
            type="color"
            aria-label="צבע הרכיב"
            value={isHex ? effective!.color! : "#ffffff"}
            onChange={(e) => set({ color: e.target.value }, "color")}
            className="size-8 cursor-pointer rounded border bg-transparent p-0.5"
          />
          <Input
            dir="ltr"
            aria-label="צבע הרכיב (ערך)"
            value={colorText}
            placeholder="של הערכה"
            className={`h-8 w-28 font-mono text-xs ${
              colorText && !isSafeCssValue(colorText) ? "border-destructive" : ""
            }`}
            onChange={(e) => {
              setColorText(e.target.value);
              if (e.target.value === "" || isSafeCssValue(e.target.value))
                set({ color: e.target.value.trim() || undefined }, "color");
            }}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          משקל
          <select
            aria-label="עובי הגופן של הרכיב"
            value={effective?.weight ?? ""}
            onChange={(e) =>
              set({ weight: e.target.value ? Number(e.target.value) : undefined }, "weight")
            }
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">כמו בעיצוב</option>
            <option value="300">דק</option>
            <option value="400">רגיל</option>
            <option value="600">בינוני</option>
            <option value="800">מודגש</option>
            <option value="900">שחור</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          רקע
          <input
            type="color"
            aria-label="צבע רקע לרכיב"
            value={bgHex ? effective!.bg! : "#000000"}
            onChange={(e) => set({ bg: e.target.value }, "bg")}
            className="size-8 cursor-pointer rounded border bg-transparent p-0.5"
          />
          {effective?.bg && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-xs"
              onClick={() => set({ bg: undefined }, "bg")}
            >
              בלי רקע
            </Button>
          )}
        </label>
        <label className="flex items-center gap-2">
          שקיפות
          <NumStep
            label="אטימות הרכיב"
            value={Math.round((effective?.opacity ?? 1) * 100)}
            min={15}
            max={100}
            step={5}
            format={(v) => `${v}%`}
            onChange={(v) => set({ opacity: v / 100 }, "opacity")}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Joystick onNudge={nudge} step={step} onReset={() => set({ x: 0, y: 0 }, "pos")} />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            מיקום:
            <span className="font-mono text-xs tabular-nums" aria-live="polite">
              {effective?.x ?? 0}% , {effective?.y ?? 0}%
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            צעד:
            {[0.5, 1, 5].map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={step === s ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => setStep(s)}
              >
                {s}%
              </Button>
            ))}
          </div>
          <p className="max-w-56 text-xs text-muted-foreground">
            גררו את הכפתור שבמרכז הג׳ויסטיק (רחוק יותר = מהר יותר), לחצו על החצים, השתמשו בחצי
            המקלדת (Shift = צעד גדול) או גררו את הרכיב עצמו בלוח. ההזזה באחוזי מסך, כך שהיא נכונה
            בכל גודל מסך.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * A joystick for moving the selected element: drag the knob and the element
 * glides in that direction - the further from the centre, the faster - and
 * the knob springs back on release. The arrows step once per click (and keep
 * stepping while held); the centre resets the position.
 */
function Joystick({
  onNudge,
  step,
  onReset,
}: {
  onNudge: (dx: number, dy: number) => void;
  step: number;
  onReset: () => void;
}) {
  const RADIUS = 34;
  const MAX_SPEED = 18; // % of the screen per second at full deflection
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const knobRef = useRef(knob);
  const nudgeRef = useRef(onNudge);
  nudgeRef.current = onNudge;
  const frame = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const stopLoop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };
  useEffect(() => stopLoop, []);

  const loop = (last: number) => (t: number) => {
    const dt = Math.min(0.1, (t - last) / 1000);
    const { x, y } = knobRef.current;
    if (x || y) nudgeRef.current((x / RADIUS) * MAX_SPEED * dt, (y / RADIUS) * MAX_SPEED * dt);
    frame.current = requestAnimationFrame(loop(t));
  };

  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer is already gone; the drag still works without capture */
    }
    origin.current = { x: e.clientX, y: e.clientY };
    stopLoop();
    frame.current = requestAnimationFrame(loop(performance.now()));
  };
  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!origin.current) return;
    let x = e.clientX - origin.current.x;
    let y = e.clientY - origin.current.y;
    const len = Math.hypot(x, y);
    if (len > RADIUS) {
      x = (x / len) * RADIUS;
      y = (y / len) * RADIUS;
    }
    knobRef.current = { x, y };
    setKnob({ x, y });
  };
  const onUp = () => {
    origin.current = null;
    knobRef.current = { x: 0, y: 0 };
    setKnob({ x: 0, y: 0 });
    stopLoop();
  };

  // Arrow buttons: one step per click, repeating while held.
  const repeat = useRef<number | null>(null);
  const hold = (dx: number, dy: number) => ({
    onPointerDown: () => {
      nudgeRef.current(dx * step, dy * step);
      repeat.current = window.setInterval(() => nudgeRef.current(dx * step, dy * step), 120);
    },
    onPointerUp: () => repeat.current !== null && window.clearInterval(repeat.current),
    onPointerLeave: () => repeat.current !== null && window.clearInterval(repeat.current),
  });
  const arrow =
    "absolute grid size-8 place-items-center rounded-full bg-background/90 text-foreground shadow ring-1 ring-border hover:bg-secondary";

  return (
    <div
      className="relative size-36 shrink-0 select-none rounded-full bg-gradient-to-b from-muted to-muted/40 ring-1 ring-border"
      role="group"
      aria-label="ג׳ויסטיק להזזת הרכיב"
    >
      <button
        type="button"
        aria-label="הזזה למעלה"
        className={`${arrow} left-1/2 top-1 -translate-x-1/2`}
        {...hold(0, -1)}
      >
        <ArrowUp className="size-4" />
      </button>
      <button
        type="button"
        aria-label="הזזה למטה"
        className={`${arrow} bottom-1 left-1/2 -translate-x-1/2`}
        {...hold(0, 1)}
      >
        <ArrowDown className="size-4" />
      </button>
      <button
        type="button"
        aria-label="הזזה שמאלה"
        className={`${arrow} left-1 top-1/2 -translate-y-1/2`}
        {...hold(-1, 0)}
      >
        <ArrowLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label="הזזה ימינה"
        className={`${arrow} right-1 top-1/2 -translate-y-1/2`}
        {...hold(1, 0)}
      >
        <ArrowRight className="size-4" />
      </button>
      <button
        type="button"
        aria-label="ידית הג׳ויסטיק - גררו כדי להזיז; לחיצה כפולה מאפסת את המיקום"
        title="גררו כדי להזיז · לחיצה כפולה: חזרה למקום המקורי"
        className="absolute left-1/2 top-1/2 grid size-12 cursor-grab touch-none place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/25 active:cursor-grabbing"
        style={{
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
          transition: origin.current ? "none" : "transform 160ms ease-out",
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={onReset}
      >
        <Crosshair className="size-5" />
      </button>
    </div>
  );
}

/* --------------------------------------------- board wording and layout -- */

function BoardElement({
  k,
  config,
  data,
  onEdit,
}: {
  k: string;
  config: TvConfig;
  data: BoardData;
  onEdit: Edit;
}) {
  const spec = EDITABLE[k];
  const isTicker = k === "ticker";
  const siteValue = spec.siteField ? String(data.settings?.[spec.siteField] ?? "") : "";
  const fallback = spec.siteField ? siteValue : spec.text ?? "";
  const value = isTicker ? config.ticker.text : config.texts[k] ?? fallback;
  const overridden = !isTicker && config.texts[k] !== undefined && config.texts[k] !== fallback;
  const hidden = isTicker ? !config.ticker.enabled : isHidden(config, k);
  const Field = spec.multiline ? Textarea : Input;

  const change = (v: string) =>
    onEdit(`txt:${k}`, (c) =>
      isTicker
        ? { ...c, ticker: { enabled: v.trim() !== "", text: v.slice(0, 400) } }
        : setText(c, k, v === fallback ? null : v),
    );

  return (
    <div className="space-y-3">
      {spec.text !== undefined && (
        <div className="space-y-1.5">
          <Field
            value={value}
            dir="rtl"
            aria-label={spec.label}
            placeholder={fallback || "טקסט"}
            onChange={(e: { target: { value: string } }) => change(e.target.value)}
            className={spec.multiline ? "min-h-20" : undefined}
          />
          <p className="text-xs text-muted-foreground">
            {spec.siteField
              ? 'משנה רק את הלוח. כדי לשנות גם באתר - הכפתור "גם באתר".'
              : isTicker
              ? "שורה שרצה בתחתית המסך. (התנועה הרציפה מעמיסה על מעבד הקופסה.)"
              : "משנה את הנוסח בלוח בלבד."}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {spec.hideable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onEdit(`hide:${k}`, (c) =>
                isTicker
                  ? { ...c, ticker: { ...c.ticker, enabled: hidden } }
                  : setHidden(c, k, !hidden),
              )
            }
          >
            {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}{" "}
            {hidden ? "הצגה בלוח" : "הסתרה מהלוח"}
          </Button>
        )}
        {spec.flip && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(`flip:${spec.flip}`, (c) => toggleFlip(c, spec.flip!))}
          >
            <ArrowLeftRight className="size-4" /> {FLIP_LABELS[spec.flip]}
          </Button>
        )}
        {overridden && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(`txt:${k}`, (c) => setText(c, k, null))}
          >
            <RotateCcw className="size-4" /> חזרה לנוסח המקורי
          </Button>
        )}
        {spec.siteField && data.settings && overridden && value.trim() && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="השם יתעדכן בכל האתר, והלוח יציג אותו משם"
            onClick={() =>
              onEdit(`site:${k}`, (c) =>
                setText(
                  withRecordEdit(c, {
                    table: "settings",
                    id: String(data.settings!.id),
                    field: spec.siteField!,
                    value: value.trim(),
                  }),
                  k,
                  null,
                ),
              )
            }
          >
            <Globe className="size-4" /> גם באתר
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ content records -- */

function RecordElement({
  k,
  config,
  data,
  onEdit,
  onClose,
}: {
  k: string;
  config: TvConfig;
  data: BoardData;
  onEdit: Edit;
  onClose: () => void;
}) {
  const m = k.match(RECORD_RE);
  if (!m) return <p className="text-sm text-muted-foreground">אי אפשר לערוך את הרכיב הזה.</p>;
  const kind = m[1] as keyof typeof TABLE_OF;
  const id = m[2];
  const field = m[3];
  const table: RecordTable = TABLE_OF[kind];
  const row = findRow(data, kind, id);
  if (!row) return <p className="text-sm text-muted-foreground">הפריט כבר לא קיים.</p>;

  const elementKey = `${kind}:${id}`;
  const hidden = config.hidden.includes(elementKey);
  const multiline = field === "body";
  const Field = multiline ? Textarea : Input;
  const ordered = (data.announcements ?? []).filter((a) => !config.hidden.includes(`ann:${a.id}`));
  const pos = ordered.findIndex((a) => a.id === id);

  return (
    <div className="space-y-3">
      {field && (
        <div className="space-y-1.5">
          <Field
            value={String(row[field] ?? "")}
            dir="rtl"
            aria-label={FIELD_LABELS[field] ?? field}
            onChange={(e: { target: { value: string } }) =>
              onEdit(`rec:${k}`, (c) =>
                withRecordEdit(c, {
                  table,
                  id,
                  field,
                  value: e.target.value.slice(0, multiline ? 4000 : 200),
                }),
              )
            }
            className={multiline ? "min-h-28" : undefined}
          />
          <p className="text-xs text-muted-foreground">
            זה אותו {KIND_LABELS[kind]} שמופיע באתר: השינוי יחול גם שם, בלחיצה על "שמור ושדר".
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onEdit(`hide:${elementKey}`, (c) => setHidden(c, elementKey, !hidden))}
        >
          <EyeOff className="size-4" /> הסתרה מהלוח בלבד
        </Button>
        {kind === "ann" && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pos <= 0}
              onClick={() =>
                onEdit(`move:${id}`, (c) =>
                  moveAnnouncement(c, data.announcements ?? [], ordered, id, -1),
                )
              }
            >
              <ArrowUp className="size-4" /> הקדמה
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pos < 0 || pos >= ordered.length - 1}
              onClick={() =>
                onEdit(`move:${id}`, (c) =>
                  moveAnnouncement(c, data.announcements ?? [], ordered, id, 1),
                )
              }
            >
              <ArrowDown className="size-4" /> העברה אחורה
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="size-4" /> מחיקת המודעה
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>למחוק את המודעה לגמרי?</AlertDialogTitle>
                  <AlertDialogDescription>
                    המודעה "{String(row.title ?? "")}" תימחק מהאתר ומכל המסכים בלחיצה על "שמור
                    ושדר". עד אז אפשר לבטל (Ctrl+Z). אם רוצים רק להוריד אותה מהלוח - "הסתרה מהלוח
                    בלבד".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      onEdit(`del:${id}`, (c) =>
                        withRecordEdit(c, { table: "announcements", id, delete: true }),
                      );
                      onClose();
                    }}
                  >
                    מחיקה
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
      {kind === "minyan" && (
        <p className="text-xs text-muted-foreground">
          שעות המניין נקבעות בלשונית "מניינים" (שעה קבועה או לפי זמני היום).
        </p>
      )}
    </div>
  );
}
