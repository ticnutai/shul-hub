import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ExternalLink,
  Columns2,
  Rows2,
  Palette,
  Pencil,
  Pause,
  Play,
  Redo2,
  Save,
  Undo2,
  Scaling,
} from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useLocation } from 'react-router-dom';
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  ALERT_EVENT_LABELS,
  DEFAULT_TV_CONFIG,
  normalizeTvConfig,
  configForDevice,
  editForDevice,
  type TvConfig,
} from "@/tv/config";
import { mergeConfig, sameJson } from "@/tv/configMerge";
import { findDesign, type SavedDesign } from "@/tv/designs";
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
import { editOccasionDesign, occasionLook, wearForOccasion } from "@/tv/occasionDesign";
import { nextDateOf, occasionPagesNow, readOccasions } from "@/tv/occasions";
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
import { downloadFile } from "@/tv/workspaceTransfer";

import { jerusalemDateKey, jerusalemWeekday, zmanimFor } from "@community/lib/minyan-time";

import { BuildGuide, type BuildStep } from "./BlankBoardStarter";
import { ContentTab } from "./ContentTab";
import { DesignTab } from "./DesignTab";
import { isDesignTopic, showDesignTopic } from "./designTopics";
import { KindChecklist, KindPicker } from "./KindPicker";
import { SaveKitButton } from "./DesignLibrary";
import type { DeviceMode } from "./devices";
import { DeviceScopeBanner, type DeviceScope } from "./DeviceScopeBanner";
import { draftReducer } from "./draftState";
import { BARE_KEY, FOCUS_KEY, LAYOUT_KEY, SIDE_H_KEY, SIDE_HEIGHT_DEFAULT, SIDE_KEY, SIDE_SHARE_DEFAULT, STUDIO_CHROME, TOP_HEIGHT_DEFAULT, TOP_KEY, clampHeight, clampShare, clampSideHeight, readStored, writeStored } from "./editorLayout";
import { ColorField, INPUT_CLASS, Section } from "./editorParts";
import { ElementEditingProvider } from "./ElementEditingProvider";
import { ElementTextTools } from "./ElementTextTools";
import { type LayerProps } from "./LayerEditors";
import { LayoutTab } from "./LayoutTab";
import { Notice } from "./Notice";
import { OccasionsEditor, occasionOffNote } from "./OccasionsEditor";
import { PartPagesBar, type OccasionTab } from "./PartPagesBar";
import { ReadabilityNote } from "./ReadabilityNote";
import { SplitHandle } from "./SplitHandle";
import { StudioPanel } from "./StudioPanel";
import { ToolsTab } from "./ToolsTab";
import { uploadTvImage, useTvConfig, useTvDevices, deviceHealth, sendCommand } from "./tvAdminData";
import { ALERT_DEMO_APP_CODE, alertDemoPayload, alertTimeline, screenSeconds, whatShows } from "@/tv/alertDemo";
import { useAlertSimulation } from "./alertSimulation";
import { PartContextPanel } from "./PartContextPanel";
import { PART_PANEL_SLOT } from "../adminPath";

