import { describe, expect, it } from "vitest";
import { contrast, over, parseColour } from "./readability";

describe("reading a colour as the board computes it", () => {
  it("takes rgb, rgba, color(srgb …) and hex", () => {
    expect(parseColour("rgb(255, 0, 0)")).toEqual([255, 0, 0, 1]);
    expect(parseColour("rgba(0, 0, 0, 0.5)")).toEqual([0, 0, 0, 0.5]);
    expect(parseColour("color(srgb 1 1 1 / 0.25)")).toEqual([255, 255, 255, 0.25]);
    expect(parseColour("#102030")).toEqual([16, 32, 48, 1]);
    expect(parseColour("var(--x)")).toBeNull();
  });
});

describe("contrast", () => {
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrast([0, 0, 0, 1], [255, 255, 255, 1])).toBeCloseTo(21, 0);
    expect(contrast([90, 26, 42, 1], [90, 26, 42, 1])).toBe(1);
  });

  it("judges see-through text by what it becomes over its background", () => {
    const bg: [number, number, number, number] = [11, 22, 40, 1];
    const faint = over([255, 255, 255, 0.15], bg);
    expect(contrast(faint, bg)).toBeLessThan(3);
    expect(contrast(over([255, 255, 255, 1], bg), bg)).toBeGreaterThan(10);
  });
});
