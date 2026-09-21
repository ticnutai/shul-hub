import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  Check,
  ExternalLink,
  Expand,
  Maximize2,
  Minimize2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  allThemes,
  getTheme,
  isLightColor,
  isSafeCssValue,
  newCustomThemeId,
  newGradientId,
  THEME_VAR_LABELS,
  THEME_VARS,
  TV_FONTS,
  TV_THEMES,
  type ThemeVar,
  type TvTheme,
} from "@/tv/themes";
import { useDayZmanim } from "@/tv/useBoardData";
import { nextCandleLighting, SHABBAT_ART } from "@/tv/shabbat";
import { jerusalemWeekday, zmanimFor } from "@community/lib/minyan-time";
import { ShabbatPicture } from "@/tv/ShabbatScene";

/** The screen layouts, with a small sketch of each for the picker. */
const LAYOUT_CHOICES: Array<{
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
];

/**
 * The decorative dress of the board. Each option shows a miniature of what
 * it does - a frame, an arch, a parchment - rather than only a name.
 */


const CLOCK_CHOICES: Array<{ id: TvConfig["clockStyle"]; name: string }> = [
  { id: "digital", name: "ספרות" },
  { id: "analog", name: "שעון מחוגים" },
  { id: "both", name: "שניהם" },
];

const SCENE_INTERVALS = [10, 15, 20, 30, 45, 60, 120, 180, 300, 600, 900, 1200, 1800, 2700, 3600];
const intervalLabel = (s: number) =>
  s < 60 ? `${s} שניות` : s === 60 ? "דקה" : s < 3600 ? `${s / 60} דקות` : "שעה";
import { FRAME_RADIUS_MAX, type FrameShape } from "@/tv/config";
import { FRAME_CHOICES, SKIN_CHOICES } from "./tvChoices";
import { SlideStrip, TvDeviceStudio } from "./TvPreview";
import { useDraftSync } from "./tvDraftChannel";
import { StudioPanel } from "./StudioPanel";
import { FigmaImport } from "./FigmaImport";
import { GradientStudio, TransferPanel } from "./GradientStudio";
import { buildExport, exportFileName, mergeImport, parseImport } from "@/tv/transfer";
import { isAllowedEdit } from "@/tv/records";
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
  /** When the draft was last changed here or in another window (0 = as loaded). */
  editedAt: number;
}

type DraftAction =
  | { type: "load"; config: TvConfig }
  | { type: "edit"; key: string; update: (c: TvConfig) => TvConfig }
  | { type: "undo" }
  | { type: "redo" }
  /** A newer draft from the other editor window (tvDraftChannel). */
  | { type: "adopt"; config: TvConfig; editedAt: number };

const COALESCE_MS = 800;

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "load":
      return {
        past: [],
        present: action.config,
        future: [],
        lastKey: null,
        lastAt: 0,
        editedAt: 0,
      };
    case "adopt":
      if (JSON.stringify(action.config) === JSON.stringify(state.present))
        return { ...state, editedAt: action.editedAt };
      return {
        past: [...state.past.slice(-60), state.present],
        present: action.config,
        future: [],
        lastKey: null,
        lastAt: 0,
        editedAt: action.editedAt,
      };
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
        editedAt: now,
      };
    }
    case "undo": {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        lastKey: null,
        lastAt: 0,
        editedAt: Date.now(),
      };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
        lastKey: null,
        lastAt: 0,
        editedAt: Date.now(),
      };
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

/**
 * `studio`: the live editor window (/admin/tv-board?draft=1) - the board on
 * the whole screen, with every control of this panel in a floating panel
 * over it. It is the same editor (one draft, one save), kept in step with an
 * editor open on the admin page through tvDraftChannel.
 */
