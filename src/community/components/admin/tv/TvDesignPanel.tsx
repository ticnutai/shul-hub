import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  Check,
  ExternalLink,
  ImagePlus,
  Minus,
  Pencil,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
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
  ALERT_EVENT_LABELS,
  DEFAULT_TV_CONFIG,
  SLIDE_KIND_LABELS,
  SLIDE_LAYOUTS,
  normalizeTvConfig,
  type AlertEvent,
  type TvConfig,
} from "@/tv/config";
import { getTheme, isSafeCssValue, THEME_VAR_LABELS, THEME_VARS, TV_FONTS, TV_THEMES, type ThemeVar } from "@/tv/themes";
import { useDayZmanim } from "@/tv/useBoardData";
import { SlideStrip, TvDeviceStudio } from "./TvPreview";
import { useBroadcastDraft } from "./tvDraftChannel";
import { TvEditInspector } from "./TvEditInspector";
import { commitRecordEdits } from "./tvRecords";
import { useQueryClient } from "@tanstack/react-query";
import { useTvSlides } from "./tvPreviewData";
import { uploadTvImage, useTvConfig, useTvDevices, deviceHealth } from "./tvAdminData";

/**
 * Live editor for the board's look and content rotation.
 *
 * Every control edits one draft TvConfig; the preview renders that draft
 * immediately with the TV's own components. Nothing reaches a TV until
 * "שמור ושדר" - a preview is never persisted silently. Undo/redo cover the
 * draft; consecutive edits of the same field (dragging a colour picker)
 * collapse into one history step so undo stays meaningful.
 */

/* ---------------------------------------------------------------- draft -- */

interface DraftState {
  past: TvConfig[];
  present: TvConfig;
  future: TvConfig[];
  lastKey: string | null;
  lastAt: number;
}

type DraftAction =
  | { type: "load"; config: TvConfig }
  | { type: "edit"; key: string; update: (c: TvConfig) => TvConfig }
  | { type: "undo" }
  | { type: "redo" };

const COALESCE_MS = 800;

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "load":
      return { past: [], present: action.config, future: [], lastKey: null, lastAt: 0 };
    case "edit": {
      const next = action.update(state.present);
      if (JSON.stringify(next) === JSON.stringify(state.present)) return state;
      const now = Date.now();
      const coalesce = action.key === state.lastKey && now - state.lastAt < COALESCE_MS;
      return {
        past: coalesce ? state.past : [...state.past.slice(-60), state.present],
        present: next,
        future: [],
        lastKey: action.key,
        lastAt: now,
      };
    }
    case "undo": {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], lastKey: null, lastAt: 0 };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return { past: [...state.past, state.present], present: next, future: rest, lastKey: null, lastAt: 0 };
    }
  }
}

/* --------------------------------------------------------- small inputs -- */

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="text-base font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/** Number with visible −/+ and ArrowUp/ArrowDown (the "spinner" users asked for). */
function Stepper({
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
    <div className="inline-flex items-center rounded-md border bg-background" role="group" aria-label={label}>
      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`הקטנת ${label}`} onClick={() => onChange(clamp(value - step))} disabled={value <= min}>
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
      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`הגדלת ${label}`} onClick={() => onChange(clamp(value + step))} disabled={value >= max}>
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

function ColorField({
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
      <input
        type="color"
        aria-label={label}
        value={isHex ? value : "#000000"}
        disabled={!isHex}
        title={isHex ? label : "ערך עם שקיפות - עריכה בטקסט"}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 shrink-0 cursor-pointer rounded border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
      />
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
        aria-label={`החזרת ${label} לערך של ערכת הנושא`}
        title={`ערך הערכה: ${themeValue}`}
        disabled={!overridden}
        onClick={onReset}
      >
        <RotateCcw className="size-3.5" />
      </Button>
    </div>
  );
}

/* ---------------------------------------------------------------- panel -- */

