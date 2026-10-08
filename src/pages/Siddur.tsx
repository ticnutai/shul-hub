import {
  ArrowLeft,
  Search,
  CalendarDays,
  ChevronDown,
  Loader2,
  LayoutList,
  AlignJustify,
  ScrollText,
  Layers,
  Sparkles,
  Columns2,
  PanelRightOpen,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { KriaPane } from "@/components/siddur/KriaPane";
import { CatIcon, ChoiceButton, ChoiceDialog, EMPTY_MARKS, PinnedBelowChrome, SectionJumpScroller, SectionStrip, SiddurJumpContext, SiddurToolsContext } from "@/components/siddur/SiddurChrome";
import { BookColumnPane, CategoryPane, FullContinuousPane, SplitPane } from "@/components/siddur/SiddurReaders";
import { SiddurSearchDialog, type SiddurSearchHit } from "@/components/siddur/SiddurSearchDialog";
import { NUSACHOT, NUSACH_INDEP, STATIC_TABS } from "@/components/siddur/siddurText";
import { TextFilterMenu, TextFiltersBar } from "@/components/siddur/SiddurTextFilters";
import { ACTIVE_THEME_KEY, CUSTOM_THEME_KEY, DisplayStyle, SIDDUR_PRESET_THEMES, SiddurDisplayStyleContext, SiddurTheme, SiddurThemeContext, SiddurViewSettings, ViewMode, isDisplayStyle, isViewMode, loadCustomTheme, loadCustomThemes, loadLegacySiddurViewSettings, normalizeSiddurTheme, saveCustomThemes, saveLatestCustomTheme, siddurAppearance } from "@/components/siddur/siddurTheme";
import { ThemePicker } from "@/components/siddur/SiddurThemePicker";
import { TehillimPane } from "@/components/siddur/TehillimPane";
import { TodayPanel, TodaySectionsContext, prayerNow } from "@/components/siddur/TodayPanel";
import { TextDisplaySettings } from "@/components/TextDisplaySettings";
import { THEME_SHADOWS } from "@/components/ThemeAppearanceControls";
import { useAuth } from "@/contexts/AuthContext";
import { useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";
import { useOmerSeason } from "@/features/omer/hooks/useOmerSeason";
import { useIsMobile } from "@/hooks/use-mobile";
import { useServiceSections } from "@/hooks/useServiceSections";
import { useSiddurCategories, preloadSiddurNusach } from "@/hooks/useSiddurData";
import { useSyncedState } from "@/hooks/useSyncedState";
import { supabase } from "@/integrations/supabase/client";
import { dayProfile } from "@/lib/jewishDay";
import { cn } from "@/lib/utils";

import { zmanimFor } from "@community/lib/minyan-time";

/* ─── Main Siddur component ──────────────────────────────── */
export const Siddur = () => {
  // A phone has one screen's worth of room and four rows of chrome above the
  // prayer. Which of them survive is decided here, once.
  const isMobile = useIsMobile();
  const navigate                = useNavigate();
  const omerInSeason            = useOmerSeason();
  const [nusach, setNusach]    = useState("sefard");
  /*
   * Tehillim has a door of its own in the top row (PrimaryDestinationNav):
   * `?tab=tehillim` opens the Siddur on it, and the address follows the tab
   * either way, so the top row marks the one that is open.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [catId, setCatId]      = useState(() => (tabParam === "tehillim" ? "tehillim" : "shacharit"));
  const catIdRef = useRef(catId);
  catIdRef.current = catId;
  useEffect(() => {
    if (tabParam === "tehillim") setCatId("tehillim");
    // "סידור" from the top row, while Tehillim was open: back to the prayers.
    else if (catIdRef.current === "tehillim") setCatId("shacharit");
  }, [tabParam]);
  useEffect(() => {
    const onTehillim = catId === "tehillim";
    if (onTehillim === (tabParam === "tehillim")) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (onTehillim) next.set("tab", "tehillim");
        else ["tab", "perek", "pasuk"].forEach((k) => next.delete(k));
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catId]);
  const { user } = useAuth();
  const initialSiddurViewSettings = useRef(loadLegacySiddurViewSettings()).current;
  const { data: syncedViewSettings, setData: setSyncedViewSettings } = useSyncedState<SiddurViewSettings>({
    localStorageKey: "siddur-view-settings-v1",
    tableName: "user_settings",
    column: "siddur_display_settings",
    userId: user?.id ?? null,
    syncToCloud: !!user,
    defaultValue: initialSiddurViewSettings,
  });
  const viewMode = isViewMode(syncedViewSettings.viewMode) ? syncedViewSettings.viewMode : "accordion";
  const displayStyle = isDisplayStyle(syncedViewSettings.displayStyle) ? syncedViewSettings.displayStyle : "classic";

  const [activeTheme, setActiveTheme] = useState<SiddurTheme>(() => {
    const saved = localStorage.getItem(ACTIVE_THEME_KEY);
    if (saved) {
      const found = SIDDUR_PRESET_THEMES.find(t => t.id === saved);
      if (found) return found;
      const savedCustom = loadCustomThemes().find(item => item.id === saved) ?? loadCustomTheme();
      if (saved === savedCustom.id || saved.startsWith("custom")) return savedCustom;
    }
    return SIDDUR_PRESET_THEMES[0];
  });
  const [customTheme, setCustomTheme] = useState<SiddurTheme>(loadCustomTheme);
  const [customThemes, setCustomThemes] = useState<SiddurTheme[]>(loadCustomThemes);
  const [publicThemes, setPublicThemes] = useState<SiddurTheme[]>([]);

  const loadPublicThemes = useCallback(async () => {
    const { data, error } = await supabase
      .from("siddur_themes")
      .select("id,name,theme,updated_at")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Failed to load public Siddur themes:", error);
      return;
    }
    setPublicThemes((data ?? []).map(row => normalizeSiddurTheme({
      ...(row.theme as unknown as SiddurTheme),
      id: `public:${row.id}`,
      name: row.name,
      emoji: (row.theme as unknown as SiddurTheme)?.emoji || "🎨",
      isCustom: true,
    })));
  }, []);

  useEffect(() => { void loadPublicThemes(); }, [loadPublicThemes]);

  const publishTheme = useCallback(async (draft: SiddurTheme): Promise<SiddurTheme> => {
    if (!user) throw new Error("יש להתחבר כמנהל כדי לפרסם ערכת נושא");
    const payload = { ...draft, id: "public", name: draft.name.trim(), isCustom: true };
    const { data, error } = await supabase
      .from("siddur_themes")
      .insert({ name: payload.name, theme: payload as unknown as import("@/integrations/supabase/types").Json, created_by: user.id })
      .select("id,name,theme")
      .single();
    if (error) throw new Error(error.message);
    const published: SiddurTheme = normalizeSiddurTheme({ ...(data.theme as unknown as SiddurTheme), id: `public:${data.id}`, name: data.name, isCustom: true });
    await loadPublicThemes();
    return published;
  }, [user, loadPublicThemes]);

  // A public theme is loaded asynchronously; restore a locally/cloud-saved selection once available.
  useEffect(() => {
    const savedId = localStorage.getItem(ACTIVE_THEME_KEY);
    if (!savedId?.startsWith("public:")) return;
    const found = publicThemes.find(t => t.id === savedId);
    if (found) setActiveTheme(found);
  }, [publicThemes]);

  // Cloud sync helpers
  const cloudSaveActiveTheme = useCallback(async (t: SiddurTheme) => {
    const ts = Date.now();
    localStorage.setItem(`${ACTIVE_THEME_KEY}__ts`, String(ts));
    if (!user) return;
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      await supabase.auth.updateUser({ data: {
        ...u.user_metadata,
        siddur_active_theme_id: t.id,
        siddur_active_theme_ts: ts,
      }});
    } catch { /* ignore */ }
  }, [user]);

  const cloudSaveCustomThemes = useCallback(async (items: SiddurTheme[], active: SiddurTheme) => {
    const ts = Date.now();
    localStorage.setItem(`${CUSTOM_THEME_KEY}__ts`, String(ts));
    if (!user) return;
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      await supabase.auth.updateUser({ data: {
        ...u.user_metadata,
        siddur_custom_theme: JSON.stringify(active),
        siddur_custom_themes: items,
        siddur_custom_theme_ts: ts,
      }});
    } catch { /* ignore */ }
  }, [user]);

  const saveCustomThemeItem = useCallback(async (draft: SiddurTheme, options?: { duplicate?: boolean }): Promise<SiddurTheme> => {
    const normalized = normalizeSiddurTheme({ ...draft, name: draft.name.trim(), emoji: "🎨", isCustom: true });
    const existingIsEditable = !options?.duplicate && normalized.id.startsWith("custom") && customThemes.some(item => item.id === normalized.id);
    const saved = {
      ...normalized,
      id: existingIsEditable ? normalized.id : `custom-${crypto.randomUUID()}`,
    };
    const items = existingIsEditable
      ? customThemes.map(item => item.id === saved.id ? saved : item)
      : [...customThemes, saved];
    setCustomThemes(items);
    setCustomTheme(saved);
    saveCustomThemes(items);
    saveLatestCustomTheme(saved);
    await cloudSaveCustomThemes(items, saved);
    return saved;
  }, [cloudSaveCustomThemes, customThemes]);

  // On login: pull cloud theme state and apply if newer
  useEffect(() => {
    if (!user) return;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return;
      const meta = u.user_metadata ?? {};

      // Restore all custom themes (new format), with backwards-compatible single-theme fallback.
      const cloudCustomTs = Number(meta["siddur_custom_theme_ts"]) || 0;
      const localCustomTs = Number(localStorage.getItem(`${CUSTOM_THEME_KEY}__ts`)) || 0;
      if (cloudCustomTs > localCustomTs && (meta["siddur_custom_themes"] || meta["siddur_custom_theme"])) {
        try {
          const ct: SiddurTheme = typeof meta["siddur_custom_theme"] === "string"
            ? JSON.parse(meta["siddur_custom_theme"])
            : meta["siddur_custom_theme"];
          const cloudItems: SiddurTheme[] = Array.isArray(meta["siddur_custom_themes"])
            ? meta["siddur_custom_themes"].map((item: SiddurTheme) => normalizeSiddurTheme(item))
            : ct?.id ? [normalizeSiddurTheme(ct)] : [];
          if (cloudItems.length > 0) {
            const activeCustom = normalizeSiddurTheme(ct?.id ? ct : cloudItems[cloudItems.length - 1]);
            saveCustomThemes(cloudItems);
            saveLatestCustomTheme(activeCustom);
            localStorage.setItem(`${CUSTOM_THEME_KEY}__ts`, String(cloudCustomTs));
            setCustomThemes(cloudItems);
            setCustomTheme(activeCustom);
            // If active theme was custom, update it too
            if (localStorage.getItem(ACTIVE_THEME_KEY) === activeCustom.id || localStorage.getItem(ACTIVE_THEME_KEY)?.startsWith("custom")) {
              const selected = cloudItems.find(item => item.id === localStorage.getItem(ACTIVE_THEME_KEY)) ?? activeCustom;
              setActiveTheme(selected);
            }
          }
        } catch { /* ignore */ }
      }

      // Restore active theme id
      const cloudActiveTs = Number(meta["siddur_active_theme_ts"]) || 0;
      const localActiveTs = Number(localStorage.getItem(`${ACTIVE_THEME_KEY}__ts`)) || 0;
      if (cloudActiveTs > localActiveTs && meta["siddur_active_theme_id"]) {
        const id = meta["siddur_active_theme_id"] as string;
        localStorage.setItem(ACTIVE_THEME_KEY, id);
        localStorage.setItem(`${ACTIVE_THEME_KEY}__ts`, String(cloudActiveTs));
        const found = SIDDUR_PRESET_THEMES.find(t => t.id === id);
        if (found) setActiveTheme(found);
        else if (id.startsWith("custom")) {
          const ct = loadCustomThemes().find(item => item.id === id) ?? loadCustomTheme();
          setActiveTheme(ct);
        }
      }
    }).catch(() => {});
  }, [user?.id]);

  const { categories, loading: catsLoading } = useSiddurCategories(nusach);
  const { settings: fontSettings } = useFontAndColorSettings();

  // Header-scoped color helpers — use headerTextColor/headerAccentColor when set (custom theme),
  // otherwise fall back to the body textColor/accentColor (preset themes are unaffected)
  const hText   = activeTheme.headerTextColor   ?? activeTheme.textColor;
  const hAccent = activeTheme.headerAccentColor ?? activeTheme.accentColor;

  // Kick off local JSON download as early as possible so it's ready when sections load
  useEffect(() => { preloadSiddurNusach(nusach); }, [nusach]);
  const isSpecial = NUSACH_INDEP.has(catId);
  const settingsTab = catId === "tehillim" ? "tehillim" : catId === "kria" ? "pasuk" : "siddur";

  /* --- On a phone: two choices and a strip, instead of two rows of tabs --- */
  //
  // Which nusach somebody davens is answered once in their life; which prayer
  // they are at, once a day. Both had a permanent row. Where they are inside
  // שחרית changes every minute and had none - the only way to move was to
  // scroll past everything in between. So the two settled questions become
  // buttons that open a grid, and the row they free up carries the sections.
  const [pickNusach, setPickNusach] = useState(false);
  const [pickPrayer, setPickPrayer] = useState(false);
  const [jumpIndex, setJumpIndex] = useState<number | null>(null);
  const [jumpNonce, setJumpNonce] = useState(0);
  const jump = useMemo(
    () => ({
      index: jumpIndex,
      nonce: jumpNonce,
      jump: (i: number) => {
        setJumpIndex(i);
        // Tapping the same one again scrolls back to it, which is what
        // somebody who has read on and wants to return expects.
        setJumpNonce((n) => n + 1);
      },
    }),
    [jumpIndex, jumpNonce],
  );
  useEffect(() => { setJumpIndex(null); }, [catId, nusach]);

  // Search can land in another prayer. Switch to it, and jump once its
  // sections are the ones on screen (checked by title, so a stale list from
  // the prayer being left can't take the jump).
  const [searchOpen, setSearchOpen] = useState(false);
  const pendingJump = useRef<SiddurSearchHit | null>(null);

  // "לפי לוח שנה": the siddur follows the Hebrew calendar - what is said today
  // at the top, a mark on each section, and it opens on the prayer of the hour.
  const [calendarMode, setCalendarMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("siddur-calendar-mode") === "1";
    } catch {
      return false;
    }
  });
  const [todayMarks, setTodayMarks] = useState<Map<string, boolean>>(() => new Map());
  const openedForToday = useRef(false);
  const toggleCalendarMode = () => {
    setCalendarMode((on) => {
      try {
        localStorage.setItem("siddur-calendar-mode", on ? "0" : "1");
      } catch {
        /* not remembered */
      }
      if (on) setTodayMarks(new Map());
      openedForToday.current = false;
      return !on;
    });
  };
  // The day the prayer is said on: tomorrow's from nightfall. Looked at again
  // every few minutes, so a siddur left open moves on at nightfall by itself.
  const [dayTick, setDayTick] = useState(0);
  useEffect(() => {
    if (!calendarMode) return;
    const t = window.setInterval(() => setDayTick((n) => n + 1), 5 * 60_000);
    return () => window.clearInterval(t);
  }, [calendarMode]);
  const todayProfile = useMemo(() => {
    if (!calendarMode) return null;
    const now = new Date();
    return dayProfile(now, zmanimFor(now, null).tzeit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarMode, dayTick]);
  // The same cached fetch the pane makes; asking twice costs nothing.
  const { sections: stripSections } = useServiceSections(nusach, isSpecial ? "" : catId, todayProfile);

  const openSearchHit = useCallback((hit: SiddurSearchHit) => {
    if (hit.catId === catId) {
      jump.jump(hit.index);
      return;
    }
    pendingJump.current = hit;
    setCatId(hit.catId);
  }, [catId, jump]);
  useEffect(() => {
    const hit = pendingJump.current;
    if (!hit || hit.catId !== catId || stripSections?.[hit.index]?.title !== hit.title) return;
    pendingJump.current = null;
    jump.jump(hit.index);
  }, [catId, stripSections, jump]);
  const prayerChoices = useMemo(
    () => [...categories.map((c) => ({ id: c.id, name: c.name })), ...STATIC_TABS],
    [categories],
  );
  const prayerName =
    prayerChoices.find((c) => c.id === catId)?.name ?? "";
  const nusachName = NUSACHOT.find((n) => n.id === nusach)?.label ?? "";

  const activeWidth = catId === "tehillim" ? fontSettings.tehillimContentWidth : fontSettings.siddurContentWidth;
  const containerMaxW =
    activeWidth === "narrow" ? "max-w-2xl" :
    activeWidth === "wide"   ? "max-w-6xl" :
    activeWidth === "full"   ? "max-w-full" :
    "max-w-4xl";

  useEffect(() => {
    if (!calendarMode || openedForToday.current || !categories.length) return;
    openedForToday.current = true;
    // Opened on Tehillim on purpose: the prayer of the hour does not take over.
    if (catIdRef.current === "tehillim") return;
    const now = new Date();
    const id = prayerNow(now, todayProfile ?? dayProfile(now, zmanimFor(now, null).tzeit), categories.map((c) => c.id));
    if (id) setCatId(id);
  }, [calendarMode, categories]);

  // If active category disappeared in new nusach, fall back to first
  useEffect(() => {
    if (!isSpecial && categories.length > 0 && !categories.find(c => c.id === catId)) {
      setCatId(categories[0].id);
    }
  }, [categories, catId, isSpecial]);

  const setMode = (mode: ViewMode) => {
    localStorage.setItem("siddur-view-mode", mode);
    setSyncedViewSettings(prev => ({ ...prev, viewMode: mode }));
  };

  const setDisplayStyle = (style: DisplayStyle) => {
    localStorage.setItem("siddur-display-style", style);
    setSyncedViewSettings(prev => ({ ...prev, displayStyle: style }));
  };

  const VIEW_MODES: { id: ViewMode; icon: React.ReactNode; title: string; desc?: string }[] = [
    { id: "accordion",  icon: <LayoutList     className="h-4 w-4" />, title: "מקטעים",       desc: "קפסאות מתקפלות" },
    { id: "continuous", icon: <AlignJustify   className="h-4 w-4" />, title: "רציף",          desc: "גלילה סעיף-אחר-סעיף" },
    { id: "scroll",     icon: <ScrollText     className="h-4 w-4" />, title: "גלילה כוללת",  desc: "כל הקטגוריות ברצף" },
    { id: "split",      icon: <PanelRightOpen className="h-4 w-4" />, title: "פצול",          desc: "רשימת סעיפים + טקסט" },
    { id: "book",       icon: <Columns2       className="h-4 w-4" />, title: "שתי עמודות",   desc: "פריסת ספר" },
  ];

  // The controls that style the page: colours, text, view mode, and the omer
  // shortcut in its season. Defined once and rendered in exactly one place -
  // the header on a wide screen, the top of the text on a phone - so that the
  // theme panel and the settings panel never exist twice over.
  // The controls that style the page, in two halves.
  //
  // On a wide screen they sit together in the header. On a phone they flank
  // the title of the first prayer - two on each side of a short word in the
  // middle of an otherwise empty line, which is the only room on the screen
  // that costs the prayer nothing. Defined once and rendered in one place
  // either way, so the theme panel and the settings panel never exist twice.
  const toolsAppearance = (
    <>
              {/* Theme picker */}
              <ThemePicker />
              {/* T — text settings */}
              <TextDisplaySettings
                initialTab={settingsTab}
                tabs={catId === "tehillim" ? ["tehillim"] : catId === "kria" ? undefined : ["siddur"]}
                showPasukCount={catId === "kria"}
              />
    </>
  );

  const toolsView = (
    <>
              {/* View mode dropdown (siddur only) */}
              {!isSpecial && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs font-medium rounded-lg"
                      style={{ color: hAccent, background: "transparent", border: "none" }}
                    >
                      <Layers className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="hidden md:inline max-w-[80px] truncate">{VIEW_MODES.find(m => m.id === viewMode)?.title ?? "תצוגה"}</span>
                      <ChevronDown className="h-3 w-3 opacity-60 flex-shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56" style={{ direction: "rtl" }}>
                    <DropdownMenuLabel className="text-right text-xs text-muted-foreground">מצב תצוגה</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {VIEW_MODES.map(m => (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <span style={{ color: viewMode === m.id ? activeTheme.accentColor : "hsl(var(--muted-foreground))" }}>{m.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className={cn("block text-sm", viewMode === m.id && "font-semibold text-foreground")}>{m.title}</span>
                          {m.desc && <span className="block text-[10px] text-muted-foreground">{m.desc}</span>}
                        </div>
                        {viewMode === m.id && <span className="text-xs flex-shrink-0" style={{ color: hAccent }}>✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {!isSpecial && (
                <button
                  onClick={toggleCalendarMode}
                  className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium transition-opacity hover:opacity-80"
                  style={calendarMode ? { color: "hsl(var(--sidebar-background))", background: hAccent } : { color: hAccent }}
                  aria-pressed={calendarMode}
                  title={calendarMode ? "לפי לוח שנה: פעיל. לחיצה מכבה" : "לפי לוח שנה: הסידור מראה מה אומרים היום"}
                  data-testid="siddur-calendar-mode"
                >
                  <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">לפי לוח</span>
                </button>
              )}
              {omerInSeason && (
                <button
                  onClick={() => navigate('/omer')}
                  className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ color: hAccent }}
                  title="ספירת העומר"
                >
                  <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">עומר</span>
                </button>
              )}
    </>
  );

  const pageTools = (
    <>
      {toolsAppearance}
      {toolsView}
    </>
  );

  const titleTools = isMobile
    ? {
        before: toolsAppearance,
        after: (
          <>
            {toolsView}
            <TextFilterMenu scope={catId === "tehillim" ? "tehillim" : "siddur"} color={hAccent} />
          </>
        ),
      }
    : null;


  return (
    <SiddurThemeContext.Provider value={{
      theme: activeTheme,
      setTheme: t => {
        setActiveTheme(t);
        localStorage.setItem(ACTIVE_THEME_KEY, t.id);
        cloudSaveActiveTheme(t);
      },
      previewTheme: t => setActiveTheme(t),
      customTheme,
      setCustomTheme: (t) => {
        const normalized = normalizeSiddurTheme(t);
        setCustomTheme(normalized);
        saveLatestCustomTheme(normalized);
      },
      customThemes,
      saveCustomTheme: saveCustomThemeItem,
      publicThemes,
      publishTheme,
    }}>
    <SiddurDisplayStyleContext.Provider value={{ displayStyle, setDisplayStyle }}>
    <SiddurToolsContext.Provider value={titleTools}>
    <SiddurJumpContext.Provider value={jump}>
    <TodaySectionsContext.Provider value={calendarMode ? todayMarks : EMPTY_MARKS}>
    <div
      data-siddur-theme={activeTheme.id}
      data-siddur-view-mode={viewMode}
      data-siddur-font={fontSettings.siddurFont}
      data-siddur-content-width={fontSettings.siddurContentWidth}
      data-siddur-text-alignment={fontSettings.siddurTextAlignment}
      data-siddur-heading-bold={String(fontSettings.siddurHeadingBold)}
      data-siddur-opening-bold={String(fontSettings.siddurOpeningBold)}
      data-siddur-show-taamim={String(fontSettings.showTaamim)}
      className="siddur-themed-root min-h-screen flex flex-col"
      style={{
        background: activeTheme.bg,
        direction: "rtl",
        "--siddur-card-radius": `${siddurAppearance(activeTheme).cornerRadius}px`,
        "--siddur-button-radius": `${siddurAppearance(activeTheme).buttonRadius}px`,
        "--siddur-border-width": `${siddurAppearance(activeTheme).borderWidth}px`,
        "--siddur-card-shadow": THEME_SHADOWS[siddurAppearance(activeTheme).shadow],
      } as CSSProperties}
    >
      {/* ── Header ── */}
      <header
        className="relative z-40"
        style={{
          background: activeTheme.headerBg,
          boxShadow: siddurAppearance(activeTheme).headerShadow
            ? THEME_SHADOWS[siddurAppearance(activeTheme).shadow]
            : "none",
        }}
      >
        <div className="w-full px-3 sm:px-5">

          <h1 className="sr-only">סידור</h1>
          {/* Siddur-specific controls. Main destinations live in GlobalAppHeader.

              On a phone this row is not rendered at all: its controls move down
              to the top of the text, and the back arrow moves into the tab bar.
              A row kept for one arrow is a row taken from the page somebody
              came here to read. */}
          {!isMobile && (
          <div className="relative flex items-center justify-center gap-1.5 py-2" dir="ltr">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                aria-label="חזרה"
                title="חזרה"
                className="absolute left-0 h-8 px-2 text-sm font-medium"
                style={{ color: hText, background: "transparent" }}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden md:inline">חזרה</span>
              </Button>
              {pageTools}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchOpen(true)}
                aria-label="חיפוש בסידור"
                title="חיפוש בסידור"
                data-testid="siddur-search-open"
                className="absolute right-0 h-8 px-2 text-sm font-medium"
                style={{ color: hText, background: "transparent" }}
              >
                <span className="hidden md:inline">חיפוש</span>
                <Search className="h-4 w-4" />
              </Button>
          </div>
          )}

          {/* ── Row 2 on a phone: the two settled questions, as buttons ── */}
          {isMobile && (
            <div className="flex items-stretch gap-1.5 pb-2.5" dir="rtl">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                aria-label="חזרה"
                title="חזרה"
                className="h-auto w-9 flex-shrink-0 p-0"
                style={{ color: hText, background: "transparent" }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <ChoiceButton
                label="נוסח"
                value={nusachName}
                color={hAccent}
                onClick={() => setPickNusach(true)}
              />
              <ChoiceButton
                label="תפילה"
                value={prayerName}
                color={hAccent}
                onClick={() => setPickPrayer(true)}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchOpen(true)}
                aria-label="חיפוש בסידור"
                title="חיפוש בסידור"
                data-testid="siddur-search-open"
                className="h-auto w-9 flex-shrink-0 p-0"
                style={{ color: hAccent, background: "transparent" }}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* ── Row 2: Nusach pills ── */}
          {!isMobile && (
          <div
            className="flex gap-1.5 pb-2.5 justify-center overflow-x-auto [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none", opacity: isSpecial ? 0.45 : 1, transition: "opacity 0.2s" }}
          >
            {NUSACHOT.map(n => (
              <button
                key={n.id}
                onClick={() => { setNusach(n.id); if (isSpecial) setCatId("shacharit"); }}
                className="px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-all"
                style={
                  nusach === n.id
                    ? { background: hAccent, color: "hsl(var(--sidebar-background))", boxShadow: `0 2px 8px ${hAccent}55`, fontWeight: 700 }
                    : { background: "transparent", color: hText }
                }
              >
                {n.label}
              </button>
            ))}
          </div>
          )}
        </div>
      </header>

      <SectionJumpScroller />
      <SiddurSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        nusach={nusach}
        categories={categories}
        accent={activeTheme.accentColor}
        onPick={openSearchHit}
      />
      <ChoiceDialog
        open={pickNusach}
        onOpenChange={setPickNusach}
        title="בחירת נוסח"
        items={NUSACHOT.map((n) => ({ id: n.id, name: n.label }))}
        value={nusach}
        onPick={(id) => {
          setNusach(id);
          if (isSpecial) setCatId("shacharit");
        }}
      />
      <ChoiceDialog
        open={pickPrayer}
        onOpenChange={setPickPrayer}
        title="בחירת תפילה"
        items={prayerChoices}
        value={catId}
        onPick={setCatId}
      />

      {/* ── On a phone: the sections of the prayer being said ──

          This is the row that is actually used. It replaces the prayer tabs,
          which asked a question that had already been answered by the button
          above. Empty for תהילים and קריאה בתורה, which have no sections of
          this kind - and then the row is simply not there. */}
      {isMobile && !isSpecial && stripSections && stripSections.length > 1 && (
        <PinnedBelowChrome background={activeTheme.headerBg}>
          <SectionStrip sections={stripSections} color={hText} accent={hAccent} />
        </PinnedBelowChrome>
      )}

      {/* ── Category tabs ── */}
      {!isMobile && (
      <div
        className="border-b flex items-stretch"
        style={{
          background: activeTheme.headerBg,
          borderColor: `${hAccent}30`,
        }}
      >
        {/* Scrollable tabs */}
        <div
          className="flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
        <div className="flex gap-0 min-w-max px-2 py-1 items-center">
          {/* Loading spinner placeholder */}
          {catsLoading && (
            <div className="px-4 py-2 flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>טוען...</span>
            </div>
          )}

          {/* Siddur prayer categories (from loaded nusach data) */}
          {!catsLoading && categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCatId(cat.id)}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-all"
              style={{
                fontFamily: "'Noto Serif Hebrew', 'David Libre', serif",
                color: catId === cat.id ? hAccent : hText,
                borderBottomColor: catId === cat.id ? hAccent : "transparent",
              }}
            >
              <CatIcon id={cat.id} />
              {cat.name}
            </button>
          ))}

          {/* Separator before special tabs */}
          {!catsLoading && categories.length > 0 && (
            <div className="self-stretch w-px bg-white/15 mx-1 my-2" />
          )}

          {/* Static tabs — always shown */}
          {STATIC_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setCatId(tab.id)}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-all"
              style={{
                fontFamily: "'Noto Serif Hebrew', 'David Libre', serif",
                color: catId === tab.id ? hAccent : hText,
                borderBottomColor: catId === tab.id ? hAccent : "transparent",
              }}
            >
              <CatIcon id={tab.id} />
              {tab.name}
            </button>
          ))}

          {/* View mode segmented control (only for siddur panes, not tehillim/kria) */}
          {/* (moved outside the scrollable area — see below) */}
        </div>
        </div>

        {/* View mode picker — clickable dropdown in tab bar */}
        {!isSpecial && (
          <div className="flex-shrink-0 flex items-center px-2 border-r border-white/10" dir="ltr">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ background: `${hAccent}18`, color: hAccent }}
                  title={VIEW_MODES.find(m => m.id === viewMode)?.title}
                >
                  {VIEW_MODES.find(m => m.id === viewMode)?.icon}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" className="w-56 z-[9999]" style={{ direction: "rtl" }}>
                <DropdownMenuLabel className="text-right text-xs text-muted-foreground">מצב תצוגה</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {VIEW_MODES.map(m => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <span style={{ color: viewMode === m.id ? activeTheme.accentColor : "hsl(var(--muted-foreground))" }}>{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className={cn("block text-sm", viewMode === m.id && "font-semibold text-foreground")}>{m.title}</span>
                      {m.desc && <span className="block text-[10px] text-muted-foreground">{m.desc}</span>}
                    </div>
                    {viewMode === m.id && <span className="text-xs flex-shrink-0" style={{ color: activeTheme.accentColor }}>✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      )}

      {/* ── Content area ── */}
      <main
        className={cn(
          "flex-1 flex flex-col pt-4 sm:pt-6 mx-auto w-full",
          containerMaxW,
          viewMode === "split" || viewMode === "book"
            ? "px-3 sm:px-5"
            : viewMode === "scroll"
            ? "px-4 sm:px-6"
            : "px-5 sm:px-7"
        )}
      >
        {/* ── Text filter toggles (nikud / taamim) ──

            On a phone this row carries the page's controls instead of four
            pills: the pills are one tap further in, and the controls are here
            rather than in the header, which has no row to spare. */}
        {!isMobile && <TextFiltersBar scope={catId === "tehillim" ? "tehillim" : "siddur"} />}

        {/* Special — nusach-independent panes */}
        {catId === "tehillim" && <TehillimPane />}
        {catId === "kria"     && (
          <KriaPane
            onNavigate={(seferId, perek) => {
              if (seferId && perek) {
                navigate(`/chumash?sefer=${seferId}&perek=${perek}`);
              } else {
                navigate("/chumash");
              }
            }}
          />
        )}

        {todayProfile && !isSpecial && categories.length > 0 && (
          <TodayPanel
            nusach={nusach}
            categories={categories}
            accent={activeTheme.accentColor}
            onOpen={openSearchHit}
            onMarks={setTodayMarks}
            current={stripSections ? { catId, sections: stripSections } : undefined}
            profile={todayProfile!}
          />
        )}

        {/* Regular siddur prayer content */}
        {!isSpecial && (viewMode === "accordion" || viewMode === "continuous") && (
          <CategoryPane nusach={nusach} catId={catId} viewMode={viewMode} today={todayProfile} />
        )}
        {!isSpecial && viewMode === "scroll" && (
          <FullContinuousPane nusach={nusach} />
        )}
        {!isSpecial && viewMode === "split" && (
          <SplitPane nusach={nusach} catId={catId} />
        )}
        {!isSpecial && viewMode === "book" && (
          <BookColumnPane nusach={nusach} catId={catId} />
        )}
      </main>
    </div>
    </TodaySectionsContext.Provider>
    </SiddurJumpContext.Provider>
    </SiddurToolsContext.Provider>
    </SiddurDisplayStyleContext.Provider>
    </SiddurThemeContext.Provider>
  );
};

export default Siddur;
