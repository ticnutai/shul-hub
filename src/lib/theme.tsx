import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export const THEMES = [
  { id: "navy", name: "נייבי וזהב", swatch: ["#16253f", "#c9a227", "#f7f6f1"] },
  { id: "jerusalem", name: "אבן ירושלמית", swatch: ["#6b5230", "#c8a44a", "#f6efe0"] },
  { id: "bordeaux", name: "בורדו וזהב", swatch: ["#5b1a22", "#d4af63", "#fbf7ef"] },
  { id: "forest", name: "ירוק זית", swatch: ["#234b3c", "#cfa94d", "#f2f7f4"] },
  { id: "sand", name: "תכלת ולבן", swatch: ["#1b6ca8", "#4fa3d1", "#ffffff"] },
  { id: "night", name: "מצב לילה", swatch: ["#0e1626", "#e8c469", "#26314a"] },
] as const;

export type ThemeId = string;
export type ThemeColors = {
  primary: string;
  gold: string;
  background: string;
  foreground: string;
  card: string;
  sidebar: string;
};
export type ThemeOption = {
  id: ThemeId;
  name: string;
  swatch: readonly string[];
  baseId: (typeof THEMES)[number]["id"];
  colors?: ThemeColors;
  custom?: boolean;
};

const STORAGE_KEY = "beit-knesset-theme";
const SNAPSHOT_KEY = "beit-knesset-ui-preferences";
const CUSTOM_THEMES_KEY = "beit-knesset-custom-themes-v1";

type PreferenceSnapshot = {
  theme: ThemeId;
  updatedAt: string;
};

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value.length > 0;
}

function readCustomThemes(): ThemeOption[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(CUSTOM_THEMES_KEY) ?? "[]") as ThemeOption[];
    return Array.isArray(value) ? value.filter((item) => item?.custom && item.id && item.name) : [];
  } catch {
    return [];
  }
}

function writeCustomThemes(themes: ThemeOption[]) {
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
}

function readLocalSnapshot(): PreferenceSnapshot {
  const fallback: PreferenceSnapshot = { theme: "navy", updatedAt: "1970-01-01T00:00:00.000Z" };
  if (typeof window === "undefined") return fallback;

  try {
    const parsed = JSON.parse(
      localStorage.getItem(SNAPSHOT_KEY) ?? "null",
    ) as Partial<PreferenceSnapshot> | null;
    if (parsed && isThemeId(parsed.theme) && typeof parsed.updatedAt === "string") {
      return { theme: parsed.theme, updatedAt: parsed.updatedAt };
    }
  } catch {
    // Keep the complete local fallback when stored data is malformed.
  }

  const legacyTheme = localStorage.getItem(STORAGE_KEY);
  return isThemeId(legacyTheme) ? { ...fallback, theme: legacyTheme } : fallback;
}

