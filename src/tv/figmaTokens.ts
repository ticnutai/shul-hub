/**
 * Reading a colour palette out of a Figma export.
 *
 * No token, no network: the admin exports the file's variables to JSON in
 * Figma (Dev Mode, or a free plugin such as Design Tokens / Tokens Studio)
 * and hands us the file. Figma has changed that export more than once, so
 * this accepts every shape we have seen in the wild:
 *
 *   1. the REST API's `variables/local` body - `meta.variables`, colours as
 *      {r,g,b,a} in 0..1, one value per mode;
 *   2. the W3C design-tokens format - nested groups of `{ $value, $type }`;
 *   3. the older Tokens Studio format - the same with `{ value, type }`;
 *   4. a plain map of name to colour.
 *
 * Everything else in the file (spacing, radii, typography) is ignored: the
 * board's themes are colours.
 */
import { THEME_ROLES, type ThemeRole } from "./transfer";
import { isSafeCssValue } from "./themes";

export interface FigmaColor {
  /** The variable's path, e.g. "brand/primary". */
  name: string;
  /** A colour this board can use: #rgb, #rrggbb, rgb() or hsl(). */
  value: string;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const hex = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n * 255)))
    .toString(16)
    .padStart(2, "0");

/** Figma keeps colours as 0..1 floats; the board wants CSS. */
function fromFigmaRgb(v: unknown): string | null {
  if (!isObj(v) || typeof v.r !== "number" || typeof v.g !== "number" || typeof v.b !== "number") {
    return null;
  }
  const a = typeof v.a === "number" ? v.a : 1;
  const base = `#${hex(v.r)}${hex(v.g)}${hex(v.b)}`;
  return a >= 1 ? base : `${base}${hex(a)}`;
}

/** A colour written as text, if it is one this board will accept. */
function fromCss(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(s)) return null;
  return isSafeCssValue(s) ? s : null;
}

/* ------------------------------------------------------- the shapes -- */

/** 1. the REST API body. */
function fromRestApi(raw: Record<string, unknown>): FigmaColor[] {
  const meta = isObj(raw.meta) ? raw.meta : raw;
  const variables = isObj(meta.variables) ? meta.variables : null;
  if (!variables) return [];
  const out: FigmaColor[] = [];
  for (const entry of Object.values(variables)) {
    if (!isObj(entry) || entry.resolvedType !== "COLOR") continue;
    const name = typeof entry.name === "string" ? entry.name : "";
    const modes = isObj(entry.valuesByMode) ? Object.values(entry.valuesByMode) : [];
    // One colour per variable: the first mode is the file's default.
    const value = modes.map(fromFigmaRgb).find(Boolean);
    if (name && value) out.push({ name, value });
  }
  return out;
}

/** 2-4. a tree of tokens, or a plain map. */
function fromTree(raw: unknown, path: string[] = [], out: FigmaColor[] = []): FigmaColor[] {
  if (!isObj(raw)) return out;

  const value = raw.$value ?? raw.value;
  const type = raw.$type ?? raw.type;
  if (value !== undefined && (type === undefined || /^colou?r$/i.test(String(type)))) {
    const colour = fromCss(value) ?? fromFigmaRgb(value);
    if (colour) {
      out.push({ name: path.join("/") || "color", value: colour });
      return out;
    }
  }

  for (const [key, child] of Object.entries(raw)) {
    if (key.startsWith("$")) continue;
    const colour = fromCss(child);
    if (colour) out.push({ name: [...path, key].join("/"), value: colour });
    else fromTree(child, [...path, key], out);
  }
  return out;
}

/**
 * Reads an export. Throws an Error whose message is meant for the admin.
 * Duplicates are dropped, keeping the first of each name.
 */
export function parseFigmaColors(text: string): FigmaColor[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("הקובץ אינו JSON תקין");
  }
  if (!isObj(raw)) throw new Error("הקובץ אינו קובץ ייצוא של פיגמה");

  const found = [...fromRestApi(raw), ...fromTree(raw)];
  const seen = new Set<string>();
  const colours = found.filter((c) => (seen.has(c.name) ? false : seen.add(c.name)));
  if (!colours.length) throw new Error("לא נמצאו צבעים בקובץ. בפיגמה יש לייצא את המשתנים (Variables) כ-JSON");
  return colours.slice(0, 200);
}

