import { describe, expect, it } from "vitest";
import { FRAME_SHAPES, normalizeTvConfig } from "./config";
import { normalizeFrameLooks } from "./frameLooks";
import { framePictureRef } from "./framePictures";
import { frameLookProps } from "./layerCss";

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
