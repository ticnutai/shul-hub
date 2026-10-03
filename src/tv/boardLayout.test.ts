import { describe, expect, it } from "vitest";
import tabletsFile from "../../docs/design-tokens-kit/example-tablets-board.json";
import example from "../../docs/design-tokens-kit/example-themes.json";
import { applyBoardLayout, boardFromTablets, tabletsFromBoard } from "./boardLayout";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "./config";
import { newCustomThemeId, newGradientId } from "./themes";
import { applyImport, buildExport, parseImport } from "./transfer";

/**
 * docs/design-tokens-kit/example-tablets-board.json is a real export of the
 * tablets editor (digital-prayer-canvas): one theme, one gradient, and the
 * board's shape beside the roles. These tests hold the translation between
 * that shape and this board's knobs.
 */
const text = JSON.stringify(tabletsFile);

describe("a file from the tablets editor", () => {
  it("brings the colours and the board's shape", () => {
    const r = parseImport(text, newCustomThemeId, newGradientId);
    expect(r.themes.map((t) => t.name)).toEqual(["אבן ירושלים"]);
    expect(r.gradients).toHaveLength(1);
    expect(r.skipped).toBe(0);
    expect(r.board).toEqual({
      // arched tablets on a stone wall
      backgroundImage: "backdrop:wall",
      frame: { shape: "arch", top: null, bottom: null },
      // the editor's default spacing leaves this board's own alone
      spacing: { top: null, bottom: null, sides: null, gap: null },
      textScale: 1,
      title: "בית הכנסת אוהל יצחק",
    });
  });

  it("lands on the board as a normal, validated config", () => {
    const r = parseImport(text, newCustomThemeId, newGradientId);
    const next = applyImport(DEFAULT_TV_CONFIG, r);
    expect(next.frame.shape).toBe("arch");
    expect(next.backgroundImage).toBe("backdrop:wall");
    expect(next.spacing).toEqual({ top: null, bottom: null, sides: null, gap: null });
    expect(next.texts["header.title"]).toBe("בית הכנסת אוהל יצחק");
    expect(next.customThemes.map((t) => t.name)).toEqual(["אבן ירושלים (2)"]);
    expect(normalizeTvConfig(next)).toEqual(next);
  });

  it("keeps the colours-only files exactly as they were", () => {
    const r = parseImport(JSON.stringify(example), newCustomThemeId, newGradientId);
    expect(r.board).toBeNull();
    const next = applyImport(DEFAULT_TV_CONFIG, r);
    expect(next.frame).toEqual(DEFAULT_TV_CONFIG.frame);
    expect(next.backgroundImage).toBe(DEFAULT_TV_CONFIG.backgroundImage);
    expect(next.spacing).toEqual(DEFAULT_TV_CONFIG.spacing);
    expect(next.texts).toEqual(DEFAULT_TV_CONFIG.texts);
  });

  it("reads a layout-only file, with no colours at all", () => {
    const r = parseImport(
      JSON.stringify({ format: "design-tokens", version: 1, board: { layout: { tabletsGap: 3 } } }),
      newCustomThemeId,
      newGradientId,
    );
    expect(r.themes).toHaveLength(0);
    // half the editor's default gap is half this board's (2u)
    expect(r.board?.spacing).toEqual({ top: null, bottom: null, sides: 8.5, gap: 1 });
  });
});