/** Where the preview's toolbar row stands: under the board, beside its buttons. */
const PREVIEW_TOOLBAR_SLOT = "preview-toolbar-slot";
import { useDraftSync } from "./tvDraftChannel";
import { TvEditInspector } from "./TvEditInspector";
import { SlideStrip, TvDeviceStudio } from "./TvPreview";
import { useTvSlides } from "./tvPreviewData";
import { commitRecordEdits } from "./tvRecords";

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
    if (isDesignTopic(step)) showDesignTopic(step);
    // Once the tab is drawn; instant, as a smooth scroll stops in a background window.
    // The arrangement: of the parts on a board of parts, of the screens' blocks on any other.
    else window.setTimeout(() => document.getElementById(state.present.screenLayout === "composition" ? "layout-elements" : "layout-screens")?.scrollIntoView({ block: "start" }), 80);
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
  // Working on an occasion: the preview is its design, the very one being edited (TvPreview `dressed`).
  const shownConfig = comparing ? pageLook(comparing.config, shownPage) : occasionScope ? scoped : pageLook(state.present, shownPage);
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
  /**
   * The occasions' screens offered beside the board's pages: the one on at the
   * preview's moment (ראש חודש, today) by itself, and those the gabbai added by
   * hand to prepare before their day - each edited there exactly as a page is.
   */
  // The real minute, apart from any day the preview is showing (ticks with the board's clock).
  const todayMinute = Math.floor((simulatedNow ? Date.now() : board.now.getTime()) / 600_000) * 10;
  const occasionTabs = useMemo<OccasionTab[]>(() => {
    const settings = board.data.settings;
    const onAt = (at: Date) =>
      occasionPagesNow(state.present, settings, at, (d) => zmanimFor(d, settings))
        .active.filter((a) => a.occasion.display !== "off")
        .map((a) => a.occasion.id);
    // "היום" is the real day; the day the preview shows brings its occasion in too.
    const on = new Set(onAt(new Date(todayMinute * 60_000)));
    const shownDay = new Set(onAt(new Date(previewMinute * 60_000)));
    const pinned = new Set(state.present.pinnedOccasions);
    return readOccasions(state.present)
      .filter((o) => o.id === occasionScope || on.has(o.id) || pinned.has(o.id) || (!occasionScope && shownDay.has(o.id)))
      .map((o) => ({ id: o.id, name: o.name, on: on.has(o.id), design: Boolean(o.design), pinned: pinned.has(o.id) }));
  }, [state.present, board.data.settings, previewMinute, todayMinute, occasionScope]);
  const addableOccasions = useMemo(() => {
    const shown = new Set(occasionTabs.map((t) => t.id));
    return readOccasions(state.present).filter((o) => !shown.has(o.id)).map((o) => ({ id: o.id, name: o.name }));
  }, [state.present, occasionTabs]);
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
  /** The pinned board's height, so that what scrolls under it stops below it (scroll-padding). */
  const [pinnedHeight, setPinnedHeight] = useState(0);
  const pinnedObserver = useRef<ResizeObserver | null>(null);
  // A callback: the pinned block comes and goes with the layout (side, full screen).
  const pinnedRef = useCallback((el: HTMLDivElement | null) => {
    pinnedObserver.current?.disconnect();
    pinnedObserver.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    pinnedObserver.current = new ResizeObserver(() => setPinnedHeight(Math.round(el.getBoundingClientRect().height)));
    pinnedObserver.current.observe(el);
  }, []);
  const [windowHeight, setWindowHeight] = useState(() => (typeof window === "undefined" ? 900 : window.innerHeight));
  useEffect(() => {
    const measure = () => {
      setIsLarge(window.innerWidth >= 1024);
      setWindowHeight(window.innerHeight);
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
    showDesignTopic("design-elements");
  };

  // A link with ?panel= (or the old ?tvTab=events) opens its tab, also on a page already open.
  useEffect(() => {
    const search=new URLSearchParams(routerLocation.search);
    const panel=search.get('panel');
    if(panel && ['design','layout','content','occasions','tools'].includes(panel)) setTab(panel);
    else if(search.get('tvTab')==='events') setTab('occasions');
  },[routerLocation.search,routerLocation.key]);

  /** "ביטול שינויים" asks first - the one question every throwing away asks (confirmAction). */
  const discard = async () => {
    const ok = await confirmAction({
      title: "לבטל את כל השינויים שלא נשמרו?",
      description: 'הטיוטה חוזרת למה שעל המסכים עכשיו. "צעד קדימה" (Ctrl+Y) מחזיר אותם.',
      confirmLabel: "ביטול השינויים",
    });
    if (ok && saved.data) dispatch({ type: "load", config: saved.data.config });
  };
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
        .catch(() => toast.error("המעבר למסך מלא נכשל - הדפדפן לא אפשר אותו"));
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

  // Preview another moment: Shabbat, an occasion's day, any date - until the
  // admin goes back to real time. One control under the preview chooses the
  // day; an occasion's eye (its row in "מועדים") shows its own.
  const [dayPreview, setDayPreview] = useState(false);
  const [shabbatPreview, setShabbatPreview] = useState(false);
  /** The reminder's simulation: the same simulated clock, run up to a time of the day. */
  const simulation = useAlertSimulation(view.alerts, board.data.settings, (at) => {
    setDayPreview(false);
    setShabbatPreview(false);
    setSimulatedNow(at);
  });
  const previewAt = (at: Date | null) => {
    simulation.halt();
    setDayPreview(Boolean(at));
    setShabbatPreview(false);
    setSimulatedNow(at);
    setPreviewIndex(0);
  };
  /** The screens the simulation can go to, and whether their app shows it (1.40 and on). */
  const simulationScreens = (devices.data ?? [])
    .filter((d) => d.approved)
    .map((d) => ({
      id: d.id,
      name: d.name || "מסך",
      online: deviceHealth(d, Date.now()).online,
      shows: (d.state?.app?.code ?? 0) >= ALERT_DEMO_APP_CODE,
    }));
  /** The simulation on a screen ("all" - every one): from its moment here, at its speed. */
  const sendSimulation = (to: string) => {
    const { event, at, moment, speed } = simulation;
    if (!event || !at) return toast.error("אין זמן מתאים היום להדמיה");
    const from = moment ?? new Date(at.getTime() - alertTimeline(view.alerts, event).from * 60_000);
    const seconds = screenSeconds(Math.round((at.getTime() - from.getTime()) / 1000), speed);
    const device = to === "all" ? null : to;
    const name = device ? simulationScreens.find((d) => d.id === device)?.name || "המסך" : "כל המסכים";
    sendCommand(device, "message", alertDemoPayload(view.alerts, from, speed, seconds))
      .then(() => toast.success(`ההדמיה לפני ${ALERT_EVENT_LABELS[event]} נשלחה ל${name} - היא תופיע שם תוך כמה שניות, ל־${seconds} שניות`))
      .catch(() => toast.error(`השליחה ל${name} נכשלה - אפשר לנסות שוב`));
  };
  /** An occasion's screen worked on as a page: its day in the preview, on its screen, its design being edited. */
  const openOccasion = (id: string) => {
    const o = readOccasions(state.present).find((x) => x.id === id);
    if (!o) return;
    setPagesPlaying(false);
    const on = occasionTabs.find((t) => t.id === id)?.on;
    // On today: the real time; otherwise its next day, at midday.
    const day = on ? null : nextDateOf(o, new Date());
    if (!on && !day) return toast.error("לא נמצא תאריך קרוב למועד הזה");
    previewAt(day ? new Date(Date.parse(`${jerusalemDateKey(day)}T11:00:00+03:00`)) : null);
    setPreviewScreen(`occasion:${id}`);
    setOccasionScope(id);
    if (!o.enabled) toast.warning(occasionOffNote(o.name));
  };
  /**
   * "קבע לשבת ופתח": a kit of an occasion's folder made that occasion's - the
   * same setting as "בחירת ערכה" in "מועדים" - and its page opened to edit it.
   */
  const wearFor = (occasionId: string, kit: SavedDesign) => {
    const o = readOccasions(state.present).find((x) => x.id === occasionId);
    if (!o) return;
    dispatch({ type: "edit", key: `occasion-kit:${occasionId}:${kit.id}`, update: (c) => wearForOccasion(c, occasionId, kit) });
    openOccasion(occasionId);
    showPreview();
    toast.success(`"${kit.name}" היא עכשיו הערכה של ${o.name} - הנה העמוד שלו לעריכה. "צעד אחורה" מבטל.`);
  };
  /** Brings the board's preview into sight, from a control further down the page. */
  const showPreview = () =>
    // A timer rather than a frame, and a jump rather than a glide: a smooth
    // scroll is cut short by the tab switch that 🎨 makes, and neither frames
    // nor a glide run in a tab that is not in front.
    window.setTimeout(() => document.querySelector("[data-board-preview]")?.scrollIntoView({ block: "center" }), 0);
  const toggleShabbatPreview = () => {
    if (shabbatPreview) return previewAt(null);
    const candle = nextCandleLighting(new Date(), board.data.settings);
    if (!candle) return toast.error("חישוב זמן הדלקת הנרות נכשל");
    previewAt(new Date(candle.getTime() + 20 * 60_000));
    setShabbatPreview(true);
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

  /**
   * "תצוגה למעלה": the save bar stops under the pinned board, measured - the
   * board's band is its height plus the handle under it, and a guess at that
   * left the bar either under the board or with a gap above it.
   */
  const [topPinned, setTopPinned] = useState(0);
  const topMeasured = layout === "top" && isLarge && !fullscreen;
  useEffect(() => {
    const el = previewColumn.current;
    if (!topMeasured || !el || typeof ResizeObserver === "undefined") {
      setTopPinned(0);
      return;
    }
    const measure = () => setTopPinned(Math.round(el.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [topMeasured, saved.isLoading, studio]);

  /**
   * Ctrl+S (Cmd+S on a Mac) is "שמור ושדר", wherever the focus is - in a text
   * field too, where the browser would otherwise offer to save the page. On a
   * Hebrew keyboard S types "ד": the key is read, not the letter.
   */
  const saveRef = useRef<() => void>(() => undefined);
  saveRef.current = () => {
    if (dirty && !saving) void save();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.code !== "KeyS" && e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      saveRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // What is being edited: the board, one screen's, or one occasion's design.
  const theme =getTheme(scoped.theme, draft.customThemes);
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
  /** The kind whose parts are listed under the preview, to take some of them off. */
  const [previewKind, setPreviewKind] = useState<number | null>(null);
  /**
   * Under the preview, while the board is edited directly: every part of a kind
   * chosen at once (all the texts, all the frames...) - the same piece as in the
   * list of parts - and then the text bar for all of them.
   */
  const partKinds = view.elements.length > 0 ? (
    <div className="space-y-2" data-testid="preview-kind-tools">
      <KindPicker elements={view.elements} selected={elementEditing.selected} select={selectElements} onKind={setPreviewKind} testId="preview-by-kind" />
      {previewKind !== null && (
        <KindChecklist elements={view.elements} kind={previewKind} selected={elementEditing.selected} select={selectElements} onClose={() => setPreviewKind(null)} />
      )}
    </div>
  ) : null;
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
    if (!count && !payload.board) return toast.error("אין עדיין צבעי בסיס או מעברי צבע משלכם לייצוא");
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
        incoming.gradients.length ? `${incoming.gradients.length} מעברי צבע` : "",
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
          .join(" · ") + ' - בטיוטה עד "שמור ושדר"',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "הייבוא נכשל");
    }
  };

  if (saved.isLoading)
    return <p className="p-6 text-center text-muted-foreground">טוען את עיצוב הלוח…</p>;
  if (saved.error)
    return (
      <p className="p-6 text-center text-destructive">
        טעינת הגדרות הלוח נכשלה. ייתכן שעדכון מסד הנתונים של מרכז הבקרה לא הורץ.
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
        {/* A toggle: the way back to the draft is offered once, on the note over the preview. */}
        <ArrowLeftRight className="size-4" /> לפני / אחרי
      </Button>
      {/* A board of parts turns its pages from the bar of pages ("הפעלת סבב העמודים"), not here as well. */}
      {view.screenLayout !== "composition" && (
        <Button
          type="button"
          variant={autoplay ? "default" : "outline"}
          size="sm"
          aria-pressed={autoplay}
          onClick={() => setAutoplay((a) => !a)}
        >
          {autoplay ? <Pause className="size-4" /> : <Play className="size-4" />}
          {autoplay ? "עצירת הסבב" : "הפעלת סבב"}
        </Button>
      )}
      {/* "תצוגה בתאריך": the one control for the day the preview shows - any date, or the coming Shabbat - and the way back. */}
      <span className="flex flex-wrap items-center gap-1.5" role="group" aria-label="יום בתצוגה" data-testid="preview-date">
        <label className="flex items-center gap-1.5 text-xs">
          תצוגה בתאריך
          <input
            type="date"
            aria-label="תצוגה בתאריך"
            className={INPUT_CLASS}
            value={dayPreview && simulatedNow ? jerusalemDateKey(simulatedNow) : ""}
            onChange={(e) => {
              previewAt(e.target.value ? new Date(Date.parse(`${e.target.value}T11:00:00+03:00`)) : null);
              setPreviewScreen(null);
            }}
          />
        </label>
        <Button type="button" variant={shabbatPreview ? "default" : "outline"} size="sm" aria-pressed={shabbatPreview} onClick={toggleShabbatPreview}>
          🕯️ תצוגת מסך שבת
        </Button>
        {simulatedNow && (
          <Button type="button" variant="ghost" size="sm" onClick={() => previewAt(null)}>
            חזרה לזמן אמת
          </Button>
        )}
      </span>
      {simulatedNow && (
        <span className="text-xs text-muted-foreground">
          מדמה {dayPreview ? <><span dir="ltr">{simulatedNow.toLocaleDateString("he-IL")}</span>, </> : "את השעה "}
          <span dir="ltr">{simulatedNow.toTimeString().slice(0, 5)}</span>
        </span>
      )}
      {/* The reminder's simulation, while it runs: what the board shows now, and its pause - beside the preview it plays on. */}
      {simulation.moment && simulation.event && simulation.at && (
        <span className="flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs" data-testid="simulation-status">
          <b>הדמיית תזכורת:</b> {whatShows(view.alerts, simulation.event, simulation.at, simulation.moment)}
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={simulation.playing ? simulation.pause : simulation.play}>
            {simulation.playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
            {simulation.playing ? "השהיה" : "המשך"}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={simulation.stop}>
            סיום ההדמיה
          </Button>
        </span>
      )}
      {dayLookNow && (
        <Notice
          variant="info"
          icon={Palette}
          className="w-full"
          data-testid="day-look-note"
          actions={
            dayLookNow.on === "board" && (
              <Button
                type="button"
                size="sm"
                variant={dayLook ? "default" : "outline"}
                aria-pressed={dayLook}
                onClick={() => setDayLookShown((v) => !v)}
              >
                {dayLook ? "הצגת העיצוב הרגיל" : "הצגה כמו במסכים"}
              </Button>
            )
          }
        >
            {dayLookNow.on === "screen"
              ? `${simulatedNow ? "ביום הזה" : "עכשיו"} המסך של ${dayLookNow.occasion} בעיצוב «${dayLookNow.design}», והמסכים הרגילים בעיצוב שלהם. את עיצוב המועד בוחרים בהגדרות המועד (לשונית מועדים).`
              : `${simulatedNow ? "ביום הזה" : "עכשיו"} כל המסכים לובשים את העיצוב «${dayLookNow.design}» של ${dayLookNow.occasion}. ${
                  dayLook
                    ? "כך הם נראים עכשיו. שינויים בעיצוב כאן חלים על הלוח הרגיל."
                    : "כאן מוצג העיצוב הרגיל שאתם עורכים."
                }`}
        </Notice>
      )}
    </>
  );

  /**
   * Where the one save bar stops while the controls scroll: under the site's
   * header, and under the board too when the board stands above the controls.
   * There were two bars - this one, which scrolled up under the header, and a
   * second at the foot of the preview - and both were on the screen at once.
   */
  const saveBarTop = fullscreen
    ? 0
    : topMeasured
      ? headerOffset + (topPinned || topHeight + 16) + 8
      : headerOffset;

  // Every design control, shared by the admin page and the live window's panel.
  /** The one save bar: first in every layout, and in the live window too, pinned while all else scrolls. */
  const saveBar = (
      <div
        className="sticky z-30 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur"
        style={{ top: saveBarTop }}
        data-testid="save-bar"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-2"
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
          size="sm"
          className="px-2"
          aria-label="צעד קדימה (Ctrl+Y)"
          title="צעד קדימה (Ctrl+Y)"
          disabled={!state.future.length}
          onClick={() => dispatch({ type: "redo" })}
        >
          <Redo2 className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={!dirty} onClick={() => void discard()}>
          ביטול שינויים
        </Button>
        <span className="ms-auto text-xs text-muted-foreground">
          {dirty ? "יש שינויים שלא נשמרו" : "הכול שמור"}
        </span>
        <Button type="button" size="sm" onClick={save} disabled={!dirty || saving} title="שמירה ושידור לכל המסכים (Ctrl+S)">
          {dirty ? <Save className="size-4" /> : <Check className="size-4" />}
          {saving ? "שומר…" : "שמור ושדר למסכים"}
        </Button>
      </div>
  );

  /** The kit the occasion being worked on wears (named after the kit it was made from), or null for none. */
  const occasionKit = occasionScope ? findDesign(state.present, readOccasions(state.present).find((o) => o.id === occasionScope)?.design) : null;
  const occasionKitName = occasionKit?.name ?? null;

  const controls = (
    <>
      {/* The live window puts the bar first in its panel, above the preview's buttons. */}
      {!studio && saveBar}
      {occasionScope ? (
        <Notice
          variant="info"
          icon={Palette}
          role="status"
          data-testid="occasion-design-banner"
          actions={
            <>
              {/* The occasion's kit, changed or taken off here as in "מועדים": the same setting. */}
              <Button type="button" size="sm" variant="outline" onClick={() => { setTab("design"); showDesignTopic("design-sets"); }}>
                החלפת ערכה
              </Button>
              {occasionKitName !== null && (
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => dispatch({ type: "edit", key: `occasion-kit-off:${occasionScope}`, update: (c) => ({ ...c, occasions: readOccasions(c).map((o) => (o.id === occasionScope ? { ...o, design: null } : o)) }) })}>
                  בלי ערכה
                </Button>
              )}
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
            </>
          }
        >
          עורכים עכשיו את המסך של <b>{readOccasions(state.present).find((o) => o.id === occasionScope)?.name ?? "המועד"}</b>
          {occasionKitName !== null ? <> בערכה <b>«{occasionKitName}»</b></> : " (בלי ערכה - כמו הלוח)"} - כל
          שינוי כאן (רקע ותמונות, צבעים, מסגרות, גופן) נשמר לערכה שלו בלבד. הלוח הרגיל לא משתנה.
        </Notice>
      ) : (
        <DeviceScopeBanner scope={scope} config={state.present} onClear={clearDevice} />
      )}

      {guide && <BuildGuide done={guide} onStep={goToStep} onClose={() => setGuide(null)} />}

      {/* The pages of a board of parts: above the tabs, since every tab edits the page chosen here. */}
      {(state.present.screenLayout === "composition" || readPages(state.present).length > 1 || occasionTabs.length > 0 || addableOccasions.length > 0) && (
        <PartPagesBar
          config={state.present}
          current={pageIndex}
          occasions={occasionTabs}
          occasion={occasionScope}
          onOccasion={openOccasion}
          addable={addableOccasions}
          onPin={(id) => {
            dispatch({ type: "edit", key: `pin:${id}`, update: (c) => ({ ...c, pinnedOccasions: [...new Set([...c.pinnedOccasions, id])].slice(0, 20) }) });
            openOccasion(id);
          }}
          onUnpin={(id) => {
            dispatch({ type: "edit", key: `unpin:${id}`, update: (c) => ({ ...c, pinnedOccasions: c.pinnedOccasions.filter((x) => x !== id) }) });
            // Taken off while being worked on: back to the board's own page.
            if (occasionScope === id) {
              setOccasionScope(null);
              previewAt(null);
              setPreviewScreen(null);
            }
          }}
          onSelect={(i) => {
            setPagesPlaying(false);
            if (occasionScope) {
              // Back from an occasion to the board's own page, at the real time.
              setOccasionScope(null);
              previewAt(null);
              setPreviewScreen(null);
            }
            setPageScope(i);
          }}
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
        {/* Moving the board in a file lives in "כלים"; the way there stays in sight from every tab. */}
        {tab !== "tools" && (
          <div className="mt-1 flex justify-end">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs"
              onClick={() => {
                setTab("tools");
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => {
                    document.querySelector('[data-testid="board-transfer-section"]')?.scrollIntoView({ block: "start" });
                    document.querySelector<HTMLElement>('[data-testid="board-transfer-section"] h2')?.focus();
                  }),
                );
              }}
            >
              ייבוא וייצוא
            </Button>
          </div>
        )}
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
          <DesignTab draft={draft} scoped={scoped} view={view} edit={edit} dispatch={dispatch} partTarget={partTarget} setPartTarget={setPartTarget} wholeBoardOnly={Boolean(occasionScope) || scope !== "all"} setComposerScreen={setComposerScreen} setGuide={setGuide} layerProps={layerProps} textToolsElsewhere={editing && Boolean(partText)} onWearFor={wearFor} todayOccasions={occasionScope ? [readOccasions(state.present).find((o) => o.id === occasionScope)?.name ?? ""] : occasionTabs.filter((t) => t.on).map((t) => t.name)} />
        </TabsContent>
        <TabsContent
          value="layout"
          className="mt-3 grid grid-cols-1 items-start gap-4 [&>*]:min-w-0 min-[1700px]:grid-cols-2"
        >
          <LayoutTab scoped={scoped} view={view} edit={edit} openPartsList={openPartsList} composerScreen={composerScreen} setComposerScreen={setComposerScreen} setPreviewScreen={setPreviewScreen} previewAt={previewAt} />
        </TabsContent>
        <TabsContent
          value="content"
          className="mt-3 grid grid-cols-1 items-start gap-4 [&>*]:min-w-0 min-[1700px]:grid-cols-2"
        >
          <ContentTab scoped={scoped} edit={edit} simulation={simulation} simulationScreens={simulationScreens} sendSimulation={sendSimulation} />
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
          dressed={Boolean(occasionScope) && !comparing}
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
        <StudioPanel
          title="עורך חי"
          status={dirty ? "יש שינויים שלא נשמרו" : "הכול שמור"}
          onSave={save}
          canSave={dirty && !saving}
          saving={saving}
        >
          <div className="space-y-3">
            {saveBar}
            {/* One line only: the click-to-edit guidance lives in the inspector below. */}
            <p className="text-[11px] leading-tight text-muted-foreground">
              <b>Alt + לחיצה</b> = לחיצה רגילה על הלוח · <b>Esc</b> = ביטול הבחירה · <b>Ctrl+S</b> = שמירה · הכול
              בטיוטה עד "שמור ושדר", ומתעדכן גם בעורך שבעמוד הניהול.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {previewActions}
              <SaveKitButton config={view} onEdit={edit} />
            </div>
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
            {editing && partKinds}
            {editing && partText}
            {controls}
          </div>
        </StudioPanel>
      </>
    );
  }

  const top = layout === "top" && !fullscreen && isLarge;
  const side = layout === "side" && !fullscreen;

  // On the studio's own toolbar row, beside the device menu: one row above
  // the board, not three. The two layouts stay in sight; the rest of how big
  // the board is and what is around it - four buttons that took a row of
  // their own - are in one menu, "גודל ותצוגה", each with its tick.
  const viewItem = "cursor-pointer gap-2";
  const layoutButtons = (
    <>
      {/* What is on the board, kept as a kit without scrolling to "ערכות" - the same form and the same save. */}
      <SaveKitButton config={view} onEdit={edit} />
      <div className="col-span-2 hidden rounded-md border p-0.5 sm:inline-flex" role="group" aria-label="פריסת העורך">
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
      <DropdownMenu dir="rtl" modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant={fullscreen || focus || beforeMax || bare ? "default" : "outline"} size="sm" data-testid="view-menu">
            <Scaling className="size-4" aria-hidden /> גודל ותצוגה <ChevronDown className="size-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        {/* In full screen only the board's column is on the screen: the menu opens inside it, or it would not be seen. */}
        <DropdownMenuPrimitive.Portal container={fullscreen ? previewColumn.current : undefined}>
          <DropdownMenuPrimitive.Content
            align="end"
            sideOffset={4}
            className="z-[100] min-w-[14rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            <DropdownMenuCheckboxItem className={viewItem} checked={fullscreen} onCheckedChange={toggleFullscreen} title="התצוגה והעורך על כל המסך (Esc ליציאה)">
              מסך מלא לעריכה
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem className={viewItem} checked={focus} onCheckedChange={(on) => setFocus(on)} title="מסתיר את הסרגל של האתר ואת שורות הלשוניות שמעל העורך, כדי שכל המסך יהיה ללוח ולבקרות">
              מצב עבודה
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem className={viewItem} checked={Boolean(beforeMax)} onCheckedChange={toggleMax} title="הלוח בגודל הגדול ביותר שנכנס; עוד בחירה מחזירה לגודל הקודם">
              הגדלה למקסימום
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem className={viewItem} checked={bare} onCheckedChange={(on) => setBare(on)} title="מסתיר את הטלוויזיה המצוירת (השוליים והמעמד), והמקום שלה הולך ללוח">
              בלי מסגרת טלוויזיה
            </DropdownMenuCheckboxItem>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenu>
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
    <div className="relative w-full" data-board-preview>
      {comparing && (
        <Notice
          variant="warning"
          className="mb-2"
          data-testid="preview-comparing"
          actions={
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
          }
        >
          מוצג עכשיו: <b>{comparing.id === "saved" ? "מה שעל המסכים - לפני השינויים" : `הגרסה מ-${comparing.label}`}</b>. אי אפשר לערוך אותו.
        </Notice>
      )}
      <TvDeviceStudio
        onDeviceChange={onDeviceChange}
        preview={comparing ? null : preview}
        {...board}
        dayLook={dayLook}
        dressed={Boolean(occasionScope) && !comparing}
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
        // Side by side the board is pinned over what is under it: never so tall
        // that nothing under it could be reached (60% of the window at most).
        fitHeight={
          top
            ? topHeight
            : fullscreen && !(side && isLarge)
              // Full screen with the board above: about half the screen, the controls scrolling under it.
              ? Math.max(260, Math.round(windowHeight * 0.55))
              : side && isLarge
                ? Math.min(sideHeight, Math.max(260, Math.round((windowHeight - headerOffset) * 0.6)))
                : undefined
        }
        toolbarExtra={layoutButtons}
        toolbarIn={PREVIEW_TOOLBAR_SLOT}
        bare={bare}
        onRequestEdit={editOnBoardAt}
        onResize={fullscreen ? undefined : resizeBoard}
        onResizeReset={resetBoardSize}
      />
      {/* What was chosen on the board, with its own choices only: a container's board, frame, shape or text. */}
      {!comparing && <PartContextPanel config={view} onEdit={edit} />}
      {!comparing && (
        <ReadabilityNote
          watch={state.present}
          customBoxes={state.present.customBoxes}
          onFix={(frame) => {
            if (frame) setPartTarget(`frame:${frame}`);
            setTab("design");
            showDesignTopic("design-text");
          }}
        />
      )}
    </div>
  );

  /** Everything under the board: the inspector, the actions, the slides, the save bar. */
  const underPreview = (
    <>
      {/* The panel of what was chosen, in the page when there is no room beside the board (PartContextPanel). */}
      <div id={PART_PANEL_SLOT} />
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
      {editing && partKinds && <div className="mt-3">{partKinds}</div>}
      {editing && partText && <div className="mt-3">{partText}</div>}
      {/* Under the board, one row that fills as it wraps: editing, the day shown, then the screens, the layout and the
          windows - no group pushed to the far side leaving a hole, the two "separate window" buttons one menu. */}
      <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="preview-bottom-row">
        {previewActions}
        <span id={PREVIEW_TOOLBAR_SLOT} className="contents" />
        <DropdownMenu dir="rtl" modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <ExternalLink className="size-4" aria-hidden /> חלון נפרד <ChevronDown className="size-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[16rem]">
            <DropdownMenuItem className="cursor-pointer flex-col items-start gap-0.5" onSelect={() => window.open("/admin/tv-board?draft=1", "shul-tv-draft")}>
              <span className="font-medium">עורך חי בחלון נפרד</span>
              <span className="text-[11px] text-muted-foreground">הלוח על כל המסך עם כלי העריכה. השינויים עוברים לכאן, ונשמרים ב"שמור ושדר".</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer flex-col items-start gap-0.5" onSelect={() => window.open("/admin/tv-board", "_blank")}>
              <span className="font-medium">תצוגת הלוח השמור בחלון נפרד</span>
              <span className="text-[11px] text-muted-foreground">הלוח בעיצוב השמור, בדיוק כמו בטלוויזיות.</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
      className={`min-w-0 grid-cols-[minmax(0,1fr)] gap-2 ${side ? "grid lg:gap-2" : "grid gap-5"}`}
      style={
        side && isLarge
          ? { gridTemplateColumns: `minmax(0, ${1 - sideShare}fr) auto minmax(0, ${sideShare}fr)` }
          : undefined
      }
    >
      {/* ------------------------------------------------ preview column -- */}
      <div
        ref={previewColumn}
        className={`order-1 min-w-0 space-y-3 lg:order-3 ${fullscreen ? "overflow-auto bg-background p-4" : ""}`}
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
              : {
                  top: headerOffset + 8,
                  maxHeight: `calc(100dvh - ${headerOffset + 16}px)`,
                  // Scrolling to a control stops it under the pinned board (and
                  // above the save bar at the foot), never behind them.
                  scrollPaddingTop: pinnedHeight + 8,
                  scrollPaddingBottom: 64,
                }
          }
        >
          {/* The board itself pinned at the top of the column: what is under it
              (the panel being edited, the text bar) scrolls beneath it, so the
              change is always in sight. It scrolled away with them, and the
              board being edited could not be seen (11.10.2026). */}
          {/* Full screen too: pinned at the top of the column that scrolls (it scrolled away - 18.10.2026). */}
          <div ref={pinnedRef} className={fullscreen ? "sticky -top-4 z-20 bg-background pb-1 pt-1" : "lg:sticky lg:top-0 lg:z-20 lg:bg-background lg:pb-1"} data-testid="preview-pinned">
            {studioView}
          </div>
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
      <div className="order-3 min-w-0 space-y-4 lg:order-1">{!fullscreen && controls}</div>
    </div>
  );
}
