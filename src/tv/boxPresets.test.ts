import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, FRAME_SHAPES, normalizeTvConfig, type TvConfig } from "./config";
import { BOX_PRESETS, applyBoxPreset, wearsBoxPreset } from "./boxPresets";
import { normalizeFrameLooks } from "./frameLooks";
import { framePictureRef } from "./framePictures";
import { frameLookProps } from "./layerCss";

const board = (): TvConfig => normalizeTvConfig(structuredClone(DEFAULT_TV_CONFIG));

describe("box shapes", () => {
  it("offers the whole box's shapes beside the corners', with no triangle", () => {
    for (const s of ["pill", "ellipse", "hexagon", "octagon"]) expect(FRAME_SHAPES).toContain(s);
    expect(FRAME_SHAPES.some((s) => /triangle|משולש/.test(s))).toBe(false);
  });

  it("lets one box have a shape and a frame picture of its own, and keeps only real ones", () => {
    const looks = normalizeFrameLooks({
      prayers: { shape: "hexagon", image: framePictureRef("double-gold") },
      zmanim: { shape: "triangle", image: "javascript:alert(1)" },
      clock: { image: "https://x.test/frame.png" },
    });
    expect(looks.prayers).toEqual({ shape: "hexagon", image: "frame:double-gold" });
    expect(looks.zmanim).toBeUndefined();
    expect(looks.clock).toEqual({ image: "https://x.test/frame.png" });

    const props = frameLookProps(looks.prayers);
    expect(props["data-shape"]).toBe("hexagon");
    expect(props["data-own-image"]).toBe("");
    expect((props.style as Record<string, string>)["--frame-image"]).toContain("data:image/svg+xml");
  });

  it("keeps uploaded frames in their gallery, checked", () => {
    const c = normalizeTvConfig({ frameUploads: ["https://x.test/a.png", "https://x.test/a.png", "http://x.test/b.png", 5] });
    expect(c.frameUploads).toEqual(["https://x.test/a.png"]);
  });
});

describe("ready boxes", () => {
  it("dress every box: its shape, its line, its depth and its frame picture together", () => {
    const hexagon = BOX_PRESETS.find((p) => p.id === "hexagon-gold")!;
    const c = applyBoxPreset(board(), hexagon, null);
    expect(c.frame.shape).toBe("hexagon");
    expect(c.frameStyle.line).toBe(hexagon.line);
    expect(c.frameStyle.depth).toBe(hexagon.depth);
    expect(wearsBoxPreset(c, hexagon, null)).toBe(true);

    const ornate = BOX_PRESETS.find((p) => p.id === "ornate")!;
    const framed = applyBoxPreset(c, ornate, null);
    expect(framed.frameStyle.image).toBe(framePictureRef("gold-ornate"));
    expect(framed.frameStyle.imageSlice).toBe(32);
    expect(wearsBoxPreset(framed, hexagon, null)).toBe(false);
  });

  it("or one box, leaving the others as they were", () => {
    const pill = BOX_PRESETS.find((p) => p.id === "soft-pill")!;
    const before = board();
    const c = applyBoxPreset(before, pill, "zmanim");
    expect(c.frameLooks.zmanim?.shape).toBe("pill");
    expect(c.frame).toEqual(before.frame);
    expect(c.frameStyle).toEqual(before.frameStyle);
    expect(c.frameLooks.prayers).toBeUndefined();
    expect(wearsBoxPreset(c, pill, "zmanim")).toBe(true);
    expect(wearsBoxPreset(c, pill, "prayers")).toBe(false);
  });
});
