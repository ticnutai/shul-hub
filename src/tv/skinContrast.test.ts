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
