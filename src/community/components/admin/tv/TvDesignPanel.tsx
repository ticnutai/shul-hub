import { useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  Check,
  ExternalLink,
  Expand,
  Columns2,
  Rows2,
  ArrowLeftRight,
  Pencil,
  Pause,
  Play,
  Redo2,
  Save,
  Undo2,
  Maximize,
  PanelTopClose,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useLocation } from 'react-router-dom';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  ALERT_EVENT_LABELS,
  DEFAULT_TV_CONFIG,
  normalizeTvConfig,
  type AlertEvent,
  configForDevice,
  editForDevice,
  type TvConfig,
} from "@/tv/config";
import { mergeConfig, sameJson } from "@/tv/configMerge";
import { findDesign } from "@/tv/designs";
import { classOfPreviewDevice, type DeviceClass } from "@/tv/devices";
import { useElementEditing } from "@/tv/elementEditing";
import { normalizeElements } from "@/tv/elements";
import {
  dataUrlToFile,
  toPortableIllustration,
  urlToDataUrl,
  type CustomIllustration,
  type PortableIllustration,
} from "@/tv/illustrated";
import { editOccasionDesign, occasionLook } from "@/tv/occasionDesign";
import { occasionPagesNow, readOccasions } from "@/tv/occasions";
import { editPage, pageAt, pageLook, readPages } from "@/tv/partPages";
import { isAllowedEdit } from "@/tv/records";
import { nextCandleLighting } from "@/tv/shabbat";
import {
  getTheme,
  newCustomThemeId,
  newGradientId,
  THEME_VAR_LABELS,
  type ThemeVar,
} from "@/tv/themes";
import { applyImport, buildExport, exportFileName, parseImport, planIllustrations } from "@/tv/transfer";
import { useDayZmanim } from "@/tv/useBoardData";
import { downloadFile } from "@/tv/workspaceTransfer";

import { jerusalemWeekday, zmanimFor } from "@community/lib/minyan-time";

import { type AlertExample } from "./AlertsSettings";
import { BuildGuide, type BuildStep } from "./BlankBoardStarter";
import { ContentTab } from "./ContentTab";
import { DesignTab } from "./DesignTab";
import type { DeviceMode } from "./devices";
import { DeviceScopeBanner, type DeviceScope } from "./DeviceScopeBanner";
import { draftReducer } from "./draftState";
import { BARE_KEY, FOCUS_KEY, LAYOUT_KEY, SIDE_H_KEY, SIDE_HEIGHT_DEFAULT, SIDE_KEY, SIDE_SHARE_DEFAULT, STUDIO_CHROME, TOP_HEIGHT_DEFAULT, TOP_KEY, clampHeight, clampShare, clampSideHeight, readStored, writeStored } from "./editorLayout";
import { ColorField, Section } from "./editorParts";
import { ElementEditingProvider } from "./ElementEditingProvider";
import { ElementTextTools } from "./ElementTextTools";
import { type LayerProps } from "./LayerEditors";
import { LayoutTab } from "./LayoutTab";
import { OccasionsEditor } from "./OccasionsEditor";
import { PartPagesBar } from "./PartPagesBar";
import { ReadabilityNote } from "./ReadabilityNote";
import { SplitHandle } from "./SplitHandle";
import { StudioPanel } from "./StudioPanel";
import { ToolsTab } from "./ToolsTab";
import { uploadTvImage, useTvConfig, useTvDevices, deviceHealth } from "./tvAdminData";
import { useDraftSync } from "./tvDraftChannel";
import { TvEditInspector } from "./TvEditInspector";
import { SlideStrip, TvDeviceStudio } from "./TvPreview";
import { useTvSlides } from "./tvPreviewData";
import { commitRecordEdits } from "./tvRecords";
import { uploadImages } from "./uploadImages";

/**
 * Live editor for the board's look and content rotation.
 *
 * Every control edits one draft TvConfig; the preview renders that draft
 * immediately with the TV's own components. Nothing reaches a TV until
 * "שמור ושדר" - a preview is never persisted silently. Undo/redo cover the
 * draft; consecutive edits of the same field (dragging a colour picker)
 * collapse into one history step so undo stays meaningful.
 */

/* ---------------------------------------------------------------- panel -- */

