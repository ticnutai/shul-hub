import type { CSSProperties } from "react";

export type AnnouncementPreset = "classic" | "gold" | "celebration" | "memorial" | "minimal";

export type AnnouncementStyle = {
  preset: AnnouncementPreset;
  background?: string;
  foreground?: string;
  accent?: string;
  titleSize?: number;
  bodySize?: number;
  align?: "right" | "center";
  radius?: number;
  shadow?: boolean;
};

export const ANNOUNCEMENT_STYLE_PRESETS: Array<{
  id: AnnouncementPreset;
  label: string;
  description: string;
  style: Required<Pick<AnnouncementStyle, "background" | "foreground" | "accent" | "align" | "radius" | "shadow">>;
}> = [
  { id: "classic", label: "כחול וזהב", description: "העיצוב הקלאסי של בית הכנסת", style: { background: "#ffffff", foreground: "#172c57", accent: "#d6a619", align: "right", radius: 16, shadow: true } },
  { id: "gold", label: "קלף וזהב", description: "רקע שמנת ומסגרת זהב", style: { background: "#fffaf0", foreground: "#172c57", accent: "#c89416", align: "center", radius: 20, shadow: true } },
  { id: "celebration", label: "שמחה", description: "עיצוב חגיגי למזל טוב", style: { background: "#fff7df", foreground: "#6d3b00", accent: "#e1a900", align: "center", radius: 24, shadow: true } },
  { id: "memorial", label: "אזכרה", description: "עיצוב מכובד ושקט", style: { background: "#f5f5f4", foreground: "#292524", accent: "#78716c", align: "right", radius: 12, shadow: false } },
  { id: "minimal", label: "נקי", description: "לבן, עדין וללא צל", style: { background: "#ffffff", foreground: "#172c57", accent: "#d6a619", align: "right", radius: 8, shadow: false } },
];

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

const clamp = (value: unknown, minimum: number, maximum: number, fallback: number) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
};

export function normalizeAnnouncementStyle(value: unknown): AnnouncementStyle {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<AnnouncementStyle>
    : {};
  const preset = ANNOUNCEMENT_STYLE_PRESETS.some((item) => item.id === candidate.preset)
    ? candidate.preset as AnnouncementPreset
    : "classic";
  const base = ANNOUNCEMENT_STYLE_PRESETS.find((item) => item.id === preset)!.style;
  return {
    preset,
    background: isHexColor(candidate.background) ? candidate.background : base.background,
    foreground: isHexColor(candidate.foreground) ? candidate.foreground : base.foreground,
    accent: isHexColor(candidate.accent) ? candidate.accent : base.accent,
    titleSize: clamp(candidate.titleSize, 16, 34, 20),
    bodySize: clamp(candidate.bodySize, 12, 24, 14),
    align: candidate.align === "center" || candidate.align === "right" ? candidate.align : base.align,
    radius: clamp(candidate.radius, 0, 32, base.radius),
    shadow: typeof candidate.shadow === "boolean" ? candidate.shadow : base.shadow,
  };
}

export function presetAnnouncementStyle(preset: AnnouncementPreset): AnnouncementStyle {
  return normalizeAnnouncementStyle({ preset });
}

export function announcementCardStyle(value: unknown): CSSProperties {
  const style = normalizeAnnouncementStyle(value);
  return {
    backgroundColor: style.background,
    color: style.foreground,
    borderColor: style.accent,
    borderRadius: style.radius,
    boxShadow: style.shadow ? "0 10px 28px rgba(23, 44, 87, 0.12)" : "none",
    textAlign: style.align,
  };
}
