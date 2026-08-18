import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const TEXT_FONTS = [
  { id: "heebo", label: "Heebo", value: '"Heebo", "Assistant", sans-serif' },
  {
    id: "noto-serif",
    label: "Noto Serif Hebrew",
    value: '"Noto Serif Hebrew", "Frank Ruhl Libre", serif',
  },
  {
    id: "frank",
    label: "Frank Ruhl Libre",
    value: '"Frank Ruhl Libre", "Noto Serif Hebrew", serif',
  },
  { id: "assistant", label: "Assistant", value: '"Assistant", "Heebo", sans-serif' },
] as const;

export type TextFontId = (typeof TEXT_FONTS)[number]["id"];
export type TextAlign = "right" | "justify" | "center";

export type TextSettings = {
  bodyFont: TextFontId;
  headingFont: TextFontId;
  bodySize: number;
  headingScale: number;
  lineHeight: number;
  letterSpacing: number;
  bold: boolean;
  align: TextAlign;
};

export const DEFAULT_TEXT_SETTINGS: TextSettings = {
  bodyFont: "heebo",
  headingFont: "noto-serif",
  bodySize: 16,
  headingScale: 1,
  lineHeight: 1.65,
  letterSpacing: 0,
  bold: false,
  align: "right",
};

const STORAGE_KEY = "shul-text-settings-v1";

const TextSettingsContext = createContext<{
  settings: TextSettings;
  preview: (draft: TextSettings) => void;
  save: (draft: TextSettings) => void;
  cancelPreview: () => void;
}>({
  settings: DEFAULT_TEXT_SETTINGS,
  preview: () => {},
  save: () => {},
  cancelPreview: () => {},
});

function isFont(value: unknown): value is TextFontId {
  return TEXT_FONTS.some((font) => font.id === value);
}

function normalize(value: Partial<TextSettings> | null): TextSettings {
  const next = { ...DEFAULT_TEXT_SETTINGS, ...(value ?? {}) };
  return {
    bodyFont: isFont(next.bodyFont) ? next.bodyFont : DEFAULT_TEXT_SETTINGS.bodyFont,
    headingFont: isFont(next.headingFont) ? next.headingFont : DEFAULT_TEXT_SETTINGS.headingFont,
    bodySize: Math.min(24, Math.max(14, Number(next.bodySize) || 16)),
    headingScale: Math.min(1.4, Math.max(0.85, Number(next.headingScale) || 1)),
    lineHeight: Math.min(2.2, Math.max(1.25, Number(next.lineHeight) || 1.65)),
    letterSpacing: Math.min(0.08, Math.max(-0.03, Number(next.letterSpacing) || 0)),
    bold: Boolean(next.bold),
    align: ["right", "justify", "center"].includes(next.align) ? next.align : "right",
  };
}

function fontValue(id: TextFontId) {
  return TEXT_FONTS.find((font) => font.id === id)?.value ?? TEXT_FONTS[0].value;
}

function applySettings(settings: TextSettings) {
  const root = document.documentElement;
  root.style.setProperty("--app-font-family", fontValue(settings.bodyFont));
  root.style.setProperty("--app-heading-font-family", fontValue(settings.headingFont));
  root.style.setProperty("--app-font-size", `${settings.bodySize}px`);
  root.style.setProperty("--app-heading-scale", String(settings.headingScale));
  root.style.setProperty("--app-line-height", String(settings.lineHeight));
  root.style.setProperty("--app-letter-spacing", `${settings.letterSpacing}em`);
  root.style.setProperty("--app-font-weight", settings.bold ? "600" : "400");
  root.style.setProperty("--app-text-align", settings.align);
}

export function TextSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_TEXT_SETTINGS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const restored = normalize(stored ? (JSON.parse(stored) as Partial<TextSettings>) : null);
      setSettings(restored);
      applySettings(restored);
    } catch {
      applySettings(DEFAULT_TEXT_SETTINGS);
    }
  }, []);

  useEffect(() => applySettings(settings), [settings]);

  const value = useMemo(
    () => ({
      settings,
      preview: (draft: TextSettings) => applySettings(normalize(draft)),
      save: (draft: TextSettings) => {
        const normalized = normalize(draft);
        setSettings(normalized);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      },
      cancelPreview: () => applySettings(settings),
    }),
    [settings],
  );

  return <TextSettingsContext.Provider value={value}>{children}</TextSettingsContext.Provider>;
}

export const useTextSettings = () => useContext(TextSettingsContext);