/**
 * `studio`: the live editor window (/admin/tv-board?draft=1) - the board on
 * the whole screen, with every control of this panel in a floating panel
 * over it. It is the same editor (one draft, one save), kept in step with an
 * editor open on the admin page through tvDraftChannel.
 */
export function TvDesignPanel(props: { studio?: boolean } = {}) {
  return <ElementEditingProvider><TvDesignPanelContent {...props} /></ElementEditingProvider>;
}
function TvDesignPanelContent({ studio = false }: { studio?: boolean } = {}) {
  const elementEditing = useElementEditing()!;
  const routerLocation = useLocation();
  const { setEnabled: setElementEditingEnabled, setDraft: setElementDraft, select: selectElements } = elementEditing;
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
  /**
   * An occasion whose own design this panel is working on (its 🎨 in
   * "מועדים"), or null for the board. While one is chosen the controls read
   * and change that occasion's design (occasionDesign.ts), on every screen.
   */
  const [occasionScope, setOccasionScope] = useState<string | null>(null);
  /** Every box ("frames") or one ("frame:<id>"): what the parts 2-5 of the design tab are about. */
  const [partTarget, setPartTarget] = useState("frames");
  // After "התחלה מאפס": the steps left, and the ones already visited.
  const [guide, setGuide] = useState<BuildStep[] | null>(null);
  const goToStep = (step: BuildStep) => {
    setGuide((g) => (g && !g.includes(step) ? [...g, step] : g));
    setTab(step === "arrange" ? "layout" : "design");
    // Once the tab is drawn; instant, as a smooth scroll stops in a background window.
    window.setTimeout(() => document.getElementById(step === "arrange" ? "layout-screens" : step)?.scrollIntoView({ block: "start" }), 80);
  };

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
   * Something other than the draft on the preview, to compare: what is on
   * the screens now ("לפני / אחרי"), or an earlier version. Never edited -
   * editing on the board, and the try-outs, are for the draft alone.
   */
  const [beforeAfter, setBeforeAfter] = useState(false);
  const [shownVersion, setShownVersion] = useState<{ id: string; label: string; config: TvConfig } | null>(null);

  /**
   * The board as the chosen screen sees it. Everything on this panel shows
   * this rather than the shared board, so the controls read back what that
   * screen actually does and the preview is that screen's board. With no
   * screen chosen it is the shared board itself, unchanged.
   */
  /**
   * Which page of a board of parts is being worked on (partPages.ts): page 1
   * is the board; on any other, everything here - the preview, the kit, the
   * frames, what they show - is that page's, and nothing else changes.
   */
  const [pageScope, setPageScope] = useState(0);
  const pageIndex = occasionScope ? 0 : Math.min(pageScope, readPages(state.present).length - 1);
  // Worked out once per change, not per render: the effects below that clear a
  // selection when what is shown changes ran on every render while comparing.
  const scoped = useMemo(
    () =>
      occasionScope
        ? occasionLook(state.present, occasionScope)
        : configForDevice(pageLook(state.present, pageIndex), scopeDevice),
    [state.present, occasionScope, pageIndex, scopeDevice],
  );
  const savedConfig = saved.data?.config;
  const comparing = useMemo(
    () => shownVersion ?? (beforeAfter && savedConfig ? { id: "saved", label: "מה שעל המסכים עכשיו", config: savedConfig } : null),
    [shownVersion, beforeAfter, savedConfig],
  );
  /**
   * The pages taking their turns in the preview, as on the wall ("הצגת החלפה"):
   * a tick a second while it plays, and none at all otherwise.
   */
  const [pagesPlaying, setPagesPlaying] = useState(false);
  const [pagesTick, setPagesTick] = useState(() => Date.now());
  useEffect(() => {
    if (!pagesPlaying) return;
    const timer = window.setInterval(() => setPagesTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pagesPlaying]);
  const playingPage = pagesPlaying ? pageAt(state.present, new Date(pagesTick)) : null;
  const shownPage = playingPage ?? pageIndex;
  const shownConfig = comparing ? pageLook(comparing.config, shownPage) : pageLook(state.present, shownPage);
  const view = useMemo(() => (preview ? { ...scoped, ...preview } : scoped), [preview, scoped]);

  const edit = useCallback(
    (key: string, update: (c: TvConfig) => TvConfig) =>
      dispatch({
        type: "edit",
        key: `${occasionScope ?? scope}:page${pageIndex}:${key}`,
        // The controls are all (config) => config and none of them know that
        // screens, occasions or pages exist; this is the one place that decides
        // where the change lands (see editForDevice, editOccasionDesign, editPage).
        update: (c) =>
          occasionScope
            ? editOccasionDesign(c, occasionScope, update)
            : pageIndex > 0
              ? editPage(c, pageIndex, (p) => editForDevice(p, scopeDevice, update))
              : editForDevice(c, scopeDevice, update),
      }),
    [scope, scopeDevice, occasionScope, pageIndex],
  );

  // Keyboard undo/redo while the panel is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Only where text is typed does the field keep its own undo; a checkbox or a
      // slider just clicked does not, or Ctrl+Z after ticking one did nothing.
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable || target?.tagName === "TEXTAREA") return;
      if (target instanceof HTMLInputElement && !/^(checkbox|radio|range|color|button|submit|reset|file)$/.test(target.type)) return;
      // The key, not the letter: on a Hebrew keyboard Z types "ז" and Y types "ט",
      // and the shortcuts never fired for a gabbai typing in Hebrew.
      const key = e.code === "KeyZ" ? "z" : e.code === "KeyY" ? "y" : e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if ((e.ctrlKey || e.metaKey) && key === "y") {
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
  /**
   * The design an occasion dresses the screens in at the preview's moment
   * (הושענא רבה in carved wood). The screens and the connected-screens tab
   * wear it; the editor shows the board being edited, without it - and says
   * so, with a way to look at it as the screens do. Without this the three
   * pictures of one board (here, there, and the TV's photo) disagreed with
   * nothing to explain why.
   */
  const previewMinute = Math.floor(board.now.getTime() / 60_000);
  const dayLookNow = useMemo(() => {
    const at = new Date(previewMinute * 60_000);
    const settings = board.data.settings;
    const { active } = occasionPagesNow(view, settings, at, (d) => zmanimFor(d, settings));
    // The most important occasion on with a design: the one that would be worn.
    const dressed = active.find((a) => a.occasion.design && findDesign(view, a.occasion.design));
    if (!dressed) return null;
    return {
      design: findDesign(view, dressed.occasion.design)!.name,
      occasion: dressed.occasion.name,
      on: dressed.occasion.designOn,
    };
  }, [view, board.data.settings, previewMinute]);
  const [dayLookShown, setDayLookShown] = useState(false);
  // Only a design that dresses the whole board changes the ordinary screens.
  const dayLook = dayLookShown && dayLookNow?.on === "board";
  const [previewIndex, setPreviewIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  // Click-to-edit on the board itself (see boardEdit.ts / TvEditInspector).
  // The live window opens ready to click on the board.
  const [editing, setEditing] = useState(studio);
  const [selected, setSelected] = useState<string | null>(null);
  /**
   * A double click on the board: editing opens, and the part under the
   * pointer is selected - once the board has drawn itself in editing, when
   * its parts carry their marks.
   */
  const editOnBoardAt = useCallback((x: number, y: number) => {
    setEditing(true);
    setAutoplay(false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const key = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-edit]")?.dataset.edit;
        if (key && key !== "board.background") setSelected(key);
      }),
    );
  }, []);
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
  /** Side by side: how tall the board may be (it used to stop at a fixed 520 px). */
  const [sideHeight, setSideHeightState] = useState(() => clampSideHeight(Number(readStored(SIDE_H_KEY)) || SIDE_HEIGHT_DEFAULT));
  const setSideHeight = (v: number) => {
    const next = clampSideHeight(v);
    setSideHeightState(next);
    writeStored(SIDE_H_KEY, String(Math.round(next)));
  };
  /**
   * Work mode: the site's header, the admin's heading and the rows of tabs
   * above the editor are hidden (tvEdit.css), and their room goes to the
   * board and its controls. Remembered in this browser.
   */
  const [focus, setFocusState] = useState(() => readStored(FOCUS_KEY) === "1");
  const setFocus = (on: boolean) => {
    setFocusState(on);
    writeStored(FOCUS_KEY, on ? "1" : "0");
  };
  useEffect(() => {
    document.body.classList.toggle("tv-focus", focus);
    return () => document.body.classList.remove("tv-focus");
  }, [focus]);
  /** The board without the drawn TV around it: the bezel and the stand go to the board. */
  const [bare, setBareState] = useState(() => readStored(BARE_KEY) === "1");
  const setBare = (on: boolean) => {
    setBareState(on);
    writeStored(BARE_KEY, on ? "1" : "0");
  };
  /** The sizes before "מקסימום", for the way back. */
  const [beforeMax, setBeforeMax] = useState<{ topHeight: number; sideShare: number; sideHeight: number } | null>(null);
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
    // Work mode hides the header: it is measured again, at nothing.
  }, [focus]);
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
  // ?panel= opens a tab directly: the minyanim admin links to "פריסה" for
  // the board's own prayer-times setting.
  const [tab, setTab] = useState(() => {
    if (figmaHandoff) return "tools";
    const search = new URLSearchParams(routerLocation.search);
    // The old "מועדים ואירועים" tab's links land on the occasions.
    if (search.get("tvTab") === "events") return "occasions";
    const panel = search.get("panel");
    return panel && ["design", "layout", "content", "occasions", "tools"].includes(panel) ? panel : "design";
  });
  /** The list of a board's parts, in the design tab. */
  const openPartsList = () => {
    setTab("design");
    window.setTimeout(() => document.getElementById("design-elements")?.scrollIntoView({ block: "start" }), 80);
  };

  /** "ביטול שינויים" asks inline before it throws the draft away. */
  useEffect(() => {
    const search=new URLSearchParams(routerLocation.search);
    const panel=search.get('panel');
    if(panel && ['design','layout','content','occasions','tools'].includes(panel)) setTab(panel);
    else if(search.get('tvTab')==='events') setTab('occasions');
  },[routerLocation.search,routerLocation.key]);

  const [confirmDiscard, setConfirmDiscard] = useState(false);
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
  // The screen open in the composer is the one the preview shows: choosing
  // "מסך 2" there and seeing the first screen here read as the choice doing nothing.
  const [previewScreen, setPreviewScreen] = useState<string | null>(null);
  useEffect(() => {
    if (!previewScreen) return;
    // An occasion's screen is its card, or its own screen (occasion:<id>:screen).
    const target = previewScreen.startsWith("occasion:") ? previewScreen : `screen:${previewScreen}`;
    const i = board.slides.findIndex((s) => s.id === target || s.id.startsWith(`${target}:`));
    if (i >= 0) setPreviewIndex(i);
  }, [previewScreen, board.slides]);
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
  const showAlertExample = (what: AlertExample = "board") => {
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
    if (!at) return toast.error("אין זמן מתאים היום להדגמה");
    // A moment at the step asked for: the staged board's card or panel, the pulsing card or its strip.
    const { stages, leadMinutes, mode } = view.alerts;
    const lead = leadMinutes[leadMinutes.length - 1] ?? 15;
    const seconds =
      mode === "staged"
        ? what === "panel" ? stages.panel * 60 - 5 : (stages.board || stages.panel || stages.highlight) * 60 - 5
        : what === "chip" ? Math.max(lead * 60 - view.alerts.popupSeconds - 30, 30) : lead * 60 - 2;
    setSimulatedNow(new Date(at.getTime() - seconds * 1000));
    window.setTimeout(() => setSimulatedNow(null), 12_000);
    toast.info(`מציג איך תיראה התזכורת ${Math.ceil(seconds / 60)} דקות לפני ${ALERT_EVENT_LABELS[event as AlertEvent]}`);
  };

  // Preview another moment: Shabbat, an occasion's day, any date - until the
  // admin goes back to real time.
  const [shabbatPreview, setShabbatPreview] = useState(false);
  const previewAt = (at: Date | null) => {
    setShabbatPreview(Boolean(at));
    setSimulatedNow(at);
    setPreviewIndex(0);
  };
  /** Brings the board's preview into sight, from a control further down the page. */
  const showPreview = () =>
    // A timer rather than a frame, and a jump rather than a glide: a smooth
    // scroll is cut short by the tab switch that 🎨 makes, and neither frames
    // nor a glide run in a tab that is not in front.
    window.setTimeout(() => document.querySelector("[data-board-preview]")?.scrollIntoView({ block: "center" }), 0);
  const toggleShabbatPreview = () => {
    if (shabbatPreview) {
      setShabbatPreview(false);
      setSimulatedNow(null);
      return;
    }
    const candle = nextCandleLighting(new Date(), board.data.settings);
    if (!candle) return toast.error("לא ניתן לחשב את זמן הדלקת הנרות");
    previewAt(new Date(candle.getTime() + 20 * 60_000));
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

  // What is being edited: the board, one screen's, or one occasion's design.
  const theme = getTheme(scoped.theme, draft.customThemes);
  elementEditing.api.current = {
    elements: view.elements,
    commit: (next, key = `elements:${crypto.randomUUID()}`) => edit(key, c => ({ ...c, elements: normalizeElements(next) })),
  };
  useEffect(() => { setElementEditingEnabled(editing && !comparing); }, [editing, comparing, setElementEditingEnabled]);
  useEffect(() => { setElementDraft(null); selectElements([]); }, [scope, occasionScope, pageIndex, comparing, setElementDraft, selectElements]);
  /**
   * The text of the part clicked on the board: the same bar as in the list of
   * parts. A double click on a text of the gabbai's writes into it there.
   */
  const partText = elementEditing.selected.some((id) => view.elements.some((e) => e.id === id && e.kind === "text")) ? (
    <div className="space-y-1" data-testid="preview-text-tools">
      <ElementTextTools
        elements={view.elements}
        ids={elementEditing.selected}
        onPatch={(ids, p, what) =>
          edit(`element-text:${ids.join(",")}:${what}`, (c) => ({ ...c, elements: normalizeElements(c.elements.map((x) => (ids.includes(x.id) && !x.locked ? { ...x, ...p } : x))) }))
        }
      />
      <p className="text-[11px] text-muted-foreground">לחיצה כפולה על טקסט בלוח - כותבים בו ישירות. Enter לסיום, Esc לביטול.</p>
    </div>
  ) : null;
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
          value={scoped.themeOverrides[v] ?? theme.vars[v]}
          themeValue={theme.vars[v]}
          overridden={v in scoped.themeOverrides}
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
    if (!count && !payload.board) return toast.error("אין עדיין צבעי בסיס או גרדיאנטים משלכם לייצוא");
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
    downloadFile(new Blob([text], { type: "application/json" }), exportFileName(what));
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
        incoming.themes.length ? `${incoming.themes.length} סטים של צבעי בסיס` : "",
        incoming.gradients.length ? `${incoming.gradients.length} גרדיאנטים` : "",
        uploaded.length ? `${uploaded.length} תבניות מאוירות` : "",
      ].filter(Boolean);
      toast.success(
        [
          parts.length ? `יובאו ${parts.join(" ו-")}` : "",
          // Shape from the tablets editor: style, corners, spacing, text size, name
          incoming.board ? "הוחל מבנה הלוח (קשת או פינות, רקע, מרווחים, גודל טקסט ושם)" : "",
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
      {/* What is on the screens now against the draft - while there is a difference to see. */}
      <Button
        type="button"
        variant={beforeAfter ? "default" : "outline"}
        size="sm"
        aria-pressed={beforeAfter}
        disabled={!dirty && !beforeAfter}
        title="מחליף בין מה שעל המסכים עכשיו לבין השינויים שלא נשמרו"
        onClick={() => {
          setShownVersion(null);
          setBeforeAfter((v) => !v);
        }}
      >
        <ArrowLeftRight className="size-4" /> {beforeAfter ? "חזרה לטיוטה" : "לפני / אחרי"}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setAutoplay((a) => !a)}>
        {autoplay ? <Pause className="size-4" /> : <Play className="size-4" />}
        {autoplay ? "עצירת הסבב" : "הפעלת סבב"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => showAlertExample("board")}
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
          מדמה {shabbatPreview ? `${simulatedNow.toLocaleDateString("he-IL")}, ` : "את השעה "}
          {simulatedNow.toTimeString().slice(0, 5)}
        </span>
      )}
      {dayLookNow && (
        <div
          className="flex w-full flex-wrap items-center gap-2 rounded-md border border-amber-400/60 bg-amber-50 px-2 py-1.5 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
          data-testid="day-look-note"
        >
          <span className="min-w-0 flex-1">
            {dayLookNow.on === "screen"
              ? `${simulatedNow ? "ביום הזה" : "עכשיו"} המסך של ${dayLookNow.occasion} בעיצוב «${dayLookNow.design}», והמסכים הרגילים בעיצוב שלהם. את עיצוב המועד בוחרים בהגדרות המועד (לשונית מועדים).`
              : `${simulatedNow ? "ביום הזה" : "עכשיו"} כל המסכים לובשים את העיצוב «${dayLookNow.design}» של ${dayLookNow.occasion}. ${
                  dayLook
                    ? "כך הם נראים עכשיו. שינויים בעיצוב כאן חלים על הלוח הרגיל."
                    : "כאן מוצג העיצוב הרגיל שאתם עורכים."
                }`}
          </span>
          {dayLookNow.on === "board" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            aria-pressed={dayLook}
            onClick={() => setDayLookShown((v) => !v)}
          >
            {dayLook ? "הצגת העיצוב הרגיל" : "הצגה כמו במסכים"}
          </Button>
          )}
        </div>
      )}
    </>
  );

  // Every design control, shared by the admin page and the live window's panel.
  // "ביטול שינויים" asks first, inline (see below).
  const controls = (
    <>
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur">
        <Button type="button" variant="outline" size="sm" onClick={() => {
          setTab('tools');
          requestAnimationFrame(() => requestAnimationFrame(() => {
            document.querySelector('[data-testid="board-transfer-section"]')?.scrollIntoView({ block: 'start' });
            document.querySelector<HTMLElement>('[data-testid="board-transfer-section"] h2')?.focus();
          }));
        }}>ייבוא / ייצוא</Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="צעד אחורה (Ctrl+Z)"
          title="צעד אחורה (Ctrl+Z)"
          disabled={!state.past.length}
          onClick={() => dispatch({ type: "undo" })}
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="צעד קדימה (Ctrl+Y)"
          title="צעד קדימה (Ctrl+Y)"
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

      {occasionScope ? (
        <div
          role="status"
          data-testid="occasion-design-banner"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/50 bg-primary/5 p-3 text-sm"
        >
          <span>
            🎨 עורכים עכשיו את העיצוב של <b>{readOccasions(state.present).find((o) => o.id === occasionScope)?.name ?? "המועד"}</b> - כל
            שינוי כאן (רקע ותמונות, צבעים, מסגרות, גופן) נשמר לעיצוב שלו בלבד. הלוח הרגיל לא משתנה.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setOccasionScope(null);
              previewAt(null);
              setPreviewScreen(null);
            }}
          >
            חזרה לעיצוב הלוח
          </Button>
        </div>
      ) : (
        <DeviceScopeBanner scope={scope} config={state.present} onClear={clearDevice} />
      )}

      {guide && <BuildGuide done={guide} onStep={goToStep} onClose={() => setGuide(null)} />}

      {/* The pages of a board of parts: above the tabs, since every tab edits the page chosen here. */}
      {!occasionScope && (state.present.screenLayout === "composition" || readPages(state.present).length > 1) && (
        <PartPagesBar
          config={state.present}
          current={pageIndex}
          onSelect={(i) => { setPagesPlaying(false); setPageScope(i); }}
          playing={playingPage}
          onPlay={(on) => { setPagesTick(Date.now()); setPagesPlaying(on); }}
          onEdit={(key, update) => dispatch({ type: "edit", key: `pages:${key}`, update })}
        />
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="design">עיצוב</TabsTrigger>
          <TabsTrigger value="layout">פריסה</TabsTrigger>
          <TabsTrigger value="content">תוכן</TabsTrigger>
          <TabsTrigger value="occasions">מועדים</TabsTrigger>
          <TabsTrigger value="tools">כלים</TabsTrigger>
        </TabsList>
        <TabsContent value="occasions" className="mt-3">
          <Section
            title="שבת, חגים ומועדים"
            hint="מה מופיע על הלוח בשבת, בחגים ובימים שלכם - לכל מועד בנפרד, ובאיזה סדר חשיבות."
          >
            <OccasionsEditor
              config={draft}
              onEdit={edit}
              onPreview={(at, occasionId) => {
                // Its day, on its own screen - and in sight: the list is far
                // below the preview, and the eye seemed to do nothing at all.
                previewAt(at);
                setPreviewScreen(at && occasionId ? `occasion:${occasionId}` : null);
                if (at) showPreview();
              }}
              onDesign={(occasionId) => {
                setOccasionScope(occasionId);
                setTab("design");
                // Again once the tab has changed: switching it scrolls the page to the tabs.
                window.setTimeout(showPreview, 200);
              }}
            />
          </Section>
        </TabsContent>
        <TabsContent
          value="design"
          className="mt-3 grid grid-cols-1 items-start gap-4 [&>*]:min-w-0 min-[1700px]:grid-cols-2"
        >
          <DesignTab draft={draft} scoped={scoped} view={view} edit={edit} dispatch={dispatch} partTarget={partTarget} setPartTarget={setPartTarget} wholeBoardOnly={Boolean(occasionScope) || scope !== "all"} setComposerScreen={setComposerScreen} setGuide={setGuide} layerProps={layerProps} textToolsElsewhere={editing && Boolean(partText)} />
        </TabsContent>
        <TabsContent
          value="layout"
          className="mt-3 grid grid-cols-1 items-start gap-4 [&>*]:min-w-0 min-[1700px]:grid-cols-2"
        >
          <LayoutTab draft={draft} scoped={scoped} view={view} edit={edit} openPartsList={openPartsList} composerScreen={composerScreen} setComposerScreen={setComposerScreen} setPreviewScreen={setPreviewScreen} previewAt={previewAt} />
        </TabsContent>
        <TabsContent
          value="content"
          className="mt-3 grid grid-cols-1 items-start gap-4 [&>*]:min-w-0 min-[1700px]:grid-cols-2"
        >
          <ContentTab draft={draft} scoped={scoped} edit={edit} uploading={uploading} upload={upload} showAlertExample={showAlertExample} />
        </TabsContent>
        <TabsContent
          value="tools"
          className="mt-3 grid grid-cols-1 items-start gap-4 [&>*]:min-w-0 min-[1700px]:grid-cols-2"
        >
          <ToolsTab draft={draft} view={view} edit={edit} dispatch={dispatch} shownVersion={shownVersion} setShownVersion={setShownVersion} setBeforeAfter={setBeforeAfter} showPreview={showPreview} doExport={doExport} doImport={doImport} figmaHandoff={figmaHandoff} />
        </TabsContent>
      </Tabs>
    </>
  );

  if (studio) {
    return (
      <>
        <TvDeviceStudio
          onDeviceChange={onDeviceChange}
          preview={comparing ? null : preview}
          {...board}
          dayLook={dayLook}
          fullscreen
          config={shownConfig}
          index={index}
          cycle={cycle}
          progress={0}
          paused={!autoplay}
          editing={editing && !comparing}
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
            {/* A board of parts turns its pages (above the tabs), not these. */}
            {view.screenLayout !== "composition" && <SlideStrip
              slides={board.slides}
              index={index}
              onPick={(i) => {
                setPreviewIndex(i);
                setCycle((c) => c + 1);
              }}
            />}
            {editing && (
              <TvEditInspector
                selected={selected}
                config={view}
                data={board.data}
                onEdit={edit}
                onSelect={setSelected}
              />
            )}
            {editing && partText}
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
      <Button
        type="button"
        variant={focus ? "default" : "outline"}
        size="sm"
        aria-pressed={focus}
        onClick={() => setFocus(!focus)}
        title="מסתיר את הסרגל של האתר ואת שורות הלשוניות שמעל העורך, כדי שכל המסך יהיה ללוח ולבקרות"
      >
        <PanelTopClose className="size-4" /> {focus ? "יציאה ממצב עבודה" : "מצב עבודה"}
      </Button>
      <Button
        type="button"
        variant={beforeMax ? "default" : "outline"}
        size="sm"
        aria-pressed={Boolean(beforeMax)}
        onClick={toggleMax}
        title="הלוח בגודל הגדול ביותר שנכנס; לחיצה נוספת מחזירה לגודל הקודם"
      >
        <Maximize className="size-4" /> {beforeMax ? "גודל קודם" : "מקסימום"}
      </Button>
      <Button
        type="button"
        variant={bare ? "default" : "outline"}
        size="sm"
        aria-pressed={bare}
        onClick={() => setBare(!bare)}
        title="מסתיר את הטלוויזיה המצוירת (השוליים והמעמד), והמקום שלה הולך ללוח"
      >
        <Square className="size-4" /> בלי מסגרת טלוויזיה
      </Button>
    </>
  );

  /**
   * A handle around the board was dragged: the board asks for a size, and
   * the layout gives it room - in "top", the height of the band it stands in;
   * side by side, the height it may take and, when it needs it, a wider column.
   */
  const resizeBoard = ({ width, height }: { width: number; height: number }) => {
    setBeforeMax(null);
    if (layout === "top") {
      setTopHeight(height + STUDIO_CHROME);
      return;
    }
    setSideHeight(height + STUDIO_CHROME);
    const box = splitBox.current?.getBoundingClientRect();
    const column = previewColumn.current?.getBoundingClientRect();
    if (box && column && width + 32 > column.width) setSideShare((width + 32) / box.width);
  };
  const resetBoardSize = () => {
    setBeforeMax(null);
    if (layout === "top") setTopHeight(TOP_HEIGHT_DEFAULT);
    else {
      setSideHeight(SIDE_HEIGHT_DEFAULT);
      setSideShare(SIDE_SHARE_DEFAULT);
    }
  };
  function toggleMax() {
    if (beforeMax) {
      setTopHeight(beforeMax.topHeight);
      setSideShare(beforeMax.sideShare);
      setSideHeight(beforeMax.sideHeight);
      setBeforeMax(null);
      return;
    }
    setBeforeMax({ topHeight, sideShare, sideHeight });
    if (layout === "top") setTopHeight(Number.MAX_SAFE_INTEGER);
    else {
      setSideShare(1);
      setSideHeight(Number.MAX_SAFE_INTEGER);
    }
  }

  const studioView = (
    <div className="w-full" data-board-preview>
      {comparing && (
        <div
          className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border-2 border-amber-500/60 bg-amber-500/10 p-2 text-sm"
          data-testid="preview-comparing"
        >
          <span className="flex-1">
            מוצג עכשיו: <b>{comparing.id === "saved" ? "מה שעל המסכים - לפני השינויים" : `הגרסה מ-${comparing.label}`}</b>. אי אפשר לערוך אותו.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setBeforeAfter(false);
              setShownVersion(null);
            }}
          >
            חזרה לטיוטה
          </Button>
        </div>
      )}
      <TvDeviceStudio
        onDeviceChange={onDeviceChange}
        preview={comparing ? null : preview}
        {...board}
        dayLook={dayLook}
        config={shownConfig}
        index={index}
        cycle={cycle}
        progress={0}
        paused={!autoplay}
        editing={editing && !comparing}
        selected={selected}
        onSelect={setSelected}
        onEdit={edit}
        large={top || fullscreen}
        fitHeight={top ? topHeight : side && isLarge ? sideHeight : undefined}
        toolbarExtra={layoutButtons}
        bare={bare}
        onRequestEdit={editOnBoardAt}
        onResize={fullscreen ? undefined : resizeBoard}
        onResizeReset={resetBoardSize}
      />
      {!comparing && (
        <ReadabilityNote
          watch={state.present}
          customBoxes={state.present.customBoxes}
          onFix={(frame) => {
            if (frame) setPartTarget(`frame:${frame}`);
            setTab("design");
            window.setTimeout(() => document.getElementById("design-text")?.scrollIntoView({ block: "start" }), 80);
          }}
        />
      )}
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
      {editing && partText && <div className="mt-3">{partText}</div>}
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
            <ExternalLink className="size-4" /> תצוגת הלוח השמור בחלון נפרד
          </Button>
        </span>
      </div>
      {view.screenLayout !== "composition" && <div className="mt-2">
        <SlideStrip
          slides={board.slides}
          index={index}
          onPick={(i) => {
            setPreviewIndex(i);
            setCycle((c) => c + 1);
          }}
        />
      </div>}

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
        {fullscreen && layout === "side" && isLarge ? (
          // Full screen, side by side: the controls on one side, the board on
          // the other, each scrolling on its own - editing while looking.
          <div
            className="grid h-full gap-4"
            style={{ gridTemplateColumns: `minmax(0, ${1 - sideShare}fr) minmax(0, ${sideShare}fr)` }}
          >
            <div className="min-h-0 space-y-4 overflow-y-auto pe-1">{controls}</div>
            <div className="min-h-0 space-y-3 overflow-y-auto">
              {studioView}
              {underPreview}
            </div>
          </div>
        ) : (
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
        )}
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
