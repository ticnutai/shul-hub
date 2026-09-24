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
 *   tabletsGap (% width)            spacing.gap   (--u)
 *   tabletWidth (% width)           spacing.sides (--u)
 *   topOffset (% height)            spacing.top   (--u)
 *   rowSize (cqw)                   textScale
 *   header.shulName                 texts["header.title"]
 *
 * The editor's percentages are of a 16:9 board, and --u is one percent of
 * the board's height, so one percent of the width is 16/9 of a --u. The
 * clock, wreath, gold stroke, row gap and colours of the tablets have no
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
/** The editor's clock and cornice take this much of the height above the tablets. */
const HEADER_HEIGHT = 10;
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
    spacing: {
      top: L ? round1(clamp(top - HEADER_HEIGHT, 0, SPACING_MAX)) : null,
      sides: L ? round1(clamp((50 - gap / 2 - width) * WIDTH_TO_U, 0, SPACING_MAX)) : null,
      gap: L ? round1(clamp(gap * WIDTH_TO_U, 0, SPACING_MAX)) : null,
    },
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
  const gapU = config.spacing.gap ?? 6 * WIDTH_TO_U;
  const gap = round1(gapU / WIDTH_TO_U);
  const sides = config.spacing.sides != null ? config.spacing.sides / WIDTH_TO_U : 50 - gap / 2 - 40;
  const width = round1(clamp(50 - gap / 2 - sides, 15, 48));
  const arched = config.frame.top == null && ARCHED_SKINS.includes(config.skin);
  const archRadius = arched
    ? 50
    : config.frame.top != null
      ? round1(clamp((config.frame.top / (width * WIDTH_TO_U)) * 100, 0, 50))
      : 4;
  return {
    layout: {
      tabletsGap: gap,
      topOffset: round1((config.spacing.top ?? 4) + HEADER_HEIGHT),
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
