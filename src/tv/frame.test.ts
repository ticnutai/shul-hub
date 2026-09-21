import { describe, expect, it } from "vitest";
import {
  CORNER_SHAPE,
  FRAME_RADIUS_MAX,
  FRAME_SHAPES,
  SPACING_EDGES,
  SPACING_MAX,
  normalizeTvConfig,
} from "./config";

/** The admin's corner settings arrive from storage, so they are not trusted. */
describe("frame settings", () => {
  const frameOf = (raw: unknown) => normalizeTvConfig({ frame: raw }).frame;

  it("defaults to the skin's own shape", () => {
    expect(frameOf(undefined)).toEqual({ shape: "auto", top: null, bottom: null });
  });

  it("keeps a real shape and drops an invented one", () => {
    expect(frameOf({ shape: "bevel" }).shape).toBe("bevel");
    expect(frameOf({ shape: "trapezoid" }).shape).toBe("auto");
  });

  it("clamps a radius and rejects anything that is not a number", () => {
    expect(frameOf({ top: 99 }).top).toBe(FRAME_RADIUS_MAX);
    expect(frameOf({ top: -4 }).top).toBe(0);
    expect(frameOf({ top: "8" }).top).toBeNull();
    expect(frameOf({ bottom: Number.NaN }).bottom).toBeNull();
  });

  it("has CSS for every shape except auto", () => {
    for (const shape of FRAME_SHAPES) {
      if (shape === "auto") continue;
      expect(CORNER_SHAPE[shape]).toBeTruthy();
    }
  });
});

/** The air around the panels comes from storage too. */
describe("spacing", () => {
  const spacingOf = (raw: unknown) => normalizeTvConfig({ spacing: raw }).spacing;

  it("defaults to what the layout draws", () => {
    expect(spacingOf(undefined)).toEqual({ top: null, sides: null, gap: null });
  });

  it("clamps each edge and refuses anything that is not a number", () => {
    expect(spacingOf({ top: 99 }).top).toBe(SPACING_MAX);
    expect(spacingOf({ sides: -2 }).sides).toBe(0);
    expect(spacingOf({ gap: "3" }).gap).toBeNull();
  });

  it("covers every edge the board knows", () => {
    const spacing = spacingOf({ top: 1, sides: 2, gap: 3 });
    expect(Object.keys(spacing).sort()).toEqual([...SPACING_EDGES].sort());
  });
});
