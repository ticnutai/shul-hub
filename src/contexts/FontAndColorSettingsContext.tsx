import { createContext, useContext, useMemo, useCallback, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSyncedState } from "@/hooks/useSyncedState";
import { useDevice } from "@/contexts/DeviceContext";

// ... keep existing code (FontAndColorSettings interface - lines 5-47)
export interface FontAndColorSettings {
  // Pasuk
  pasukFont: string;
  pasukSize: number;
  pasukColor: string;
  pasukBold: boolean;
  
  // Title/Header
  titleFont: string;
  titleSize: number;
  titleColor: string;
  titleBold: boolean;
  
  // Question
  questionFont: string;
  questionSize: number;
  questionColor: string;
  questionBold: boolean;
  
  // Answer
  answerFont: string;
  answerSize: number;
  answerColor: string;
  answerBold: boolean;
  
  // Commentary
  commentaryFont: string;
  commentarySize: number;
  commentaryColor: string;
  commentaryBold: boolean;
  commentaryLineHeight: "normal" | "relaxed" | "loose" | "custom";
  commentaryLineHeightCustom: number;
  commentaryMaxWidth: "narrow" | "medium" | "wide" | "full"; // kept for compat
  commentaryTextAlignment: "right" | "center" | "left" | "justify";
  commentaryContentWidth: "narrow" | "normal" | "wide" | "full";
  commentaryContentSpacing: "compact" | "normal" | "comfortable" | "spacious" | "custom";
  commentaryContentSpacingCustom: number;
  commentaryLetterSpacing: "tight" | "normal" | "wide" | "wider" | "custom";
  commentaryLetterSpacingCustom: number;
  commentaryWordSpacing: number;

  // Pasuk layout (per-tab, independent from global and other tabs)
  pasukTextAlignment: "right" | "center" | "left" | "justify";
  pasukLineHeight: "tight" | "normal" | "relaxed" | "loose" | "custom";
  pasukLineHeightCustom: number;
  pasukContentWidth: "narrow" | "normal" | "wide" | "full";
  pasukContentSpacing: "compact" | "normal" | "comfortable" | "spacious" | "custom";
  pasukContentSpacingCustom: number;
  pasukLetterSpacing: "tight" | "normal" | "wide" | "wider" | "custom";
  pasukLetterSpacingCustom: number;
  pasukWordSpacing: number;

  // Title layout (per-tab)
  titleTextAlignment: "right" | "center" | "left" | "justify";
  titleLineHeight: "tight" | "normal" | "relaxed" | "loose" | "custom";
  titleLineHeightCustom: number;
  titleContentWidth: "narrow" | "normal" | "wide" | "full";
  titleContentSpacing: "compact" | "normal" | "comfortable" | "spacious" | "custom";
  titleContentSpacingCustom: number;
  titleLetterSpacing: "tight" | "normal" | "wide" | "wider" | "custom";
  titleLetterSpacingCustom: number;
  titleWordSpacing: number;

  // Question layout (per-tab)
  questionTextAlignment: "right" | "center" | "left" | "justify";
  questionLineHeight: "tight" | "normal" | "relaxed" | "loose" | "custom";
  questionLineHeightCustom: number;
  questionContentWidth: "narrow" | "normal" | "wide" | "full";
  questionContentSpacing: "compact" | "normal" | "comfortable" | "spacious" | "custom";
  questionContentSpacingCustom: number;
  questionLetterSpacing: "tight" | "normal" | "wide" | "wider" | "custom";
  questionLetterSpacingCustom: number;
  questionWordSpacing: number;

  // Siddur / Prayers
  siddurFont: string;
  siddurSize: number;
  siddurBold: boolean;
  siddurHeadingBold: boolean;
  siddurOpeningBold: boolean;
  siddurOpeningWordCount: 1 | 2 | 3;
  siddurTextAlignment: "right" | "center" | "left" | "justify";
  siddurLineHeight: "tight" | "normal" | "relaxed" | "loose" | "custom";
  siddurLineHeightCustom: number;
  siddurContentWidth: "narrow" | "normal" | "wide" | "full";
  siddurContentSpacing: "compact" | "normal" | "comfortable" | "spacious" | "custom";
  siddurContentSpacingCustom: number;
  siddurLetterSpacing: "tight" | "normal" | "wide" | "wider" | "custom";
  siddurLetterSpacingCustom: number;
  siddurWordSpacing: number;

  // Tehillim
  tehillimFont: string;
  tehillimSize: number;
  tehillimBold: boolean;
  tehillimTextAlignment: "right" | "center" | "left" | "justify";
  tehillimLineHeight: "tight" | "normal" | "relaxed" | "loose" | "custom";
  tehillimLineHeightCustom: number;
  tehillimContentWidth: "narrow" | "normal" | "wide" | "full";
  tehillimContentSpacing: "compact" | "normal" | "comfortable" | "spacious" | "custom";
  tehillimContentSpacingCustom: number;
  tehillimLetterSpacing: "tight" | "normal" | "wide" | "wider" | "custom";
  tehillimLetterSpacingCustom: number;
  tehillimWordSpacing: number;

