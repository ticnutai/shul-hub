import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export const THEMES = [
  { id: "navy", name: "נייבי וזהב", swatch: ["#16253f", "#c9a227", "#f7f6f1"] },
  { id: "jerusalem", name: "אבן ירושלמית", swatch: ["#6b5230", "#c8a44a", "#f6efe0"] },
  { id: "bordeaux", name: "בורדו וזהב", swatch: ["#5b1a22", "#d4af63", "#fbf7ef"] },
  { id: "forest", name: "ירוק זית", swatch: ["#234b3c", "#cfa94d", "#f2f7f4"] },
  { id: "sand", name: "תכלת ולבן", swatch: ["#1b6ca8", "#4fa3d1", "#ffffff"] },
  { id: "night", name: "מצב לילה", swatch: ["#0e1626", "#e8c469", "#26314a"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "beit-knesset-theme";
const SNAPSHOT_KEY = "beit-knesset-ui-preferences";

type PreferenceSnapshot = {
  theme: ThemeId;
  updatedAt: string;
};

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((theme) => theme.id === value);
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
  setTheme: (t: ThemeId) => void;
}>({ theme: "navy", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("navy");
  const [userId, setUserId] = useState<string | null>(null);
  const uploadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setThemeState(readLocalSnapshot().theme);
  }, []);

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

      if (cloudTheme && data.preferences_updated_at > local.updatedAt) {
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
    root.classList.add(`theme-${theme}`);
  }, [theme]);

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

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
