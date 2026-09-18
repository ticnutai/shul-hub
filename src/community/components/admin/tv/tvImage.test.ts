import { describe, expect, it } from "vitest";
import { fitForTv } from "./tvImage";

describe("fitForTv", () => {
  it("shrinks a 12 MP phone photo to just cover the 2400x1350 box", () => {
    expect(fitForTv(4032, 3024)).toEqual({ width: 2400, height: 1800, lowRes: false });
  });

  it("never enlarges a small image, and flags it as soft on the TV", () => {
    expect(fitForTv(1280, 720)).toEqual({ width: 1280, height: 720, lowRes: true });
  });

  it("keeps a Full HD image as is without a warning", () => {
    expect(fitForTv(1920, 1080)).toEqual({ width: 1920, height: 1080, lowRes: false });
  });

  it("sizes a portrait flyer by its width, since cover fills the width", () => {
    expect(fitForTv(3000, 4000)).toEqual({ width: 2400, height: 3200, lowRes: false });
  });

  it("caps very long images at the GPU texture limit", () => {
    const r = fitForTv(3000, 12000);
    expect(Math.max(r.width, r.height)).toBeLessThanOrEqual(4096);
  });
});