  // Text filters
  showNikud: boolean;
  showTaamim: boolean;

  // Display Settings
  textAlignment: "right" | "center" | "left" | "justify";
  contentSpacing: "compact" | "normal" | "comfortable" | "spacious" | "custom";
  contentSpacingCustom: number;
  lineHeight: "tight" | "normal" | "relaxed" | "loose" | "custom";
  lineHeightCustom: number;
  contentWidth: "narrow" | "normal" | "wide" | "full";
  letterSpacing: "tight" | "normal" | "wide" | "wider" | "custom";
  letterSpacingCustom: number;
  wordSpacing: number;
  
  // Dynamic Zoom
  fontScale: number;
}

interface FontAndColorSettingsContextType {
  settings: FontAndColorSettings;
  updateSettings: (settings: Partial<FontAndColorSettings>) => void;
  setPreviewSettings: (settings: FontAndColorSettings | null) => void;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
}

const defaultSettings: FontAndColorSettings = {
  pasukFont: "David Libre",
  pasukSize: 18,
  pasukColor: "#1a1a1a",
  pasukBold: false,
  titleFont: "David Libre",
  titleSize: 16,
  titleColor: "#2563eb",
  titleBold: true,
  questionFont: "David Libre",
  questionSize: 16,
  questionColor: "#1a1a1a",
  questionBold: false,
  answerFont: "David Libre",
  answerSize: 14,
  answerColor: "#666666",
  answerBold: false,
  commentaryFont: "David Libre",
  commentarySize: 18,
  commentaryColor: "#2d2d2d",
  commentaryBold: false,
  commentaryLineHeight: "relaxed",
  commentaryLineHeightCustom: 1.9,
  commentaryMaxWidth: "medium",
  commentaryTextAlignment: "justify",
  commentaryContentWidth: "normal",
  commentaryContentSpacing: "normal",
  commentaryContentSpacingCustom: 1,
  commentaryLetterSpacing: "normal",
  commentaryLetterSpacingCustom: 0,
  commentaryWordSpacing: 0,
  // Per-tab pasuk layout
  pasukTextAlignment: "right",
  pasukLineHeight: "normal",
  pasukLineHeightCustom: 1.5,
  pasukContentWidth: "normal",
  pasukContentSpacing: "normal",
  pasukContentSpacingCustom: 1,
  pasukLetterSpacing: "normal",
  pasukLetterSpacingCustom: 0,
  pasukWordSpacing: 0,
  // Per-tab title layout
  titleTextAlignment: "right",
  titleLineHeight: "normal",
  titleLineHeightCustom: 1.5,
  titleContentWidth: "normal",
  titleContentSpacing: "normal",
  titleContentSpacingCustom: 1,
  titleLetterSpacing: "normal",
  titleLetterSpacingCustom: 0,
  titleWordSpacing: 0,
  // Per-tab question layout
  questionTextAlignment: "right",
  questionLineHeight: "normal",
  questionLineHeightCustom: 1.5,
  questionContentWidth: "normal",
  questionContentSpacing: "normal",
  questionContentSpacingCustom: 1,
  questionLetterSpacing: "normal",
  questionLetterSpacingCustom: 0,
  questionWordSpacing: 0,
  siddurFont: "David Libre",
  siddurSize: 18,
  siddurBold: false,
  siddurHeadingBold: true,
  siddurOpeningBold: true,
  siddurOpeningWordCount: 1,
  siddurTextAlignment: "right",
  siddurLineHeight: "normal",
  siddurLineHeightCustom: 1.5,
  siddurContentWidth: "narrow",
  siddurContentSpacing: "normal",
  siddurContentSpacingCustom: 1,
  siddurLetterSpacing: "normal",
  siddurLetterSpacingCustom: 0,
  siddurWordSpacing: 0,
  tehillimFont: "Noto Serif Hebrew",
  tehillimSize: 18,
  tehillimBold: false,
  tehillimTextAlignment: "right",
  tehillimLineHeight: "normal",
  tehillimLineHeightCustom: 1.5,
  tehillimContentWidth: "normal",
  tehillimContentSpacing: "normal",
  tehillimContentSpacingCustom: 1,
  tehillimLetterSpacing: "normal",
  tehillimLetterSpacingCustom: 0,
  tehillimWordSpacing: 0,
  showNikud: true,
  showTaamim: false,
  textAlignment: "right",
  contentSpacing: "normal",
  contentSpacingCustom: 1,
  lineHeight: "normal",
  lineHeightCustom: 1.5,
  contentWidth: "normal",
  letterSpacing: "normal",
  letterSpacingCustom: 0,
  wordSpacing: 0,
  fontScale: 1,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeSettings = (settings: FontAndColorSettings): FontAndColorSettings => ({
  ...settings,
  pasukSize: clamp(Number(settings.pasukSize || defaultSettings.pasukSize), 8, 32),
  titleSize: clamp(Number(settings.titleSize || defaultSettings.titleSize), 8, 28),
  questionSize: clamp(Number(settings.questionSize || defaultSettings.questionSize), 8, 28),
  answerSize: clamp(Number(settings.answerSize || defaultSettings.answerSize), 8, 24),
  commentarySize: clamp(Number(settings.commentarySize || defaultSettings.commentarySize), 8, 24),
  siddurSize: clamp(Number(settings.siddurSize || defaultSettings.siddurSize), 8, 36),
  siddurHeadingBold: Boolean(settings.siddurHeadingBold),
  siddurOpeningBold: Boolean(settings.siddurOpeningBold),
  siddurOpeningWordCount: clamp(Number(settings.siddurOpeningWordCount || 1), 1, 3) as 1 | 2 | 3,
  tehillimSize: clamp(Number(settings.tehillimSize || defaultSettings.tehillimSize), 8, 36),
  siddurLineHeightCustom: clamp(Number(settings.siddurLineHeightCustom || defaultSettings.siddurLineHeightCustom), 1, 3),
  tehillimLineHeightCustom: clamp(Number(settings.tehillimLineHeightCustom || defaultSettings.tehillimLineHeightCustom), 1, 3),
  pasukLineHeightCustom: clamp(Number(settings.pasukLineHeightCustom ?? 1.5), 1, 3),
  titleLineHeightCustom: clamp(Number(settings.titleLineHeightCustom ?? 1.5), 1, 3),
  questionLineHeightCustom: clamp(Number(settings.questionLineHeightCustom ?? 1.5), 1, 3),
  commentaryLineHeightCustom: clamp(Number(settings.commentaryLineHeightCustom ?? 1.9), 1, 3),
  pasukWordSpacing: clamp(Number(settings.pasukWordSpacing ?? 0), 0, 0.5),
  titleWordSpacing: clamp(Number(settings.titleWordSpacing ?? 0), 0, 0.5),
  questionWordSpacing: clamp(Number(settings.questionWordSpacing ?? 0), 0, 0.5),
  commentaryWordSpacing: clamp(Number(settings.commentaryWordSpacing ?? 0), 0, 0.5),
  siddurWordSpacing: clamp(Number(settings.siddurWordSpacing ?? 0), 0, 0.5),
  tehillimWordSpacing: clamp(Number(settings.tehillimWordSpacing ?? 0), 0, 0.5),
  fontScale: clamp(Number(settings.fontScale || defaultSettings.fontScale), 0.6, 1.8),
  wordSpacing: clamp(Number(settings.wordSpacing ?? 0), 0, 0.5),
});

const FontAndColorSettingsContext = createContext<FontAndColorSettingsContextType | undefined>(undefined);

export const FontAndColorSettingsProvider = ({ children, scopeKey }: { children: ReactNode; scopeKey?: string }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isMobile } = useDevice();

  // Use device-specific column and localStorage key
  const baseColumn = isMobile ? "font_settings_mobile" : "font_settings";
  const baseKey = isMobile ? "torah-font-color-settings-mobile" : "torah-font-color-settings";
  // Scoped instance (e.g. side panel) uses its own localStorage key and skips cloud sync
  const column = scopeKey ? `${baseColumn}_${scopeKey}` : baseColumn;
  const localStorageKey = scopeKey ? `${baseKey}-${scopeKey}` : baseKey;

  const { data: settings, setData: setSettingsData, status } = useSyncedState<FontAndColorSettings>({
    localStorageKey,
    tableName: "user_settings",
    column,
    userId,
    syncToCloud: !scopeKey && !!userId,
    defaultValue: defaultSettings,
  });
  const [previewSettings, setPreviewSettingsState] = useState<FontAndColorSettings | null>(null);

  const normalizedSettings = useMemo(() => normalizeSettings(settings), [settings]);
  const effectiveSettings = useMemo(
    () => previewSettings ? normalizeSettings(previewSettings) : normalizedSettings,
    [previewSettings, normalizedSettings],
  );

  const updateSettings = useCallback((newSettings: Partial<FontAndColorSettings>) => {
    setSettingsData((prev) => normalizeSettings({ ...prev, ...newSettings }));
  }, [setSettingsData]);

  const setPreviewSettings = useCallback((nextSettings: FontAndColorSettings | null) => {
    setPreviewSettingsState(nextSettings ? normalizeSettings(nextSettings) : null);
  }, []);

  const value = useMemo(
    () => ({ settings: effectiveSettings, updateSettings, setPreviewSettings, syncStatus: status }),
    [effectiveSettings, updateSettings, setPreviewSettings, status],
  );

  return (
    <FontAndColorSettingsContext.Provider value={value}>
      {children}
    </FontAndColorSettingsContext.Provider>
  );
};

export const useFontAndColorSettings = () => {
  const context = useContext(FontAndColorSettingsContext);
  if (!context) {
    throw new Error("useFontAndColorSettings must be used within FontAndColorSettingsProvider");
  }
  return context;
};
