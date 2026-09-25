import { describe, expect, it } from "vitest";
import { DEFAULT_ILLUSTRATED_STYLE, normalizeTvConfig, type IllustratedStyle } from "./config";
import { illustratedLayers, isNeutral, stoneMask } from "./illustratedAdjust";
import { ILLUSTRATION_DEFS } from "./illustrated";

const boxes = ILLUSTRATION_DEFS.find((d) => d.id === "stone")!.boxes;
const look = (p: Partial<IllustratedStyle>): IllustratedStyle => ({ ...DEFAULT_ILLUSTRATED_STYLE, ...p });

describe("picture adjustments on a painted board", () => {
  it("changes nothing by default", () => {
    expect(isNeutral(DEFAULT_ILLUSTRATED_STYLE)).toBe(true);
    expect(illustratedLayers(boxes, DEFAULT_ILLUSTRATED_STYLE)).toEqual({ picture: {}, stone: null, frames: [] });
  });

  it("filters the picture's own layer only when asked", () => {
    const l = illustratedLayers(boxes, look({ brightness: 1.2, saturation: 0.5, hue: 30 }));
    expect(l.picture.filter).toBe("brightness(1.2) saturate(0.5) hue-rotate(30deg)");
  });

  it("colours the stones outside the frames, keeping their light and shade", () => {
    const l = illustratedLayers(boxes, look({ stoneTint: "#aa3322", stoneTintStrength: 0.4 }));
    expect(l.stone).toMatchObject({ background: "#aa3322", opacity: 0.4, mixBlendMode: "color" });
    const mask = decodeURIComponent(String(l.stone!.maskImage));
    // The whole picture, with a hole for each panel and plaque and the clock.
    expect(mask).toContain("M0 0H100V100H0Z");
    expect(mask.match(/M\d/g)!.length).toBe(1 + 4 + 1);
  });

  it("gives the frames a background, a line and depth, arched when asked", () => {
    const l = illustratedLayers(boxes, look({ frameFill: "#ffffff", frameFillOpacity: 0.5, frameLine: "#000000", frameDepth: 1, frameShape: "arch" }));
    const panel = l.frames.find((f) => f.key === "panelR")!.style;
    expect(panel.background).toBe("rgba(255, 255, 255, 0.5)");
    expect(String(panel.border)).toContain("#000000");
    expect(String(panel.boxShadow)).toContain("inset");
    expect(String(panel.borderRadius)).toContain("50% 50%");
    // Plaques stay rectangles even with arched panels.
    expect(String(l.frames.find((f) => f.key === "plaqueR")!.style.borderRadius)).toBe("0.4cqw");
    expect(decodeURIComponent(stoneMask(boxes, look({ frameShape: "arch" })))).toContain("A");
  });

  it("stores only safe values, within range", () => {
    const s = normalizeTvConfig({
      illustratedStyle: {
        brightness: 9, saturation: -1, hue: 400, stoneTint: "red; background:url(x)", frameFill: "#FFAA00",
        frameDepth: 3, frameLineWidth: 99, frameShape: "weird",
      },
    }).illustratedStyle;
    expect(s).toMatchObject({ brightness: 1.4, saturation: 0, hue: 180, stoneTint: null, frameFill: "#FFAA00", frameDepth: 1, frameLineWidth: 6, frameShape: "rect" });
    // An older saved board (only size, rows and inks) reads as neutral.
    expect(isNeutral(normalizeTvConfig({ illustratedStyle: { scale: 1.2, rows: 7 } }).illustratedStyle)).toBe(true);
  });
});
