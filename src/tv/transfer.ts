import {
  MAX_LOOKS,
  newLookId as defaultLookId,
  normalizeGradients,
  normalizeLookBoard,
  normalizeTvConfig,
  type LookBoard,
  type TvConfig,
  type TvLook,
} from "./config";
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

/**
 * A whole look: colours plus the board's style, corners, spacing, font,
 * background and clock (see TvLook in config.ts).
 *
 * `theme` is either the colours themselves, as roles, or the id of a theme
 * every copy of this board has built in ("navy", "print"...). `board` uses
 * this board's own vocabulary - skin ids, corner shapes - which is why it is
 * a sibling of `themes` and not inside a theme: an app that only knows
 * colours reads `themes`, ignores `looks`, and nothing breaks.
 * See DESIGN_TOKENS_SPEC section 8.
 */
export interface PortableLook {
  name: string;
  description?: string;
  theme: PortableTheme | string;
  board: LookBoard;
}

export interface TransferFile {
  format: typeof TRANSFER_FORMAT;
  version: number;
  /** Informational: which app wrote the file. Importers must not depend on it. */
  app?: string;
  exportedAt: string;
  themes: PortableTheme[];
  gradients: PortableGradient[];
  looks?: PortableLook[];
}

export interface ImportResult {
  themes: TvTheme[];
  gradients: TvGradient[];
  /** Looks, each pointing at a built-in theme or one of `themes` above. */
  looks: TvLook[];
  /** How many entries were dropped as invalid, so the admin is told. */
  skipped: number;
}

/* ------------------------------------------------------------ export -- */

export function toPortableTheme(theme: TvTheme): PortableTheme {
  const roles: Partial<Record<ThemeRole, string>> = {};
  for (const role of THEME_ROLES) roles[role] = theme.vars[VAR_BY_ROLE[role]];
  return { name: theme.name, description: theme.description || undefined, mode: theme.light ? "light" : "dark", roles };
}

/**
 * A look as it travels. An uploaded background picture stays behind: it
 * belongs to this synagogue, and another board has no business loading it.
 * The built-in backdrops ("backdrop:...") travel, since every board has them.
 */
export function toPortableLook(look: TvLook, customThemes: readonly TvTheme[]): PortableLook {
  const custom = customThemes.find((t) => t.id === look.theme);
  const board = { ...look.board };
  if (typeof board.backgroundImage === "string" && !board.backgroundImage.startsWith("backdrop:")) delete board.backgroundImage;
  return {
    name: look.name,
    description: look.description || undefined,
    theme: custom ? toPortableTheme(custom) : look.theme,
    board,
  };
}

export function buildExport(
  config: TvConfig,
  pick: { themes?: boolean; gradients?: boolean; looks?: boolean } = {},
): TransferFile {
  return {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    app: "shul-hub-tv",
    exportedAt: new Date().toISOString(),
    themes: (pick.themes ?? true) ? config.customThemes.map(toPortableTheme) : [],
    gradients: (pick.gradients ?? true) ? config.gradients.map((g) => ({ name: g.name, value: g.value })) : [],
    looks: (pick.looks ?? true) ? config.customLooks.map((l) => toPortableLook(l, config.customThemes)) : [],
  };
}

export type ExportWhat = "themes" | "gradients" | "looks" | "all";

export function exportFileName(what: ExportWhat): string {
  const day = new Date().toISOString().slice(0, 10);
  const label =
    what === "themes" ? "ערכות-נושא" : what === "gradients" ? "גרדיאנטים" : what === "looks" ? "מראות" : "עיצוב";
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
export function parseImport(
  text: string,
  newThemeId: () => string,
  newGradientId: () => string,
  newLookId: () => string = defaultLookId,
): ImportResult {
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
  const rawLooks = Array.isArray(raw.looks) ? raw.looks : [];

  // Everything rides through the config normaliser, which is the single place
  // that decides what a valid colour, gradient or name is.
  const staged = rawThemes.map((t) => {
    if (!isObj(t)) return t;
    const vars = isObj(t.roles) ? fromRoles(t.roles) : t.vars;
    return { ...t, id: newThemeId(), vars, light: t.mode === "light" || t.light === true };
  });
  const themes = normalizeTvConfig({ customThemes: staged }).customThemes;
  const gradients = normalizeGradients(rawGradients.map((g) => (isObj(g) ? { ...g, id: newGradientId() } : g)));

  // Looks. A look that brings its own colours brings them as a theme, which
  // goes through exactly the same door as the themes above.
  const builtIn = new Set(TV_THEMES.map((t) => t.id));
  const looks: TvLook[] = [];
  const lookThemes: TvTheme[] = [];
  let badLooks = 0;
  for (const l of rawLooks) {
    const name = isObj(l) && typeof l.name === "string" ? l.name.trim().slice(0, 40) : "";
    if (!isObj(l) || !name) {
      badLooks++;
      continue;
    }
    let themeId: string | null = null;
    if (typeof l.theme === "string") {
      themeId = builtIn.has(l.theme) ? l.theme : null;
    } else if (isObj(l.theme)) {
      const t = l.theme;
      const [made] = normalizeTvConfig({
        customThemes: [
          {
            ...t,
            id: newThemeId(),
            name: typeof t.name === "string" && t.name.trim() ? t.name : name,
            vars: isObj(t.roles) ? fromRoles(t.roles) : t.vars,
            light: t.mode === "light" || t.light === true,
          },
        ],
      }).customThemes;
      if (made) {
        lookThemes.push(made);
        themeId = made.id;
      }
    }
    if (!themeId) {
      badLooks++;
      continue;
    }
    // A picture uploaded by another synagogue is not ours to load.
    const board = isObj(l.board) ? { ...l.board } : {};
    if (typeof board.backgroundImage === "string" && !board.backgroundImage.startsWith("backdrop:")) delete board.backgroundImage;
    looks.push({
      id: newLookId(),
      name,
      description: typeof l.description === "string" ? l.description.slice(0, 80) : "",
      theme: themeId,
      board: normalizeLookBoard(board),
    });
  }

  if (!themes.length && !gradients.length && !looks.length) {
    throw new Error("לא נמצאו ערכות נושא, גרדיאנטים או מראות תקינים בקובץ");
  }
  return {
    themes: [...themes, ...lookThemes],
    gradients,
    looks,
    skipped: rawThemes.length - themes.length + (rawGradients.length - gradients.length) + badLooks,
  };
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
  const lookNames = new Set(config.customLooks.map((l) => l.name));
  const customThemes = [
    ...config.customThemes,
    ...incoming.themes.map((t) => ({ ...t, name: unique(t.name, themeNames) })),
  ].slice(0, 24);
  // A look whose theme did not fit under the 24-theme ceiling is left out,
  // rather than kept pointing at colours that are not there.
  const themeIds = new Set([...TV_THEMES, ...customThemes].map((t) => t.id));
  return {
    ...config,
    customThemes,
    gradients: [...config.gradients, ...incoming.gradients.map((g) => ({ ...g, name: unique(g.name, gradientNames) }))].slice(0, 40),
    customLooks: [
      ...config.customLooks,
      ...(incoming.looks ?? []).filter((l) => themeIds.has(l.theme)).map((l) => ({ ...l, name: unique(l.name, lookNames) })),
    ].slice(0, MAX_LOOKS),
  };
}
