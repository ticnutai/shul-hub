/**
 * Dim text that can actually be read, on every skin.
 *
 * Photographed off the wall at אהל אברהם: the zmanim panel showed its times
 * and not their names. The time inherits the panel's own colour, which the
 * skin sets; the label asks for `--tv-text-dim`, which belongs to the theme
 * and is a pale colour meant for a dark board. On that skin's cream panel it
 * measured 1.75:1, against a 4.5:1 threshold - not hard to read, absent.
 *
 * The skin that caused it was one of ten with light panels, so fixing the
 * one that was photographed would have left nine. This checks all of them,
 * and will fail for the eleventh: a skin that draws a light panel and does
 * not say what dim text on it should be.
 *
 * It reads the stylesheet rather than a browser, which is enough because the
 * question is about declared colours. What it cannot see is a panel painted
 * by an image or a gradient that is not written as hex, so a skin doing that
 * has to be looked at by eye.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { LIGHT_BOARD_PALETTE, themeStyle, THEME_VARS } from "./themes";

const CSS = readFileSync("src/tv/tv.css", "utf8");

/** WCAG AA for body text. A wall is read from further away, never nearer. */
const MIN_CONTRAST = 4.5;

const channel = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The average of the hex stops in a background, which is where text sits. */
function average(hexes: string[]): string {
  const parts = [0, 1, 2].map((k) =>
    Math.round(hexes.reduce((sum, h) => sum + parseInt(h.slice(1 + k * 2, 3 + k * 2), 16), 0) / hexes.length),
  );
  return "#" + parts.map((v) => v.toString(16).padStart(2, "0")).join("");
}

interface Panel {
  skin: string;
  background: string;
  color: string;
}

