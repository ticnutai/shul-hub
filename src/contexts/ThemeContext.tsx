import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSyncedState } from "@/hooks/useSyncedState";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_THEME_APPEARANCE, THEME_SHADOWS, type ThemeAppearanceSettings } from "@/components/ThemeAppearanceControls";

export type Theme = "classic" | "royal-gold" | "elegant-night" | "ancient-scroll" | "light" | "gold-silver" | "custom";

export interface CustomAppTheme extends ThemeAppearanceSettings {
  name: string;
  background: string;
  foreground: string;
  card: string;
  primary: string;
  accent: string;
  sidebar: string;
  sidebarForeground: string;
}

export interface SavedAppTheme extends CustomAppTheme {
  id: string;
  updatedAt: string;
}

const CUSTOM_THEME_KEY = "torah-custom-theme";
const CUSTOM_THEMES_KEY = "torah-custom-themes-v1";
const defaultCustomTheme: CustomAppTheme = {
  name: "הערכה שלי", background: "#f8f6f1", foreground: "#17233d", card: "#ffffff",
  primary: "#173665", accent: "#e9b51f", sidebar: "#142c55", sidebarForeground: "#fff8e6",
  ...DEFAULT_THEME_APPEARANCE,
};

const normalizeAppTheme = (theme?: Partial<CustomAppTheme> | null): CustomAppTheme => ({
  ...defaultCustomTheme,
  ...(theme ?? {}),
});

