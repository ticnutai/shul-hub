import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, ILLUSTRATIONS, normalizeTvConfig } from "./config";
import { ILLUSTRATED_ROWS, ILLUSTRATION_DEFS, illustrationDef, rowWindow, todaysRows } from "./illustrated";

describe("the illustrated layout's config", () => {
  it("is a layout like the others, with a painted board to choose", () => {
    const c = normalizeTvConfig({ ...DEFAULT_TV_CONFIG, screenLayout: "illustrated", illustration: "wood" });
    expect(c.screenLayout).toBe("illustrated");
    expect(c.illustration).toBe("wood");
  });

  it("falls back to the curtain for anything it does not know", () => {
    expect(normalizeTvConfig({ illustration: "url(x)" }).illustration).toBe("curtain");
    expect(DEFAULT_TV_CONFIG.illustration).toBe("curtain");
  });
});

describe("the painted boards", () => {
  it("has a picture's worth of frames for every board, inside the picture", () => {
    expect(ILLUSTRATION_DEFS.map((d) => d.id)).toEqual([...ILLUSTRATIONS]);
    for (const d of ILLUSTRATION_DEFS) {
      for (const [x1, y1, x2, y2] of Object.values(d.boxes)) {
        expect(x1).toBeGreaterThanOrEqual(0);
        expect(y1).toBeGreaterThanOrEqual(0);
        expect(x2).toBeLessThanOrEqual(100);
        expect(y2).toBeLessThanOrEqual(100);
        expect(x2).toBeGreaterThan(x1);
        expect(y2).toBeGreaterThan(y1);
      }
    }
    expect(illustrationDef("stone").name).toBe("לוחות הברית מאבן");
  });
});

describe("which minyanim a painted frame shows", () => {
  it("shows them all when they fit", () => {
    expect(rowWindow(5, 2)).toEqual([0, 5]);
  });

  it("starts the day at the first minyan", () => {
    expect(rowWindow(14, 0)).toEqual([0, ILLUSTRATED_ROWS]);
  });

  it("keeps the one just gone and the ones coming", () => {
    // Fourteen minyanim, the next is the sixth: the fifth stays for latecomers.
    expect(rowWindow(14, 5)).toEqual([4, 11]);
  });

  it("ends the day on the last minyanim", () => {
    expect(rowWindow(14, 13)).toEqual([7, 14]);
    expect(rowWindow(14, -1)).toEqual([7, 14]);
  });
});

describe("the painted board's editing options", () => {
  it("keeps sizes, rows and inks in range", () => {
    const c = normalizeTvConfig({ illustratedStyle: { scale: 9, rows: 2, ink: "#123456", accent: "red", clockInk: "url(x)" } });
    expect(c.illustratedStyle).toEqual({ scale: 1.3, rows: 4, ink: "#123456", accent: null, clockInk: null });
    expect(DEFAULT_TV_CONFIG.illustratedStyle).toEqual({ scale: 1, rows: 7, ink: null, accent: null, clockInk: null });
  });

  it("windows the minyanim by the chosen number of rows", () => {
    expect(rowWindow(14, 5, 5)).toEqual([4, 9]);
  });
});

describe("today's minyanim in one painted frame", () => {
  it("takes every prayer schedule on the board, in time order (סליחות on a Friday)", () => {
    const row = (id: string, minutes: number) => ({ minyan: { id, label: id }, minutes, time: "", cancelled: false }) as never;
    const slides = [
      { id: "prayer:friday", kind: "prayer", title: "יום שישי", rows: [row("shacharit", 510)], subcategories: [], seconds: 20, layout: "split" },
      { id: "prayer:slichot", kind: "prayer", title: "סליחות", rows: [row("slichot", 480), row("shacharit", 510)], subcategories: [], seconds: 20, layout: "split" },
      { id: "learning", kind: "learning", seconds: 15, layout: "cards" },
    ] as never;
    expect(todaysRows(slides).map((r) => r.minyan.id)).toEqual(["slichot", "shacharit"]);
  });
});
