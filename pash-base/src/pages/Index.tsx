import { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from "react";
import { Book, Loader2, ChevronRight, ChevronLeft, User, BookOpen, ScrollText, Languages, BookMarked, Sparkles, Cog, Check, LayoutPanelTop, Palette } from "lucide-react";

import { Sefer, FlatPasuk } from "@/types/torah";
import { cn } from "@/lib/utils";
import { PARSHA_START } from "@/utils/parshaStartPositions";
import { SeferSelector } from "@/components/SeferSelector";
import { ViewModeToggle } from "@/components/ViewModeToggle";
import { UserMenu } from "@/components/UserMenu";
import { GlobalSearchTrigger } from "@/components/GlobalSearchTrigger";
import { InlineSearch } from "@/components/InlineSearch";
import { TextDisplaySettings } from "@/components/TextDisplaySettings";
import { FontAndColorSettingsProvider } from "@/contexts/FontAndColorSettingsContext";
import { MinimizeButton } from "@/components/MinimizeButton";
import { PasukSimpleNavigator } from "@/components/PasukSimpleNavigator";
// ReadingProgress removed - replaced with nav buttons
import { useDisplayMode, DisplayMode } from "@/contexts/DisplayModeContext";
import { useDevice } from "@/contexts/DeviceContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { getCurrentWeeklyParsha, getCalendarPreference } from "@/utils/parshaUtils";
import { SeferSkeleton } from "@/components/SeferSkeleton";
import { SelectionProvider } from "@/contexts/SelectionContext";
import { MultiShareBar } from "@/components/MultiShareBar";
import { SelectionModeButton } from "@/components/SelectionModeButton";
import { yieldToMain } from "@/utils/asyncHelpers";
import { lazyLoadSefer, preloadNextSefer } from "@/utils/lazyLoadSefer";
import { usePinchZoom } from "@/hooks/usePinchZoom";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { SidePanelTrigger } from "@/components/SidePanelTrigger";
import { LayoutOverlay } from "@/components/LayoutOverlay";
import { logInteraction } from "@/utils/interactionDebug";
import { CompactPasukView } from "@/components/CompactPasukView";
import { LuxuryTextView } from "@/components/LuxuryTextView";

import { useReadingPositionSync } from "@/hooks/useReadingPositionSync";
import { useOmerSeason } from "@/features/omer/hooks/useOmerSeason";

// Lazy load heavy components - split by usage priority
// Critical components (loaded when mode is active)
const PaginatedPasukList = lazy(() => import("@/components/PaginatedPasukList").then(m => ({ default: m.PaginatedPasukList })));
const ChumashView = lazy(() => import("@/components/ChumashView").then(m => ({ default: m.ChumashView })));
const SideContentPanel = lazy(() => import("@/components/SideContentPanel").then(m => ({ default: m.SideContentPanel })));

// Navigation components (loaded after initial render)
const QuickSelector = lazy(() => import("@/components/QuickSelector").then(m => ({ default: m.QuickSelector })));
const FloatingQuickSelector = lazy(() => import("@/components/FloatingQuickSelector").then(m => ({ default: m.FloatingQuickSelector })));
const FloatingActionButton = lazy(() => import("@/components/FloatingActionButton").then(m => ({ default: m.FloatingActionButton })));
const Settings = lazy(() => import("@/components/Settings").then(m => ({ default: m.Settings })));

const ComponentLoader = () => (
  <div className="flex flex-col items-center justify-center py-8 gap-3 animate-fade-in">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <p className="text-sm text-muted-foreground animate-pulse">טוען תוכן...</p>
  </div>
);

type CorpusMode = "torah" | "neviim";
type TextLanguage = "he" | "en";
type MobileHeaderLayout = "single" | "stacked";

const TORAH_SEFARIM = [
  { id: 1, name: "בראשית" },
  { id: 2, name: "שמות" },
  { id: 3, name: "ויקרא" },
  { id: 4, name: "במדבר" },
  { id: 5, name: "דברים" },
];

const NEVIIM_SEFARIM = [
  { id: 102, name: "יהושע" },
  { id: 103, name: "שופטים" },
  { id: 104, name: "שמואל א" },
  { id: 105, name: "שמואל ב" },
  { id: 106, name: "מלכים א" },
  { id: 107, name: "מלכים ב" },
  { id: 101, name: "אסתר" },
];

const getCorpusModeForSefer = (seferId: number): CorpusMode => {
  return NEVIIM_SEFARIM.some(s => s.id === seferId) ? "neviim" : "torah";
};

const Index = () => {
  const { displaySettings, updateDisplaySettings } = useDisplayMode();
  const { isMobile, isTablet } = useDevice();
  const navigate = useNavigate();
  const omerInSeason = useOmerSeason();
  const [searchParams] = useSearchParams();
  const [corpusMode, setCorpusMode] = useState<CorpusMode>(() => {
    try {
      return (localStorage.getItem("corpusMode") as CorpusMode) || "torah";
    } catch {
      return "torah";
    }
  });
  const [selectedSefer, setSelectedSefer] = useState<number>(1);
  const [textLanguage, setTextLanguage] = useState<TextLanguage>(() => {
    try {
      const saved = localStorage.getItem("textLanguage");
      return saved === "en" ? "en" : "he";
    } catch {
      return "he";
    }
  });
  const mobileHeaderLayout: MobileHeaderLayout = displaySettings?.headerLayout === "single" ? "single" : "stacked";
  const displayMode: DisplayMode = displaySettings?.mode || 'full';
  const mobileVerseSideMargin = displaySettings?.verseSideMargin ?? 0;
  const [seferData, setSeferData] = useState<Sefer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedParsha, setSelectedParsha] = useState<number | null>(null);
  const [selectedPerek, setSelectedPerek] = useState<number | null>(null);
  const [selectedPasuk, setSelectedPasuk] = useState<number | null>(null);
  const [currentPasukIndex, setCurrentPasukIndex] = useState(0);
  const [singlePasukMode, setSinglePasukMode] = useState(false);
  // Expansion is stored independently for the two main layouts and is synced
  // by DisplayModeContext, so changing one layout never changes the other.
  const globalExpandAll = displayMode === "luxury"
    ? displaySettings.chumashExpanded
    : displaySettings.questionsExpanded;
  const toggleGlobalExpandAll = useCallback(() => {
    if (displayMode === "luxury") {
      updateDisplaySettings({ chumashExpanded: !displaySettings.chumashExpanded });
    } else {
      updateDisplaySettings({ questionsExpanded: !displaySettings.questionsExpanded });
    }
  }, [displayMode, displaySettings.chumashExpanded, displaySettings.questionsExpanded, updateDisplaySettings]);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const { syncDone: readingPosSyncDone, resolvedState: resolvedReadingState, savePosition } = useReadingPositionSync();
  const weeklyParshaLoadedRef = useRef<number | false>(false); // stores the sefer id that was set by weekly parsha
  const pendingSearchNav = useRef<{ perek: number; pasuk: number } | null>(null); // pending navigation from search
  const seferClickStartedAtRef = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [autoWeeklyParsha, setAutoWeeklyParsha] = useState(() => {
    try {
      const saved = localStorage.getItem('autoWeeklyParsha');
      return saved === null ? true : saved === 'true';
    } catch { return true; }
  });

  useEffect(() => {
    const handler = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      if (typeof enabled === "boolean") setAutoWeeklyParsha(enabled);
    };
    window.addEventListener("auto-weekly-parsha-changed", handler);
    return () => window.removeEventListener("auto-weekly-parsha-changed", handler);
  }, []);
  
  // Side content panel state (for Chumash view)
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelMode, setSidePanelMode] = useState<"user" | "pasuk">("pasuk");
  const [sidePanelPasuk, setSidePanelPasuk] = useState<FlatPasuk | null>(null);
  const [chumashSelectedPasukId, setChumashSelectedPasukId] = useState<number | null>(null);
  const [sidePanelWidth, setSidePanelWidth] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("side_panel_width") || "320", 10) || 320; } catch { return 320; }
  });

  const currentSeferOptions = corpusMode === "torah" ? TORAH_SEFARIM : NEVIIM_SEFARIM;
  // appTitle removed – no longer shown in mobile header
  const appSubtitle = corpusMode === "torah" ? "חמישה חומשי תורה עם פירושים" : "נביאים ומגילות";

  const toggleTextLanguage = useCallback(() => {
    setTextLanguage(prev => {
      const next: TextLanguage = prev === "he" ? "en" : "he";
      localStorage.setItem("textLanguage", next);
      toast.success(next === "he" ? "השפה הוחלפה לעברית" : "השפה הוחלפה לאנגלית");
      return next;
    });
  }, []);

  const saveMobileHeaderLayout = useCallback((layout: MobileHeaderLayout) => {
    updateDisplaySettings({ headerLayout: layout });
    toast.success(layout === "stacked" ? "הפריסה הדו־שורתית נשמרה" : "הפריסה הרגילה נשמרה");
  }, [updateDisplaySettings]);

  useEffect(() => {
    if (!currentSeferOptions.some(s => s.id === selectedSefer)) {
      setSelectedSefer(currentSeferOptions[0].id);
      setSelectedParsha(null);
      setSelectedPerek(null);
      setSelectedPasuk(null);
      setSinglePasukMode(false);
    }
  }, [currentSeferOptions, selectedSefer]);



  // Enable pinch-to-zoom for dynamic font scaling
  usePinchZoom({ minScale: 0.6, maxScale: 1.8, step: 0.1 });
  
  
  // PRIORITY: Load weekly parsha FIRST - before sefer data loads
  useEffect(() => {
    if (!readingPosSyncDone) return; // wait for cloud sync to resolve before reading state
    if (initialLoadDone) return;

    if (corpusMode === "neviim") {
      setSelectedSefer(NEVIIM_SEFARIM[0].id);
      setSelectedParsha(null);
      setSelectedPerek(null);
      setSelectedPasuk(null);
      setSinglePasukMode(false);
      setInitialLoadDone(true);
      return;
    }
    
    const hasUrlParams = searchParams.get('sefer') || searchParams.get('perek') || searchParams.get('pasuk');
    if (hasUrlParams) {
      setInitialLoadDone(true);
      return;
    }

    // If auto weekly parsha is disabled, load saved state instead
    if (!autoWeeklyParsha) {
      const savedState = resolvedReadingState ?? (() => {
        try { const r = localStorage.getItem('lastReadingState'); return r ? JSON.parse(r) : null; } catch { return null; }
      })();
      if (savedState) {
        try {
          if (savedState.selectedSefer) setSelectedSefer(savedState.selectedSefer);
          if (savedState.selectedParsha) setSelectedParsha(savedState.selectedParsha);
          if (savedState.selectedPerek) setSelectedPerek(savedState.selectedPerek);
          if (savedState.selectedPasuk) setSelectedPasuk(savedState.selectedPasuk);
          if (savedState.singlePasukMode !== undefined) setSinglePasukMode(savedState.singlePasukMode);
        } catch { /* ignore */ }
      }
      setInitialLoadDone(true);
      return;
    }

    const isIsrael = getCalendarPreference();
    const weeklyParsha = getCurrentWeeklyParsha(isIsrael);

    if (weeklyParsha) {
      setSelectedSefer(weeklyParsha.sefer);
      setSelectedParsha(weeklyParsha.parshaId);
      setSelectedPerek(null);
      setSelectedPasuk(null);
      setSinglePasukMode(false);
      weeklyParshaLoadedRef.current = weeklyParsha.sefer;
      setInitialLoadDone(true);

      const savedState = resolvedReadingState ?? (() => {
        try { const r = localStorage.getItem('lastReadingState'); return r ? JSON.parse(r) : null; } catch { return null; }
      })();
      if (savedState) {
        try {
          if (savedState.selectedParsha && savedState.selectedParsha !== weeklyParsha.parshaId && savedState.selectedPerek) {
            const seferNames: Record<number, string> = { 1: "בראשית", 2: "שמות", 3: "ויקרא", 4: "במדבר", 5: "דברים" };
            const savedSeferName = seferNames[savedState.selectedSefer] || "";
            setTimeout(() => {
              toast("המשך מהמקום האחרון?", {
                description: `${savedSeferName} - פרק ${toHebrewNumber(savedState.selectedPerek)}${savedState.selectedPasuk ? ` פסוק ${toHebrewNumber(savedState.selectedPasuk)}` : ""}`,
                action: {
                  label: "המשך",
                  onClick: () => {
                    if (savedState.selectedSefer) setSelectedSefer(savedState.selectedSefer);
                    if (savedState.selectedParsha) setSelectedParsha(savedState.selectedParsha);
                    if (savedState.selectedPerek) setSelectedPerek(savedState.selectedPerek);
                    if (savedState.selectedPasuk) setSelectedPasuk(savedState.selectedPasuk);
                    if (savedState.singlePasukMode !== undefined) setSinglePasukMode(savedState.singlePasukMode);
                  },
                },
                duration: 8000,
              });
            }, 1500);
          }
        } catch { /* ignore */ }
      }
      return;
    }

    // If no weekly parsha (e.g., during certain holidays), try to load saved state
    const savedState = resolvedReadingState ?? (() => {
      try { const r = localStorage.getItem('lastReadingState'); return r ? JSON.parse(r) : null; } catch { return null; }
    })();
    if (savedState) {
      try {
        if (savedState.selectedSefer) setSelectedSefer(savedState.selectedSefer);
        if (savedState.selectedParsha) setSelectedParsha(savedState.selectedParsha);
        if (savedState.selectedPerek) setSelectedPerek(savedState.selectedPerek);
        if (savedState.selectedPasuk) setSelectedPasuk(savedState.selectedPasuk);
        if (savedState.singlePasukMode !== undefined) setSinglePasukMode(savedState.singlePasukMode);
      } catch (error) {
        console.error('Error loading saved reading state:', error);
      }
    }
    setInitialLoadDone(true);
  }, [searchParams, initialLoadDone, autoWeeklyParsha, corpusMode, readingPosSyncDone, resolvedReadingState]);

  // Save reading state to localStorage and cloud whenever it changes (only after initial load)
  useEffect(() => {
    if (!initialLoadDone) return;
    const stateToSave = {
      corpusMode,
      selectedSefer,
      selectedParsha,
      selectedPerek,
      selectedPasuk,
      singlePasukMode,
    };
    savePosition(stateToSave);
  }, [initialLoadDone, corpusMode, selectedSefer, selectedParsha, selectedPerek, selectedPasuk, singlePasukMode, savePosition]);
  
  // Handle URL parameters for direct navigation
  useEffect(() => {
    const seferParam = searchParams.get('sefer');
    const perekParam = searchParams.get('perek');
    const pasukParam = searchParams.get('pasuk');
    const highlightParam = searchParams.get('highlight');

    if (seferParam) {
      const sefer = parseInt(seferParam);
      const validIds = new Set([...TORAH_SEFARIM, ...NEVIIM_SEFARIM].map(s => s.id));
      if (validIds.has(sefer)) {
        const nextMode = getCorpusModeForSefer(sefer);
        setCorpusMode(nextMode);
        localStorage.setItem("corpusMode", nextMode);
        setSelectedSefer(sefer);
      }
    }

    if (perekParam && pasukParam) {
      const perek = parseInt(perekParam);
      const pasuk = parseInt(pasukParam);
      setSelectedPerek(perek);
      setSelectedPasuk(pasuk);
      setSinglePasukMode(true);
    }

    // Highlight shared text fragment after content loads
    if (highlightParam) {
      const attemptHighlight = (retries = 0) => {
        if (retries > 10) return;
        setTimeout(() => {
          // Find and highlight the text in the page
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node: Text | null;
          while ((node = walker.nextNode() as Text | null)) {
            const idx = node.textContent?.indexOf(highlightParam) ?? -1;
            if (idx >= 0 && node.parentElement && !node.parentElement.closest('mark.shared-highlight')) {
              const range = document.createRange();
              range.setStart(node, idx);
              range.setEnd(node, idx + highlightParam.length);
              const mark = document.createElement('mark');
              mark.className = 'shared-highlight bg-primary/30 text-foreground rounded px-0.5 animate-pulse';
              range.surroundContents(mark);
              mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Remove animation after 3s
              setTimeout(() => mark.classList.remove('animate-pulse'), 3000);
              return;
            }
          }
          attemptHighlight(retries + 1);
        }, 500);
      };
      attemptHighlight();
    }
  }, [searchParams]);

  // Cache for loaded sefarim to avoid re-loading
  const seferCache = useMemo(() => new Map<number, Sefer>(), []);
  
  // Load sefer on demand (lazy loading) with non-blocking parsing
  useEffect(() => {
    let cancelled = false;
    
    const loadSefer = async () => {
      const loadStartedAt = Date.now();

      // Check cache first
      if (seferCache.has(selectedSefer)) {
        if (!cancelled) {
          setSeferData(seferCache.get(selectedSefer)!);
          setLoading(false);
          logInteraction("Index", "loadSefer-cache-hit", {
            seferId: selectedSefer,
            loadMs: Date.now() - loadStartedAt,
            clickToReadyMs: seferClickStartedAtRef.current ? Date.now() - seferClickStartedAtRef.current : null,
          });
          seferClickStartedAtRef.current = null;
        }
        return;
      }

      setLoading(true);
      setLoadingProgress(0);
      try {
        setLoadingProgress(30);
        
        // Load sefer using dynamic import (better code splitting)
        const sefer = await lazyLoadSefer(selectedSefer);
        if (cancelled) return;
        
        setLoadingProgress(60);
        
        // Yield to main thread to prevent blocking
        await yieldToMain();
        if (cancelled) return;
        
        setLoadingProgress(80);
        
        // Cache the loaded sefer
        seferCache.set(selectedSefer, sefer);
        setSeferData(sefer);
        
        // Check if there's a pending search navigation for this sefer
        if (pendingSearchNav.current) {
          const nav = pendingSearchNav.current;
          pendingSearchNav.current = null;
          for (const parsha of sefer.parshiot) {
            if (parsha.perakim.some(p => p.perek_num === nav.perek)) {
              setSelectedParsha(parsha.parsha_id);
              break;
            }
          }
          setSelectedPerek(nav.perek);
          setSelectedPasuk(nav.pasuk);
          setSinglePasukMode(false);
          setCurrentPasukIndex(0);
        } else if (weeklyParshaLoadedRef.current === selectedSefer) {
          // This is the sefer loaded by weekly parsha - keep selections
          weeklyParshaLoadedRef.current = false;
        } else if (!weeklyParshaLoadedRef.current) {
          setSelectedParsha(null);
          setSelectedPerek(null);
          setSelectedPasuk(null);
        }
        // If weeklyParshaLoadedRef points to a different sefer, don't reset
        
        setLoadingProgress(100);
        setLoading(false);
        logInteraction("Index", "loadSefer-complete", {
          seferId: selectedSefer,
          loadMs: Date.now() - loadStartedAt,
          clickToReadyMs: seferClickStartedAtRef.current ? Date.now() - seferClickStartedAtRef.current : null,
        });
        seferClickStartedAtRef.current = null;
        
        // Preload next sefer in background for smooth navigation
        preloadNextSefer(selectedSefer);
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading sefer:", err);
          toast.error("שגיאה בטעינת החומש");
          setLoading(false);
          logInteraction("Index", "loadSefer-error", {
            seferId: selectedSefer,
            loadMs: Date.now() - loadStartedAt,
          });
          seferClickStartedAtRef.current = null;
        }
      }
    };

    loadSefer();
    
    return () => { cancelled = true; };
  }, [selectedSefer, seferCache, corpusMode]);
  // Flatten pesukim from nested structure with batching to prevent blocking
  const flattenedPesukim = useMemo(() => {
    if (!seferData) return [];
    
    const flat: FlatPasuk[] = [];
    let itemCount = 0;
    const BATCH_SIZE = 100;
    
    for (const parsha of seferData.parshiot) {
      for (const perek of parsha.perakim) {
        for (const pasuk of perek.pesukim) {
          flat.push({
            id: pasuk.id,
            sefer: seferData.sefer_id,
            sefer_name: seferData.sefer_name,
            perek: perek.perek_num,
            pasuk_num: pasuk.pasuk_num,
            text: pasuk.text,
            text_en: pasuk.text_en,
            content: pasuk.content || [],
            parsha_id: parsha.parsha_id,
            parsha_name: parsha.parsha_name
          });
          
          itemCount++;
          // Note: Cannot use async in useMemo, but limiting array operations
          // This optimized structure reduces blocking
        }
      }
    }
    
    return flat;
  }, [seferData]);

  // Guard against stale persisted selection state that can lead to an empty view
  useEffect(() => {
    if (!seferData) return;

    if (selectedParsha !== null) {
      const parshaExists = seferData.parshiot.some(p => p.parsha_id === selectedParsha);
      if (!parshaExists) {
        setSelectedParsha(null);
        setSelectedPerek(null);
        setSelectedPasuk(null);
        setSinglePasukMode(false);
        return;
      }
    }

    if (selectedPerek !== null) {
      const perekExists = seferData.parshiot.some(parsha =>
        (selectedParsha === null || parsha.parsha_id === selectedParsha) &&
        parsha.perakim.some(perek => perek.perek_num === selectedPerek)
      );

      if (!perekExists) {
        setSelectedPerek(null);
        setSelectedPasuk(null);
        setSinglePasukMode(false);
        return;
      }
    }

    if (selectedPasuk !== null && selectedPerek !== null) {
      const hasPasukInCurrentScope = flattenedPesukim.some(pasuk =>
        (selectedParsha === null || pasuk.parsha_id === selectedParsha) &&
        pasuk.perek === selectedPerek &&
        pasuk.pasuk_num === selectedPasuk
      );

      if (!hasPasukInCurrentScope) {
        setSelectedPasuk(null);
        setSinglePasukMode(false);
      }
    }
  }, [seferData, flattenedPesukim, selectedParsha, selectedPerek, selectedPasuk]);

  // Get current parsha name and navigation info
  const currentParshaName = useMemo(() => {
    if (!seferData || selectedParsha === null) return null;
    const parsha = seferData.parshiot.find(p => p.parsha_id === selectedParsha);
    return parsha?.parsha_name || null;
  }, [seferData, selectedParsha]);

  // Navigate to previous/next parsha
  const navigateToParsha = useCallback((direction: 'prev' | 'next') => {
    if (!seferData || selectedParsha === null) return;
    
    const currentIndex = seferData.parshiot.findIndex(p => p.parsha_id === selectedParsha);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0 || newIndex >= seferData.parshiot.length) return;
    
    const newParsha = seferData.parshiot[newIndex];
    setSelectedParsha(newParsha.parsha_id);
    setSelectedPerek(null);
    setSelectedPasuk(null);
    setSinglePasukMode(false);
  }, [seferData, selectedParsha]);

  // Check if can navigate prev/next
  const canNavigatePrev = useMemo(() => {
    if (!seferData || selectedParsha === null) return false;
    const currentIndex = seferData.parshiot.findIndex(p => p.parsha_id === selectedParsha);
    return currentIndex > 0;
  }, [seferData, selectedParsha]);

  const canNavigateNext = useMemo(() => {
    if (!seferData || selectedParsha === null) return false;
    const currentIndex = seferData.parshiot.findIndex(p => p.parsha_id === selectedParsha);
    return currentIndex < seferData.parshiot.length - 1;
  }, [seferData, selectedParsha]);

  // Keyboard shortcuts for navigation
  useKeyboardShortcuts({
    onNextParsha: useCallback(() => canNavigateNext && navigateToParsha('next'), [canNavigateNext, navigateToParsha]),
    onPrevParsha: useCallback(() => canNavigatePrev && navigateToParsha('prev'), [canNavigatePrev, navigateToParsha]),
  });

  // All pesukim in the selected parsha (for pasuk navigation)
  // Start from the actual Torah opening pasuk of the parasha (may be mid-chapter).
  const parshaAllPesukim = useMemo(() => {
    if (selectedParsha === null) return [];
    let pesukim = flattenedPesukim.filter(p => p.parsha_id === selectedParsha);
    const start = PARSHA_START[selectedParsha];
    if (start && start.pasuk > 1) {
      const startIdx = pesukim.findIndex(
        p => p.perek === start.perek && p.pasuk_num >= start.pasuk
      );
      if (startIdx > 0) pesukim = pesukim.slice(startIdx);
    }
    return pesukim;
  }, [flattenedPesukim, selectedParsha]);

  const filteredPesukim = useMemo(() => {
    let pesukim = flattenedPesukim;

    // Filter by parsha
    if (selectedParsha !== null) {
      pesukim = pesukim.filter(p => p.parsha_id === selectedParsha);
    }

    // Filter by perek
    if (selectedPerek !== null) {
      pesukim = pesukim.filter(p => p.perek === selectedPerek);
    } else if (selectedParsha !== null) {
      // No specific perek chosen → show the whole parasha but START from its
      // actual Torah opening pasuk (some parshiot begin mid-chapter).
      const start = PARSHA_START[selectedParsha];
      if (start && start.pasuk > 1) {
        const startIdx = pesukim.findIndex(
          p => p.perek === start.perek && p.pasuk_num >= start.pasuk
        );
        if (startIdx > 0) pesukim = pesukim.slice(startIdx);
      }
    }

    // Don't filter by specific pasuk in these cases:
    // 1. When in single pasuk mode (allows navigation between pesukim)
    // 2. When in compact mode (we want to show multiple pesukim starting from selected)
    if (selectedPasuk !== null && !singlePasukMode && displayMode !== "compact") {
      const byPasuk = pesukim.filter(p => p.pasuk_num === selectedPasuk);
      if (byPasuk.length > 0) {
        pesukim = byPasuk;
      }
    }

    return pesukim;
  }, [flattenedPesukim, selectedParsha, selectedPerek, selectedPasuk, singlePasukMode, displayMode]);

  const displayedPesukim = useMemo(() => {
    if (singlePasukMode && filteredPesukim.length > 0) {
      return [filteredPesukim[currentPasukIndex]];
    }
    
    // The compact view receives the remaining list and loads it in batches while scrolling.
    if (displayMode === "compact") {
      if (selectedPasuk !== null) {
        const startIndex = filteredPesukim.findIndex(p => p.pasuk_num === selectedPasuk);
        if (startIndex >= 0) {
          return filteredPesukim.slice(startIndex);
        }
      }
      return filteredPesukim;
    }
    
    // Default: show all
    return filteredPesukim;
  }, [filteredPesukim, singlePasukMode, currentPasukIndex, displayMode, selectedPasuk]);

  const localizedDisplayedPesukim = useMemo(() => {
    if (textLanguage === "he") return displayedPesukim;
    return displayedPesukim.map((pasuk) => ({
      ...pasuk,
      text: pasuk.text_en || pasuk.text,
    }));
  }, [displayedPesukim, textLanguage]);

  // Verbose selection-state logging removed — was creating console noise on every render.
  // Re-enable temporarily by uncommenting if you need to debug selection flow.

  const handleNavigate = useCallback((index: number) => {
    setCurrentPasukIndex(index);
  }, []);

  const handleQuickSelectorChange = useCallback(() => {
    setCurrentPasukIndex(0);
    setSinglePasukMode(false);
  }, []);

  const handleSeferSelect = useCallback((seferId: number) => {
    logInteraction("Index", "handleSeferSelect", { seferId, fromSefer: selectedSefer });
    seferClickStartedAtRef.current = Date.now();

    const nextMode = getCorpusModeForSefer(seferId);
    if (nextMode !== corpusMode) {
      setCorpusMode(nextMode);
      localStorage.setItem("corpusMode", nextMode);
    }

    if (seferCache.has(seferId)) {
      setSeferData(seferCache.get(seferId)!);
      setLoading(false);
      logInteraction("Index", "handleSeferSelect-immediate-cache", { seferId });
    }

    // Clear old data immediately to prevent showing stale parshiot
    if (seferId !== selectedSefer && !seferCache.has(seferId)) {
      setSeferData(null);
      setLoading(true);
    }
    setSelectedSefer(seferId);
    setSelectedParsha(null);
    setSelectedPerek(null);
    setSelectedPasuk(null);
    setSinglePasukMode(false);
    setCurrentPasukIndex(0);
  }, [selectedSefer, seferCache, corpusMode]);

  const handleParshaSelect = useCallback((p: number | null) => {
    logInteraction("Index", "handleParshaSelect", { parsha: p });
    setSelectedParsha(p);
    setSelectedPerek(null);
    setSelectedPasuk(null);
    handleQuickSelectorChange();
  }, [handleQuickSelectorChange]);

  const handlePerekSelect = useCallback((p: number | null) => {
    logInteraction("Index", "handlePerekSelect", { perek: p });
    setSelectedPerek(p);
    setSelectedPasuk(null);
    handleQuickSelectorChange();
  }, [handleQuickSelectorChange]);

  const handlePasukSelect = useCallback((p: number | null) => {
    logInteraction("Index", "handlePasukSelect", {
      pasuk: p,
      selectedPerek,
      displayMode,
      singlePasukMode,
    });
    if (p === null) {
      setSelectedPasuk(null);
      return;
    }

    // Never infer or change perek from pasuk selection.
    // If perek is not selected yet, keep state stable and just store the pasuk.
    if (selectedPerek === null) {
      setSelectedPasuk(p);
      return;
    }
    
    if (displayMode === "compact") {
      setSelectedPasuk(prev => (prev === p ? null : p));
      setSinglePasukMode(false);
    } else {
      const effectivePerek = selectedPerek;
      const perekPesukim = flattenedPesukim.filter(pasuk => 
        pasuk.perek === effectivePerek && 
        (selectedParsha === null || pasuk.parsha_id === selectedParsha)
      );
      const index = perekPesukim.findIndex(pasuk => pasuk.pasuk_num === p);
      setCurrentPasukIndex(index >= 0 ? index : 0);
      setSelectedPasuk(p);
      setSinglePasukMode(true);
    }
  }, [displayMode, flattenedPesukim, selectedPerek, selectedParsha]);
  
  const totalPesukimInPerek = useMemo(() => {
    if (!seferData || selectedPerek === null) return 0;
    // חיפוש בנתונים המקוריים, לא רק בפסוקים המסוננים
    for (const parsha of seferData.parshiot) {
      for (const perek of parsha.perakim) {
        if (perek.perek_num === selectedPerek) {
          return perek.pesukim.length;
        }
      }
    }
    return 0;
  }, [seferData, selectedPerek]);

  // Handler for ChumashView pasuk selection (opens side panel)
  const handleChumashPasukSelect = useCallback((_pasukId: number, pasuk: FlatPasuk) => {
    logInteraction("Index", "handleChumashPasukSelect", {
      pasukId: pasuk.id,
      currentOpen: sidePanelOpen,
      currentMode: sidePanelMode,
      currentSelected: chumashSelectedPasukId,
    });
    // Clicking the same pasuk again toggles it closed.
    if (sidePanelOpen && sidePanelMode === "pasuk" && chumashSelectedPasukId === pasuk.id) {
      setSidePanelOpen(false);
      setSidePanelPasuk(null);
      setChumashSelectedPasukId(null);
      return;
    }

    setChumashSelectedPasukId(pasuk.id);
    setSidePanelPasuk(pasuk);
    setSidePanelMode("pasuk");
    setSidePanelOpen(true);
  }, [chumashSelectedPasukId, sidePanelMode, sidePanelOpen]);

  const toggleCorpusMode = useCallback(() => {
    setCorpusMode(prev => {
      const next: CorpusMode = prev === "torah" ? "neviim" : "torah";
      localStorage.setItem("corpusMode", next);
      setSeferData(null);
      setSelectedSefer(next === "torah" ? TORAH_SEFARIM[0].id : NEVIIM_SEFARIM[0].id);
      setSelectedParsha(null);
      setSelectedPerek(null);
      setSelectedPasuk(null);
      setSinglePasukMode(false);
      setCurrentPasukIndex(0);
      toast.success(next === "torah" ? "עבר למצב חומשים" : "עבר למצב נביאים (מגילת אסתר)");
      return next;
    });
  }, []);

  // Handle navigation from search results
  const handleSearchNavigate = useCallback((seferId: number, perek: number, pasuk: number) => {
    logInteraction("Index", "handleSearchNavigate", { seferId, perek, pasuk });
    const nextMode = getCorpusModeForSefer(seferId);
    if (nextMode !== corpusMode) {
      setCorpusMode(nextMode);
      localStorage.setItem("corpusMode", nextMode);
    }
    // Store pending navigation so loadSefer effect won't reset selections
    pendingSearchNav.current = { perek, pasuk };
    
    const applyNav = (data: Sefer) => {
      for (const parsha of data.parshiot) {
        if (parsha.perakim.some(p => p.perek_num === perek)) {
          setSelectedParsha(parsha.parsha_id);
          break;
        }
      }
      setSelectedPerek(perek);
      setSelectedPasuk(pasuk);
      setSinglePasukMode(false);
      setCurrentPasukIndex(0);
    };

    if (seferId === selectedSefer && seferData) {
      // Same sefer - apply immediately
      applyNav(seferData);
      pendingSearchNav.current = null;
    } else {
      // Different sefer - set sefer and let loadSefer handle the rest
      setSeferData(null);
      setSelectedSefer(seferId);
    }
  }, [seferCache, selectedSefer, seferData, corpusMode]);

  const handleOpenQuickNav = useCallback(() => {
    logInteraction("Index", "handleOpenQuickNav");
    const trigger = document.querySelector('[data-floating-quick-trigger]') as HTMLElement | null;
    trigger?.click();
  }, []);

  return (
    <SelectionProvider>
    <div
      className="min-h-screen bg-background pb-20 overflow-x-hidden"
      style={{
        paddingBottom: isMobile
          ? 'max(calc(6rem + var(--safe-area-inset-bottom, var(--sai-bottom, env(safe-area-inset-bottom, 0px)))), 10rem)'
          : 'calc(5rem + var(--safe-area-inset-bottom, var(--sai-bottom, env(safe-area-inset-bottom, 0px))))'
      }}
    >
      {/* Header - Fully Responsive */}
      <header data-layout="header" data-theme-header data-layout-label="הדר ראשי" className="sticky top-0 z-50 bg-sidebar shadow-lg">
        <div className="w-full px-3 sm:px-4 py-2 sm:py-3">
          {/* Mobile Layout - Stack vertically */}
          <div
            className="flex flex-col gap-1 md:hidden"
            style={{ paddingTop: 'max(var(--safe-area-inset-top, var(--sai-top, env(safe-area-inset-top, 0px))), 28px)' }}
          >
            <div className="relative flex min-h-7 items-center justify-center pb-0.5" dir="rtl">
              <div
                data-layout="btn-user"
                data-layout-label="👤 חשבון"
                className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center gap-0.5"
              >
                <UserMenu iconOnly />
              </div>
              {mobileHeaderLayout === "stacked" && (
                <div className="flex items-center justify-center gap-1">
                <button
                  onClick={() => {
                    setCorpusMode("torah");
                    localStorage.setItem("corpusMode", "torah");
                    setSelectedSefer(TORAH_SEFARIM[0].id);
                    setSelectedParsha(null);
                    setSelectedPerek(null);
                    setSelectedPasuk(null);
                  }}
                  className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-accent/80 transition-colors hover:bg-accent/10 hover:text-accent"
                >
                  <Book className="h-3.5 w-3.5" />
                  חומש
                </button>
                <button
                  onClick={() => navigate('/siddur')}
                  className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-accent/65 transition-colors hover:bg-accent/10 hover:text-accent"
                >
                  <BookMarked className="h-3.5 w-3.5" />
                  סידור
                </button>
                </div>
              )}
            </div>
            {/* Action row */}
            <div className="flex w-full items-center px-1">
              <div data-layout="header-actions-mobile" data-layout-label="כפתורי כותרת (מובייל)" className="flex w-full items-center justify-between gap-0.5">
                <span data-layout="btn-lang" data-layout-label="🌐 שפה">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTextLanguage}
                  className="h-8 w-8 text-accent hover:text-accent hover:bg-accent/10"
                  title={textLanguage === "he" ? "Switch to English" : "החלף לעברית"}
                >
                  <Languages className="h-4 w-4" />
                </Button>
                </span>
                <span data-layout="btn-themes" data-layout-label="🎨 ערכות נושא">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    document.documentElement.dataset.openAppThemes = "true";
                    window.dispatchEvent(new CustomEvent("open-app-themes"));
                  }}
                  className="h-8 w-8 text-accent hover:bg-accent/10 hover:text-accent"
                  title="ערכות נושא"
                  aria-label="פתח ערכות נושא"
                >
                  <Palette className="h-4 w-4" />
                </Button>
                </span>

                {displayMode !== "luxury" && <span data-layout="btn-text-settings" data-layout-label="✏️ הגדרות טקסט"><TextDisplaySettings /></span>}
                <span data-layout="btn-selection" data-layout-label="☑️ מצב בחירה"><SelectionModeButton /></span>
                <span data-layout="btn-search" data-layout-label="🔍 חיפוש"><GlobalSearchTrigger onNavigateToPasuk={handleSearchNavigate} /></span>
                {/* Mode switcher: in the regular layout all destinations stay on this row. */}
                {mobileHeaderLayout === "single" && <span data-layout="btn-mode-switcher" data-layout-label="📚 מצב אפליקציה" className="flex items-center gap-0.5">
                  <span data-layout="btn-corpus">
                  <button
                    onClick={() => {
                      const next = corpusMode === "torah" ? "neviim" : "torah";
                      setCorpusMode(next);
                      localStorage.setItem("corpusMode", next);
                      const firstSeferId = next === "neviim" ? NEVIIM_SEFARIM[0].id : TORAH_SEFARIM[0].id;
                      setSelectedSefer(firstSeferId);
                      setSelectedParsha(null);
                      setSelectedPerek(null);
                      setSelectedPasuk(null);
                    }}
                    className="flex items-center justify-center h-8 w-8 rounded-md text-xs font-semibold transition-all text-accent"
                    title="חומש"
                  >
                    <Book className="h-4 w-4" />
                  </button>
                  </span>
                  <span data-layout="btn-siddur">
                  <button
                    onClick={() => navigate('/siddur')}
                    className="flex items-center justify-center h-8 w-8 rounded-md text-xs font-medium transition-all text-accent/50 hover:text-accent"
                    title="סידור תפילה"
                  >
                    <BookMarked className="h-4 w-4" />
                  </button>
                  </span>
                  {omerInSeason && <button
                    onClick={() => navigate('/omer')}
                    className="flex items-center justify-center h-8 w-8 rounded-md text-xs font-medium transition-all text-accent/50 hover:text-accent"
                    title="ספירת העומר"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>}
                </span>}
                {mobileHeaderLayout === "stacked" && omerInSeason && (
                  <button
                    onClick={() => navigate('/omer')}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-accent/50 transition-all hover:text-accent"
                    title="ספירת העומר"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-md text-accent/70 transition-colors hover:bg-accent/10 hover:text-accent"
                      title="בחירת פריסת מובייל"
                      aria-label="בחירת פריסת מובייל"
                    >
                      <LayoutPanelTop className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-48" style={{ direction: "rtl" }}>
                    <DropdownMenuItem onSelect={() => saveMobileHeaderLayout("single")} className="justify-between gap-3">
                      <span>פריסה רגילה</span>
                      {mobileHeaderLayout === "single" && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => saveMobileHeaderLayout("stacked")} className="justify-between gap-3">
                      <span>חומש וסידור למעלה</span>
                      {mobileHeaderLayout === "stacked" && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <span data-layout="btn-settings" data-layout-label="⚙️ הגדרות">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => (document.querySelector('[data-settings-trigger]') as HTMLElement)?.click()}
                    className="h-8 w-8 text-accent hover:bg-accent/10 hover:text-accent"
                    title="הגדרות"
                    aria-label="הגדרות"
                  >
                    <Cog className="h-4 w-4" />
                  </Button>
                </span>
              </div>
            </div>
          </div>

          {/* Desktop/Tablet Layout */}
          <div data-layout="header-actions-desktop" data-layout-label="כפתורי כותרת (דסקטופ)" className="hidden md:flex flex-col gap-1.5">
            {/* Single row: Title (right) | Mode switcher (center) | Icons + Search (left) */}
            <div className="flex items-center justify-between gap-3">
              {/* Right: Title */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Book className="h-6 w-6 flex-shrink-0" style={{ color: 'hsl(var(--accent))' }} />
                <div className="flex flex-col leading-none">
                  <h1
                    className="font-bold text-primary-foreground tracking-wide"
                    style={{
                      fontSize: '1.15rem',
                      fontFamily: "'Noto Serif Hebrew', 'David Libre', serif",
                      background: 'linear-gradient(90deg, hsl(var(--accent)), hsl(var(--primary-foreground)))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {appSubtitle}
                  </h1>
                  <span
                    className="text-xs tracking-widest uppercase"
                    style={{ color: 'hsl(var(--accent) / 0.7)', fontFamily: "'Noto Serif Hebrew', serif", letterSpacing: '0.15em' }}
                  >
                    ✦ &nbsp; Torah Study &nbsp; ✦
                  </span>
                </div>
              </div>

              {/* Center: Mode switcher — חומש / סידור / עומר */}
              <span data-layout="btn-mode-switcher" data-layout-label="📚 מצב אפליקציה" className="flex items-center gap-0.5">
                <span data-layout="btn-corpus">
                <button
                  onClick={() => {
                    const next = corpusMode === "torah" ? "neviim" : "torah";
                    setCorpusMode(next);
                    localStorage.setItem("corpusMode", next);
                    const firstSeferId = next === "neviim" ? NEVIIM_SEFARIM[0].id : TORAH_SEFARIM[0].id;
                    setSelectedSefer(firstSeferId);
                    setSelectedParsha(null);
                    setSelectedPerek(null);
                    setSelectedPasuk(null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-all text-accent"
                  title="חומש"
                >
                  <Book className="h-4 w-4" />
                  <span>חומש</span>
                </button>
                </span>
                <span data-layout="btn-siddur">
                <button
                  onClick={() => navigate('/siddur')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all text-accent/50 hover:text-accent"
                  title="סידור תפילה"
                >
                  <BookMarked className="h-4 w-4" />
                  <span>סידור</span>
                </button>
                </span>
                {omerInSeason && <button
                  onClick={() => navigate('/omer')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all text-accent/50 hover:text-accent"
                  title="ספירת העומר"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>ספירת העומר</span>
                </button>}
              </span>

              {/* Left: Icons clustered together + Search at far left */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {displayMode !== "luxury" && <span data-layout="btn-text-settings" data-layout-label="✏️ הגדרות טקסט"><TextDisplaySettings /></span>}
                <span data-layout="btn-selection" data-layout-label="☑️ מצב בחירה"><SelectionModeButton /></span>
                <span data-layout="btn-search" data-layout-label="🔍 חיפוש"><GlobalSearchTrigger onNavigateToPasuk={handleSearchNavigate} /></span>
                <span data-layout="btn-themes" data-layout-label="🎨 ערכות נושא">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      document.documentElement.dataset.openAppThemes = "true";
                      window.dispatchEvent(new CustomEvent("open-app-themes"));
                    }}
                    className="h-8 w-8 text-accent hover:text-accent hover:bg-accent/10"
                    title="ערכות נושא"
                    aria-label="פתח ערכות נושא"
                  >
                    <Palette className="h-4 w-4" />
                  </Button>
                </span>
                <span data-layout="btn-settings" data-layout-label="⚙️ הגדרות">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => (document.querySelector('[data-settings-trigger]') as HTMLElement)?.click()}
                    className="h-8 w-8 text-accent hover:text-accent hover:bg-accent/10"
                    title="הגדרות"
                  >
                    <Cog className="h-4 w-4" />
                  </Button>
                </span>
                <span data-layout="btn-user" data-layout-label="👤 משתמש"><UserMenu /></span>
                <div className="flex items-center gap-2 w-56 mr-1">
                  <InlineSearch onNavigateToPasuk={handleSearchNavigate} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Settings Button - rendered by Settings component */}
      <Suspense fallback={null}>
        {!(isMobile && sidePanelOpen) && <Settings />}
      </Suspense>

      {/* Layout editor overlay — Ctrl+Shift+L or floating button */}
      <LayoutOverlay />

      <div 
        className="container mx-auto px-3 sm:px-4 py-1 sm:py-2 space-y-1 sm:space-y-2 transition-[padding] duration-300 ease-in-out"
      >
        {/* Sefer / Parsha / Perek / Pasuk Selector */}
        <div data-layout="sefer-selector" data-layout-label="בורר חומש / פרשה / פסוק">
        <SeferSelector 
          sefer={seferData}
          selectedSefer={selectedSefer} 
          seferOptions={currentSeferOptions}
          onSeferSelect={handleSeferSelect} 
          selectedParsha={selectedParsha}
          onParshaSelect={handleParshaSelect}
          selectedPerek={selectedPerek}
          onPerekSelect={handlePerekSelect}
          selectedPasuk={selectedPasuk}
          onPasukSelect={handlePasukSelect}
        />
        </div>

        {/* Side Panel Buttons + Parsha/Pasuk Nav - Desktop only, SAME ROW */}
        <div data-layout="desktop-controls" data-layout-label="שורת כלים" className="hidden md:flex justify-between items-center gap-2">
          {/* Left side: toolbar buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {displayMode !== "luxury" && <span data-layout="btn-text-settings-inline" data-layout-label="✏️ הגדרות טקסט (שורת כלים)"><TextDisplaySettings /></span>}
            <span data-layout="btn-view-mode" data-layout-label="👁️ מצב תצוגה"><ViewModeToggle seferId={selectedSefer} /></span>
            <span data-layout="btn-user-content" data-layout-label="📂 התוכן שלי">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setSidePanelMode("user");
                setSidePanelOpen(!sidePanelOpen || sidePanelMode !== "user");
              }}
                      className={cn("", sidePanelOpen && sidePanelMode === "user" && "bg-accent/15 border-accent text-accent ring-1 ring-accent/30")}
                      title="התוכן שלי"
                    >
                      <User className={cn("h-4 w-4", sidePanelOpen && sidePanelMode === "user" && "text-accent")} />
            </Button>
            </span>
            {displayMode === "chumash" && (
              <span data-layout="btn-commentary" data-layout-label="📖 פירושים">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setSidePanelMode("pasuk");
                  setSidePanelOpen(!sidePanelOpen || sidePanelMode !== "pasuk");
                }}
                      className={cn("", sidePanelOpen && sidePanelMode === "pasuk" && "bg-accent/15 border-accent text-accent ring-1 ring-accent/30")}
                      title="פירושים"
                    >
                      <BookOpen className={cn("h-4 w-4", sidePanelOpen && sidePanelMode === "pasuk" && "text-accent")} />
              </Button>
              </span>
            )}
            {filteredPesukim.length > 0 && (
              <span data-layout="btn-minimize" data-layout-label="➖ מזער הכל">
              <MinimizeButton
                variant="global"
                isMinimized={!globalExpandAll}
                onClick={toggleGlobalExpandAll}
              />
              </span>
            )}
          </div>

          {/* Right side (RTL center): Parsha & Pasuk navigation */}
          {currentParshaName && filteredPesukim.length > 0 && (
            <div data-layout="parsha-pasuk-nav" data-layout-label="ניווט פרשה ופסוקים" className="flex items-center justify-center gap-6 flex-1" dir="rtl">
              {/* Parsha navigation */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateToParsha('prev')}
                  disabled={!canNavigatePrev}
                  className="h-8 w-8 p-0 hover:bg-primary/20 disabled:opacity-30 transition-colors"
                  title="פרשה קודמת"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-base sm:text-lg font-semibold text-primary whitespace-nowrap">
                    {currentParshaName}
                  </span>
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateToParsha('next')}
                  disabled={!canNavigateNext}
                  className="h-8 w-8 p-0 hover:bg-primary/20 disabled:opacity-30 transition-colors"
                  title="פרשה הבאה"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </div>

              {/* Pasuk navigation */}
              {parshaAllPesukim.length > 0 && (
                <PasukSimpleNavigator
                  pesukim={parshaAllPesukim}
                  currentPasukNum={selectedPasuk || filteredPesukim[0]?.pasuk_num || 1}
                  onNavigate={handlePasukSelect}
                />
              )}
            </div>
          )}
        </div>

        {/* Persistent Side Panel Trigger Arrow — hidden on mobile (mobile uses bottom sheet + User button) */}
        {!isMobile && (
          <SidePanelTrigger
            isOpen={sidePanelOpen}
            onClick={() => {
              if (sidePanelOpen) {
                setSidePanelOpen(false);
              } else {
                setSidePanelOpen(true);
              }
            }}
          />
        )}

        {/* Side Content Panel - moved into the grid below */}

        {loading ? (
          <SeferSkeleton />
        ) : (
          <>
            {/* Navigation bar moved above the grid */}

            {/* Mobile controls - ABOVE the grid */}
            {isMobile && (
              <div
                data-layout="mobile-controls"
                data-layout-label="בקרות מובייל"
                className="mt-4 grid w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 rounded-2xl border border-accent/20 bg-card/35 px-3 py-3 shadow-sm"
                dir="ltr"
              >
                <div className="flex h-11 w-11 items-center justify-center justify-self-start">
                  {filteredPesukim.length > 0 && (
                  <MinimizeButton
                    variant="global"
                    isMinimized={!globalExpandAll}
                    onClick={toggleGlobalExpandAll}
                  />
                  )}
                </div>
                <div className="flex min-w-0 items-center justify-center" dir="rtl">
                  <ViewModeToggle seferId={selectedSefer} />
                </div>
                <div className="flex h-11 w-11 items-center justify-center justify-self-end" dir="rtl">
                  {displayMode === "luxury"
                    ? <div id="luxury-mobile-text-settings-slot" className="flex h-11 w-11 items-center justify-center" />
                    : <TextDisplaySettings />}
                </div>
              </div>
            )}

            {/* Navigation buttons - parsha & pasuk - mobile only (desktop has it inside desktop-controls above) */}
            {displayMode !== "luxury" && (isMobile || isTablet) && currentParshaName && parshaAllPesukim.length > 0 && (
              <div data-layout="nav-buttons" data-layout-label="🔀 ניווט" className="mt-3 flex items-center justify-center gap-3 py-3 px-2" dir="rtl">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateToParsha('prev')}
                  disabled={!canNavigatePrev}
                  className="h-10 w-10 p-0 rounded-full hover:bg-primary/10 disabled:opacity-20 transition-colors flex-shrink-0"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <span className="text-sm font-bold text-primary truncate max-w-[120px] text-center" style={{ fontSize: currentParshaName.length > 8 ? '0.75rem' : '0.875rem' }}>
                  {currentParshaName}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateToParsha('next')}
                  disabled={!canNavigateNext}
                  className="h-10 w-10 p-0 rounded-full hover:bg-primary/10 disabled:opacity-20 transition-colors flex-shrink-0"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="h-5 w-px bg-border mx-1" />
                <PasukSimpleNavigator
                  pesukim={parshaAllPesukim}
                  currentPasukNum={selectedPasuk || filteredPesukim[0]?.pasuk_num || 1}
                  onNavigate={handlePasukSelect}
                />
              </div>
            )}

            <div className="relative mt-6 sm:mt-8" ref={gridRef}>
            <div
              className="grid gap-2 w-full max-w-full overflow-hidden items-start"
              style={
                isMobile
                  ? {
                      gridTemplateColumns: "minmax(0, 1fr)",
                      width: `calc(100% + ${24 - (mobileVerseSideMargin * 2)}px)`,
                      maxWidth: "none",
                      marginInline: `${mobileVerseSideMargin - 12}px`,
                    }
                  : sidePanelOpen
                  ? { gridTemplateColumns: `320px 1fr ${sidePanelWidth}px` }
                  : { gridTemplateColumns: "320px 1fr" }
              }
            >
              {/* Quick Selector Sidebar - Hide on mobile when content is showing */}
              {(!isMobile || filteredPesukim.length === 0) && (
                <div data-layout="quick-selector" data-layout-label="בחירה מהירה (סרגל צד)">
                <Suspense fallback={<ComponentLoader />}>
                  <QuickSelector
                    sefer={seferData}
                    selectedParsha={selectedParsha}
                    onParshaSelect={handleParshaSelect}
                    selectedPerek={selectedPerek}
                    onPerekSelect={handlePerekSelect}
                    totalPesukimInPerek={totalPesukimInPerek}
                    selectedPasuk={selectedPasuk}
                    onPasukSelect={handlePasukSelect}
                    onResetToSefer={() => {
                      setSelectedParsha(null);
                      setSelectedPerek(null);
                      setSelectedPasuk(null);
                      setSinglePasukMode(false);
                      setCurrentPasukIndex(0);
                    }}
                  />
                </Suspense>
                </div>
              )}

              {/* Main Content - Verse cards */}
              <div className="w-full min-w-0 overflow-hidden order-first lg:order-none" style={{ maxWidth: "100%" }}>
                {filteredPesukim.length === 0 ? (
                  <Card data-layout="verse-cards" data-layout-label="כרטיסי פסוקים" className="p-12 text-center animate-fade-in">
                    <p className="text-lg text-muted-foreground mb-2">
                      {selectedPasuk !== null && selectedPerek !== null
                        ? `אין תוכן זמין לפסוק ${toHebrewNumber(selectedPasuk)} בפרק ${toHebrewNumber(selectedPerek)}`
                        : selectedPerek !== null
                        ? `אין פסוקים עם תוכן בפרק ${toHebrewNumber(selectedPerek)}`
                        : selectedParsha !== null
                        ? "אין פסוקים עם תוכן בפרשה הנבחרת"
                        : "בחר חומש ופרשה להתחלה"}
                    </p>
                    {selectedPasuk !== null && (
                      <p className="text-sm text-muted-foreground">
                        בחר פסוק עם נקודה ירוקה לצפייה בשאלות ותשובות
                      </p>
                    )}
                  </Card>
                ) : (
                  <Suspense fallback={<ComponentLoader />}>
                    <div data-layout="verse-cards" data-layout-label="כרטיסי פסוקים"
                      key={`${selectedPerek}-${selectedParsha}`}
                    >
                      {displayMode === "luxury" ? (
                        <FontAndColorSettingsProvider scopeKey="luxury">
                        <LuxuryTextView
                          pesukim={localizedDisplayedPesukim}
                          expandAll={globalExpandAll}
                          textSettingsPortalId={isMobile ? "luxury-mobile-text-settings-slot" : undefined}
                          navigation={(isMobile || isTablet) && currentParshaName && parshaAllPesukim.length > 0 ? (
                            <div data-layout="nav-buttons" data-layout-label="🔀 ניווט" className="flex items-center justify-center gap-3 px-2 py-3" dir="rtl">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigateToParsha('prev')}
                                disabled={!canNavigatePrev}
                                className="h-10 w-10 p-0 rounded-full hover:bg-primary/10 disabled:opacity-20 transition-colors flex-shrink-0"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </Button>
                              <span className="text-sm font-bold text-primary truncate max-w-[120px] text-center" style={{ fontSize: currentParshaName.length > 8 ? '0.75rem' : '0.875rem' }}>
                                {currentParshaName}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigateToParsha('next')}
                                disabled={!canNavigateNext}
                                className="h-10 w-10 p-0 rounded-full hover:bg-primary/10 disabled:opacity-20 transition-colors flex-shrink-0"
                              >
                                <ChevronLeft className="h-5 w-5" />
                              </Button>
                              <PasukSimpleNavigator
                                pesukim={parshaAllPesukim}
                                currentPasukNum={selectedPasuk || filteredPesukim[0]?.pasuk_num || 1}
                                onNavigate={handlePasukSelect}
                              />
                            </div>
                          ) : null}
                        />
                        </FontAndColorSettingsProvider>
                      ) : displayMode === "chumash" ? (
                        <ChumashView 
                          pesukim={localizedDisplayedPesukim} 
                          seferId={selectedSefer}
                          selectedPasukId={chumashSelectedPasukId}
                          onPasukSelect={handleChumashPasukSelect}
                        />
                      ) : displayMode === "compact" ? (
                        <CompactPasukView pesukim={localizedDisplayedPesukim} seferId={selectedSefer} expandAll={globalExpandAll} />
                      ) : (
                        <PaginatedPasukList pesukim={localizedDisplayedPesukim} seferId={selectedSefer} expandAll={globalExpandAll} />
                      )}
                    </div>
                  </Suspense>
                )}
              </div>

              {/* Side Content Panel - overlaid on left, aligned to grid top */}
              {!isMobile && (
                <Suspense fallback={null}>
                  <SideContentPanel
                    isOpen={sidePanelOpen}
                    onClose={() => setSidePanelOpen(false)}
                    mode={sidePanelMode}
                    onModeChange={setSidePanelMode}
                    selectedPasuk={sidePanelPasuk}
                    seferId={selectedSefer}
                    inGrid={true}
                    width={sidePanelWidth}
                    onWidthChange={(w) => {
                      setSidePanelWidth(w);
                      localStorage.setItem("side_panel_width", String(w));
                    }}
                  />
                </Suspense>
              )}
            </div>
            </div>

            {/* Side Content Panel - mobile (sheet) */}
            {isMobile && (
              <Suspense fallback={null}>
                <SideContentPanel
                  isOpen={sidePanelOpen}
                  onClose={() => setSidePanelOpen(false)}
                  mode={sidePanelMode}
                  onModeChange={setSidePanelMode}
                  selectedPasuk={sidePanelPasuk}
                  seferId={selectedSefer}
                />
              </Suspense>
            )}
          </>
        )}
      </div>

      {/* Hidden trigger for quick selector, opened from floating action menu */}
      {isMobile && (
        <Suspense fallback={null}>
          <FloatingQuickSelector
            sefer={seferData}
            selectedParsha={selectedParsha}
            onParshaSelect={handleParshaSelect}
            selectedPerek={selectedPerek}
            onPerekSelect={handlePerekSelect}
            totalPesukimInPerek={totalPesukimInPerek}
            selectedPasuk={selectedPasuk}
            onPasukSelect={handlePasukSelect}
            hiddenTrigger={true}
          />
        </Suspense>
      )}

      {/* Floating Draggable Action Button */}
      <Suspense fallback={null}>
        <FloatingActionButton
          onNavigateToPasuk={handleSearchNavigate}
          onOpenQuickNav={handleOpenQuickNav}
          currentSefer={selectedSefer}
          currentPerek={selectedPerek}
          currentPasuk={selectedPasuk}
        />
      </Suspense>

      {/* Floating multi-select share bar */}
      <MultiShareBar />

    </div>
    </SelectionProvider>
  );
};
export default Index;
