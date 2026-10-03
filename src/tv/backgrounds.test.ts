import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "./config";
import { applyBackground, backgroundOf, builtinBackgrounds, flatFill, galleryOf, kindOf, wears, wearsExactly } from "./backgrounds";
import { themeStyle } from "./themes";

const board = (patch: Record<string, unknown> = {}): TvConfig => normalizeTvConfig({ ...structuredClone(DEFAULT_TV_CONFIG), ...patch });

describe("one gallery of backgrounds", () => {
  it("offers colours, gradients, pictures and pictures with a layer over them", () => {
    const kinds = new Set(builtinBackgrounds().map(kindOf));
    expect([...kinds].sort()).toEqual(["colour", "gradient", "picture"]);
    expect(builtinBackgrounds().some((b) => b.picture && b.overlay)).toBe(true);
    // Every ready one has its own id, once.
    const ids = builtinBackgrounds().map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("applying one writes the board's own fields, and the board then wears it", () => {
    const pic = builtinBackgrounds().find((b) => b.picture && b.overlay)!;
    const c = applyBackground(board(), pic);
    expect(c.backgroundImage).toBe(pic.picture);
    expect(c.backgroundOverlay).toBe(pic.overlay);
    expect(c.backgroundDim).toBe(pic.strength);
    expect(wears(c, pic)).toBe(true);
    expect(wearsExactly(c, pic)).toBe(true);
    // A colour after it takes the picture and its layer away.
    const navy = builtinBackgrounds().find((b) => kindOf(b) === "colour")!;
    const after = applyBackground(c, navy);
    expect(after.backgroundImage).toBeNull();
    expect(after.backgroundOverlay).toBeNull();
    expect(backgroundOf(after).fill).toBe(navy.fill);
    expect(wears(after, pic)).toBe(false);
  });

  it("keeps the shul's own, checked, and reads the gradients saved before there was a gallery", () => {
    // A board stored before there was a gallery: no "backgrounds" at all.
    const legacy = normalizeTvConfig({ gradients: [{ id: "u_abcd1234", name: "שלי", value: "linear-gradient(90deg, #000000, #ffffff)" }] });
    expect(legacy.backgrounds).toEqual([expect.objectContaining({ id: "b_abcd1234", name: "שלי", fill: "linear-gradient(90deg, #000000, #ffffff)" })]);
    expect(galleryOf(legacy)[0]!.id).toBe("b_abcd1234");

    const c = board({
      backgrounds: [
        { id: "b_good1", name: "טוב", fill: flatFill("#123456"), picture: null, overlay: null, strength: 0.4, tune: {} },
        { id: "b_bad01", name: "רע", fill: "url(javascript:1)", picture: null, overlay: null, strength: 0.4 },
        { id: "b_pic01", name: "תמונה", fill: null, picture: "https://x.test/a.jpg", overlay: "#000000", strength: 2 },
        { id: "nope", name: "בלי מזהה", fill: flatFill("#000000") },
      ],
    });
    expect(c.backgrounds.map((b) => b.id)).toEqual(["b_good1", "b_pic01"]);
    expect(c.backgrounds[1]!.strength).toBe(0.95);
  });

  it("draws the layer over the picture only when there is one", () => {
    expect((themeStyle({ theme: "night", font: "heebo", backgroundOverlay: "linear-gradient(180deg, #000000, #111111)" }) as Record<string, string>)["--tv-bg-overlay"]).toContain("linear-gradient");
    expect((themeStyle({ theme: "night", font: "heebo", backgroundOverlay: "red; }" }) as Record<string, string>)["--tv-bg-overlay"]).toBeUndefined();
  });
});
