import { describe, expect, it } from "vitest";
import { normalizeTvConfig, FRAME_SHAPES, CORNER_SHAPE } from "./config";
import { DEFAULT_BACKGROUND_TUNE, DEFAULT_FRAME_STYLE, isSafeLayerFill, normalizeBackgroundTune, normalizeFrameStyle } from "./layers";
import { fillCss, isPictureFill, layerVars, tuneFilter } from "./layerCss";

describe("the layers: background adjustments and every frame's dress", () => {
  it("leave a board that never set them exactly as it was", () => {
    const c = normalizeTvConfig({});
    expect(c.backgroundTune).toEqual(DEFAULT_BACKGROUND_TUNE);
    expect(c.frameStyle).toEqual(DEFAULT_FRAME_STYLE);
    expect(layerVars(c.backgroundTune, c.frameStyle)).toEqual({ vars: {}, classes: "" });
  });

  it("keep only safe values, within range", () => {
    expect(normalizeBackgroundTune({ brightness: 9, saturation: -1, hue: 999, blur: 50, tint: "red;x", tintStrength: 3 })).toEqual({
      brightness: 1.4, saturation: 0, hue: 180, blur: 10, tint: null, tintStrength: 1,
    });
    const f = normalizeFrameStyle({
      fill: "url(javascript:alert(1))", fillOpacity: 2, line: "#c9a227", lineWidth: 99, depth: -1,
      image: "http://insecure.example/frame.png", imageSlice: 90, imageWidth: 0,
    });
    expect(f).toMatchObject({ fill: null, fillOpacity: 1, line: "#c9a227", lineWidth: 6, depth: 0, image: null, imageSlice: 45, imageWidth: 0.5 });
  });

  it("accept a colour, a gradient, a ready picture or an uploaded one as a fill", () => {
    expect(isSafeLayerFill("#5a1a2a")).toBe(true);
    expect(isSafeLayerFill("linear-gradient(180deg, #102040, #203060)")).toBe(true);
    expect(isSafeLayerFill("backdrop:clouds")).toBe(true);
    expect(isSafeLayerFill("https://example.supabase.co/storage/v1/object/public/x.png")).toBe(true);
    expect(isSafeLayerFill("backdrop:../../etc")).toBe(false);
    expect(isSafeLayerFill("http://example.com/x.png")).toBe(false);
  });

  it("fade a colour or a gradient, and leave a picture whole", () => {
    expect(fillCss("#ffffff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    expect(fillCss("linear-gradient(180deg, #000000, #ffffff)", 0.5)).toBe(
      "linear-gradient(180deg, rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.5))",
    );
    expect(fillCss("https://example.com/p.png", 0.5)).toBe('url("https://example.com/p.png") center / cover no-repeat');
    expect(fillCss("backdrop:clouds")).toMatch(/^url\(".+"\) center \/ cover no-repeat$/);
    expect(fillCss("backdrop:nope")).toBeNull();
    expect(isPictureFill("backdrop:clouds")).toBe(true);
    expect(isPictureFill("#ffffff")).toBe(false);
  });

  it("switch each rule on only when it is set", () => {
    const { vars, classes } = layerVars(
      { ...DEFAULT_BACKGROUND_TUNE, brightness: 1.2, blur: 4 },
      { ...DEFAULT_FRAME_STYLE, fill: "#123456", line: "#c9a227", depth: 0.5, image: "https://example.com/f.png" },
    );
    expect(classes.trim().split(" ").sort()).toEqual(
      ["has-bg-tune", "has-frame-depth", "has-frame-fill", "has-frame-image", "has-frame-line"].sort(),
    );
    expect(vars["--tv-bg-filter"]).toBe("brightness(1.2) blur(calc(var(--u) * 0.40))");
    expect(vars["--frame-fill"]).toBe("#123456");
    expect(vars["--frame-image-slice"]).toBe("30%");
    expect(tuneFilter(DEFAULT_BACKGROUND_TUNE)).toBeNull();
  });

  it("offer the arch among the frame shapes", () => {
    expect(FRAME_SHAPES).toContain("arch");
    expect(CORNER_SHAPE.arch).toBe("round");
  });
});
