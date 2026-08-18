import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}>({ theme: "navy", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("navy");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (stored && THEMES.some((t) => t.id === stored)) setThemeState(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    THEMES.forEach((t) => root.classList.remove(`theme-${t.id}`));
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  const setTheme = (t: ThemeId) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
