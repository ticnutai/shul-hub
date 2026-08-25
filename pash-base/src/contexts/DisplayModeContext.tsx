import { createContext, useContext, useMemo, useCallback, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSyncedState } from "@/hooks/useSyncedState";
import { useDevice } from "@/contexts/DeviceContext";

export type DisplayMode = "full" | "compact" | "luxury" | "minimized" | "chumash";

export interface DisplaySettings {
  version?: number;
  mode: DisplayMode;
  pasukCount: number;
  loadMoreCount: number;
  /** Symmetric outer margin for mobile verse cards, in pixels. */
  verseSideMargin: number;
  /** Mobile header arrangement; synced per account with the rest of mobile display settings. */
  headerLayout: "single" | "stacked";
  /** Whether verse cards are expanded in Questions & Commentaries view. */
  questionsExpanded: boolean;
  /** Whether verse cards are expanded in Chumash & Commentaries view. */
  chumashExpanded: boolean;
}

interface DisplayModeContextType {
  displaySettings: DisplaySettings;
  updateDisplaySettings: (settings: Partial<DisplaySettings>) => void;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
}

const defaultSettings: DisplaySettings = {
  version: 3,
  mode: "compact",
  pasukCount: 10,
  loadMoreCount: 10,
  verseSideMargin: 0,
  headerLayout: "stacked",
  questionsExpanded: true,
  chumashExpanded: true,
};

const normalizeDisplayMode = (mode: unknown): DisplayMode => {
  switch (mode) {
    case "full":
    case "compact":
    case "luxury":
    case "minimized":
      return mode;
    // Legacy modes (kept for backward-compat with persisted settings)
    case "chumash":
      return "luxury";
    case "scroll":
      return "compact";
    case "verses-only":
    case "verses-questions":
      return "full";
    default:
      return defaultSettings.mode;
  }
};

const DisplayModeContext = createContext<DisplayModeContextType | undefined>(undefined);

export const DisplayModeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isMobile } = useDevice();

  // Use device-specific column and localStorage key
  const column = isMobile ? "display_settings_mobile" : "display_settings";
  const localStorageKey = isMobile ? "torah-display-settings-mobile" : "torah-display-settings";

  const { data: displaySettings, setData: setDisplaySettingsData, status } = useSyncedState<DisplaySettings>({
    localStorageKey,
    tableName: "user_settings",
    column,
    userId,
    syncToCloud: !!userId,
    defaultValue: defaultSettings,
  });

  const updateDisplaySettings = useCallback((settings: Partial<DisplaySettings>) => {
    setDisplaySettingsData((prev) => ({ ...prev, ...settings, version: 3 }));
  }, [setDisplaySettingsData]);

  // Migrate the former device-only header preference into the synced settings object.
  // Once written, useSyncedState persists it locally and in user_settings in Supabase.
  useEffect(() => {
    if (displaySettings?.headerLayout) return;
    let legacy: DisplaySettings["headerLayout"] = "stacked";
    try {
      legacy = localStorage.getItem("mobileHeaderLayout") === "single" ? "single" : "stacked";
    } catch { /* storage may be unavailable */ }
    setDisplaySettingsData((prev) => ({ ...prev, headerLayout: legacy, version: 3 }));
  }, [displaySettings?.headerLayout, setDisplaySettingsData]);

  // Safety layer: ensure displaySettings always has valid structure
  const safeDisplaySettings: DisplaySettings = useMemo(() => ({
    mode: normalizeDisplayMode(displaySettings?.mode),
    pasukCount: (displaySettings?.version ?? 0) >= 2
      ? (displaySettings.pasukCount || defaultSettings.pasukCount)
      : defaultSettings.pasukCount,
    loadMoreCount: displaySettings?.loadMoreCount || defaultSettings.loadMoreCount,
    verseSideMargin: Math.min(32, Math.max(0, displaySettings?.verseSideMargin ?? defaultSettings.verseSideMargin)),
    headerLayout: displaySettings?.headerLayout === "single" ? "single" : "stacked",
    // Older settings did not store expansion per view. Treat them as expanded
    // so a fresh install and an upgraded account both open content by default.
    questionsExpanded: displaySettings?.questionsExpanded !== false,
    chumashExpanded: displaySettings?.chumashExpanded !== false,
  }), [displaySettings]);

  const value = useMemo(() => ({ displaySettings: safeDisplaySettings, updateDisplaySettings, syncStatus: status }), [safeDisplaySettings, updateDisplaySettings, status]);

  return (
    <DisplayModeContext.Provider value={value}>
      {children}
    </DisplayModeContext.Provider>
  );
};

export const useDisplayMode = () => {
  const context = useContext(DisplayModeContext);
  if (!context) {
    throw new Error("useDisplayMode must be used within DisplayModeProvider");
  }
  return context;
};
