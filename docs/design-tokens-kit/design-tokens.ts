/**
 * design-tokens.ts — a portable themes-and-gradients kit.
 *
 * Copy this one file into any TypeScript project. It has no dependencies and
 * no framework: just types, validation, export and import for the
 * "design-tokens" format (see README.md next to this file).
 *
 * What you must provide in your own project:
 *   1. VAR_BY_ROLE  — which of your CSS variables plays each role.
 *   2. DEFAULT_VARS — a complete set of your variables, used to fill in
 *                     roles a foreign file does not define.
 *
 * Everything else works as-is.
 */

/* ------------------------------------------------------------- roles -- */

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

/** EDIT ME: your CSS variable for each role. Leave a role out if you have no equivalent. */
export const VAR_BY_ROLE: Partial<Record<ThemeRole, string>> = {
  background: "--bg",
  backgroundGlowTop: "--bg-alt",
  backgroundGlowBottom: "--bg-alt-2",
  surface: "--surface",
  text: "--text",
  textMuted: "--text-muted",
  accent: "--accent",
  accentAlt: "--accent-alt",
  onAccent: "--on-accent",
  highlight: "--highlight",
};

/** EDIT ME: a complete, valid set of your variables (your default theme). */
export const DEFAULT_VARS: Record<string, string> = {
  "--bg": "#0b1628",
  "--bg-alt": "#1b3054",
  "--bg-alt-2": "#16304f",
  "--surface": "rgba(255, 255, 255, 0.05)",
  "--text": "#f4f7fb",
  "--text-muted": "#9fb2cc",
  "--accent": "#f0c35c",
  "--accent-alt": "#b99236",
  "--on-accent": "#0b1628",
  "--highlight": "#ef8f4c",
};

/* ------------------------------------------------------------- types -- */

export interface Theme {
  id: string;
  name: string;
  description?: string;
  light: boolean;
  /** Your own CSS variables: { "--accent": "#f0c35c", ... } */
  vars: Record<string, string>;
}

export interface Gradient {
  id: string;
  name: string;
  /** The CSS itself. Rules that use a gradient store this value, never the id. */
  value: string;
}

export interface TransferFile {
  format: "design-tokens";
  version: number;
  app?: string;
  exportedAt: string;
  themes: Array<{ name: string; description?: string; mode: "light" | "dark"; roles: Partial<Record<ThemeRole, string>> }>;
  gradients: Array<{ name: string; value: string }>;
}

export interface ImportResult {
  themes: Theme[];
  gradients: Gradient[];
  /** Entries dropped as invalid. Show this to the user; never hide it. */
  skipped: number;
}

export const FORMAT = "design-tokens";
export const VERSION = 1;

/* -------------------------------------------------------- validation -- */

/** Colours only: hex, rgb(a), hsl(a). Anything else could break out of the declaration. */
export function isSafeColor(value: string): boolean {
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i.test(value.trim());
}

/**
 * Gradients: only the gradient functions, only characters that cannot end a
 * declaration or start another, and - where a browser is available - the
 * browser's own opinion on whether it is a real background-image.
 */