/** Every `.tv-root.is-skin-X .tv-panel` rule that states both colours. */
function lightPanels(): Panel[] {
  const out: Panel[] = [];
  const rule = /\.tv-root\.is-skin-([a-z]+)\s+\.tv-panel[^{]*\{([^}]*)\}/g;
  for (const match of CSS.matchAll(rule)) {
    const body = match[2];
    const color = /color:\s*(#[0-9a-f]{6})/i.exec(body)?.[1];
    const background = [...(/background:\s*([^;]*)/i.exec(body)?.[1] ?? "").matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);
    if (!color || !background.length) continue;
    // A panel whose text is dark is a light panel.
    if (luminance(color) > 0.3) continue;
    out.push({ skin: match[1], background: average(background), color });
  }
  return out;
}

/** What dim text inside this skin's panels is declared to be. */
function dimFor(skin: string): string | null {
  const rule = new RegExp(
    `\\.tv-root\\.is-skin-${skin}\\s+\\.tv-panel[^{]*\\{[^}]*--tv-text-dim:\\s*(#[0-9a-f]{6})`,
    "i",
  );
  return rule.exec(CSS)?.[1] ?? null;
}

describe("dim text on a light panel", () => {
  const panels = lightPanels();

  it("finds the skins that draw light panels", () => {
    // If this drops to nothing the test below is passing vacuously.
    expect(panels.length).toBeGreaterThan(5);
  });

  it("every one of them says what dim text on it should be", () => {
    const silent = [...new Set(panels.map((p) => p.skin))].filter((s) => !dimFor(s));
    expect(
      silent,
      "these skins draw a light panel and leave --tv-text-dim to the theme, " +
        "which is a pale colour for a dark board - set one on their .tv-panel rule",
    ).toEqual([]);
  });

  it("and that colour can be read against the panel it sits on", () => {
    const failures: string[] = [];
    for (const panel of panels) {
      const dim = dimFor(panel.skin);
      if (!dim) continue;
      const ratio = contrast(dim, panel.background);
      if (ratio < MIN_CONTRAST) failures.push(`${panel.skin}: ${dim} on ${panel.background} = ${ratio.toFixed(2)}:1`);
    }
    expect(failures, `below ${MIN_CONTRAST}:1`).toEqual([]);
  });

  it("the panel's own text is readable too, which is what made the gap visible", () => {
    // The time was legible and the label was not, on the same line. Holding
    // both down is what makes that comparison meaningful.
    const failures: string[] = [];
    for (const panel of panels) {
      const ratio = contrast(panel.color, panel.background);
      if (ratio < MIN_CONTRAST) failures.push(`${panel.skin}: ${panel.color} on ${panel.background} = ${ratio.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });
});

/** The board's own background, where a skin paints one. */
function boardBackground(skin: string): string | null {
  // String.raw, because a backslash in an ordinary template literal is an
  // escape and quietly disappears: `\s+` became `s+` and the pattern matched
  // nothing, which read as "no skin paints a light board".
  const rule = new RegExp(
    String.raw`\.tv-root\.is-skin-SKIN\s+\.tv-bg[^{]*\{([^}]*)\}`.replace("SKIN", skin),
  );
  const body = rule.exec(CSS)?.[1];
  if (!body) return null;
  const stops = [...body.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);
  return stops.length ? average(stops) : null;
}

/** A palette value this skin restates for the whole board, if it does. */
function boardVar(skin: string, name: string): string | null {
  return (LIGHT_BOARD_PALETTE[skin] as Record<string, string> | undefined)?.[name] ?? null;
}

/** Every skin named anywhere in the stylesheet. */
function allSkins(): string[] {
  return [...new Set([...CSS.matchAll(/is-skin-([a-z]+)/g)].map((m) => m[1]))];
}

describe("the palette on a light board", () => {
  /**
   * A skin that paints the board light cannot leave the palette to the theme.
   * Every theme here is dark, so its text is a near-white and its accent a
   * pale gold - on a light board that is not dim text, it is no text. The
   * prayer timeline draws straight onto the board and is where it showed.
   */
  const lightBoards = allSkins().filter((s) => {
    const bg = boardBackground(s);
    return bg !== null && luminance(bg) > 0.4;
  });

  it("finds the skins that paint a light board", () => {
    expect(lightBoards.length).toBeGreaterThan(0);
  });

  it("each of them restates the palette rather than inheriting a dark theme's", () => {
    const missing: string[] = [];
    for (const skin of lightBoards)
      for (const name of ["--tv-text", "--tv-text-dim", "--tv-accent"])
        if (!boardVar(skin, name)) missing.push(`${skin} ${name}`);
    expect(
      missing,
      "a light board with the theme's own colours shows near-white text on cream",
    ).toEqual([]);
  });

  it("and every value can be read on that board", () => {
    const failures: string[] = [];
    for (const skin of lightBoards) {
      const bg = boardBackground(skin)!;
      for (const [name, floor] of [["--tv-text", 7], ["--tv-text-dim", 4.5], ["--tv-accent", 4.5]] as const) {
        const value = boardVar(skin, name);
        if (!value) continue;
        const r = contrast(value, bg);
        if (r < floor) failures.push(`${skin} ${name}: ${value} on ${bg} = ${r.toFixed(2)}:1 (needs ${floor})`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("the palette reaches the board", () => {
  /**
   * It was declared, measured and tested - and never drawn. The theme's
   * colours are an inline style on the board, and a stylesheet rule on the
   * same element loses to it; the test above read the stylesheet, which said
   * the right thing. This asks the style the board is actually given.
   */
  it("a light skin's palette wins over a dark theme's", () => {
    for (const [skin, palette] of Object.entries(LIGHT_BOARD_PALETTE)) {
      const style = themeStyle({ theme: "forest", skin, font: "heebo" }) as Record<string, string>;
      for (const [name, value] of Object.entries(palette)) expect(style[name], `${skin} ${name}`).toBe(value);
    }
  });

  it("and the gabbai's own colour still wins over the skin's", () => {
    const style = themeStyle({ theme: "forest", skin: "sky", font: "heebo", overrides: { "--tv-accent": "#123456" } }) as Record<string, string>;
    expect(style["--tv-accent"]).toBe("#123456");
  });

  it("a dark skin keeps its theme's colours", () => {
    const style = themeStyle({ theme: "forest", skin: "plain", font: "heebo" }) as Record<string, string>;
    expect(style["--tv-text"]).not.toBe(LIGHT_BOARD_PALETTE.sky["--tv-text"]);
  });

  it("names only real palette variables", () => {
    for (const palette of Object.values(LIGHT_BOARD_PALETTE))
      for (const name of Object.keys(palette)) expect(THEME_VARS as readonly string[]).toContain(name);
  });
});

describe("the analog clock on a skin that paints its own face", () => {
  it("is not covered by the theme's dark tint", () => {
    // Every theme is dark, and the tint over the face is the theme's
    // background at 70%: over a cream face, a black disc.
    const painted = [...CSS.matchAll(/\.tv-root\.is-skin-([a-z]+)[^{,]*\.tv-analog-face/g)].map((m) => m[1]);
    const hidden = new Set(
      [...CSS.matchAll(/\.tv-root\.is-skin-([a-z]+)[^{,]*\.tv-analog-tint/g)].map((m) => m[1]),
    );
    expect(painted.length).toBeGreaterThan(3);
    expect([...new Set(painted)].filter((s) => !hidden.has(s))).toEqual([]);
  });
});