const normalizeSavedAppTheme = (theme: SavedAppTheme): SavedAppTheme => ({
  ...normalizeAppTheme(theme),
  id: theme.id,
  updatedAt: theme.updatedAt,
});

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  customTheme: CustomAppTheme;
  customThemes: SavedAppTheme[];
  publicThemes: SavedAppTheme[];
  saveCustomTheme: (theme: CustomAppTheme, options?: { id?: string; duplicate?: boolean }) => Promise<SavedAppTheme>;
  selectCustomTheme: (id: string) => Promise<void>;
  publishCustomTheme: (theme: CustomAppTheme) => Promise<SavedAppTheme>;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [customTheme, setCustomTheme] = useState<CustomAppTheme>(() => {
    try { return normalizeAppTheme(JSON.parse(localStorage.getItem(CUSTOM_THEME_KEY) || "{}")); }
    catch { return defaultCustomTheme; }
  });
  const [customThemes, setCustomThemes] = useState<SavedAppTheme[]>(() => {
    try { return (JSON.parse(localStorage.getItem(CUSTOM_THEMES_KEY) || "[]") as SavedAppTheme[]).map(normalizeSavedAppTheme); }
    catch { return []; }
  });
  const [publicThemes, setPublicThemes] = useState<SavedAppTheme[]>([]);

  const { data: theme, setData: setThemeData, status } = useSyncedState<Theme>({
    localStorageKey: "torah-theme",
    tableName: "user_settings",
    column: "theme",
    userId,
    syncToCloud: !!userId,
    defaultValue: "classic",
  });

  useEffect(() => {
    document.documentElement.classList.remove("classic", "royal-gold", "elegant-night", "ancient-scroll", "light", "gold-silver", "custom");
    document.documentElement.classList.add(theme);
    if (theme !== "custom") return;
    const root = document.documentElement;
    const hexToHsl = (hex: string) => {
      const raw = hex.replace("#", "");
      const r = parseInt(raw.slice(0, 2), 16) / 255, g = parseInt(raw.slice(2, 4), 16) / 255, b = parseInt(raw.slice(4, 6), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      let h = 0; const l = (max + min) / 2; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      if (d) { if (max === r) h = 60 * (((g - b) / d) % 6); else if (max === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); }
      if (h < 0) h += 360;
      return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };
    const vars: Record<string, string> = {
      "--background": customTheme.background, "--foreground": customTheme.foreground,
      "--card": customTheme.card, "--card-foreground": customTheme.foreground,
      "--popover": customTheme.card, "--popover-foreground": customTheme.foreground,
      "--primary": customTheme.primary, "--primary-foreground": customTheme.sidebarForeground,
      "--accent": customTheme.accent, "--accent-foreground": customTheme.foreground,
      "--secondary": customTheme.card, "--secondary-foreground": customTheme.foreground,
      "--muted": customTheme.card, "--muted-foreground": customTheme.foreground,
      "--border": customTheme.accent, "--input": customTheme.accent, "--ring": customTheme.accent,
      "--sidebar-background": customTheme.sidebar, "--sidebar-foreground": customTheme.sidebarForeground,
      "--sidebar-primary": customTheme.accent, "--sidebar-primary-foreground": customTheme.foreground,
      "--sidebar-accent": customTheme.primary, "--sidebar-accent-foreground": customTheme.sidebarForeground,
      "--sidebar-border": customTheme.primary, "--sidebar-ring": customTheme.accent,
    };
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, hexToHsl(value)));
    const appearanceVars: Record<string, string> = {
      "--radius": `${customTheme.cornerRadius}px`,
      "--theme-card-radius": `${customTheme.cornerRadius}px`,
      "--theme-button-radius": `${customTheme.buttonRadius}px`,
      "--theme-border-width": `${customTheme.borderWidth}px`,
      "--theme-card-shadow": THEME_SHADOWS[customTheme.shadow],
      "--theme-header-shadow": customTheme.headerShadow ? THEME_SHADOWS[customTheme.shadow] : "none",
    };
    Object.entries(appearanceVars).forEach(([key, value]) => root.style.setProperty(key, value));
    return () => [...Object.keys(vars), ...Object.keys(appearanceVars)].forEach(key => root.style.removeProperty(key));
  }, [theme, customTheme]);

  useEffect(() => {
    if (!user) return;
    const cloud = user.user_metadata?.custom_app_theme;
    const cloudThemes = user.user_metadata?.custom_app_themes;
    if (Array.isArray(cloudThemes)) {
      const normalizedThemes = (cloudThemes as SavedAppTheme[]).map(normalizeSavedAppTheme);
      setCustomThemes(normalizedThemes);
      localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(normalizedThemes));
    }
    if (cloud && typeof cloud === "object") {
      const next = normalizeAppTheme(cloud as Partial<CustomAppTheme>);
      setCustomTheme(next);
      localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(next));
    }
  }, [user?.id]);

  const loadPublicThemes = useCallback(async () => {
    const { data, error } = await supabase
      .from("app_themes")
      .select("id,name,theme,updated_at")
      .order("created_at", { ascending: true });
    if (error) {
      // The migration may not have been applied yet; keep the local theme system usable.
      console.error("Failed to load public app themes:", error);
      return;
    }
    setPublicThemes((data ?? []).map(row => ({
      ...defaultCustomTheme,
      ...(row.theme as unknown as CustomAppTheme),
      id: `public:${row.id}`,
      name: row.name,
      updatedAt: row.updated_at,
    })));
  }, []);

  useEffect(() => { void loadPublicThemes(); }, [loadPublicThemes]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeData(newTheme);
  }, [setThemeData]);

  const persistCustomThemes = useCallback(async (items: SavedAppTheme[], active: CustomAppTheme) => {
    setCustomThemes(items);
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(items));
    if (user) {
      const { error } = await supabase.auth.updateUser({ data: { ...user.user_metadata, custom_app_theme: active, custom_app_themes: items } });
      if (error) throw error;
    }
  }, [user]);

  const saveCustomTheme = useCallback(async (next: CustomAppTheme, options?: { id?: string; duplicate?: boolean }) => {
    const now = new Date().toISOString();
    const existingId = !options?.duplicate ? options?.id : undefined;
    const normalized = normalizeAppTheme(next);
    const saved: SavedAppTheme = { ...normalized, id: existingId || crypto.randomUUID(), updatedAt: now };
    const items = existingId && customThemes.some(item => item.id === existingId)
      ? customThemes.map(item => item.id === existingId ? saved : item)
      : [...customThemes, saved];
    setCustomTheme(normalized);
    localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(normalized));
    await persistCustomThemes(items, normalized);
    return saved;
  }, [customThemes, persistCustomThemes]);

  const selectCustomTheme = useCallback(async (id: string) => {
    const selected = [...customThemes, ...publicThemes].find(item => item.id === id);
    if (!selected) return;
    const { id: _id, updatedAt: _updatedAt, ...rawActive } = selected;
    const active = normalizeAppTheme(rawActive);
    setCustomTheme(active);
    localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(active));
    setThemeData("custom");
    await persistCustomThemes(customThemes, active);
  }, [customThemes, publicThemes, persistCustomThemes, setThemeData]);

  const publishCustomTheme = useCallback(async (next: CustomAppTheme): Promise<SavedAppTheme> => {
    if (!user) throw new Error("יש להתחבר כמנהל כדי לפרסם ערכת נושא");
    const payload = { ...defaultCustomTheme, ...next, name: next.name.trim() };
    const { data, error } = await supabase
      .from("app_themes")
      .insert({ name: payload.name, theme: payload, created_by: user.id })
      .select("id,name,theme,updated_at")
      .single();
    if (error) throw error;
    const published: SavedAppTheme = {
      ...defaultCustomTheme,
      ...(data.theme as unknown as CustomAppTheme),
      id: `public:${data.id}`,
      name: data.name,
      updatedAt: data.updated_at,
    };
    await loadPublicThemes();
    const { id: _id, updatedAt: _updatedAt, ...active } = published;
    setCustomTheme(active);
    localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(active));
    setThemeData("custom");
    await persistCustomThemes(customThemes, active);
    return published;
  }, [customThemes, loadPublicThemes, persistCustomThemes, setThemeData, user]);

  const value = useMemo(() => ({ theme, setTheme, customTheme, customThemes, publicThemes, saveCustomTheme, selectCustomTheme, publishCustomTheme, syncStatus: status }), [theme, setTheme, customTheme, customThemes, publicThemes, saveCustomTheme, selectCustomTheme, publishCustomTheme, status]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
