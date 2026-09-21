import { normalizeGradients, normalizeTvConfig, type TvConfig } from "./config";
import { THEME_VARS, TV_GRADIENTS, TV_THEMES, type ThemeVar, type TvGradient, type TvTheme } from "./themes";

/**
 * Carrying themes and gradients between systems.
 *
 * The file is deliberately NOT written in this project's own language. A
 * theme is stored as ten named *roles* ("background", "text", "accent"...),
 * not as this board's CSS variables, so the same file can be imported by any
 * other app that knows what its own background and text are. Each app keeps
 * one small table mapping its variables to those roles, and nothing else has
 * to agree.
 *
 * The full specification, for implementing this in another project, is in
 * docs/DESIGN_TOKENS_SPEC.md.
 *
 * An imported file is untrusted input: every value is validated by the same
 * normalisers the saved config uses, ids are minted locally, and anything
 * that does not survive validation is dropped and counted.
 */

export const TRANSFER_FORMAT = "design-tokens";
export const TRANSFER_VERSION = 1;
/** What older files (exported before the portable format) carry. */
const LEGACY_KIND = "shul-hub-tv-design";

/** The ten roles a theme is described by. Order matters only for readability. */
export const THEME_ROLES = [
  "background",
  "backgroundGlowTop",
  "backgroundGlowBottom",
  "surface",
  "text",
  "textMuted",
  "accent",
  "accentAlt",
  "onAccent",
  "highlight",
] as const;
export type ThemeRole = (typeof THEME_ROLES)[number];

/** This board's variables, in the same order as THEME_ROLES. */
const VAR_BY_ROLE: Record<ThemeRole, ThemeVar> = {
  background: "--tv-bg-a",
  backgroundGlowTop: "--tv-bg-b",
  backgroundGlowBottom: "--tv-bg-c",
  surface: "--tv-panel",
  text: "--tv-text",
  textMuted: "--tv-text-dim",
  accent: "--tv-accent",
  accentAlt: "--tv-accent-2",
  onAccent: "--tv-on-accent",
  highlight: "--tv-pinned",
};

export interface PortableTheme {
  name: string;
  description?: string;
  /** Whether the background is light or dark - so an importer can file it correctly. */
  mode: "light" | "dark";
  roles: Partial<Record<ThemeRole, string>>;
}

export interface PortableGradient {
  name: string;
  /** Plain CSS: linear-gradient(...) / radial-gradient(...) / conic-gradient(...). */
  value: string;
}

export interface TransferFile {
  format: typeof TRANSFER_FORMAT;
  version: number;
  /** Informational: which app wrote the file. Importers must not depend on it. */
  app?: string;
  exportedAt: string;
  themes: PortableTheme[];
  gradients: PortableGradient[];
}

export interface ImportResult {
  themes: TvTheme[];
  gradients: TvGradient[];
  /** How many entries were dropped as invalid, so the admin is told. */
  skipped: number;
}

/* ------------------------------------------------------------ export -- */

export function toPortableTheme(theme: TvTheme): PortableTheme {
  const roles: Partial<Record<ThemeRole, string>> = {};
  for (const role of THEME_ROLES) roles[role] = theme.vars[VAR_BY_ROLE[role]];
  return { name: theme.name, description: theme.description || undefined, mode: theme.light ? "light" : "dark", roles };
}

export function buildExport(config: TvConfig, pick: { themes?: boolean; gradients?: boolean } = {}): TransferFile {
  return {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    app: "shul-hub-tv",
    exportedAt: new Date().toISOString(),
    themes: (pick.themes ?? true) ? config.customThemes.map(toPortableTheme) : [],
    gradients: (pick.gradients ?? true) ? config.gradients.map((g) => ({ name: g.name, value: g.value })) : [],
  };
}

export function exportFileName(what: "themes" | "gradients" | "all"): string {
  const day = new Date().toISOString().slice(0, 10);
  const label = what === "themes" ? "ערכות-נושא" : what === "gradients" ? "גרדיאנטים" : "עיצוב";
  return `לוח-${label}-${day}.json`;
}

/* ------------------------------------------------------------ import -- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A role map becomes this board's variables. Missing roles fall back to the
 * default theme, so a file from an app with a smaller palette still imports
 * into a complete, usable theme instead of being rejected.
 */
export function fromRoles(roles: Record<string, unknown>): Record<ThemeVar, string> {
  const base = TV_THEMES[0].vars;
  const vars = {} as Record<ThemeVar, string>;
  for (const v of THEME_VARS) vars[v] = base[v];
  for (const role of THEME_ROLES) {
    const value = roles[role];
    if (typeof value === "string") vars[VAR_BY_ROLE[role]] = value;
  }
  return vars;
}

/**
 * Reads a pasted or uploaded file, in the portable format or in this
 * project's older one. Throws with a Hebrew reason the admin can act on.
 */
export function parseImport(text: string, newThemeId: () => string, newGradientId: () => string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("הקובץ אינו בפורמט הנכון (JSON לא תקין)");
  }
  if (!isObj(raw)) throw new Error("הקובץ אינו בפורמט הנכון");
  const portable = raw.format === TRANSFER_FORMAT;
  if (!portable && raw.kind !== LEGACY_KIND) throw new Error("זה לא קובץ עיצוב: חסר שדה format עם הערך design-tokens");
  if (portable && typeof raw.version === "number" && raw.version > TRANSFER_VERSION) {
    throw new Error("הקובץ נוצר בגרסה חדשה יותר של הפורמט. עדכנו את המערכת ונסו שוב");
  }

  const rawThemes = Array.isArray(raw.themes) ? raw.themes : [];
  const rawGradients = Array.isArray(raw.gradients) ? raw.gradients : [];

  // Everything rides through the config normaliser, which is the single place
  // that decides what a valid colour, gradient or name is.
  const staged = rawThemes.map((t) => {
    if (!isObj(t)) return t;
    const vars = isObj(t.roles) ? fromRoles(t.roles) : t.vars;
    return { ...t, id: newThemeId(), vars, light: t.mode === "light" || t.light === true };
  });
  const themes = normalizeTvConfig({ customThemes: staged }).customThemes;
  const gradients = normalizeGradients(rawGradients.map((g) => (isObj(g) ? { ...g, id: newGradientId() } : g)));

  if (!themes.length && !gradients.length) throw new Error("לא נמצאו ערכות נושא או גרדיאנטים תקינים בקובץ");
  return { themes, gradients, skipped: rawThemes.length - themes.length + (rawGradients.length - gradients.length) };
}

/** Adds imported items to a config, renaming anything whose name is taken. */
export function mergeImport(config: TvConfig, incoming: ImportResult): TvConfig {
  const themeNames = new Set([...TV_THEMES, ...config.customThemes].map((t) => t.name));
  const gradientNames = new Set([...TV_GRADIENTS, ...config.gradients].map((g) => g.name));
  const unique = (name: string, taken: Set<string>) => {
    let candidate = name;
    for (let i = 2; taken.has(candidate); i++) candidate = `${name} (${i})`;
    taken.add(candidate);
    return candidate;
  };
  return {
    ...config,
    customThemes: [...config.customThemes, ...incoming.themes.map((t) => ({ ...t, name: unique(t.name, themeNames) }))].slice(0, 24),
    gradients: [...config.gradients, ...incoming.gradients.map((g) => ({ ...g, name: unique(g.name, gradientNames) }))].slice(0, 40),
  };
}
