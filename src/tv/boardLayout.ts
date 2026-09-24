import { FRAME_RADIUS_MAX, SPACING_MAX, normalizeTvConfig, type BoardSkin, type TvConfig } from "./config";

/**
 * The shape of a board, carried in a design-tokens file beside the colours.
 *
 * The "tablets" editor (digital-prayer-canvas) writes its layout into the
 * same file as the theme, as sibling keys of `roles` - `layout`, `header`,
 * `appearance`, `content` - which the format allows (DESIGN_TOKENS_SPEC.md
 * §"extending"). This module is the one table that translates between that
 * description and this board's own knobs, in both directions:
 *
 *   editor                          this board
 *   ─────────────────────────────   ─────────────────────────────────────
 *   arched tablets (archRadius≥35)  skin "tablets" ("arch" on marble)
 *   flat / rounded tablets          frame: round corners, radius in --u
 *   wallTexture                     skin (stone / velvet / wood / crown)
 *   tabletsGap (% width)            spacing.gap   (scaled, see below)
 *   outer margin (% width)          spacing.sides (scaled)
 *   topOffset (% height)            spacing.top   (scaled)
 *   rowSize (cqw)                   textScale
 *   header.shulName                 texts["header.title"]
 *
 * Spacing is relative, not converted. The editor lays out two tablets and
 * this board three columns, so the same percentage does not mean the same
 * air: taken literally, the editor's default gap came out five times this
 * board's and cut the last rows off the short panels. Instead the editor's
 * defaults stand for "as the style draws it" (null), and a change in the
 * editor moves the board's own default by the same proportion - half the
 * gap there is half the gap here. The defaults were measured on the
 * dashboard layout with the tablets skin.
 *
 * The clock, wreath, gold stroke, row gap and colours of the tablets have no
 * counterpart here and are not carried. Prayer times are not design: they
 * come from the minyanim table, never from a file.
 *
 * Everything is clamped to what the config allows and then passed through
 * normalizeTvConfig, the same validation every saved board goes through.
 */

/** The board knobs a file can set. */
export interface BoardLayoutPatch {
  skin: BoardSkin;
  frame: TvConfig["frame"];
  spacing: TvConfig["spacing"];
  textScale: number;
  /** The synagogue name for the header, when the file carries one. */
  title: string | null;
}

/** What the editor writes, as far as this board understands it. */
export interface TabletsLayout {
  layout: {
    tabletsGap: number;
    topOffset: number;
    tabletWidth: number;
    archRadius: number;
    archHeight: number;
  };
  header: { shulName?: string };
  appearance: {
    wallTexture: WallTexture;
    rowSize: number;
    titleSize: number;
  };
}

type WallTexture = "jerusalem-stone" | "smooth-marble" | "dark-velvet" | "wood";

/** One percent of a 16:9 board's width, in --u (percent of its height). */
const WIDTH_TO_U = 16 / 9;
/** The editor's own defaults: the layout that means "leave the spacing alone". */
const EDITOR = { gap: 6, margin: 7, top: 14 };
/** What this board draws when spacing is left alone, in --u (measured, see above). */
const BOARD = { gap: 2, sides: 7, top: 2.6 };
/** Closer to the editor's default than this, and the board keeps its own. */
const SAME = 0.05;
/** The editor's row size that reads as textScale 1. */
const BASE_ROW_SIZE = 1.9;
/** From this curve on, the tablets are arches, not rounded boxes. */
const ARCH_FROM = 35;

const WALL_SKIN: Record<WallTexture, BoardSkin> = {
  "jerusalem-stone": "stone",
  "smooth-marble": "crown",
  "dark-velvet": "velvet",
  wood: "wood",
};

const SKIN_WALL: Partial<Record<BoardSkin, WallTexture>> = {
  stone: "jerusalem-stone",
  tablets: "jerusalem-stone",
  parchment: "jerusalem-stone",
  crown: "smooth-marble",
  arch: "smooth-marble",
  heichal: "smooth-marble",
  pillars: "smooth-marble",
  velvet: "dark-velvet",
  hall: "dark-velvet",
  curtain: "dark-velvet",
  wood: "wood",
};

/** Skins whose panels are already arched tablets. */
const ARCHED_SKINS: BoardSkin[] = ["tablets", "arch", "dome"];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** The editor's value as this board's, in proportion to both defaults; null at the default. */
function scaled(value: number, editorDefault: number, boardDefault: number): number | null {
  const ratio = value / editorDefault;
  if (Math.abs(ratio - 1) < SAME) return null;
  return round1(clamp(boardDefault * ratio, 0, SPACING_MAX));
}

