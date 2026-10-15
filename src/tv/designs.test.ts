import { describe, expect, it } from "vitest";
import { normalizeTvConfig } from "./config";
import { applyDesign, BUILTIN_DESIGNS, captureDesign, coloursOnScreen, findDesign, PAINTED_BOARD_LOOKS } from "./designs";
import { getTheme } from "./themes";

const board = () =>
  normalizeTvConfig({
    theme: "navy",
    boardFrame: "columns",
    font: "classic",
    backgroundGradient: "linear-gradient(180deg, #102040, #203060)",
    backgroundTune: { brightness: 1.2 },
    frameStyle: { fill: "#1c2f52", line: "#c9a227" },
    frameLooks: { zmanim: { bg: "#5a1a2a", text: "#ffeeaa" } },
    themeOverrides: { "--tv-text": "#fafafa", "--tv-bg-a": "#010203" },
    screenLayout: "dashboard",
  });

describe("saved designs", () => {
  it('replaces old decoration without changing content, in a kit of parts',()=>{
    const original=normalizeTvConfig({...board(),texts:{'header.title':'תוכן קיים'},styles:{'header.title':{x:20,scale:2}},titleStyle:'ribbon'});
    const changed=applyDesign(original,findDesign(original,'d_sapphirelayers')!);
    expect(changed.styles).toEqual({});
    expect(changed.frameLooks).toEqual({});
    expect(changed.titleStyle).toBe('plain');
    expect(changed.texts).toEqual(original.texts);
    expect(changed.screens).toEqual(original.screens);
    expect(changed.logos).toEqual(original.logos);
  });
  it("carry only the parts they were saved with", () => {
    const d = captureDesign(board(), "רקע לילה", ["background"]);
    expect(d.parts).toEqual(["background"]);
    expect(d.values.backgroundGradient).toContain("#102040");
    expect(d.values.backgroundTune?.brightness).toBe(1.2);
    expect(d.values.boardFrame).toBeUndefined();
    expect(d.values.font).toBeUndefined();
    expect(d.values.frameStyle?.fill).toBe("#1c2f52");
    expect(d.values.frameStyle?.line).toBeNull();
    expect(d.values.frameLooks).toEqual({ zmanim: { bg: "#5a1a2a" } });
    expect(Object.keys(d.colours).sort()).toEqual(["--tv-bg-a", "--tv-bg-b", "--tv-bg-c"]);
    expect(d.colours["--tv-bg-a"]).toBe("#010203");
  });

  it("change those parts when applied, and leave the rest exactly as it was", () => {
    const d = captureDesign(board(), "רקע לילה", ["background"]);
    const other = normalizeTvConfig({
      theme: "forest",
      boardFrame: "beams",
      font: "modern",
      frameStyle: { line: "#ffffff" },
      frameLooks: { zmanim: { text: "#000000" } },
      screenLayout: "rotate",
    });
    const before = coloursOnScreen(other);
    const after = applyDesign(other, d);
    // The design's parts...
    expect(after.backgroundGradient).toContain("#102040");
    expect(after.backgroundTune.brightness).toBe(1.2);
    expect(after.frameStyle.fill).toBe("#1c2f52");
    expect(coloursOnScreen(after)["--tv-bg-a"]).toBe("#010203");
    // ...and nothing else.
    expect(after.boardFrame).toBe("beams");
    expect(after.font).toBe("modern");
    expect(after.screenLayout).toBe("rotate");
    expect(after.frameStyle.line).toBe("#ffffff");
    expect(after.frameLooks.zmanim).toEqual({ bg: "#5a1a2a", text: "#000000" });
    expect(coloursOnScreen(after)["--tv-text"]).toBe(before["--tv-text"]);
    expect(coloursOnScreen(after)["--tv-accent"]).toBe(before["--tv-accent"]);
  });

  it("of everything, put the whole look back", () => {
    const b = board();
    const d = captureDesign(b, "הכל", ["background", "frames", "text", "layout"]);
    const after = applyDesign(normalizeTvConfig({ theme: "forest" }), d);
    for (const k of ["skin", "font", "backgroundGradient", "screenLayout", "frameStyle", "frameLooks"] as const) {
      expect(after[k]).toEqual(b[k]);
    }
    expect(coloursOnScreen(after)).toEqual(coloursOnScreen(b));
  });

  it("survive saving and loading, and nothing unsafe gets through", () => {
    const d = captureDesign(board(), "שמור", ["background", "text"]);
    const loaded = normalizeTvConfig({ designs: [JSON.parse(JSON.stringify(d))] }).designs;
    expect(loaded).toEqual([d]);
    const bad = normalizeTvConfig({
      designs: [
        { id: "d_evil1", name: "x", parts: ["background"], colours: { "--tv-bg-a": "red;}" }, values: { backgroundGradient: "url(javascript:1)" } },
        { id: "no", name: "bad id", parts: ["text"], values: {} },
        { id: "d_empty1", name: "no parts", parts: [], values: {} },
      ],
    }).designs;
    expect(bad).toHaveLength(1);
    expect(bad[0].colours).toEqual({});
    expect(bad[0].values.backgroundGradient).toBeNull();
  });
});

describe("a ready-made design laid over a board", () => {
  it("brings its whole ground: a colour it does not name comes from its own theme, not the board under it", () => {
    // A navy board dressed in a stone kit.
    const navy = normalizeTvConfig({ theme: "navy", themeOverrides: { "--tv-text": "#f3f5f8" } });
    const stone = findDesign(navy, "d_premium_jerusalem-stone")!;
    const dressed = applyDesign(navy, stone);
    const ground = coloursOnScreen(dressed)["--tv-bg-a"];
    expect(ground).toBe(getTheme("stone", []).vars["--tv-bg-a"]);
    expect(ground).not.toBe(getTheme("navy", []).vars["--tv-bg-a"]);
    // What it does name, it keeps.
    expect(coloursOnScreen(dressed)["--tv-text"]).toBe(stone.colours["--tv-text"]);
  });
});

describe("the kits on offer", () => {
  it("are all of parts: the old ones not built of parts are gone (an old painted board is still moved onto its look)", () => {
    for (const id of ["d_curtain", "d_stone", "d_wood", "d_modern", "d_sapphireparts"]) expect(BUILTIN_DESIGNS.some((d) => d.id === id)).toBe(false);
    expect(BUILTIN_DESIGNS.every((d) => d.values.screenLayout === "composition" || (d.values.elements?.length ?? 0) > 0)).toBe(true);
    expect(PAINTED_BOARD_LOOKS.map((d) => d.id)).toEqual(["d_curtain", "d_stone", "d_wood", "d_modern"]);
  });
});
