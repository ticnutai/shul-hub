import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  Check,
  ExternalLink,
  Expand,
  Columns2,
  Rows2,
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
  configForDevice,
  deviceHasOverrides,
  editForDevice,
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
    id: "illustrated",
    name: "תבנית מאוירת",
    hint: "לוח מצויר (פרוכת, לוחות אבן, עץ מגולף) עם הזמנים של היום בתוך המסגרות",
    sketch: (
      <>
        <i className="col-span-3 h-2 rounded-full bg-current opacity-60" />
        <i className="row-span-3 rounded-t-full bg-current opacity-45" />
        <i className="row-span-3 rounded-sm bg-current opacity-20" />
        <i className="row-span-3 rounded-t-full bg-current opacity-45" />
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
import { classOfPreviewDevice, type DeviceClass } from "@/tv/devices";
import type { DeviceMode } from "./devices";
import { DeviceScopeBanner, type DeviceScope } from "./DeviceScopeBanner";
import { FrameSpacing } from "./BoardLook";
import { BackgroundLayer, FramesLayer, TextLayer, type LayerProps } from "./LayerEditors";
import { uploadImages } from "./uploadImages";
import { DesignLibrary } from "./DesignLibrary";
import { captureDesign, MAX_DESIGNS } from "@/tv/designs";
import { ScreenComposer } from "./ScreenComposer";
import { SlideStrip, TvDeviceStudio } from "./TvPreview";
import { useDraftSync } from "./tvDraftChannel";
import { StudioPanel } from "./StudioPanel";
import { FigmaImport } from "./FigmaImport";
import { TransferPanel } from "./GradientStudio";
import {
  dataUrlToFile,
  toPortableIllustration,
  urlToDataUrl,
  type CustomIllustration,
  type PortableIllustration,
} from "@/tv/illustrated";
import { PaintedPresets, PaintedRows } from "./IllustratedLookEditor";
import { DayLooksEditor } from "./DayLooksEditor";
import { applyImport, buildExport, exportFileName, parseImport, planIllustrations } from "@/tv/transfer";
import { isAllowedEdit } from "@/tv/records";
import { TvEditInspector } from "./TvEditInspector";
import { SplitHandle } from "./SplitHandle";
import { commitRecordEdits } from "./tvRecords";
import { mergeConfig, sameJson } from "@/tv/configMerge";
import { draftReducer } from "./draftState";
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
    base: DEFAULT_TV_CONFIG,
    future: [],
    lastKey: null,
    lastAt: 0,
    editedAt: 0,
  });
  const draft = state.present;
  const loadedRef = useRef(false);
  const savedJson = saved.data ? JSON.stringify(saved.data.config) : null;
  // Unsaved = changed here since the board was read, not "differs from the
  // server": a change made elsewhere is not this editor's work to lose.
  const dirty = savedJson !== null && !sameJson(draft, state.base);

  // Load the saved config into the draft once; after that, every change to
  // the stored board is taken in under the edits made here (rebase).
  // A draft already adopted from the other editor window (it can arrive
  // before the saved row does) is newer than the saved row: keep it.
  const editedAtRef = useRef(0);
  editedAtRef.current = state.editedAt;
  useEffect(() => {
    if (!saved.data) return;
    if (!loadedRef.current) {
      loadedRef.current = true;
      if (editedAtRef.current > 0) {
        dispatch({ type: "rebase", config: saved.data.config });
        return;
      }
      dispatch({ type: "load", config: saved.data.config });
      return;
    }
    dispatch({ type: "rebase", config: saved.data.config });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follow the saved row only
  }, [savedJson]);

  // Unsaved edits must not vanish with a stray navigation - nor with the
  // app reloading itself into a new deploy (see src/main.tsx, which waits
  // for this to clear before it takes one).
  useEffect(() => {
    const w = window as { __appHasUnsavedWork?: boolean };
    w.__appHasUnsavedWork = dirty;
    if (!dirty) return () => undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      w.__appHasUnsavedWork = false;
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
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

  /**
   * Which screen is being worked on: the wall, a computer, a phone - or all
   * of them at once, which is the default and what every edit did before
   * screens could differ.
   *
   * It is one choice covering the whole panel rather than a scope on each
   * control, because it is the question you answer once when you sit down:
   * "I am fixing the phone now". Every control below then means what it
   * says, and the preview shows that screen.
   */
  const [scope, setScope] = useState<DeviceScope>("all");
  const scopeDevice = scope === "all" ? null : scope;

  // The device strip over the preview is the only switcher; choosing a
  // device there is also choosing what these controls edit.
  const onDeviceChange = useCallback((mode: DeviceMode) => {
    setScope(mode === "all" ? "all" : classOfPreviewDevice(mode));
  }, []);

  /** Puts one screen back to following the board. */
  const clearDevice = useCallback(
    (device: DeviceClass) =>
      dispatch({
        type: "edit",
        key: `clear:${device}`,
        update: (c) => {
          const perDevice = { ...c.perDevice };
          delete perDevice[device];
          return { ...c, perDevice };
        },
      }),
    [],
  );
  /**
   * Something being tried out, shown on the board but not written down.
   *
   * Dragging a colour and having to press "החלה" before you can see what
   * you did is a guessing game: the little swatch in the editor is not the
   * board, and a gradient that looks right in a 20-pixel strip can be
   * wrong across a wall. So what is being adjusted is laid over the board
   * for display only - it never reaches the draft, so it cannot be saved
   * by accident and vanishes the moment the control is left.
   */
  const [preview, setPreview] = useState<Partial<TvConfig> | null>(null);

  /**
   * The board as the chosen screen sees it. Everything on this panel shows
   * this rather than the shared board, so the controls read back what that
   * screen actually does and the preview is that screen's board. With no
   * screen chosen it is the shared board itself, unchanged.
   */
  const scoped = configForDevice(state.present, scopeDevice);
  const view = preview ? { ...scoped, ...preview } : scoped;

  const edit = useCallback(
    (key: string, update: (c: TvConfig) => TvConfig) =>
      dispatch({
        type: "edit",
        key: `${scope}:${key}`,
        // The controls are all (config) => config and none of them know that
        // screens exist; this is the one place that decides where the change
        // lands (see editForDevice).
        update: (c) => editForDevice(c, scopeDevice, update),
      }),
    [scope, scopeDevice],
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
  /** Which screen the composer has open. Not part of the board; the editor's own place. */
  const [composerScreen, setComposerScreen] = useState(0);
  const board = useTvSlides(view, simulatedNow);
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
  /**
   * How the editor is laid out, and how much room each part has.
   *
   * "side": the controls and the board side by side, with a bar between
   * them to widen either. "top": the board on top, staying put under the
   * site's header while the controls scroll beneath it, with a bar under it
   * to make it taller or shorter. Both, and the sizes, are remembered in
   * this browser. Fullscreen still puts the board column alone on the screen.
   */
  const [layout, setLayoutState] = useState<"side" | "top">(() => (readStored(LAYOUT_KEY) === "top" ? "top" : "side"));
  const setLayout = (next: "side" | "top") => {
    setLayoutState(next);
    writeStored(LAYOUT_KEY, next);
  };
  const [sideShare, setSideShareState] = useState(() => clampShare(Number(readStored(SIDE_KEY)) || SIDE_SHARE_DEFAULT));
  const setSideShare = (v: number) => {
    const next = clampShare(v);
    setSideShareState(next);
    writeStored(SIDE_KEY, String(next));
  };
  const [topHeight, setTopHeightState] = useState(() => clampHeight(Number(readStored(TOP_KEY)) || TOP_HEIGHT_DEFAULT));
  const setTopHeight = (v: number) => {
    const next = clampHeight(v);
    setTopHeightState(next);
    writeStored(TOP_KEY, String(Math.round(next)));
  };
  const splitBox = useRef<HTMLDivElement>(null);
  /** Side by side needs a desktop; below it the two stack, as they always did. */
  const [isLarge, setIsLarge] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024);
  /** The site's header is pinned too: the board is pinned under it, not behind it. */
  const [headerOffset, setHeaderOffset] = useState(0);
  useEffect(() => {
    const measure = () => {
      setIsLarge(window.innerWidth >= 1024);
      const header = document.querySelector<HTMLElement>('[data-testid="global-app-header"]');
      setHeaderOffset(header ? Math.round(header.getBoundingClientRect().height) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
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
    const event = view.alerts.events.find((e) => e !== "candle" && day[e]) ?? "sunset";
    const at = day[event as AlertEvent];
    const lead = view.alerts.leadMinutes[view.alerts.leadMinutes.length - 1] ?? 15;
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
  const sb = view.shabbat;
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
    if (!view.shabbat.enabled) toast.warning("מסך השבת כבוי - הוא לא יופיע בשבת עד שתפעילו אותו.");
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
  const baseRef = useRef(state.base);
  baseRef.current = state.base;
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
      // Only what was changed here goes onto the board as it is now.
      const base = baseRef.current;
      const stored = await saved.save.mutateAsync((current) => mergeConfig(base, clean, current));
      sync.announceSaved();
      const now = latestDraft.current;
      dispatch({ type: "load", config: stored });
      if (now !== snapshot) {
        // Edited meanwhile: keep those edits, minus the content already written.
        const done = new Set(snapshot._records ?? []);
        const left = (now._records ?? []).filter((r) => !done.has(r));
        const kept = { ...now, _records: left.length ? left : undefined };
        dispatch({ type: "edit", key: "after-save", update: () => mergeConfig(clean, kept, stored) });
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
  const painted = draft.screenLayout === "illustrated";
  const layerProps: LayerProps = {
    config: view,
    saved: scoped,
    onEdit: edit,
    setPreview,
    colourFields: (vars) => colourFields(vars),
  };
  /** The theme's colours for one layer; ↺ puts one back to the theme's. */
  const colourFields = (vars: ThemeVar[]) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {vars.map((v) => (
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
  );
  /** The colours on screen now: the theme plus the live edits below. */
  const currentVars = () =>
    ({ ...theme.vars, ...(draft.themeOverrides as Partial<Record<ThemeVar, string>>) } as Record<
      ThemeVar,
      string
    >);
  const [naming, setNaming] = useState<{ id: string; value: string } | null>(null);
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
    edit("theme-rename", (c) => ({
      ...c,
      customThemes: c.customThemes.map((t) => (t.id === naming.id ? { ...t, name } : t)),
    }));
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

  const doExport = async (what: "themes" | "gradients" | "all", how: "file" | "clipboard") => {
    // "הכל" also carries the painted boards imported here, pictures inside,
    // so the file stands on its own in another system.
    let illustrations: PortableIllustration[] = [];
    let missing = 0;
    if (what === "all" && draft.customIllustrations.length) {
      const results = await Promise.allSettled(
        draft.customIllustrations.map(async (i) => toPortableIllustration(i, await urlToDataUrl(i.image))),
      );
      illustrations = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      missing = results.length - illustrations.length;
    }
    const payload = buildExport(
      draft,
      {
        themes: what !== "gradients",
        gradients: what !== "themes",
        // "הכל" also carries the board's shape, for the tablets editor
        board: what === "all",
      },
      illustrations,
    );
    const count = payload.themes.length + payload.gradients.length + illustrations.length;
    if (!count && !payload.board) return toast.error("אין עדיין ערכות נושא או גרדיאנטים משלכם לייצוא");
    const what_ = `${count} פריטים${payload.board ? " ומבנה הלוח" : ""}${
      missing ? ` · ${missing} תבניות לא יוצאו כי התמונה שלהן לא נטענה` : ""
    }`;
    const text = JSON.stringify(payload, null, 2);
    if (how === "clipboard") {
      void navigator.clipboard
        .writeText(text)
        .then(() => toast.success(`${what_} הועתקו ללוח`))
        .catch(() => toast.error("ההעתקה נכשלה"));
      return;
    }
    // A plain download: nothing leaves the browser.
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(what);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`${what_} יוצאו לקובץ`);
  };

  const doImport = async (text: string) => {
    try {
      const incoming = parseImport(text, newCustomThemeId, newGradientId);
      // Painted boards: the four built in are recognised and not uploaded
      // again; every other picture goes through the same uploader as a
      // background (decoded, resampled for the TV, stored) before the board
      // is added - the config keeps the stored URL, never the picture.
      const plan = planIllustrations(incoming);
      const uploaded: Array<Omit<CustomIllustration, "id">> = [];
      let failed = 0;
      for (const p of plan.upload) {
        try {
          const { url } = await uploadTvImage(dataUrlToFile(p.image, p.name));
          const { image: _picture, ...shape } = p;
          uploaded.push({ ...shape, image: url });
        } catch {
          failed++;
        }
      }
      edit("import", (c) => {
        const next = applyImport(c, incoming, uploaded);
        // The first painted board of the file becomes the one the
        // illustrated layout shows (the layout itself is left alone).
        const added = next.customIllustrations.filter((i) => !c.customIllustrations.some((o) => o.id === i.id));
        const first = plan.builtin[0] ?? added[0]?.id;
        return first ? { ...next, illustration: first } : next;
      });
      const parts = [
        incoming.themes.length ? `${incoming.themes.length} ערכות נושא` : "",
        incoming.gradients.length ? `${incoming.gradients.length} גרדיאנטים` : "",
        uploaded.length ? `${uploaded.length} תבניות מאוירות` : "",
      ].filter(Boolean);
      toast.success(
        [
          parts.length ? `יובאו ${parts.join(" ו-")}` : "",
          // Shape from the tablets editor: style, corners, spacing, text size, name
          incoming.board ? "הוחל מבנה הלוח (סגנון, פינות, מרווחים, גודל טקסט ושם)" : "",
          plan.builtin.length ? `${plan.builtin.length} תבניות מאוירות כבר קיימות כאן ולא הועלו שוב` : "",
          uploaded.length || plan.builtin.length ? "לבחירה: פריסה ← תבנית מאוירת" : "",
          failed ? `${failed} תמונות לא הועלו` : "",
          incoming.skipped ? `${incoming.skipped} פריטים לא תקינים דולגו` : "",
        ]
          .filter(Boolean)
          .join(" · ") + '. לחצו "שמור ושדר" כדי להחיל.',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "הייבוא נכשל");
    }
  };

  const [uploading, setUploading] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await uploadImages(files);
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

      <DeviceScopeBanner scope={scope} config={state.present} onClear={clearDevice} />

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
            title="ערכות נושא ועיצובים"
            hint="ערכה היא בסיס הצבעים; עיצוב הוא מראה שבניתם ושמרתם - כולו או רק חלקים ממנו (רקע, מסגרות, טקסט, פריסה). ערכות בהירות מתאימות למסכי LCD; על מסך OLED עדיף כהה."
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
                          onClick={() => setNaming({ id: t.id, value: t.name })}
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
            <DesignLibrary config={view} onEdit={edit} />
            <AlertDialog
              open={Boolean(themeSwitch)}
              onOpenChange={(open) => !open && setThemeSwitch(null)}
            >
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>יש שינויי צבע שלא נשמרו בערכה</AlertDialogTitle>
                  <AlertDialogDescription>
                    מעבר לערכה אחרת יבטל את שינויי הצבע שעשיתם על ״{theme.name}״. אפשר לשמור אותם
                    קודם כעיצוב חדש, וכך הם יישארו זמינים תמיד.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>להישאר כאן</AlertDialogCancel>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const name = `${theme.name} (מותאם)`;
                      edit("design-new", (c) => ({
                        ...c,
                        designs: [...c.designs, captureDesign(c, name, ["background", "frames", "text"])].slice(0, MAX_DESIGNS),
                      }));
                      toast.success(`הצבעים נשמרו כעיצוב "${name}".`);
                      setThemeSwitch(null);
                    }}
                  >
                    שמירה כעיצוב חדש
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
                  placeholder="שם חדש"
                  className="h-9 w-56"
                  onChange={(e) => setNaming({ ...naming, value: e.target.value })}
                />
                <Button type="submit" size="sm">
                  שינוי השם
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNaming(null)}>
                  ביטול
                </Button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
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
                    : 'ערכה מובנית: שנו צבעים (ב"רקעים", "מסגרות" ו"טקסט") ושמרו כעיצוב חדש.'}
                  {draft.customThemes.length >= 24 ? " הגעתם למספר הערכות המרבי (24)." : ""}
                </span>
              </div>
            )}
            {hasOverrides && (
              <p className="text-xs text-muted-foreground">
                בחירת ערכה אחרת מאפסת את התאמות הצבע שלמטה.
              </p>
            )}
            {painted && <PaintedPresets onEdit={edit} />}
          </Section>

          <Section
            title="רקעים"
            hint="מה שמאחורי: צבע, גרדיאנט, תמונה (שמיים, עננים...) או תמונה משלכם - ללוח כולו, לכל המסגרות או למסגרת אחת, עם סליידרים לכל אחד."
          >
            <BackgroundLayer {...layerProps} />
          </Section>

          <Section
            title="מסגרות"
            hint="הצורה של המסגרות: סגנון, פינות, קו, עובי, בליטה, או צורה משלכם מתמונה. איפה הן עומדות - בלשונית פריסה."
          >
            <FramesLayer {...layerProps} />
          </Section>

          <Section title="טקסט" hint="גופן, גודל וצבעים - לכל הלוח, בתוך מסגרת מסוימת, או לאזור אחד על הלוח.">
            <TextLayer {...layerProps} />
          </Section>
        </TabsContent>
        <TabsContent
          value="layout"
          className="mt-3 grid grid-cols-1 items-start gap-4 [&>*]:min-w-0 min-[1700px]:grid-cols-2"
        >
          <Section
            title="מסכים ומה עליהם"
            hint="כמה מסכים, ומה מופיע בכל אחד. מסך אחד — הלוח עומד; כמה — הוא מתחלף ביניהם."
          >
            <ScreenComposer
              config={draft}
              current={composerScreen}
              onChange={(screens, next) => {
                setComposerScreen(next);
                edit("screens", (c) => ({ ...c, screens }));
              }}
            />
          </Section>

          <Section
            title="כמה נכנס במסך"
            hint="יום עם הרבה מניינים לא נכנס במסך אחד. הלוח לוקח עוד מסך במקום להקטין את הטקסט — כאן קובעים איפה הקו."
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-32">
                <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="rows-per-screen">
                  מניינים במסך
                </label>
                <Input
                  id="rows-per-screen"
                  type="number"
                  min={4}
                  max={60}
                  value={draft.prayerRowsPerScreen}
                  onChange={(e) =>
                    edit("rowsPerScreen", (c) => ({
                      ...c,
                      prayerRowsPerScreen: Math.min(60, Math.max(4, Number(e.target.value) || 14)),
                    }))
                  }
                />
              </div>
              <p className="flex-1 text-xs text-muted-foreground">
                התשובה תלויה במסך: טלוויזיה מעל ארון הקודש מחזיקה יותר ממסך קטן על מדף. השבירה תמיד
                במעבר בין תפילות — שחרית לא תיחתך באמצע.
              </p>
            </div>
            {(painted || draft.screenLayout === "medallion") && <PaintedRows config={draft} onEdit={edit} />}
          </Section>

          <Section title="פריסת מסך" hint="איך המסך כולו מסודר. לוח שנבנה למעלה במסכים — המסכים שלו קובעים, גם בשבת.">
            <div className="grid grid-cols-2 gap-2">
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
            {painted && (
              <p className="text-xs text-muted-foreground">
                איזה ציור, והקיר, המסגרות והטקסט שלו - בלשונית עיצוב.
              </p>
            )}
            <DayLooksEditor config={draft} onEdit={edit} />
            {/* A painted board brings its own frames and their places. */}
            {!painted && <FrameSpacing config={view} onEdit={edit} />}

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
            hint="מהדלקת הנרות ביום שישי ועד צאת השבת הלוח מציג רק מסך שבת - חלות ונרות דולקים, 'שבת שלום', הפרשה וזמני השבת - בלי החלפת מסכים. הזמנים לפי מיקום בית הכנסת (בתי כנסת ← פרטים)."
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
            {/* One number for the whole synagogue, kept with the other zmanim settings
                and shared with the website - not a second copy here that could disagree. */}
            <p className="text-sm">
              צאת השבת והחג:{" "}
              <strong>
                {board.data.settings?.shabbat_end_minutes ?? draft.shabbat.endMinutesAfterSunset} דק׳ אחרי השקיעה
              </strong>{" "}
              <span className="text-xs text-muted-foreground">
                (או צאת הכוכבים, המאוחר מביניהם). משנים בפרטי בית הכנסת (הכפתור "בתי כנסת" למעלה ← פרטים ← כוונון ידני), וזה חל על הלוח ועל האתר יחד.
              </span>
            </p>
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
                    onChange={(e) => void upload(e.target.files)}
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
            title="ספירה לתפילה הבאה"
            hint="שורה מתחת לזמני התפילות שסופרת כמה נשאר למניין הבא. השאלה של מי שחוצה את האולם היא לא ״מתי מנחה״ אלא ״פספסתי?״, ומספר שזז עונה על זה מהר יותר משעה שצריך לחסר משעון. פעיל רק בפריסת ״לוח מלא״."
          >
            <label className="flex items-center gap-3">
              <Switch
                checked={draft.countdown.enabled}
                onCheckedChange={(on) =>
                  edit("cd-on", (c) => ({ ...c, countdown: { ...c.countdown, enabled: on } }))
                }
              />
              הצגת ספירה
            </label>
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
            <FigmaImport config={view} onEdit={edit} handoff={figmaHandoff} />
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
          onDeviceChange={onDeviceChange}
          preview={preview}
          {...board}
          fullscreen
          config={state.present}
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
                config={view}
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

  const top = layout === "top" && !fullscreen;
  const side = layout === "side" && !fullscreen;

  // On the studio's own toolbar row, beside the device menu: one row above
  // the board, not three.
  const layoutButtons = (
    <>
      <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="פריסת העורך">
        <Button
          type="button"
          variant={layout === "side" ? "default" : "ghost"}
          size="sm"
          className="h-7"
          aria-pressed={layout === "side"}
          onClick={() => setLayout("side")}
          title="הבקרות והתצוגה זו לצד זו, עם ידית ביניהן לשינוי הרוחב"
        >
          <Columns2 className="size-4" /> זה לצד זה
        </Button>
        <Button
          type="button"
          variant={layout === "top" ? "default" : "ghost"}
          size="sm"
          className="h-7"
          aria-pressed={layout === "top"}
          onClick={() => setLayout("top")}
          title="התצוגה למעלה ונשארת במקום, הבקרות מתחתיה נגללות, עם ידית לשינוי הגובה"
        >
          <Rows2 className="size-4" /> תצוגה למעלה
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={toggleFullscreen}
        title="התצוגה והעורך על כל המסך (Esc ליציאה)"
      >
        <Expand className="size-4" /> {fullscreen ? "יציאה ממסך מלא" : "מסך מלא לעריכה"}
      </Button>
    </>
  );

  const studioView = (
    <div className="w-full">
      <TvDeviceStudio
        onDeviceChange={onDeviceChange}
        preview={preview}
        {...board}
        config={state.present}
        index={index}
        cycle={cycle}
        progress={0}
        paused={!autoplay}
        editing={editing}
        selected={selected}
        onSelect={setSelected}
        onEdit={edit}
        large={top || fullscreen}
        fitHeight={top ? topHeight : undefined}
        toolbarExtra={layoutButtons}
      />
    </div>
  );

  /** Everything under the board: the inspector, the actions, the slides, the save bar. */
  const underPreview = (
    <>
      {editing && (
        <div className="mt-3">
          <TvEditInspector
            selected={selected}
            config={view}
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

      {/* The same save as the bar at the top, kept under the preview.

          The options run to several screens, so by the time somebody has
          finished changing something the only button that matters has
          scrolled out of sight, and they have to go back up to press it.
          It shows only while there is something to save, so a board that
          is up to date carries no extra furniture. */}
      {dirty && (
        <div
          data-sticky-chrome
          className="sticky bottom-0 z-20 -mx-1 mt-3 flex items-center gap-2 border-t bg-background/95 px-1 py-2 backdrop-blur"
        >
          <span className="text-xs text-muted-foreground">יש שינויים שלא נשמרו</span>
          <Button type="button" size="sm" className="ms-auto" onClick={save} disabled={saving}>
            <Save className="size-4" /> {saving ? "שומר…" : "שמור ושדר למסכים"}
          </Button>
        </div>
      )}
    </>
  );

  if (top)
    return (
      <div className="space-y-4">
        {/* The board stays under the site's header while the controls
            scroll beneath it; the bar under it sets how much of the screen
            it takes. The column is the fullscreen target, as in "side". */}
        <div
          ref={previewColumn}
          className="sticky z-30 -mx-1 bg-background px-1 pb-1 shadow-[0_6px_12px_-10px_rgba(0,0,0,0.35)]"
          style={{ top: headerOffset }}
          data-testid="editor-preview-top"
        >
          <div className="overflow-hidden pt-1" style={{ height: topHeight }}>
            {studioView}
          </div>
          <SplitHandle
            orientation="horizontal"
            label="גובה התצוגה"
            onDrag={(y) => {
              const box = previewColumn.current?.getBoundingClientRect();
              if (box) setTopHeight(y - box.top - 4);
            }}
            onStep={(d) => setTopHeight(topHeight + d * 40)}
            onReset={() => setTopHeight(TOP_HEIGHT_DEFAULT)}
          />
        </div>
        {underPreview}
        <div className="space-y-4">{controls}</div>
      </div>
    );

  return (
    <div
      ref={splitBox}
      className={`gap-2 ${side ? "grid lg:gap-2" : "grid gap-5"}`}
      style={
        side && isLarge
          ? { gridTemplateColumns: `minmax(0, ${1 - sideShare}fr) auto minmax(0, ${sideShare}fr)` }
          : undefined
      }
    >
      {/* ------------------------------------------------ preview column -- */}
      <div
        ref={previewColumn}
        className={`order-1 space-y-3 lg:order-3 ${fullscreen ? "overflow-auto bg-background p-4" : ""}`}
      >
        {/* Pinned while the controls scroll. It is capped to the window
            height and scrolls inside itself, because a sticky block taller
            than the window simply scrolls away - which left the whole left
            side of a wide screen empty. */}
        <div
          className={fullscreen ? "space-y-3" : "lg:sticky lg:space-y-3 lg:overflow-y-auto lg:pe-1"}
          style={
            fullscreen || !isLarge
              ? undefined
              : { top: headerOffset + 8, maxHeight: `calc(100dvh - ${headerOffset + 16}px)` }
          }
        >
          {studioView}
          {underPreview}

          {/* In full screen only this column is on the screen - the browser
              puts *it* into fullscreen, not the page - so the controls come
              with it. Otherwise "full screen for editing" is a screen you
              cannot edit from. Rendered here or below, never in both: two
              copies would be two of every control. */}
          {fullscreen && <div className="mt-4">{controls}</div>}
        </div>
      </div>

      {/* --------------------------------------------- the bar between -- */}
      {side && isLarge && (
        <div className="order-2 hidden lg:flex">
          <SplitHandle
            orientation="vertical"
            label="רוחב התצוגה מול הבקרות"
            onDrag={(x) => {
              const box = splitBox.current?.getBoundingClientRect();
              // The preview is the left column (the page is right to left).
              if (box) setSideShare((x - box.left) / box.width);
            }}
            onStep={(d) => setSideShare(sideShare + d * 0.05)}
            onReset={() => setSideShare(SIDE_SHARE_DEFAULT)}
          />
        </div>
      )}

      {/* ----------------------------------------------- controls column -- */}
      <div className="order-3 space-y-4 lg:order-1">{!fullscreen && controls}</div>
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

/* ------------------------------------------------------ editor layout -- */

const LAYOUT_KEY = "shul-hub.tv-editor.layout";
const SIDE_KEY = "shul-hub.tv-editor.side-share";
const TOP_KEY = "shul-hub.tv-editor.top-height";
/** The board's share of the width, side by side - what the page gave it before. */
const SIDE_SHARE_DEFAULT = 0.52;
const TOP_HEIGHT_DEFAULT = 440;

/** Neither side so narrow it is useless: a board under 30%, controls under 25%. */
function clampShare(v: number): number {
  return Math.min(0.75, Math.max(0.3, v));
}

/** A board at least readable, and room left for at least a few controls. */
function clampHeight(v: number): number {
  const max = typeof window === "undefined" ? 900 : Math.max(260, window.innerHeight - 260);
  return Math.min(max, Math.max(220, v));
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: it simply is not remembered */
  }
}