export function TvDesignPanel({ studio = false }: { studio?: boolean } = {}) {
  const saved = useTvConfig();
  const devices = useTvDevices();
  const [state, dispatch] = useReducer(draftReducer, {
    past: [],
    present: DEFAULT_TV_CONFIG,
    future: [],
    lastKey: null,
    lastAt: 0,
    editedAt: 0,
  });
  const draft = state.present;
  const loadedRef = useRef(false);
  const savedJson = saved.data ? JSON.stringify(saved.data.config) : null;
  const dirty = savedJson !== null && JSON.stringify(draft) !== savedJson;

  // Load the saved config into the draft once, and again after a save.
  // A draft already adopted from the other editor window (it can arrive
  // before the saved row does) is newer than the saved row: keep it.
  const editedAtRef = useRef(0);
  editedAtRef.current = state.editedAt;
  useEffect(() => {
    if (saved.data && (!loadedRef.current || !dirty)) {
      const first = !loadedRef.current;
      loadedRef.current = true;
      if (first && editedAtRef.current > 0) return;
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

  // In step with the other editor window of this browser (admin page <-> live window).
  const queryClientForSync = useQueryClient();
  const sync = useDraftSync(draft, state.editedAt, {
    onRemoteDraft: (config, editedAt) => {
      // Validated like any stored config; content edits ride along, whitelisted.
      const records = Array.isArray(config?._records)
        ? config._records.filter(isAllowedEdit).slice(0, 500)
        : [];
      dispatch({
        type: "adopt",
        config: { ...normalizeTvConfig(config), _records: records },
        editedAt,
      });
    },
    onSaved: () => void queryClientForSync.invalidateQueries({ queryKey: ["tv_config_admin"] }),
  });

  const edit = useCallback(
    (key: string, update: (c: TvConfig) => TvConfig) => dispatch({ type: "edit", key, update }),
    [],
  );

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
  // The live window opens ready to click on the board.
  const [editing, setEditing] = useState(studio);
  const [selected, setSelected] = useState<string | null>(null);
  // Esc in the live window: drop the selection first; with nothing selected,
  // stop editing on the board (clicks then work on it normally).
  useEffect(() => {
    if (!studio) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("[role=alertdialog], [role=menu]")) return;
      if (selected) setSelected(null);
      else setEditing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studio, selected]);
  // A bigger preview: "wide" stacks the controls under a full-width preview;
  // fullscreen puts the preview column alone on the whole screen.
  const [wide, setWide] = useState(false);
  /**
   * A palette sent by the Figma plugin: it arrives in the URL fragment, is
   * read once, and the address is cleaned so a refresh does not import it
   * again. The tools tab opens by itself so the admin lands on the wizard.
   */
  const [figmaHandoff] = useState(() => {
    if (typeof window === "undefined" || !/[#&]figma=/.test(window.location.hash)) return null;
    const hash = window.location.hash;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return hash;
  });
  const [tab, setTab] = useState(figmaHandoff ? "tools" : "design");

  /** "ביטול שינויים" asks inline before it throws the draft away. */
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  /** The theme whose "מחיקה" is waiting to be confirmed, inline. */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Saving, or an undo back to the saved design, answers the question itself.
  useEffect(() => {
    if (!dirty) setConfirmDiscard(false);
  }, [dirty]);
  const [fullscreen, setFullscreen] = useState(false);
  const previewColumn = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === previewColumn.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else
      void previewColumn.current
        ?.requestFullscreen?.()
        .catch(() => toast.error("הדפדפן לא אפשר מסך מלא"));
  };
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
    // On Friday and Saturday the simulated moment could fall inside Shabbat,
    // where the board shows the Shabbat screen and no alerts - so the demo
    // uses the coming Sunday instead.
    const weekday = jerusalemWeekday(new Date());
    const day =
      weekday >= 5
        ? zmanimFor(new Date(Date.now() + (7 - weekday) * 86_400_000), board.data.settings)
        : zmanimToday;
    const event = draft.alerts.events.find((e) => e !== "candle" && day[e]) ?? "sunset";
    const at = day[event as AlertEvent];
    const lead = draft.alerts.leadMinutes[draft.alerts.leadMinutes.length - 1] ?? 15;
    if (!at) return toast.error("אין זמן מתאים היום להדגמה");
    setSimulatedNow(new Date(at.getTime() - lead * 60_000 + 2000));
    window.setTimeout(() => setSimulatedNow(null), 12_000);
    toast.info(
      `מציג איך תיראה ההתראה ${lead} דקות לפני ${ALERT_EVENT_LABELS[event as AlertEvent]}`,
    );
  };

  // Preview the Shabbat screen: jump the preview clock to 20 minutes after
  // the next candle lighting, until the admin goes back to real time.
  const [shabbatPreview, setShabbatPreview] = useState(false);
  // Shabbat pictures: pick one, or several for a slideshow.
  const sb = draft.shabbat;
  const pickScene = (scene: string) =>
    edit("sb-scene", (c) => {
      const cur = c.shabbat.scenes;
      if (!c.shabbat.rotate) return { ...c, shabbat: { ...c.shabbat, scenes: [scene] } };
      const has = cur.includes(scene);
      if (has && cur.length === 1) return c; // at least one picture
      return {
        ...c,
        shabbat: { ...c.shabbat, scenes: has ? cur.filter((s) => s !== scene) : [...cur, scene] },
      };
    });
  const [sbUploading, setSbUploading] = useState(false);
  const uploadShabbat = async (files: FileList | null) => {
    if (!files?.length) return;
    setSbUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const uploaded = await uploadTvImage(file);
        urls.push(uploaded.url);
        if (uploaded.lowRes)
          toast.warning(
            `"${file.name}" קטנה מדי לטלוויזיה (${uploaded.lowRes.width}×${uploaded.lowRes.height}) ותיראה מעט מטושטשת.`,
            { duration: 9000 },
          );
      }
      edit("sb-upload", (c) => ({
        ...c,
        shabbat: {
          ...c.shabbat,
          photos: [...c.shabbat.photos, ...urls].slice(0, 30),
          // A new photo is shown right away: alone, or added to the slideshow.
          scenes: c.shabbat.rotate ? [...c.shabbat.scenes, ...urls].slice(0, 30) : [urls[0]],
        },
      }));
      toast.success(urls.length > 1 ? `${urls.length} תמונות נוספו` : "התמונה נוספה ונבחרה");
    } catch (e) {
      toast.error(`ההעלאה נכשלה: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSbUploading(false);
    }
  };
  const removeShabbatPhoto = (url: string) =>
    edit("sb-photo-del", (c) => {
      const scenes = c.shabbat.scenes.filter((s) => s !== url);
      return {
        ...c,
        shabbat: {
          ...c.shabbat,
          photos: c.shabbat.photos.filter((p) => p !== url),
          scenes: scenes.length ? scenes : ["art:classic"],
        },
      };
    });

  const toggleShabbatPreview = () => {
    if (shabbatPreview) {
      setShabbatPreview(false);
      setSimulatedNow(null);
      return;
    }
    const candle = nextCandleLighting(new Date(), board.data.settings);
    if (!candle) return toast.error("לא ניתן לחשב את זמן הדלקת הנרות");
    setShabbatPreview(true);
    setSimulatedNow(new Date(candle.getTime() + 20 * 60_000));
    setPreviewIndex(0);
    if (!draft.shabbat.enabled) toast.warning("מסך השבת כבוי - הוא לא יופיע בשבת עד שתפעילו אותו.");
  };

  /* -------------------------------------------------------------- save -- */

  const approvedCount = (devices.data ?? []).filter((d) => d.approved).length;
  const onlineCount = (devices.data ?? []).filter(
    (d) => d.approved && deviceHealth(d, Date.now()).online,
  ).length;

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
          ["announcements", "shiurim", "minyanim", "settings"].map((k) =>
            queryClient.invalidateQueries({ queryKey: [k] }),
          ),
        );
      }
      const clean = normalizeTvConfig(snapshot);
      await saved.save.mutateAsync(clean);
      sync.announceSaved();
      const now = latestDraft.current;
      if (now === snapshot) {
        // The draft carried the content edits; start clean from what was saved.
        dispatch({ type: "load", config: clean });
      } else {
        // Edited meanwhile: keep those edits, minus the content already written.
        const done = new Set(snapshot._records ?? []);
        dispatch({
          type: "load",
          config: { ...now, _records: (now._records ?? []).filter((r) => !done.has(r)) },
        });
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

  const themes = allThemes(draft.customThemes);
  const theme = getTheme(draft.theme, draft.customThemes);
  const isCustom = draft.customThemes.some((t) => t.id === draft.theme);
  const hasOverrides = Object.keys(draft.themeOverrides).length > 0;
  /** The colours on screen now: the theme plus the live edits below. */
  const currentVars = () =>
    ({ ...theme.vars, ...(draft.themeOverrides as Partial<Record<ThemeVar, string>>) } as Record<
      ThemeVar,
      string
    >);
  const [naming, setNaming] = useState<{
    mode: "new" | "rename";
    id?: string;
    value: string;
  } | null>(null);
  // Switching themes drops the colour tweaks made on top of the current one.
  // Losing work in silence is how a design gets messy, so ask first.
  const [themeSwitch, setThemeSwitch] = useState<string | null>(null);
  const applyThemeChoice = (id: string) =>
    edit("theme", (c) => ({ ...c, theme: id, themeOverrides: {} }));
  const pickTheme = (id: string) => {
    if (id === draft.theme) return;
    if (Object.keys(draft.themeOverrides).length) setThemeSwitch(id);
    else applyThemeChoice(id);
  };
  const commitName = () => {
    if (!naming) return;
    const name = naming.value.trim().slice(0, 40);
    if (!name) return toast.error("צריך לתת שם לערכה");
    if (naming.mode === "new") {
      const vars = currentVars();
      const t: TvTheme = {
        id: newCustomThemeId(),
        name,
        description: `על בסיס "${theme.name}"`,
        light: isLightColor(vars["--tv-bg-a"]),
        vars,
      };
      edit("theme-new", (c) => ({
        ...c,
        customThemes: [...c.customThemes, t],
        theme: t.id,
        themeOverrides: {},
      }));
      toast.success(`הערכה "${name}" נשמרה ונבחרה. היא תגיע למסכים ב"שמור ושדר".`);
    } else {
      edit("theme-rename", (c) => ({
        ...c,
        customThemes: c.customThemes.map((t) => (t.id === naming.id ? { ...t, name } : t)),
      }));
    }
    setNaming(null);
  };
  const updateTheme = () => {
    const vars = currentVars();
    edit("theme-update", (c) => ({
      ...c,
      customThemes: c.customThemes.map((t) =>
        t.id === c.theme ? { ...t, vars, light: isLightColor(vars["--tv-bg-a"]) } : t,
      ),
      themeOverrides: {},
    }));
    toast.success(`הערכה "${theme.name}" עודכנה.`);
  };
  const deleteTheme = (id: string) =>
    edit("theme-delete", (c) => ({
      ...c,
      customThemes: c.customThemes.filter((t) => t.id !== id),
      ...(c.theme === id ? { theme: "navy", themeOverrides: {} } : {}),
    }));
  /* --------------------------------------------- import and export -- */

  const doExport = (what: "themes" | "gradients" | "all", how: "file" | "clipboard") => {
    const payload = buildExport(draft, {
      themes: what !== "gradients",
      gradients: what !== "themes",
    });
    const count = payload.themes.length + payload.gradients.length;
    if (!count) return toast.error("אין עדיין ערכות נושא או גרדיאנטים משלכם לייצוא");
    const text = JSON.stringify(payload, null, 2);
    if (how === "clipboard") {
      void navigator.clipboard
        .writeText(text)
        .then(() => toast.success(`${count} פריטים הועתקו ללוח`))
        .catch(() => toast.error("ההעתקה נכשלה"));
      return;
    }
    // A plain download: nothing leaves the browser.
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(what);
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${count} פריטים יוצאו לקובץ`);
  };

  const doImport = (text: string) => {
    try {
      const incoming = parseImport(text, newCustomThemeId, newGradientId);
      edit("import", (c) => mergeImport(c, incoming));
      const parts = [
        incoming.themes.length ? `${incoming.themes.length} ערכות נושא` : "",
        incoming.gradients.length ? `${incoming.gradients.length} גרדיאנטים` : "",
      ].filter(Boolean);
      toast.success(
        `יובאו ${parts.join(" ו-")}${
          incoming.skipped ? ` · ${incoming.skipped} פריטים לא תקינים דולגו` : ""
        }. לחצו "שמור ושדר" כדי להחיל.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "הייבוא נכשל");
    }
  };

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
          slideshow: {
            ...c.slideshow,
            images: [...c.slideshow.images, ...urls.map((url) => ({ url }))],
          },
          slides: c.slides.map((s) => (s.kind === "slideshow" ? { ...s, enabled: true } : s)),
        }));
      toast.success(urls.length > 1 ? `${urls.length} תמונות הועלו` : "התמונה הועלתה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
    }
  };

  if (saved.isLoading)
    return <p className="p-6 text-center text-muted-foreground">טוען את עיצוב הלוח…</p>;
  if (saved.error)
    return (
      <p className="p-6 text-center text-destructive">
        לא ניתן לטעון את הגדרות הלוח. ייתכן שהמיגרציה של מרכז הבקרה לא הורצה.
      </p>
    );

  // The buttons under the preview, shared by the admin page and the live window.
  const previewActions = (
    <>
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={showAlertExample}
        disabled={!draft.alerts.enabled}
      >
        <BellRing className="size-4" /> דוגמת התראת זמנים
      </Button>
      <Button
        type="button"
        variant={shabbatPreview ? "default" : "outline"}
        size="sm"
        aria-pressed={shabbatPreview}
        onClick={toggleShabbatPreview}
      >
        🕯️ {shabbatPreview ? "חזרה לזמן אמת" : "תצוגת מסך שבת"}
      </Button>
      {simulatedNow && (
        <span className="text-xs text-muted-foreground">
          מדמה {shabbatPreview ? "ערב שבת, " : "את השעה "}
          {simulatedNow.toTimeString().slice(0, 5)}
        </span>
      )}
    </>
  );

  // Every design control, shared by the admin page and the live window's panel.
  // "ביטול שינויים" asks first, inline (see below).
  const controls = (
    <>
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="ביטול (Ctrl+Z)"
          title="ביטול (Ctrl+Z)"
          disabled={!state.past.length}
          onClick={() => dispatch({ type: "undo" })}
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="חזרה (Ctrl+Y)"
          title="חזרה (Ctrl+Y)"
          disabled={!state.future.length}
          onClick={() => dispatch({ type: "redo" })}
        >
          <Redo2 className="size-4" />
        </Button>
        {confirmDiscard ? (
          <span className="flex items-center gap-1">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setConfirmDiscard(false);
                if (saved.data) dispatch({ type: "load", config: saved.data.config });
              }}
            >
              לבטל הכל?
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDiscard(false)}>
              המשך לערוך
            </Button>
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!dirty}
            onClick={() => setConfirmDiscard(true)}
          >
            ביטול שינויים
          </Button>
        )}
        <span className="ms-auto text-xs text-muted-foreground">
          {dirty ? "יש שינויים שלא נשמרו" : "הכל שמור"}
        </span>
        <Button type="button" onClick={save} disabled={!dirty || saving}>
          {dirty ? <Save className="size-4" /> : <Check className="size-4" />}
          {saving ? "שומר…" : "שמור ושדר למסכים"}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="design">עיצוב</TabsTrigger>
          <TabsTrigger value="layout">פריסה</TabsTrigger>
          <TabsTrigger value="content">תוכן</TabsTrigger>
          <TabsTrigger value="tools">כלים</TabsTrigger>
        </TabsList>
        <TabsContent
          value="design"
          className="mt-3 grid grid-cols-1 items-start gap-4 [&>*]:min-w-0 min-[1700px]:grid-cols-2"
        >
          <Section
            title="ערכת נושא"
            hint="בסיס הצבעים. ערכות בהירות מתאימות למסכי LCD; על מסך OLED עדיף כהה (מונע צריבה). ערכות ששמרתם מגיעות גם לשלט של הטלוויזיה."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {themes.map((t) => {
                const custom = !TV_THEMES.some((b) => b.id === t.id);
                return (
                  <div
                    key={t.id}
                    className={`relative overflow-hidden rounded-lg border text-right transition ${
                      draft.theme === t.id
                        ? "ring-2 ring-primary ring-offset-2"
                        : "hover:border-primary/50"
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={draft.theme === t.id}
                      onClick={() => pickTheme(t.id)}
                      className="block w-full text-right"
                    >
                      <div
                        className="flex h-12 items-end gap-1 p-2"
                        style={{
                          background: `radial-gradient(ellipse at 20% 0%, ${t.vars["--tv-bg-b"]}, transparent 70%), ${t.vars["--tv-bg-a"]}`,
                        }}
                      >
                        <span
                          className="size-4 rounded-full"
                          style={{ background: t.vars["--tv-accent"] }}
                        />
                        <span
                          className="size-4 rounded-full"
                          style={{ background: t.vars["--tv-text"] }}
                        />
                        <span
                          className="size-4 rounded-full"
                          style={{ background: t.vars["--tv-accent-2"] }}
                        />
                      </div>
                      <div className="p-2 pb-1">
                        <div className="text-sm font-medium">
                          {t.name}
                          {custom && (
                            <span className="ms-1 rounded bg-secondary px-1 text-[10px] font-normal text-muted-foreground">
                              שלי
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] leading-tight text-muted-foreground">
                          {t.description}
                        </div>
                      </div>
                    </button>
                    {custom && (
                      <div className="flex gap-1 px-1 pb-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[11px]"
                          onClick={() => setNaming({ mode: "rename", id: t.id, value: t.name })}
                        >
                          שינוי שם
                        </Button>
                        {confirmDelete === t.id ? (
                          <>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="h-6 px-1.5 text-[11px]"
                              onClick={() => {
                                setConfirmDelete(null);
                                deleteTheme(t.id);
                              }}
                            >
                              {draft.theme === t.id ? "למחוק? הלוח יחזור לברירת המחדל" : "למחוק?"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[11px]"
                              onClick={() => setConfirmDelete(null)}
                            >
                              ביטול
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[11px] text-destructive"
                            onClick={() => setConfirmDelete(t.id)}
                          >
                            מחיקה
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <AlertDialog
              open={Boolean(themeSwitch)}
              onOpenChange={(open) => !open && setThemeSwitch(null)}
            >
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>יש שינויי צבע שלא נשמרו בערכה</AlertDialogTitle>
                  <AlertDialogDescription>
                    מעבר לערכה אחרת יבטל את שינויי הצבע שעשיתם על ״{theme.name}״. אפשר לשמור אותם
                    קודם כערכה חדשה, וכך הם יישארו זמינים תמיד.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>להישאר כאן</AlertDialogCancel>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setNaming({ mode: "new", value: `${theme.name} (מותאם)` });
                      setThemeSwitch(null);
                    }}
                  >
                    שמירה כערכה חדשה
                  </Button>
                  <AlertDialogAction
                    onClick={() => {
                      if (themeSwitch) applyThemeChoice(themeSwitch);
                      setThemeSwitch(null);
                    }}
                  >
                    החלפה בלי לשמור
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {naming ? (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  commitName();
                }}
              >
                <Input
                  autoFocus
                  aria-label="שם הערכה"
                  value={naming.value}
                  maxLength={40}
                  placeholder={naming.mode === "new" ? "שם לערכה החדשה, למשל: חגים" : "שם חדש"}
                  className="h-9 w-56"
                  onChange={(e) => setNaming({ ...naming, value: e.target.value })}
                />
                <Button type="submit" size="sm">
                  {naming.mode === "new" ? "שמירת הערכה" : "שינוי השם"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNaming(null)}>
                  ביטול
                </Button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setNaming({ mode: "new", value: hasOverrides ? `${theme.name} (מותאם)` : "" })
                  }
                >
                  <Plus className="size-4" /> שמירה כערכה חדשה
                </Button>
                {isCustom && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasOverrides}
                    onClick={updateTheme}
                    title={
                      hasOverrides
                        ? "שומר את שינויי הצבע שלמטה לתוך הערכה"
                        : "שנו צבעים למטה ואז עדכנו"
                    }
                  >
                    <Save className="size-4" /> עדכון הערכה "{theme.name}"
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  {isCustom
                    ? 'ערכה שלכם: שנו צבעים למטה ולחצו "עדכון הערכה".'
                    : "ערכה מובנית: שנו צבעים למטה ושמרו כערכה חדשה כדי לערוך אותה."}
                  {draft.customThemes.length >= 24 ? " הגעתם למספר הערכות המרבי (24)." : ""}
                </span>
              </div>
            )}
            {hasOverrides && (
              <p className="text-xs text-muted-foreground">
                בחירת ערכה אחרת מאפסת את התאמות הצבע שלמטה.
              </p>
            )}
          </Section>

          <Section
            title="צבעים (עריכה חיה)"
            hint={`מתחיל מ"${theme.name}". כל שינוי מופיע מיד בתצוגה; ↺ מחזיר לערך הערכה.`}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {THEME_VARS.map((v: ThemeVar) => (
                <ColorField
                  key={v}
                  label={THEME_VAR_LABELS[v]}
                  value={draft.themeOverrides[v] ?? theme.vars[v]}
                  themeValue={theme.vars[v]}
                  overridden={v in draft.themeOverrides}
                  onChange={(value) =>
                    edit(`color:${v}`, (c) => ({
                      ...c,
                      themeOverrides: { ...c.themeOverrides, [v]: value },
                    }))
                  }
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

          <Section
            title="רקע הלוח"
            hint="גרדיאנט או תמונה מאחורי כל הלוח. גרדיאנט נשאר חד בכל גודל מסך ואינו עולה דבר בביצועים."
          >
            <GradientStudio
              config={draft}
              onEdit={edit}
              applyLabel="החלה על רקע הלוח"
              current={draft.backgroundGradient}
              onApply={(value) => edit("bg-gradient", (c) => ({ ...c, backgroundGradient: value }))}
            />
            <div className="h-px bg-border" />
            <div className="text-xs font-medium text-muted-foreground">או תמונת רקע</div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                <label className="cursor-pointer">
                  <ImagePlus className="size-4" />{" "}
                  {draft.backgroundImage ? "החלפת תמונה" : "העלאת תמונה"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => void upload(e.target.files, "background")}
                  />
                </label>
              </Button>
              {draft.backgroundImage && (
                <>
                  <img
                    src={draft.backgroundImage}
                    alt=""
                    className="h-10 w-16 rounded object-cover"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => edit("bg", (c) => ({ ...c, backgroundImage: null }))}
                  >
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

          <Section title="גופן וגודל טקסט">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label htmlFor="tv-font">גופן</Label>
                <select
                  id="tv-font"
                  value={draft.font}
                  onChange={(e) =>
                    edit("font", (c) => ({ ...c, font: e.target.value as TvConfig["font"] }))
                  }
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
        </TabsContent>
        <TabsContent
          value="layout"
          className="mt-3 grid grid-cols-1 items-start gap-4 [&>*]:min-w-0 min-[1700px]:grid-cols-2"
        >
          <Section title="פריסת מסך" hint="איך המסך כולו מסודר. מסך השבת תמיד מוצג על כל המסך.">
            <div className="grid grid-cols-3 gap-2">
              {LAYOUT_CHOICES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={draft.screenLayout === l.id}
                  onClick={() => edit("layout", (c) => ({ ...c, screenLayout: l.id }))}
                  className={`rounded-lg border p-2 text-right transition ${
                    draft.screenLayout === l.id
                      ? "ring-2 ring-primary ring-offset-2"
                      : "hover:border-primary/50"
                  }`}
                >
                  <span
                    className="mb-2 grid aspect-video grid-cols-3 grid-rows-[auto_1fr_1fr_1fr] gap-1 rounded-md bg-[#0b1628] p-1.5 text-[#f0c35c]"
                    aria-hidden
                  >
                    {l.sketch}
                  </span>
                  <span className="block text-sm font-medium">{l.name}</span>
                  <span className="block text-[11px] leading-tight text-muted-foreground">
                    {l.hint}
                  </span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">סגנון תצוגה</div>
              <div
                data-testid="skin-picker"
                className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5"
              >
                {SKIN_CHOICES.map((sk) => (
                  <button
                    key={sk.id}
                    type="button"
                    aria-pressed={draft.skin === sk.id}
                    title={sk.hint}
                    onClick={() => edit("skin", (c) => ({ ...c, skin: sk.id }))}
                    className={`rounded-lg border p-1.5 text-right transition ${
                      draft.skin === sk.id
                        ? "ring-2 ring-primary ring-offset-2"
                        : "hover:border-primary/50"
                    }`}
                  >
                    <span
                      className="mb-1 block aspect-[16/10] overflow-hidden rounded-md bg-[#0b1628]"
                      aria-hidden
                    >
                      {sk.preview}
                    </span>
                    <span className="block text-center text-xs font-medium">{sk.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                הסגנון מתלבש על כל ערכת נושא וכל פריסה. "לוחות אבן" ו"קלף" הופכים את הלוחות לבהירים,
                והטקסט שבתוכם מתכהה בהתאם.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">מסגרות</div>
              <div data-testid="frame-shapes" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {FRAME_CHOICES.map((fr) => (
                  <button
                    key={fr.id}
                    type="button"
                    aria-pressed={draft.frame.shape === fr.id}
                    title={fr.hint}
                    onClick={() =>
                      edit("frame.shape", (c) => ({ ...c, frame: { ...c.frame, shape: fr.id } }))
                    }
                    className={`rounded-lg border p-1.5 text-center transition ${
                      draft.frame.shape === fr.id
                        ? "ring-2 ring-primary ring-offset-2"
                        : "hover:border-primary/50"
                    }`}
                  >
                    <span
                      className="mx-auto mb-1 block h-10 w-14 border-2 border-[#c9a227] bg-[#12243f]"
                      style={fr.css}
                      aria-hidden
                    />
                    <span className="block text-[11px] font-medium">{fr.name}</span>
                  </button>
                ))}
              </div>

              {(["top", "bottom"] as const).map((edge) => {
                const value = draft.frame[edge];
                const label = edge === "top" ? "עיגול למעלה" : "עיגול למטה";
                return (
                  <div key={edge} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0">{label}</span>
                    <input
                      type="range"
                      min={0}
                      max={FRAME_RADIUS_MAX}
                      step={0.5}
                      value={value ?? 1.6}
                      disabled={value === null}
                      aria-label={label}
                      onChange={(e) =>
                        edit(`frame.${edge}`, (c) => ({
                          ...c,
                          frame: { ...c.frame, [edge]: Number(e.target.value) },
                        }))
                      }
                      className="h-2 flex-1 accent-primary disabled:opacity-40"
                    />
                    <span className="w-10 text-left tabular-nums text-muted-foreground">
                      {value === null ? "—" : value}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={value === null ? "default" : "outline"}
                      aria-pressed={value === null}
                      onClick={() =>
                        edit(`frame.${edge}.auto`, (c) => ({
                          ...c,
                          frame: { ...c.frame, [edge]: value === null ? 1.6 : null },
                        }))
                      }
                    >
                      לפי הסגנון
                    </Button>
                  </div>
                );
              })}

              <p className="text-xs text-muted-foreground">
                חל על כל הלוחות בכל הסגנונות ובכל הפריסות - בטלוויזיה, בלפטופ ובנייד. כשקובעים
                עיגול, הצורה של הסגנון (כיפה, קשת, קצה מסולסל) מוחלפת בפינה שנבחרה; החומרים
                והצבעים של הסגנון נשארים.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              שעון:
              {CLOCK_CHOICES.map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  size="sm"
                  variant={draft.clockStyle === c.id ? "default" : "outline"}
                  aria-pressed={draft.clockStyle === c.id}
                  onClick={() => edit("clock", (cfg) => ({ ...cfg, clockStyle: c.id }))}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          </Section>

          <Section title="ראש המסך">
            <label className="flex items-center gap-3">
              <Switch
                checked={draft.header.logo}
                onCheckedChange={(on) =>
                  edit("h-logo", (c) => ({ ...c, header: { ...c.header, logo: on } }))
                }
              />
              לוגו קרובים ליד שם בית הכנסת
            </label>
            <label className="flex items-center gap-3">
              <Switch
                checked={draft.header.parasha}
                onCheckedChange={(on) =>
                  edit("h-parasha", (c) => ({ ...c, header: { ...c.header, parasha: on } }))
                }
              />
              פרשת השבוע
            </label>
            <label className="flex items-center gap-3">
              <Switch
                checked={draft.header.dafYomi}
                onCheckedChange={(on) =>
                  edit("h-daf", (c) => ({ ...c, header: { ...c.header, dafYomi: on } }))
                }
              />
              הדף היומי
            </label>
          </Section>

          <Section
            title="שקופיות ופריסות"
            hint="הסדר, משך הזמן והפריסה של כל שקופית. החצים משנים סדר."
          >
            <ul className="space-y-2">
              {draft.slides.map((s, i) => (
                <li
                  key={s.kind}
                  className={`rounded-lg border p-3 ${s.enabled ? "" : "opacity-60"}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <Switch
                      checked={s.enabled}
                      aria-label={`הצגת ${SLIDE_KIND_LABELS[s.kind]}`}
                      onCheckedChange={(on) =>
                        edit(`slide-on:${s.kind}`, (c) => ({
                          ...c,
                          slides: c.slides.map((x) =>
                            x.kind === s.kind ? { ...x, enabled: on } : x,
                          ),
                        }))
                      }
                    />
                    <span className="min-w-28 font-medium">{SLIDE_KIND_LABELS[s.kind]}</span>
                    <select
                      aria-label={`פריסת ${SLIDE_KIND_LABELS[s.kind]}`}
                      value={s.layout}
                      onChange={(e) =>
                        edit(`slide-layout:${s.kind}`, (c) => ({
                          ...c,
                          slides: c.slides.map((x) =>
                            x.kind === s.kind ? { ...x, layout: e.target.value } : x,
                          ),
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
                          edit(`slide-sec:${s.kind}`, (c) => ({
                            ...c,
                            slides: c.slides.map((x) =>
                              x.kind === s.kind ? { ...x, seconds: v } : x,
                            ),
                          }))
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
                    <p className="mt-2 text-xs text-muted-foreground">
                      המשך נקבע לפי מספר התמונות × זמן לתמונה (בהגדרות המצגת).
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        </TabsContent>
        <TabsContent
          value="content"
          className="mt-3 grid grid-cols-1 items-start gap-4 [&>*]:min-w-0 min-[1700px]:grid-cols-2"
        >
          <Section
            title="מסך שבת"
            hint="מהדלקת הנרות ביום שישי ועד צאת השבת הלוח מציג רק מסך שבת - חלות ונרות דולקים, 'שבת שלום', הפרשה וזמני השבת - בלי החלפת מסכים. הזמנים לפי הגדרות בית הכנסת."
          >
            <label className="flex items-center gap-3">
              <Switch
                checked={draft.shabbat.enabled}
                onCheckedChange={(on) =>
                  edit("sb-on", (c) => ({ ...c, shabbat: { ...c.shabbat, enabled: on } }))
                }
              />
              מסך שבת פעיל
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              צאת השבת:
              <Stepper
                label="דקות אחרי השקיעה"
                value={draft.shabbat.endMinutesAfterSunset}
                min={18}
                max={90}
                step={1}
                format={(v) => `${v} דק׳`}
                onChange={(v) =>
                  edit("sb-end", (c) => ({
                    ...c,
                    shabbat: { ...c.shabbat, endMinutesAfterSunset: v },
                  }))
                }
              />
              <span className="text-xs text-muted-foreground">אחרי השקיעה</span>
              {[40, 72].map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={draft.shabbat.endMinutesAfterSunset === m ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    edit("sb-end", (c) => ({
                      ...c,
                      shabbat: { ...c.shabbat, endMinutesAfterSunset: m },
                    }))
                  }
                >
                  {m === 72 ? "72 (ר״ת)" : `${m} (מקובל)`}
                </Button>
              ))}
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-sm font-medium">תמונת השבת</span>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={sb.rotate}
                    onCheckedChange={(on) =>
                      edit("sb-rotate", (c) => ({
                        ...c,
                        shabbat: {
                          ...c.shabbat,
                          rotate: on,
                          scenes: on ? c.shabbat.scenes : c.shabbat.scenes.slice(0, 1),
                        },
                      }))
                    }
                  />
                  מצגת: החלפת תמונות
                </label>
                {sb.rotate && (
                  <label className="flex items-center gap-2 text-sm">
                    כל
                    <select
                      aria-label="זמן לכל תמונה"
                      value={sb.secondsPerScene}
                      onChange={(e) =>
                        edit("sb-secs", (c) => ({
                          ...c,
                          shabbat: { ...c.shabbat, secondsPerScene: Number(e.target.value) },
                        }))
                      }
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                    >
                      {(SCENE_INTERVALS.includes(sb.secondsPerScene)
                        ? SCENE_INTERVALS
                        : [...SCENE_INTERVALS, sb.secondsPerScene].sort((a, b) => a - b)
                      ).map((s) => (
                        <option key={s} value={s}>
                          {intervalLabel(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {sb.rotate
                  ? `לחצו על תמונות כדי להוסיף או להוציא מהמצגת; המספר הוא הסדר. נבחרו ${sb.scenes.length}.`
                  : 'לחצו על תמונה כדי לבחור אותה. להחלפת תמונות לפי זמן - הפעילו "מצגת".'}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ...SHABBAT_ART.map((a) => ({
                    scene: `art:${a.id}`,
                    label: a.label,
                    photo: false,
                  })),
                  ...sb.photos.map((p, i) => ({ scene: p, label: `תמונה ${i + 1}`, photo: true })),
                ].map(({ scene, label, photo }) => {
                  const order = sb.scenes.indexOf(scene);
                  const chosen = order >= 0;
                  return (
                    <div
                      key={scene}
                      className={`relative overflow-hidden rounded-lg border bg-[#0b1628] transition ${
                        chosen
                          ? "ring-2 ring-primary ring-offset-2"
                          : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={chosen}
                        aria-label={label}
                        onClick={() => pickScene(scene)}
                        className="block w-full"
                      >
                        <div className="pointer-events-none aspect-[900/520] p-1 [&_.tv-shabbat-photo]:max-h-none [&_.tv-shabbat-photo]:shadow-none [&_svg]:h-full [&_svg]:w-full">
                          <ShabbatPicture scene={scene} />
                        </div>
                        <div className="bg-background/95 px-2 py-1 text-right text-xs font-medium">
                          {label}
                        </div>
                      </button>
                      {chosen && sb.rotate && (
                        <span className="absolute start-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {order + 1}
                        </span>
                      )}
                      {photo && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="absolute end-1.5 top-1.5 size-7"
                          aria-label={`הסרת ${label}`}
                          onClick={() => removeShabbatPhoto(scene)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button type="button" variant="outline" size="sm" asChild disabled={sbUploading}>
                <label className="cursor-pointer">
                  <ImagePlus className="size-4" /> {sbUploading ? "מעלה…" : "העלאת תמונות משלכם"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => void uploadShabbat(e.target.files)}
                  />
                </label>
              </Button>
              <span className="ms-2 text-xs text-muted-foreground">
                מומלץ 1920×1080 ומעלה; התמונה מותאמת אוטומטית לטלוויזיה.
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              אפשר לשנות את הכיתוב, להסתיר חלקים ולהזיז בעריכה ישירה: לחצו "תצוגת מסך שבת" ואז
              "עריכה ישירה בלוח".
            </p>
          </Section>

          <Section
            title="מצגת תמונות"
            hint="תמונות מאירועים, מודעות מעוצבות, תרומות. יוצגו כשקופית נפרדת. כל תמונה מותאמת אוטומטית לחדות מרבית בטלוויזיה; מודעות עם טקסט עדיף להעלות כ-PNG."
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                <label className="cursor-pointer">
                  <ImagePlus className="size-4" /> {uploading ? "מעלה…" : "הוספת תמונות"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => void upload(e.target.files, "slideshow")}
                  />
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
                  onChange={(v) =>
                    edit("sh-sec", (c) => ({
                      ...c,
                      slideshow: { ...c.slideshow, secondsPerImage: v },
                    }))
                  }
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
                            images: c.slideshow.images.map((x, j) =>
                              j === i ? { ...x, caption: e.target.value || undefined } : x,
                            ),
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
                        edit("sh-del", (c) => ({
                          ...c,
                          slideshow: {
                            ...c.slideshow,
                            images: c.slideshow.images.filter((_, j) => j !== i),
                          },
                        }))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="סרגל הודעה רץ"
            hint="טקסט שנע בתחתית המסך. שימו לב: אנימציה רציפה - בטלוויזיה החלשה נמדדה צריכת מעבד גבוהה (~45%) כל עוד הסרגל פעיל."
          >
            <label className="flex items-center gap-3">
              <Switch
                checked={draft.ticker.enabled}
                onCheckedChange={(on) =>
                  edit("tk-on", (c) => ({ ...c, ticker: { ...c.ticker, enabled: on } }))
                }
              />
              הצגת סרגל
            </label>
            <Textarea
              value={draft.ticker.text}
              maxLength={400}
              placeholder="למשל: ברוכים הבאים · שיעור העמוד היומי בכל יום ב-16:15"
              onChange={(e) =>
                edit("tk-text", (c) => ({ ...c, ticker: { ...c.ticker, text: e.target.value } }))
              }
            />
          </Section>

          <Section
            title="התראות לפני סוף זמן"
            hint="ספירה לאחור בתחתית המסך, וכרטיס גדול בכל אחת מהדקות שנבחרו."
          >
            <label className="flex items-center gap-3">
              <Switch
                checked={draft.alerts.enabled}
                onCheckedChange={(on) =>
                  edit("al-on", (c) => ({ ...c, alerts: { ...c.alerts, enabled: on } }))
                }
              />
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
                          events: ev.target.checked
                            ? [...c.alerts.events, e]
                            : c.alerts.events.filter((x) => x !== e),
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
              onChange={(leads) =>
                edit("al-leads", (c) => ({ ...c, alerts: { ...c.alerts, leadMinutes: leads } }))
              }
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
                onChange={(v) =>
                  edit("al-sec", (c) => ({ ...c, alerts: { ...c.alerts, popupSeconds: v } }))
                }
              />
            </div>
          </Section>
        </TabsContent>
        <TabsContent
          value="tools"
          className="mt-3 grid grid-cols-1 items-start gap-4 [&>*]:min-w-0 min-[1700px]:grid-cols-2"
        >
          <Section
            title="ייבוא וייצוא"
            hint="גיבוי של ערכות הנושא והגרדיאנטים שלכם, או העברה שלהם לבית כנסת אחר. הייבוא מוסיף ואינו מוחק."
          >
            <TransferPanel onExport={doExport} onImport={doImport} />
          </Section>

          <Section
            title="ייבוא מפיגמה"
            hint="קובץ המשתנים (Variables) של פיגמה הופך לערכת נושא. בלי טוקן ובלי חשבון - הקובץ נקרא כאן בדפדפן."
          >
            <FigmaImport config={draft} onEdit={edit} handoff={figmaHandoff} />
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
                  ערכת הנושא, הצבעים, השקופיות וההתראות יחזרו להגדרות המקוריות בתצוגה המקדימה. שום
                  דבר לא ישתנה במסכים עד שתלחצו "שמור ושדר".
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => edit("reset-all", () => structuredClone(DEFAULT_TV_CONFIG))}
                >
                  אפס
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>
    </>
  );

  if (studio) {
    return (
      <>
        <TvDeviceStudio
          {...board}
          fullscreen
          config={draft}
          index={index}
          cycle={cycle}
          progress={0}
          paused={!autoplay}
          editing={editing}
          selected={selected}
          onSelect={setSelected}
          onEdit={edit}
        />
        <StudioPanel title="עורך חי" status={dirty ? "יש שינויים שלא נשמרו" : "הכל שמור"}>
          <div className="space-y-3">
            {/* One line only: the click-to-edit guidance lives in the inspector below. */}
            <p className="text-[11px] leading-tight text-muted-foreground">
              <b>Alt + לחיצה</b> = לחיצה רגילה על הלוח · <b>Esc</b> = ביטול הבחירה · הכל טיוטה עד
              "שמור ושדר", ומתעדכן גם בעורך שבעמוד הניהול.
            </p>
            <div className="flex flex-wrap items-center gap-2">{previewActions}</div>
            <SlideStrip
              slides={board.slides}
              index={index}
              onPick={(i) => {
                setPreviewIndex(i);
                setCycle((c) => c + 1);
              }}
            />
            {editing && (
              <TvEditInspector
                selected={selected}
                config={draft}
                data={board.data}
                onEdit={edit}
                onSelect={setSelected}
              />
            )}
            {controls}
          </div>
        </StudioPanel>
      </>
    );
  }

  return (
    <div
      className={`grid gap-5 ${
        wide
          ? ""
          : "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"
      }`}
    >
      {/* ------------------------------------------------ preview column -- */}
      <div
        ref={previewColumn}
        className={`order-1 space-y-3 lg:order-2 ${
          fullscreen ? "overflow-auto bg-background p-4" : ""
        }`}
      >
        {/* Pinned while the controls scroll. It is capped to the window
            height and scrolls inside itself, because a sticky block taller
            than the window simply scrolls away - which left the whole left
            side of a wide screen empty. */}
        <div
          className={
            wide || fullscreen
              ? "space-y-3"
              : "lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:space-y-3 lg:overflow-y-auto lg:pe-1"
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={wide ? "default" : "outline"}
              size="sm"
              aria-pressed={wide}
              onClick={() => setWide((w) => !w)}
              title="התצוגה על כל רוחב המסך, והבקרות מתחתיה"
            >
              {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}{" "}
              {wide ? "תצוגה רגילה" : "תצוגה רחבה"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              title="התצוגה והעורך על כל המסך (Esc ליציאה)"
            >
              <Expand className="size-4" /> {fullscreen ? "יציאה ממסך מלא" : "מסך מלא לעריכה"}
            </Button>
          </div>
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
            onEdit={edit}
            large={wide || fullscreen}
          />
          {editing && (
            <div className="mt-3">
              <TvEditInspector
                selected={selected}
                config={draft}
                data={board.data}
                onEdit={edit}
                onSelect={setSelected}
              />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {previewActions}
            <span className="ms-auto flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                title="פותח את הלוח על כל המסך בחלון נפרד, עם כל כלי העריכה בחלונית צפה. השינויים עוברים בין החלון לכאן בשני הכיוונים, ונשמרים רק ב'שמור ושדר'. אפשר לגרור אותו למסך שני או לטלוויזיה שמחוברת למחשב."
                onClick={() => window.open("/admin/tv-board?draft=1", "shul-tv-draft")}
              >
                <ExternalLink className="size-4" /> עורך חי בחלון נפרד
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
      <div className="order-2 space-y-4 lg:order-1">{controls}</div>
    </div>
  );
}

function LeadMinutesEditor({
  value,
  onChange,
}: {
  value: number[];
  onChange: (v: number[]) => void;
}) {
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
        <span
          key={m}
          className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-0.5"
        >
          {m} דק׳
          <button
            type="button"
            aria-label={`הסרת התראה של ${m} דקות`}
            onClick={() => onChange(value.filter((x) => x !== m))}
            className="text-muted-foreground hover:text-foreground"
          >
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
