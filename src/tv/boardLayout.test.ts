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
      skin: "tablets",
      frame: { shape: "auto", top: null, bottom: null },
      // 6% of the width is 10.7u, clamped to the most this board allows
      spacing: { top: 4, sides: 10, gap: 10 },
      textScale: 1,
      title: "בית הכנסת אוהל יצחק",
    });
  });

  it("lands on the board as a normal, validated config", () => {
    const r = parseImport(text, newCustomThemeId, newGradientId);
    const next = applyImport(DEFAULT_TV_CONFIG, r);
    expect(next.skin).toBe("tablets");
    expect(next.spacing).toEqual({ top: 4, sides: 10, gap: 10 });
    expect(next.texts["header.title"]).toBe("בית הכנסת אוהל יצחק");
    expect(next.customThemes.map((t) => t.name)).toEqual(["אבן ירושלים (2)"]);
    expect(normalizeTvConfig(next)).toEqual(next);
  });

  it("keeps the colours-only files exactly as they were", () => {
    const r = parseImport(JSON.stringify(example), newCustomThemeId, newGradientId);
    expect(r.board).toBeNull();
    const next = applyImport(DEFAULT_TV_CONFIG, r);
    expect(next.skin).toBe(DEFAULT_TV_CONFIG.skin);
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
    expect(r.board?.spacing.gap).toBe(5.3);
  });
});

describe("the translation table", () => {
  it("turns a flat curve into a corner radius on the wall's own skin", () => {
    const b = boardFromTablets({
      layout: { archRadius: 10, tabletWidth: 40, tabletsGap: 2, topOffset: 12 },
      appearance: { wallTexture: "wood", rowSize: 2.28 },
    })!;
    expect(b.skin).toBe("wood");
    expect(b.frame).toEqual({ shape: "round", top: 7, bottom: 1 });
    expect(b.spacing).toEqual({ top: 2, sides: 10, gap: 3.6 });
    expect(b.textScale).toBe(1.2);
  });

  it("maps every wall", () => {
    const skin = (wall: string, archRadius = 0) =>
      boardFromTablets({ layout: { archRadius }, appearance: { wallTexture: wall } })!.skin;
    expect([skin("jerusalem-stone"), skin("smooth-marble"), skin("dark-velvet"), skin("wood")]).toEqual([
      "stone",
      "crown",
      "velvet",
      "wood",
    ]);
    expect(skin("smooth-marble", 50)).toBe("arch");
    expect(skin("dark-velvet", 50)).toBe("tablets");
  });

  it("clamps and ignores what it cannot trust", () => {
    const b = boardFromTablets({
      layout: { tabletsGap: 1e9, topOffset: -5, tabletWidth: "wide", archRadius: Infinity },
      header: { shulName: 42 },
      appearance: { wallTexture: "url(https://evil.example)", rowSize: 99 },
    })!;
    expect(b.spacing.gap).toBe(10);
    expect(b.spacing.top).toBe(0);
    expect(b.skin).toBe("tablets");
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

describe("exporting the shape", () => {
  it("is only in 'all' and survives a round trip", () => {
    const board = applyImport(DEFAULT_TV_CONFIG, parseImport(text, newCustomThemeId, newGradientId));
    expect(buildExport(board).board).toBeUndefined();

    const file = buildExport(board, { board: true });
    expect(file.board?.appearance.wallTexture).toBe("jerusalem-stone");
    expect(file.board?.layout.archRadius).toBe(50);
    expect(file.board?.header.shulName).toBe("בית הכנסת אוהל יצחק");

    const again = applyImport(DEFAULT_TV_CONFIG, parseImport(JSON.stringify(file), newCustomThemeId, newGradientId));
    expect(again.skin).toBe(board.skin);
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