export function isSafeGradient(value: string): boolean {
  const v = value.trim();
  if (v.length > 600 || !/^(repeating-)?(linear|radial|conic)-gradient\(/i.test(v) || !v.endsWith(")")) return false;
  if (/[;{}\\<>]|url\(|var\(|expression|image-set|attr\(|@import/i.test(v)) return false;
  if (!/^[a-z0-9\s(),.%#-]+$/i.test(v)) return false;
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") return CSS.supports("background-image", v);
  return true;
}

/** A colour or a gradient — what a background may be. */
export function isSafeFill(value: string): boolean {
  return isSafeColor(value) || isSafeGradient(value);
}

/** Is this background light? Used to file an imported theme as light or dark. */
export function isLightColor(color: string): boolean {
  const m = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

const cleanName = (value: unknown, fallback = ""): string =>
  (typeof value === "string" ? value : fallback).trim().slice(0, 40);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Ids are local to each app; imported entries always get fresh ones. */
export const newId = (prefix = "u"): string => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

/* ------------------------------------------------------------ export -- */

export function buildExport(
  themes: Theme[],
  gradients: Gradient[],
  options: { app?: string; themes?: boolean; gradients?: boolean } = {},
): TransferFile {
  return {
    format: FORMAT,
    version: VERSION,
    app: options.app,
    exportedAt: new Date().toISOString(),
    themes: (options.themes ?? true)
      ? themes.map((t) => {
          const roles: Partial<Record<ThemeRole, string>> = {};
          for (const role of THEME_ROLES) {
            const cssVar = VAR_BY_ROLE[role];
            if (cssVar && t.vars[cssVar]) roles[role] = t.vars[cssVar];
          }
          return { name: t.name, description: t.description || undefined, mode: t.light ? ("light" as const) : ("dark" as const), roles };
        })
      : [],
    gradients: (options.gradients ?? true) ? gradients.map((g) => ({ name: g.name, value: g.value })) : [],
  };
}

/** Downloads the file in a browser. Nothing leaves the machine. */
export function downloadExport(file: TransferFile, fileName = "design-tokens.json"): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------ import -- */

/** Roles become your variables; anything the file omits keeps your default. */
function varsFromRoles(roles: Record<string, unknown>): Record<string, string> {
  const vars = { ...DEFAULT_VARS };
  for (const role of THEME_ROLES) {
    const cssVar = VAR_BY_ROLE[role];
    const value = roles[role];
    if (cssVar && typeof value === "string" && isSafeColor(value)) vars[cssVar] = value.trim();
  }
  return vars;
}

/**
 * Reads a file. Throws an Error whose message is meant for the user.
 * Partial files are fine: themes only, or gradients only.
 */
export function parseImport(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON");
  }
  if (!isObj(raw) || raw.format !== FORMAT) throw new Error("Not a design-tokens file");
  if (typeof raw.version === "number" && raw.version > VERSION) {
    throw new Error("This file was written by a newer version of the format");
  }

  const rawThemes = Array.isArray(raw.themes) ? raw.themes : [];
  const rawGradients = Array.isArray(raw.gradients) ? raw.gradients : [];

  const themes: Theme[] = [];
  for (const t of rawThemes) {
    if (!isObj(t) || !isObj(t.roles)) continue;
    const name = cleanName(t.name);
    if (!name) continue;
    const vars = varsFromRoles(t.roles);
    const background = VAR_BY_ROLE.background ? vars[VAR_BY_ROLE.background] : "";
    themes.push({
      id: newId("c"),
      name,
      description: cleanName(t.description) || undefined,
      light: t.mode === "light" || (t.mode === undefined && isLightColor(background)),
      vars,
    });
  }

  const gradients: Gradient[] = [];
  for (const g of rawGradients) {
    if (!isObj(g) || typeof g.value !== "string" || !isSafeGradient(g.value)) continue;
    const name = cleanName(g.name);
    if (!name) continue;
    gradients.push({ id: newId("g"), name, value: g.value.trim() });
  }

  if (!themes.length && !gradients.length) throw new Error("The file holds no valid themes or gradients");
  return { themes, gradients, skipped: rawThemes.length - themes.length + (rawGradients.length - gradients.length) };
}

/**
 * Adds imported entries to what you already have. Never overwrites: a name
 * that is taken gets a number, so importing the same file twice is safe.
 */
export function mergeImport(
  current: { themes: Theme[]; gradients: Gradient[] },
  incoming: ImportResult,
  limits = { themes: 24, gradients: 40 },
): { themes: Theme[]; gradients: Gradient[] } {
  const takenThemes = new Set(current.themes.map((t) => t.name));
  const takenGradients = new Set(current.gradients.map((g) => g.name));
  const unique = (name: string, taken: Set<string>) => {
    let candidate = name;
    for (let i = 2; taken.has(candidate); i++) candidate = `${name} (${i})`;
    taken.add(candidate);
    return candidate;
  };
  return {
    themes: [...current.themes, ...incoming.themes.map((t) => ({ ...t, name: unique(t.name, takenThemes) }))].slice(0, limits.themes),
    gradients: [...current.gradients, ...incoming.gradients.map((g) => ({ ...g, name: unique(g.name, takenGradients) }))].slice(0, limits.gradients),
  };
}

/* ------------------------------------------------------------ apply -- */

/** Inline style for a theme: put it on your root element. */
export function themeStyle(theme: Theme, overrides: Record<string, string> = {}): Record<string, string> {
  const style: Record<string, string> = {};
  for (const [cssVar, value] of Object.entries({ ...theme.vars, ...overrides })) {
    if (isSafeColor(value) || isSafeGradient(value)) style[cssVar] = value;
  }
  return style;
}

/** Saving a gradient into a rule: store the value, never a reference to the library. */
export function applyGradient(value: string): { backgroundImage: string } | null {
  return isSafeGradient(value) ? { backgroundImage: value } : null;
}
