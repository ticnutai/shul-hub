import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "./config";
import { builtinBackgrounds, galleryOf, hiddenBackgrounds } from "./backgrounds";
import { hideReady, isHiddenReady, showReady } from "./readyItems";

describe("whatever can be added can be removed", () => {
  it("hides a ready item from its list, and brings it back", () => {
    const c = normalizeTvConfig(structuredClone(DEFAULT_TV_CONFIG));
    const first = builtinBackgrounds()[0]!;
    const hidden = hideReady(c, "bg", first.id);
    expect(isHiddenReady(hidden, "bg", first.id)).toBe(true);
    expect(galleryOf(hidden).some((b) => b.id === first.id)).toBe(false);
    expect(hiddenBackgrounds(hidden).map((b) => b.id)).toEqual([first.id]);
    const back = showReady(hidden, "bg", first.id);
    expect(galleryOf(back).some((b) => b.id === first.id)).toBe(true);
    // A frame's id is its stored reference already.
    expect(hideReady(c, "frame", "frame:rope").hiddenReady).toEqual(["frame:rope"]);
  });

  it("keeps only real keys from storage, once each", () => {
    const c = normalizeTvConfig({ hiddenReady: ["bg:x_c_navy", "bg:x_c_navy", "theme:night", "evil:<script>", 7, "frame:rope"] });
    expect(c.hiddenReady).toEqual(["bg:x_c_navy", "theme:night", "frame:rope"]);
  });
});
