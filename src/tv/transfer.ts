import { normalizeGradients, normalizeTvConfig, type TvConfig } from "./config";
import { TV_GRADIENTS, TV_THEMES, type TvGradient, type TvTheme } from "./themes";

/**
 * Moving themes and gradients between boards (and between synagogues): the
 * admin exports a small JSON file, someone else imports it.
 *
 * An imported file is untrusted. It is never merged as-is: every theme and
 * gradient goes through the same normalisation the saved config does, so a
 * bad colour, an unsafe gradient or a wrong shape is dropped rather than
 * stored. Ids are re-minted on import, so importing twice never overwrites
 * the themes already saved.
 */

export const TRANSFER_KIND = "shul-hub-tv-design";
export const TRANSFER_VERSION = 1;

export interface TransferFile {
  kind: typeof TRANSFER_KIND;
  version: number;
  exportedAt: string;
  themes: TvTheme[];
  gradients: TvGradient[];
}

export interface ImportResult {
  themes: TvTheme[];
  gradients: TvGradient[];
  /** What was dropped, so the admin is told rather than left guessing. */
  skipped: number;
}

export function buildExport(
  config: TvConfig,
  pick: { themes?: boolean; gradients?: boolean } = {},
): TransferFile {
  const wantThemes = pick.themes ?? true;
  const wantGradients = pick.gradients ?? true;
  return {
    kind: TRANSFER_KIND,
    version: TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    themes: wantThemes ? config.customThemes : [],
    gradients: wantGradients ? config.gradients : [],
  };
}

export function exportFileName(what: "themes" | "gradients" | "all"): string {
  const day = new Date().toISOString().slice(0, 10);
  const label = what === "themes" ? "ערכות-נושא" : what === "gradients" ? "גרדיאנטים" : "עיצוב";
  return `לוח-${label}-${day}.json`;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Reads a pasted or uploaded file. Throws with a Hebrew reason the admin can
 * act on; a partial file (only themes, or only gradients) is fine.
 */
export function parseImport(
  text: string,
  newThemeId: () => string,
  newGradientId: () => string,
): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("הקובץ אינו בפורמט הנכון (JSON לא תקין)");
  }
  if (!isObj(raw)) throw new Error("הקובץ אינו בפורמט הנכון");
  if (raw.kind !== TRANSFER_KIND) throw new Error("זה לא קובץ עיצוב של לוח התצוגה");

  const rawThemes = Array.isArray(raw.themes) ? raw.themes : [];
  const rawGradients = Array.isArray(raw.gradients) ? raw.gradients : [];

  // Themes ride through the config normaliser: ids are re-minted first, so a
  // built-in id or a duplicate in the file cannot shadow anything saved.
  const staged = rawThemes.map((t) => (isObj(t) ? { ...t, id: newThemeId() } : t));
  const themes = normalizeTvConfig({ customThemes: staged }).customThemes;
  const gradients = normalizeGradients(
    rawGradients.map((g) => (isObj(g) ? { ...g, id: newGradientId() } : g)),
  );

  if (!themes.length && !gradients.length)
    throw new Error("לא נמצאו ערכות נושא או גרדיאנטים תקינים בקובץ");
  return {
    themes,
    gradients,
    skipped: rawThemes.length - themes.length + (rawGradients.length - gradients.length),
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
  return {
    ...config,
    customThemes: [
      ...config.customThemes,
      ...incoming.themes.map((t) => ({ ...t, name: unique(t.name, themeNames) })),
    ].slice(0, 24),
    gradients: [
      ...config.gradients,
      ...incoming.gradients.map((g) => ({ ...g, name: unique(g.name, gradientNames) })),
    ].slice(0, 40),
  };
}
