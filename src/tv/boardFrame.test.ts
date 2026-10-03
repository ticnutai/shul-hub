import { describe, expect, it } from "vitest";
import { BOARD_FRAMES, normalizeTvConfig } from "./config";
import { BOARD_FRAME_KNOBS, boardFramePieces, boardFrameVars, dragTune, normalizeBoardFrameTune } from "./boardFrame";

describe("the board's frame, moved and sized by hand", () => {
  it("is as drawn until somebody moves it", () => {
    expect(normalizeTvConfig({}).boardFrameTune).toEqual({ size: 1, length: 1, x: 0, y: 0, sides: "both" });
  });

  it("keeps what was set, inside its limits, and drops rubbish", () => {
    expect(normalizeBoardFrameTune({ size: 1.6, length: 0.5, x: 4, y: -3, sides: "right" })).toEqual({
      size: 1.6, length: 0.5, x: 4, y: -3, sides: "right",
    });
    expect(normalizeBoardFrameTune({ size: 99, length: 0, x: -5, y: "up", sides: "middle" })).toEqual({
      size: 2.5, length: 0.2, x: 0, y: 0, sides: "both",
    });
  });

  it("columns and curtains stand on the sides chosen; beams always top and bottom", () => {
    expect(boardFramePieces("columns", "both")).toHaveLength(2);
    expect(boardFramePieces("columns", "left")).toEqual(["tv-bf-column is-left"]);
    expect(boardFramePieces("heichal", "right")).toEqual(["tv-bf-column is-right", "tv-bf-beam is-top", "tv-bf-beam is-bottom"]);
    expect(boardFramePieces("beams", "left")).toHaveLength(2);
  });

  it("every frame has its pieces and names its knobs", () => {
    for (const f of BOARD_FRAMES) {
      expect(boardFramePieces(f, "both").length).toBeGreaterThan(0);
      expect(BOARD_FRAME_KNOBS[f].size).toBeTruthy();
    }
  });

  it("is written as the variables the board draws from", () => {
    expect(boardFrameVars({ size: 1.5, length: 0.8, x: 2, y: -1, sides: "both" })).toEqual({
      "--bf-s": "1.5", "--bf-l": "0.8", "--bf-x": "calc(var(--u) * 2)", "--bf-y": "calc(var(--u) * -1)",
    });
  });
});

describe("a drag on a piece of the board's frame", () => {
  const t0 = { size: 1, length: 1, x: 0, y: 0, sides: "both" as const };
  const at = { u: 10, width: 1600, height: 1000, fromRight: false, fromBottom: false };

  it("moves a column: toward the middle is further from its side, and down is down", () => {
    expect(dragTune("tv-bf-column is-right", null, t0, { ...at, dx: -40, dy: 30 })).toMatchObject({ x: 4, y: 3 });
    expect(dragTune("tv-bf-column is-left", null, t0, { ...at, dx: 40, dy: 0 })).toMatchObject({ x: 4 });
  });

  it("widens a column by its inner edge, and lengthens it by an end", () => {
    expect(dragTune("tv-bf-column is-right", "size", t0, { ...at, dx: -64, dy: 0 }).size).toBe(2);
    const shorter = dragTune("tv-bf-column is-left", "len-b", t0, { ...at, dx: 0, dy: -198 });
    expect(shorter.length).toBeCloseTo(0.8, 2);
    // Its top stays where it was: the middle follows the end that moved.
    expect(shorter.y).toBeCloseTo(-9.9, 1);
  });

  it("a beam moves away from its own edge, and grows along it", () => {
    expect(dragTune("tv-bf-beam is-bottom", null, t0, { ...at, dx: 0, dy: -50 }).y).toBe(5);
    expect(dragTune("tv-bf-beam is-top", "len-b", { ...t0, length: 0.5 }, { ...at, dx: 160, dy: 0 }).length).toBeCloseTo(0.7, 2);
  });

  it("stays inside the limits however far it is dragged", () => {
    expect(dragTune("tv-bf-column is-right", "size", t0, { ...at, dx: -5000, dy: 0 }).size).toBe(2.5);
    expect(dragTune("tv-bf-column is-right", null, t0, { ...at, dx: 5000, dy: 0 }).x).toBe(0);
  });
});
