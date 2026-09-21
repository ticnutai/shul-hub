import { describe, expect, it } from "vitest";
import { CORNER_SHAPE, FRAME_RADIUS_MAX, FRAME_SHAPES, normalizeTvConfig } from "./config";

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