function writeLocalSnapshot(snapshot: PreferenceSnapshot) {
  localStorage.setItem(STORAGE_KEY, snapshot.theme);
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

const ThemeContext = createContext<{
  theme: ThemeId;
  themes: ThemeOption[];
  setTheme: (t: ThemeId) => void;
  updateTheme: (id: ThemeId, name: string, colors: ThemeColors) => void;
  duplicateTheme: (id: ThemeId, name: string, colors: ThemeColors) => ThemeId;
}>({
  theme: "navy",
  themes: THEMES.map((item) => ({ ...item, baseId: item.id })),
  setTheme: () => {},
  updateTheme: () => {},
  duplicateTheme: () => "navy",
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("navy");
  const [customThemes, setCustomThemes] = useState<ThemeOption[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const uploadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCustomThemes(readCustomThemes());
    setThemeState(readLocalSnapshot().theme);
  }, []);

  const themes = useMemo<ThemeOption[]>(() => {
    const builtIns = THEMES.map(
      (item) =>
        customThemes.find((custom) => custom.id === item.id) ?? { ...item, baseId: item.id },
    );
    return [
      ...builtIns,
      ...customThemes.filter((custom) => !THEMES.some((item) => item.id === custom.id)),
    ];
  }, [customThemes]);

  useEffect(() => {
    let cancelled = false;

    const synchronize = async (nextUserId: string | null) => {
      if (cancelled) return;
      setUserId(nextUserId);
      if (!nextUserId) return;

      const local = readLocalSnapshot();
      const { data, error } = await supabase
        .from("user_ui_preferences")
        .select("preferences, preferences_updated_at")
        .eq("user_id", nextUserId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.warn("לא ניתן לסנכרן את העדפות הממשק; נעשה שימוש בהגדרות המקומיות.");
        return;
      }

      const cloudTheme =
        data?.preferences &&
        typeof data.preferences === "object" &&
        !Array.isArray(data.preferences) &&
        isThemeId(data.preferences["theme"])
          ? data.preferences["theme"]
          : null;

      if (cloudTheme && data && data.preferences_updated_at > local.updatedAt) {
        const snapshot = { theme: cloudTheme, updatedAt: data.preferences_updated_at };
        writeLocalSnapshot(snapshot);
        setThemeState(cloudTheme);
        return;
      }

      const updatedAt =
        local.updatedAt === "1970-01-01T00:00:00.000Z" ? new Date().toISOString() : local.updatedAt;
      await supabase.from("user_ui_preferences").upsert(
        {
          user_id: nextUserId,
          preferences: { theme: local.theme },
          preferences_updated_at: updatedAt,
        },
        { onConflict: "user_id" },
      );
    };

    supabase.auth.getSession().then(({ data }) => void synchronize(data.session?.user.id ?? null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void synchronize(session?.user.id ?? null), 0);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
      if (uploadTimer.current) clearTimeout(uploadTimer.current);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    THEMES.forEach((t) => root.classList.remove(`theme-${t.id}`));
    const selected = themes.find((item) => item.id === theme) ?? themes[0]!;
    root.classList.add(`theme-${selected.baseId}`);
    const variables: Array<keyof ThemeColors> = [
      "primary",
      "gold",
      "background",
      "foreground",
      "card",
      "sidebar",
    ];
    variables.forEach((name) => {
      if (selected.colors?.[name]) root.style.setProperty(`--${name}`, selected.colors[name]!);
      else root.style.removeProperty(`--${name}`);
    });
    if (selected.colors) {
      root.style.setProperty("--card-foreground", selected.colors.foreground);
      root.style.setProperty("--popover", selected.colors.card);
      root.style.setProperty("--popover-foreground", selected.colors.foreground);
      root.style.setProperty("--sidebar-foreground", selected.colors.background);
      root.style.setProperty("--sidebar-primary", selected.colors.gold);
      root.style.setProperty(
        "--sidebar-accent",
        `color-mix(in oklch, ${selected.colors.sidebar} 84%, ${selected.colors.gold})`,
      );
      root.style.setProperty(
        "--sidebar-border",
        `color-mix(in oklch, ${selected.colors.gold} 35%, transparent)`,
      );
      root.style.setProperty("--hero-from", selected.colors.sidebar);
      root.style.setProperty("--hero-to", selected.colors.primary);
    } else {
      [
        "--card-foreground",
        "--popover",
        "--popover-foreground",
        "--sidebar-foreground",
        "--sidebar-primary",
        "--sidebar-accent",
        "--sidebar-border",
        "--hero-from",
        "--hero-to",
      ].forEach((name) => root.style.removeProperty(name));
    }
  }, [theme, themes]);

  const setTheme = (t: ThemeId) => {
    const updatedAt = new Date().toISOString();
    setThemeState(t);
    writeLocalSnapshot({ theme: t, updatedAt });

    if (userId) {
      if (uploadTimer.current) clearTimeout(uploadTimer.current);
      uploadTimer.current = setTimeout(() => {
        void supabase
          .from("user_ui_preferences")
          .upsert(
            { user_id: userId, preferences: { theme: t }, preferences_updated_at: updatedAt },
            { onConflict: "user_id" },
          )
          .then(({ error }) => {
            if (error) console.warn("ערכת הנושא נשמרה מקומית אך הסנכרון לענן נכשל.");
          });
      }, 350);
    }
  };

  const updateTheme = (id: ThemeId, name: string, colors: ThemeColors) => {
    const existing = themes.find((item) => item.id === id);
    if (!existing) return;
    const replacement: ThemeOption = {
      ...existing,
      name: name.trim() || existing.name,
      swatch: [colors.primary, colors.gold, colors.background],
      colors,
      custom: true,
    };
    const next = [...customThemes.filter((item) => item.id !== id), replacement];
    setCustomThemes(next);
    writeCustomThemes(next);
    setTheme(id);
  };

  const duplicateTheme = (id: ThemeId, name: string, colors: ThemeColors) => {
    const source = themes.find((item) => item.id === id) ?? themes[0]!;
    const nextId = `custom-${Date.now().toString(36)}`;
    const copy: ThemeOption = {
      id: nextId,
      name: name.trim() || `${source.name} — עותק`,
      swatch: [colors.primary, colors.gold, colors.background],
      baseId: source.baseId,
      colors,
      custom: true,
    };
    const next = [...customThemes, copy];
    setCustomThemes(next);
    writeCustomThemes(next);
    setTheme(nextId);
    return nextId;
  };

  return (
    <ThemeContext.Provider value={{ theme, themes, setTheme, updateTheme, duplicateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
