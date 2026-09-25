import { describe, expect, it } from "vitest";
import { DEFAULT_ILLUSTRATED_STYLE, normalizeTvConfig } from "./config";
import { ILLUSTRATED_PRESETS } from "./illustratedPresets";

describe("ready palettes for painted boards", () => {
  it("are all valid as stored, and survive saving unchanged", () => {
    const ids = new Set<string>();
    for (const pr of ILLUSTRATED_PRESETS) {
      expect(ids.has(pr.id)).toBe(false);
      ids.add(pr.id);
      const style = { ...DEFAULT_ILLUSTRATED_STYLE, ...pr.style };
      expect(normalizeTvConfig({ illustratedStyle: style }).illustratedStyle).toEqual(style);
    }
  });

  it("include grey, mocha and dark ones, and one that goes back to the picture", () => {
    const names = ILLUSTRATED_PRESETS.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(["כמו בציור", "אבן אפורה", "מוקה", "שוקולד כהה", "פחם"]));
    const original = ILLUSTRATED_PRESETS.find((p) => p.id === "original")!.style;
    expect({ ...DEFAULT_ILLUSTRATED_STYLE, ...original }).toEqual(DEFAULT_ILLUSTRATED_STYLE);
  });

  it("puts light text on the dark ones", () => {
    const light = (hex: string) => parseInt(hex.slice(1, 3), 16) > 200;
    for (const id of ["chocolate", "charcoal", "night"]) {
      const s = ILLUSTRATED_PRESETS.find((p) => p.id === id)!.style;
      expect(light(s.ink!)).toBe(true);
      expect(s.brightness).toBeLessThan(1);
    }
  });
});
