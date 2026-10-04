import { describe, expect, it } from "vitest";
import { snapOffset, snapTune } from "./snap";

describe("snapping an element while it is dragged", () => {
  it("lands back on its own place when close to it", () => {
    expect(snapOffset(0.8, 30)).toEqual({ value: 0, line: 30 });
  });
  it("lands with its middle on the board's middle", () => {
    // Its middle stands at 30%: an offset of 20 puts it at 50.
    expect(snapOffset(19.3, 30)).toEqual({ value: 20, line: 50 });
  });
  it("otherwise moves on a half-percent grid, with no guide", () => {
    expect(snapOffset(7.3, 30)).toEqual({ value: 7.5, line: null });
  });
});

describe("snapping a piece of the board's frame", () => {
  it("rounds, and comes back to its usual size and place when close", () => {
    expect(snapTune({ size: 1.03, length: 0.98, x: 0.3, y: 3.2, sides: "both" })).toEqual({
      size: 1, length: 1, x: 0, y: 3, sides: "both",
    });
    expect(snapTune({ size: 1.62, length: 0.52, x: 4.7, y: -2.3, sides: "left" })).toEqual({
      size: 1.6, length: 0.5, x: 4.5, y: -2.5, sides: "left",
    });
  });
  it("is caught on the screen's edge, at the side and from top to bottom", () => {
    const edge = { x: -0.8, y: null, length: 100 / 98.8 };
    expect(snapTune({ size: 1, length: 1.009, x: -0.7, y: 0, sides: "both" }, edge)).toEqual({
      size: 1, length: 1.012, x: -0.8, y: 0, sides: "both",
    });
    // Nearer its usual place than the edge: back there.
    expect(snapTune({ size: 1, length: 1.003, x: -0.3, y: 0, sides: "both" }, edge)).toMatchObject({ length: 1, x: 0 });
  });
});
