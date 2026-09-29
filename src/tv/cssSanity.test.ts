/**
 * The board's stylesheet has no broken values.
 *
 * A script that converted the festival screen's vw to cqw wrote "3.cqw" for
 * "3.5vw" and "3cqw" for "34vw", with an invisible control character where
 * the digit had been. A browser drops a declaration it cannot read without a
 * word, so the card lost its margin and padding and the day's screen went
 * out to the walls broken. Nothing type-checks CSS; this does, crudely.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync("src/tv/tv.css", "utf8");
const code = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

describe("tv.css", () => {
  it("has no control characters", () => {
    // eslint-disable-next-line no-control-regex
    expect(CSS.match(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g) ?? []).toEqual([]);
  });

  it("has no length without a number, or a number ending in a dot", () => {
    const bad = code
      .split("\n")
      .filter((l) => /\d\.(?:cq[whib]|cqmin|v[wh]|px|em|rem)\b|[\s(,:](?:cq[whib]|v[wh])\b/.test(l))
      .map((l) => l.trim());
    expect(bad).toEqual([]);
  });

  it("the day's card keeps its margin and padding", () => {
    const card = /^\.tv-event-card \{([^}]*)\}/m.exec(code)?.[1] ?? "";
    expect(card).toMatch(/margin: 3\.5cqw;/);
    expect(card).toMatch(/padding: 2cqw 2\.6cqw;/);
  });
});