describe("the translation table", () => {
  it("turns a flat curve into a corner radius, on the wall's own background", () => {
    const b = boardFromTablets({
      layout: { archRadius: 10, tabletWidth: 40, tabletsGap: 2, topOffset: 12 },
      appearance: { wallTexture: "wood", rowSize: 2.28 },
    })!;
    expect(b.backgroundImage).toBe("backdrop:wood");
    expect(b.frame).toEqual({ shape: "round", top: 7, bottom: 1 });
    expect(b.spacing).toEqual({ top: 2.2, bottom: null, sides: 9, gap: 0.7 });
    expect(b.textScale).toBe(1.2);
  });

  it("maps every wall", () => {
    const wallOf = (wall: string) => boardFromTablets({ layout: { archRadius: 0 }, appearance: { wallTexture: wall } })!.backgroundImage;
    expect([wallOf("jerusalem-stone"), wallOf("smooth-marble"), wallOf("dark-velvet"), wallOf("wood")]).toEqual([
      "backdrop:wall",
      "backdrop:marble",
      "backdrop:velvet",
      "backdrop:wood",
    ]);
    expect(boardFromTablets({ layout: { archRadius: 50 } })!.frame.shape).toBe("arch");
    // and back: every wall comes out as the wall it went in as
    for (const wall of ["jerusalem-stone", "smooth-marble", "dark-velvet", "wood"]) {
      const b = boardFromTablets({ layout: { archRadius: 0 }, appearance: { wallTexture: wall } })!;
      expect(tabletsFromBoard(applyBoardLayout(DEFAULT_TV_CONFIG, b)).appearance.wallTexture).toBe(wall);
    }
  });

  it("clamps and ignores what it cannot trust", () => {
    const b = boardFromTablets({
      layout: { tabletsGap: 1e9, topOffset: -5, tabletWidth: "wide", archRadius: Infinity },
      header: { shulName: 42 },
      appearance: { wallTexture: "url(https://evil.example)", rowSize: 99 },
    })!;
    expect(b.spacing.gap).toBe(10);
    expect(b.spacing.top).toBe(0);
    expect(b.frame.shape).toBe("arch");
    expect(b.backgroundImage).toBe("backdrop:wall");
    expect(b.textScale).toBe(1.3);
    expect(b.title).toBeNull();
    const next = applyBoardLayout(DEFAULT_TV_CONFIG, b);
    expect(normalizeTvConfig(next)).toEqual(next);
  });

  it("says nothing when the entry has no shape", () => {
    expect(boardFromTablets({ name: "x", roles: {} })).toBeNull();
    expect(boardFromTablets(null)).toBeNull();
    expect(boardFromTablets("layout")).toBeNull();
  });
});

describe("spacing that fits", () => {
  it("never gives the tablets more air than the editor asked for", () => {
    // A modest change in the editor stays a modest change here: the default
    // gap mapped to the maximum once, and the short panels lost their last rows.
    const b = boardFromTablets({ layout: { tabletsGap: 7.5, tabletWidth: 39, topOffset: 15 } })!;
    expect(b.spacing.gap).toBe(2.5);
    // 7.25% against the editor's 7% is close enough to keep the board's own
    expect(b.spacing.sides).toBeNull();
    expect(b.spacing.top).toBe(2.8);
  });

  it("round-trips a changed spacing through the editor's terms", () => {
    const b = boardFromTablets({ layout: { tabletsGap: 3, tabletWidth: 44, topOffset: 18 } })!;
    const back = tabletsFromBoard(applyBoardLayout(DEFAULT_TV_CONFIG, b)).layout;
    expect(back.tabletsGap).toBe(3);
    expect(back.tabletWidth).toBe(44);
    expect(back.topOffset).toBeCloseTo(18, 0);
  });
});

describe("exporting the shape", () => {
  it("is only in 'all' and survives a round trip", () => {
    const board = applyImport(DEFAULT_TV_CONFIG, parseImport(text, newCustomThemeId, newGradientId));
    expect(buildExport(board).board).toBeUndefined();

    const file = buildExport(board, { board: true });
    expect(file.board?.appearance.wallTexture).toBe("jerusalem-stone");
    expect(file.board?.layout.archRadius).toBe(50);
    expect(file.board?.header.shulName).toBe("בית הכנסת אוהל יצחק");

    const again = applyImport(DEFAULT_TV_CONFIG, parseImport(JSON.stringify(file), newCustomThemeId, newGradientId));
    expect(again.backgroundImage).toBe(board.backgroundImage);
    expect(again.frame).toEqual(board.frame);
    expect(again.spacing).toEqual(board.spacing);
    expect(again.textScale).toBe(board.textScale);
    expect(again.texts["header.title"]).toBe(board.texts["header.title"]);
  });

  it("describes an untouched board with the editor's defaults", () => {
    const t = tabletsFromBoard(DEFAULT_TV_CONFIG);
    expect(t.layout).toEqual({ tabletsGap: 6, topOffset: 14, tabletWidth: 40, archRadius: 4, archHeight: 2 });
    expect(t.header).toEqual({});
  });
});