export function TvDesignPanel() {
  const saved = useTvConfig();
  const devices = useTvDevices();
  const [state, dispatch] = useReducer(draftReducer, {
    past: [],
    present: DEFAULT_TV_CONFIG,
    future: [],
    lastKey: null,
    lastAt: 0,
  });
  const draft = state.present;
  const loadedRef = useRef(false);
  const savedJson = saved.data ? JSON.stringify(saved.data.config) : null;
  const dirty = savedJson !== null && JSON.stringify(draft) !== savedJson;

  // Load the saved config into the draft once, and again after a save.
  useEffect(() => {
    if (saved.data && (!loadedRef.current || !dirty)) {
      loadedRef.current = true;
      dispatch({ type: "load", config: saved.data.config });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the saved row changes
  }, [savedJson]);

  // Unsaved edits must not vanish with a stray navigation.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Feeds /admin/tv-board?draft=1 open in another window of this browser.
  useBroadcastDraft(draft);

  const edit = useCallback((key: string, update: (c: TvConfig) => TvConfig) => dispatch({ type: "edit", key, update }), []);

  // Keyboard undo/redo while the panel is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ----------------------------------------------------------- preview -- */

  const [simulatedNow, setSimulatedNow] = useState<Date | null>(null);
  const board = useTvSlides(draft, simulatedNow);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  // Click-to-edit on the board itself (see boardEdit.ts / TvEditInspector).
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);
  const [cycle, setCycle] = useState(0);
  const index = Math.min(previewIndex, Math.max(board.slides.length - 1, 0));
  const current = board.slides[index];

  useEffect(() => {
    if (!autoplay || !current || board.slides.length < 2) return;
    const id = window.setTimeout(() => {
      setPreviewIndex((i) => (i + 1) % board.slides.length);
      setCycle((c) => c + 1);
    }, current.seconds * 1000);
    return () => window.clearTimeout(id);
  }, [autoplay, current, board.slides.length]);

  const zmanimToday = useDayZmanim(new Date(), board.data.settings);
  const showAlertExample = () => {
    const event = draft.alerts.events.find((e) => e !== "candle" && zmanimToday[e]) ?? "sunset";
    const at = zmanimToday[event as AlertEvent];
    const lead = draft.alerts.leadMinutes[draft.alerts.leadMinutes.length - 1] ?? 15;
    if (!at) return toast.error("אין זמן מתאים היום להדגמה");
    setSimulatedNow(new Date(at.getTime() - lead * 60_000 + 2000));
    window.setTimeout(() => setSimulatedNow(null), 12_000);
    toast.info(`מציג איך תיראה ההתראה ${lead} דקות לפני ${ALERT_EVENT_LABELS[event as AlertEvent]}`);
  };

  /* -------------------------------------------------------------- save -- */

  const approvedCount = (devices.data ?? []).filter((d) => d.approved).length;
  const onlineCount = (devices.data ?? []).filter((d) => d.approved && deviceHealth(d, Date.now()).online).length;

  const queryClient = useQueryClient();
  // Latest draft for the save below, which awaits: an edit made while it runs
  // must survive it.
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return; // a double click must not save twice
    setSaving(true);
    const snapshot = draft;
    try {
      // Content first (announcements, minyan names, the site name...): if a
      // row fails, nothing is broadcast and the draft keeps every change.
      const records = await commitRecordEdits(snapshot._records);
      if (records) {
        await Promise.all(
          ["announcements", "shiurim", "minyanim", "settings"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })),
        );
      }
      const clean = normalizeTvConfig(snapshot);
      await saved.save.mutateAsync(clean);
      const now = latestDraft.current;
      if (now === snapshot) {
        // The draft carried the content edits; start clean from what was saved.
        dispatch({ type: "load", config: clean });
      } else {
        // Edited meanwhile: keep those edits, minus the content already written.
        const done = new Set(snapshot._records ?? []);
        dispatch({ type: "load", config: { ...now, _records: (now._records ?? []).filter((r) => !done.has(r)) } });
      }
      toast.success(
        approvedCount
          ? `נשמר ושודר. ${onlineCount} מתוך ${approvedCount} מסכים מחוברים יתעדכנו עכשיו${
              onlineCount < approvedCount ? "; השאר יתעדכנו כשיתחברו" : ""
            }.`
          : "נשמר. מסכים שיצומדו יקבלו את העיצוב הזה.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const theme = getTheme(draft.theme);
  const [uploading, setUploading] = useState(false);
  const upload = async (files: FileList | null, into: "background" | "slideshow") => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const uploaded = await uploadTvImage(file);
        urls.push(uploaded.url);
        if (uploaded.lowRes)
          toast.warning(
            `"${file.name}" קטנה מדי לטלוויזיה (${uploaded.lowRes.width}×${uploaded.lowRes.height}) ותיראה מעט מטושטשת. לאיכות מלאה העלו תמונה ברוחב 1920 פיקסלים לפחות.`,
            { duration: 9000 },
          );
      }
      if (into === "background") edit("bg", (c) => ({ ...c, backgroundImage: urls[0] }));
      else
        edit("show", (c) => ({
          ...c,
          slideshow: { ...c.slideshow, images: [...c.slideshow.images, ...urls.map((url) => ({ url }))] },
          slides: c.slides.map((s) => (s.kind === "slideshow" ? { ...s, enabled: true } : s)),
        }));
      toast.success(urls.length > 1 ? `${urls.length} תמונות הועלו` : "התמונה הועלתה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
    }
  };

  if (saved.isLoading) return <p className="p-6 text-center text-muted-foreground">טוען את עיצוב הלוח…</p>;
  if (saved.error)
    return (
      <p className="p-6 text-center text-destructive">
        לא ניתן לטעון את הגדרות הלוח. ייתכן שהמיגרציה של מרכז הבקרה לא הורצה.
      </p>
    );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* ------------------------------------------------ preview column -- */}
      <div className="order-1 space-y-3 lg:order-2">
        <div className="lg:sticky lg:top-4 lg:space-y-3">
          <TvDeviceStudio
            {...board}
            config={draft}
            index={index}
            cycle={cycle}
            progress={0}
            paused={!autoplay}
            editing={editing}
            selected={selected}
            onSelect={setSelected}
          />
          {editing && (
            <div className="mt-3">
              <TvEditInspector selected={selected} config={draft} data={board.data} onEdit={edit} onSelect={setSelected} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={editing ? "default" : "outline"}
              size="sm"
              aria-pressed={editing}
              onClick={() => {
                setEditing((v) => !v);
                setSelected(null);
                setAutoplay(false);
              }}
            >
              <Pencil className="size-4" /> {editing ? "סיום עריכה בלוח" : "עריכה ישירה בלוח"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAutoplay((a) => !a)}>
              {autoplay ? <Pause className="size-4" /> : <Play className="size-4" />}
              {autoplay ? "עצירת הסבב" : "הפעלת סבב"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={showAlertExample} disabled={!draft.alerts.enabled}>
              <BellRing className="size-4" /> דוגמת התראת זמנים
            </Button>
            {simulatedNow && <span className="text-xs text-muted-foreground">מדמה את השעה {simulatedNow.toTimeString().slice(0, 5)}</span>}
            <span className="ms-auto flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                title="פותח את הלוח בחלון נפרד שמתעדכן בכל שינוי כאן, עוד לפני השמירה. אפשר לגרור אותו למסך שני או לטלוויזיה שמחוברת למחשב."
                onClick={() => window.open("/admin/tv-board?draft=1", "shul-tv-draft")}
              >
                <ExternalLink className="size-4" /> חלון חי (טיוטה)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                title="הלוח במסך מלא בעיצוב השמור, בדיוק כמו בטלוויזיות. מתאים גם כדי להשתמש במחשב כמסך תצוגה."
                onClick={() => window.open("/admin/tv-board", "_blank")}
              >
                <ExternalLink className="size-4" /> לוח במסך מלא
              </Button>
            </span>
          </div>
          <div className="mt-2">
            <SlideStrip
              slides={board.slides}
              index={index}
              onPick={(i) => {
                setPreviewIndex(i);
                setCycle((c) => c + 1);
              }}
            />
          </div>
        </div>
      </div>

      {/* ----------------------------------------------- controls column -- */}
      <div className="order-2 space-y-4 lg:order-1">
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur">
          <Button type="button" variant="ghost" size="icon" aria-label="ביטול (Ctrl+Z)" title="ביטול (Ctrl+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })}>
            <Undo2 className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="חזרה (Ctrl+Y)" title="חזרה (Ctrl+Y)" disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })}>
            <Redo2 className="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm" disabled={!dirty}>
                ביטול שינויים
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>לבטל את כל השינויים שלא נשמרו?</AlertDialogTitle>
                <AlertDialogDescription>התצוגה תחזור לעיצוב השמור, שהוא מה שמוצג כעת על המסכים.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>המשך לערוך</AlertDialogCancel>
                <AlertDialogAction onClick={() => saved.data && dispatch({ type: "load", config: saved.data.config })}>
                  בטל שינויים
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <span className="ms-auto text-xs text-muted-foreground">{dirty ? "יש שינויים שלא נשמרו" : "הכל שמור"}</span>
          <Button type="button" onClick={save} disabled={!dirty || saving}>
            {dirty ? <Save className="size-4" /> : <Check className="size-4" />}
            {saving ? "שומר…" : "שמור ושדר למסכים"}
          </Button>
        </div>

        <Section title="ערכת נושא" hint="בסיס הצבעים. ערכות בהירות מתאימות למסכי LCD; על מסך OLED עדיף כהה (מונע צריבה).">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TV_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={draft.theme === t.id}
                onClick={() => edit("theme", (c) => ({ ...c, theme: t.id, themeOverrides: {} }))}
                className={`overflow-hidden rounded-lg border text-right transition ${
                  draft.theme === t.id ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"
                }`}
              >
                <div
                  className="flex h-12 items-end gap-1 p-2"
                  style={{
                    background: `radial-gradient(ellipse at 20% 0%, ${t.vars["--tv-bg-b"]}, transparent 70%), ${t.vars["--tv-bg-a"]}`,
                  }}
                >
                  <span className="size-4 rounded-full" style={{ background: t.vars["--tv-accent"] }} />
                  <span className="size-4 rounded-full" style={{ background: t.vars["--tv-text"] }} />
                  <span className="size-4 rounded-full" style={{ background: t.vars["--tv-accent-2"] }} />
                </div>
                <div className="p-2">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-[11px] leading-tight text-muted-foreground">{t.description}</div>
                </div>
              </button>
            ))}
          </div>
          {Object.keys(draft.themeOverrides).length > 0 && (
            <p className="text-xs text-muted-foreground">בחירת ערכה אחרת מאפסת את התאמות הצבע שלמטה.</p>
          )}
        </Section>

        <Section title="גופן וגודל טקסט">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="tv-font">גופן</Label>
              <select
                id="tv-font"
                value={draft.font}
                onChange={(e) => edit("font", (c) => ({ ...c, font: e.target.value as TvConfig["font"] }))}
                className="block h-9 rounded-md border bg-background px-2 text-sm"
              >
                {TV_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>גודל טקסט</Label>
              <Stepper
                label="גודל טקסט"
                value={Math.round(draft.textScale * 100)}
                min={80}
                max={130}
                step={5}
                format={(v) => `${v}%`}
                onChange={(v) => edit("scale", (c) => ({ ...c, textScale: v / 100 }))}
              />
            </div>
          </div>
        </Section>

        <Section title="צבעים (עריכה חיה)" hint={`מתחיל מ"${theme.name}". כל שינוי מופיע מיד בתצוגה; ↺ מחזיר לערך הערכה.`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {THEME_VARS.map((v: ThemeVar) => (
              <ColorField
                key={v}
                label={THEME_VAR_LABELS[v]}
                value={draft.themeOverrides[v] ?? theme.vars[v]}
                themeValue={theme.vars[v]}
                overridden={v in draft.themeOverrides}
                onChange={(value) => edit(`color:${v}`, (c) => ({ ...c, themeOverrides: { ...c.themeOverrides, [v]: value } }))}
                onReset={() =>
                  edit(`reset:${v}`, (c) => {
                    const next = { ...c.themeOverrides };
                    delete next[v];
                    return { ...c, themeOverrides: next };
                  })
                }
              />
            ))}
          </div>
        </Section>

        <Section title="תמונת רקע" hint="אופציונלי. התמונה מוחשכת כדי שהטקסט יישאר קריא. היא מותאמת אוטומטית לאיכות המלאה של הטלוויזיה; מומלץ לפחות 1920×1080.">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
              <label className="cursor-pointer">
                <ImagePlus className="size-4" /> {draft.backgroundImage ? "החלפת תמונה" : "העלאת תמונה"}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files, "background")} />
              </label>
            </Button>
            {draft.backgroundImage && (
              <>
                <img src={draft.backgroundImage} alt="" className="h-10 w-16 rounded object-cover" />
                <Button type="button" variant="ghost" size="sm" onClick={() => edit("bg", (c) => ({ ...c, backgroundImage: null }))}>
                  <Trash2 className="size-4" /> הסרה
                </Button>
              </>
            )}
          </div>
          {draft.backgroundImage && (
            <div className="space-y-1">
              <Label>החשכה: {Math.round(draft.backgroundDim * 100)}%</Label>
              <Slider
                value={[draft.backgroundDim * 100]}
                min={0}
                max={95}
                step={5}
                onValueChange={([v]) => edit("dim", (c) => ({ ...c, backgroundDim: v / 100 }))}
                aria-label="החשכת תמונת הרקע"
              />
            </div>
          )}
        </Section>

        <Section title="שקופיות ופריסות" hint="הסדר, משך הזמן והפריסה של כל שקופית. החצים משנים סדר.">
          <ul className="space-y-2">
            {draft.slides.map((s, i) => (
              <li key={s.kind} className={`rounded-lg border p-3 ${s.enabled ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <Switch
                    checked={s.enabled}
                    aria-label={`הצגת ${SLIDE_KIND_LABELS[s.kind]}`}
                    onCheckedChange={(on) =>
                      edit(`slide-on:${s.kind}`, (c) => ({ ...c, slides: c.slides.map((x) => (x.kind === s.kind ? { ...x, enabled: on } : x)) }))
                    }
                  />
                  <span className="min-w-28 font-medium">{SLIDE_KIND_LABELS[s.kind]}</span>
                  <select
                    aria-label={`פריסת ${SLIDE_KIND_LABELS[s.kind]}`}
                    value={s.layout}
                    onChange={(e) =>
                      edit(`slide-layout:${s.kind}`, (c) => ({
                        ...c,
                        slides: c.slides.map((x) => (x.kind === s.kind ? { ...x, layout: e.target.value } : x)),
                      }))
                    }
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                  >
                    {SLIDE_LAYOUTS[s.kind].map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  {s.kind !== "slideshow" && (
                    <Stepper
                      label={`משך ${SLIDE_KIND_LABELS[s.kind]}`}
                      value={s.seconds}
                      min={5}
                      max={120}
                      step={1}
                      format={(v) => `${v} שנ׳`}
                      onChange={(v) =>
                        edit(`slide-sec:${s.kind}`, (c) => ({ ...c, slides: c.slides.map((x) => (x.kind === s.kind ? { ...x, seconds: v } : x)) }))
                      }
                    />
                  )}
                  <div className="ms-auto flex">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="הזזה למעלה"
                      disabled={i === 0}
                      onClick={() =>
                        edit("order", (c) => {
                          const slides = [...c.slides];
                          [slides[i - 1], slides[i]] = [slides[i], slides[i - 1]];
                          return { ...c, slides };
                        })
                      }
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="הזזה למטה"
                      disabled={i === draft.slides.length - 1}
                      onClick={() =>
                        edit("order", (c) => {
                          const slides = [...c.slides];
                          [slides[i], slides[i + 1]] = [slides[i + 1], slides[i]];
                          return { ...c, slides };
                        })
                      }
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                  </div>
                </div>
                {s.kind === "slideshow" && (
                  <p className="mt-2 text-xs text-muted-foreground">המשך נקבע לפי מספר התמונות × זמן לתמונה (בהגדרות המצגת).</p>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="שורת לימוד בראש המסך">
          <label className="flex items-center gap-3">
            <Switch checked={draft.header.parasha} onCheckedChange={(on) => edit("h-parasha", (c) => ({ ...c, header: { ...c.header, parasha: on } }))} />
            פרשת השבוע
          </label>
          <label className="flex items-center gap-3">
            <Switch checked={draft.header.dafYomi} onCheckedChange={(on) => edit("h-daf", (c) => ({ ...c, header: { ...c.header, dafYomi: on } }))} />
            הדף היומי
          </label>
        </Section>

        <Section title="התראות לפני סוף זמן" hint="ספירה לאחור בתחתית המסך, וכרטיס גדול בכל אחת מהדקות שנבחרו.">
          <label className="flex items-center gap-3">
            <Switch checked={draft.alerts.enabled} onCheckedChange={(on) => edit("al-on", (c) => ({ ...c, alerts: { ...c.alerts, enabled: on } }))} />
            התראות פעילות
          </label>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(Object.keys(ALERT_EVENT_LABELS) as AlertEvent[]).map((e) => (
              <label key={e} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={draft.alerts.events.includes(e)}
                  onChange={(ev) =>
                    edit(`al-ev:${e}`, (c) => ({
                      ...c,
                      alerts: {
                        ...c.alerts,
                        events: ev.target.checked ? [...c.alerts.events, e] : c.alerts.events.filter((x) => x !== e),
                      },
                    }))
                  }
                />
                {ALERT_EVENT_LABELS[e]}
              </label>
            ))}
          </div>
          <LeadMinutesEditor
            value={draft.alerts.leadMinutes}
            onChange={(leads) => edit("al-leads", (c) => ({ ...c, alerts: { ...c.alerts, leadMinutes: leads } }))}
          />
          <div className="flex items-center gap-3 text-sm">
            משך הצגת הכרטיס:
            <Stepper
              label="משך הצגת התראה"
              value={draft.alerts.popupSeconds}
              min={10}
              max={180}
              step={5}
              format={(v) => `${v} שנ׳`}
              onChange={(v) => edit("al-sec", (c) => ({ ...c, alerts: { ...c.alerts, popupSeconds: v } }))}
            />
          </div>
        </Section>

        <Section
          title="סרגל הודעה רץ"
          hint="טקסט שנע בתחתית המסך. שימו לב: אנימציה רציפה - בטלוויזיה החלשה נמדדה צריכת מעבד גבוהה (~45%) כל עוד הסרגל פעיל."
        >
          <label className="flex items-center gap-3">
            <Switch checked={draft.ticker.enabled} onCheckedChange={(on) => edit("tk-on", (c) => ({ ...c, ticker: { ...c.ticker, enabled: on } }))} />
            הצגת סרגל
          </label>
          <Textarea
            value={draft.ticker.text}
            maxLength={400}
            placeholder="למשל: ברוכים הבאים · שיעור העמוד היומי בכל יום ב-16:15"
            onChange={(e) => edit("tk-text", (c) => ({ ...c, ticker: { ...c.ticker, text: e.target.value } }))}
          />
        </Section>

        <Section title="מצגת תמונות" hint="תמונות מאירועים, מודעות מעוצבות, תרומות. יוצגו כשקופית נפרדת. כל תמונה מותאמת אוטומטית לחדות מרבית בטלוויזיה; מודעות עם טקסט עדיף להעלות כ-PNG.">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
              <label className="cursor-pointer">
                <ImagePlus className="size-4" /> {uploading ? "מעלה…" : "הוספת תמונות"}
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void upload(e.target.files, "slideshow")} />
              </label>
            </Button>
            <span className="flex items-center gap-2 text-sm">
              זמן לתמונה:
              <Stepper
                label="זמן לתמונה"
                value={draft.slideshow.secondsPerImage}
                min={3}
                max={60}
                step={1}
                format={(v) => `${v} שנ׳`}
                onChange={(v) => edit("sh-sec", (c) => ({ ...c, slideshow: { ...c.slideshow, secondsPerImage: v } }))}
              />
            </span>
          </div>
          {draft.slideshow.images.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {draft.slideshow.images.map((img, i) => (
                <li key={img.url + i} className="flex items-center gap-2 rounded-lg border p-2">
                  <img src={img.url} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
                  <Input
                    value={img.caption ?? ""}
                    placeholder="כיתוב (לא חובה)"
                    className="h-8 text-sm"
                    onChange={(e) =>
                      edit(`sh-cap:${i}`, (c) => ({
                        ...c,
                        slideshow: {
                          ...c.slideshow,
                          images: c.slideshow.images.map((x, j) => (j === i ? { ...x, caption: e.target.value || undefined } : x)),
                        },
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label="הסרת תמונה"
                    onClick={() =>
                      edit("sh-del", (c) => ({ ...c, slideshow: { ...c.slideshow, images: c.slideshow.images.filter((_, j) => j !== i) } }))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
              <RotateCcw className="size-4" /> איפוס לעיצוב ברירת המחדל
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>לאפס את כל העיצוב לברירת המחדל?</AlertDialogTitle>
              <AlertDialogDescription>
                ערכת הנושא, הצבעים, השקופיות וההתראות יחזרו להגדרות המקוריות בתצוגה המקדימה. שום דבר לא ישתנה במסכים עד
                שתלחצו "שמור ושדר".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={() => edit("reset-all", () => structuredClone(DEFAULT_TV_CONFIG))}>אפס</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function LeadMinutesEditor({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const [adding, setAdding] = useState("");
  const add = () => {
    const n = Number(adding);
    if (!Number.isInteger(n) || n < 1 || n > 180) return toast.error("הזינו מספר דקות בין 1 ל-180");
    onChange([...new Set([...value, n])].sort((a, b) => b - a).slice(0, 5));
    setAdding("");
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      התראה לפני:
      {value.map((m) => (
        <span key={m} className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-0.5">
          {m} דק׳
          <button type="button" aria-label={`הסרת התראה של ${m} דקות`} onClick={() => onChange(value.filter((x) => x !== m))} className="text-muted-foreground hover:text-foreground">
            ×
          </button>
        </span>
      ))}
      {value.length < 5 && (
        <span className="inline-flex items-center gap-1">
          <Input
            type="number"
            min={1}
            max={180}
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="h-8 w-20"
            aria-label="דקות להתראה נוספת"
          />
          <Button type="button" variant="outline" size="sm" onClick={add}>
            הוספה
          </Button>
        </span>
      )}
    </div>
  );
}