/** This board's value back in the editor's terms. */
function unscaled(value: number | null, editorDefault: number, boardDefault: number): number {
  return value == null ? editorDefault : round1((value / boardDefault) * editorDefault);
}

/**
 * Reads the editor's layout from a theme entry (or a top-level `board`).
 * null when the entry carries no layout at all - a colours-only file.
 */
export function boardFromTablets(entry: unknown): BoardLayoutPatch | null {
  if (!isObj(entry)) return null;
  const L = isObj(entry.layout) ? entry.layout : null;
  const H = isObj(entry.header) ? entry.header : null;
  const A = isObj(entry.appearance) ? entry.appearance : null;
  if (!L && !H && !A) return null;

  const gap = num(L?.tabletsGap, 6, 0, 40);
  const width = num(L?.tabletWidth, 40, 15, 48);
  const top = num(L?.topOffset, 14, 0, 50);
  const archRadius = num(L?.archRadius, 50, 0, 50);
  const wall = (typeof A?.wallTexture === "string" && A.wallTexture in WALL_SKIN ? A.wallTexture : "jerusalem-stone") as WallTexture;
  const arched = archRadius >= ARCH_FROM;

  // A real arch is drawn by the skins made of arches; a flatter curve
  // becomes a corner radius on whatever skin the wall calls for.
  const skin: BoardSkin = arched ? (wall === "smooth-marble" ? "arch" : "tablets") : WALL_SKIN[wall];
  const frame: TvConfig["frame"] = arched
    ? { shape: "auto", top: null, bottom: null }
    : {
        shape: "round",
        top: clamp(Math.round((archRadius / 100) * width * WIDTH_TO_U), 0, FRAME_RADIUS_MAX),
        bottom: clamp(Math.round(0.02 * width * WIDTH_TO_U), 0, FRAME_RADIUS_MAX),
      };

  const title = typeof H?.shulName === "string" ? H.shulName.trim().slice(0, 300) : "";
  return {
    skin,
    frame,
    spacing: L
      ? {
          top: scaled(top, EDITOR.top, BOARD.top),
          sides: scaled(Math.max(0, 50 - gap / 2 - width), EDITOR.margin, BOARD.sides),
          gap: scaled(gap, EDITOR.gap, BOARD.gap),
        }
      : { top: null, sides: null, gap: null },
    textScale: Math.round(clamp(num(A?.rowSize, BASE_ROW_SIZE, 0.8, 5) / BASE_ROW_SIZE, 0.8, 1.3) * 100) / 100,
    title: title || null,
  };
}

/** Puts a file's layout onto a board. The result is a normal, validated config. */
export function applyBoardLayout(config: TvConfig, patch: BoardLayoutPatch): TvConfig {
  return normalizeTvConfig({
    ...config,
    skin: patch.skin,
    frame: patch.frame,
    spacing: patch.spacing,
    textScale: patch.textScale,
    texts: patch.title ? { ...config.texts, "header.title": patch.title } : config.texts,
  });
}

/**
 * The same table backwards, for export: this board described in the
 * editor's terms, so a file from here opens there with the same air, the
 * same arches and the same wall. Knobs left "as the style draws it" (null)
 * are written as the editor's own defaults.
 */
export function tabletsFromBoard(config: TvConfig): TabletsLayout {
  const gap = clamp(unscaled(config.spacing.gap, EDITOR.gap, BOARD.gap), 0, 40);
  const margin = unscaled(config.spacing.sides, EDITOR.margin, BOARD.sides);
  const width = round1(clamp(50 - gap / 2 - margin, 15, 48));
  const arched = config.frame.top == null && ARCHED_SKINS.includes(config.skin);
  const archRadius = arched
    ? 50
    : config.frame.top != null
      ? round1(clamp((config.frame.top / (width * WIDTH_TO_U)) * 100, 0, 50))
      : 4;
  return {
    layout: {
      tabletsGap: gap,
      topOffset: round1(clamp(unscaled(config.spacing.top, EDITOR.top, BOARD.top), 0, 50)),
      tabletWidth: width,
      archRadius,
      archHeight: arched ? 34 : round1(archRadius / 2),
    },
    header: config.texts["header.title"] ? { shulName: config.texts["header.title"] } : {},
    appearance: {
      wallTexture: SKIN_WALL[config.skin] ?? "jerusalem-stone",
      rowSize: round1(config.textScale * BASE_ROW_SIZE),
      titleSize: round1(config.textScale * 2.1),
    },
  };
}