/* -------------------------------------------------------- the roles -- */

/**
 * What a colour's name usually means. Checked in order, first match wins,
 * and a colour is never used for two roles - so a palette named the ordinary
 * way lands on its feet, and anything else is corrected by hand in the UI.
 */
const ROLE_HINTS: Array<[ThemeRole, RegExp]> = [
  ["onAccent", /(on[-_/ ]?(accent|primary|brand)|inverse|inverted)/i],
  ["textMuted", /(muted|subtle|secondary[-_/ ]?text|tertiary|dim|placeholder|disabled)/i],
  ["text", /(text|foreground|(^|[-_/ ])fg([-_/ ]|$)|ink|content|on[-_/ ]?(background|surface))/i],
  ["surface", /(surface|card|panel|elevated|sheet|paper|popover)/i],
  ["backgroundGlowTop", /(bg|background)[-_/ ]?(2|b|alt|soft|glow|top|light)/i],
  ["backgroundGlowBottom", /(bg|background)[-_/ ]?(3|c|deep|dark|bottom|shade)/i],
  ["background", /(background|(^|[-_/ ])bg([-_/ ]|$)|canvas|base|body|page)/i],
  ["highlight", /(highlight|attention|warning|amber|gold|marker|pinned)/i],
  ["accentAlt", /(accent[-_/ ]?(2|alt|secondary)|secondary|brand[-_/ ]?2)/i],
  ["accent", /(accent|primary|brand|main)/i],
];

/** A first guess at which colour plays which role. Unknown roles stay null. */
export function guessRoles(colours: FigmaColor[]): Record<ThemeRole, string | null> {
  const roles = Object.fromEntries(THEME_ROLES.map((r) => [r, null])) as Record<ThemeRole, string | null>;
  const taken = new Set<string>();
  for (const [role, hint] of ROLE_HINTS) {
    if (roles[role]) continue;
    const match = colours.find((c) => !taken.has(c.name) && hint.test(c.name));
    if (match) {
      roles[role] = match.value;
      taken.add(match.name);
    }
  }
  return roles;
}

/** Hebrew names for the roles, for the import screen. */
export const ROLE_LABELS: Record<ThemeRole, string> = {
  background: "רקע ראשי",
  backgroundGlowTop: "זוהר רקע עליון",
  backgroundGlowBottom: "זוהר רקע תחתון",
  surface: "רקע הלוחות",
  text: "טקסט",
  textMuted: "טקסט משני",
  accent: "צבע הדגשה",
  accentAlt: "הדגשה משנית",
  onAccent: "טקסט על הדגשה",
  highlight: "הדגשת שורה",
};

/* ------------------------------------------------ handed over by URL -- */

/**
 * The Figma plugin ("שלח ללוח", in figma-plugin/) opens the editor with the
 * palette in the URL fragment. A fragment is never sent to a server, so the
 * colours travel from Figma to this browser and no further.
 *
 * This is untrusted input like any other: only colours this board accepts
 * survive, and only the first two hundred of them.
 */
export function readHandoff(hash: string): { name: string; colours: FigmaColor[] } | null {
  const match = /[#&]figma=([A-Za-z0-9_-]+)/.exec(hash);
  if (!match) return null;
  try {
    const base64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!isObj(raw) || !Array.isArray(raw.colors)) return null;
    const colours: FigmaColor[] = [];
    for (const entry of raw.colors) {
      if (!isObj(entry)) continue;
      const name = typeof entry.n === "string" ? entry.n.slice(0, 80) : "";
      const value = fromCss(entry.v);
      if (name && value && colours.length < 200) colours.push({ name, value });
    }
    if (!colours.length) return null;
    return { name: typeof raw.name === "string" ? raw.name.slice(0, 40) : "ערכה מפיגמה", colours };
  } catch {
    return null;
  }
}
