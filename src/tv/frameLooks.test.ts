import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, configForDevice, editForDevice, normalizeTvConfig } from "./config";
import { makeBoardEdit } from "./boardEdit";
import { frameLookCss, normalizeFrameLooks, setFrameLook } from "./frameLooks";
import { THEME_VARS, THEME_VAR_LAYERS } from "./themes";

describe("frame looks", () => {
  it("keeps only known frames and safe colours", () => {
    const looks = normalizeFrameLooks({
      prayers: { bg: "#5a1a2a", text: "#ffffff", accent: "red; background:url(x)", line: "#c9a227" },
      zmanim: { bg: "linear-gradient(180deg, #102040, #203060)" },
      clock: { bg: "url(https://evil.example/x.png)" },
      nowhere: { bg: "#000000" },
    });
    expect(looks).toEqual({
      prayers: { bg: "#5a1a2a", text: "#ffffff", line: "#c9a227" },
      zmanim: { bg: "linear-gradient(180deg, #102040, #203060)" },
    });
  });

  it("a board saved before frame looks has none, and loads unchanged", () => {
    expect(normalizeTvConfig({}).frameLooks).toEqual({});
    expect(DEFAULT_TV_CONFIG.frameLooks).toEqual({});
  });

  it("clearing the last field drops the frame", () => {
    const one = setFrameLook({}, "prayers", { bg: "#5a1a2a" });
    expect(one).toEqual({ prayers: { bg: "#5a1a2a" } });
    expect(setFrameLook(one, "prayers", { bg: null })).toEqual({});
  });

  it("dresses one frame through the theme's own variables", () => {
    const css = frameLookCss({ bg: "#5a1a2a", text: "#ffffff", accent: "#f0c35c" }) as Record<string, string>;
    expect(css.background).toBe("#5a1a2a");
    expect(css["--tv-panel"]).toBe("#5a1a2a");
    expect(css["--tv-text"]).toBe("#ffffff");
    expect(css["--tv-text-dim"]).toBe("#ffffff");
    expect(css["--tv-accent"]).toBe("#f0c35c");
    expect(frameLookCss(undefined)).toBeUndefined();
  });

  it("reaches that frame on the board and no other, under the element's own look", () => {
    const config = normalizeTvConfig({
      frameLooks: { prayers: { bg: "#5a1a2a" } },
      styles: { "panel.zmanim": { color: "#123456" } },
    });
    const edit = makeBoardEdit(config, true);
    expect(edit.frame("prayers").style).toMatchObject({ background: "#5a1a2a" });
    expect(edit.frame("prayers")["data-frame"]).toBe("prayers");
    const zmanim = edit.frame("zmanim", "panel.zmanim");
    expect(zmanim.style).toEqual({ color: "#123456" });
    expect(zmanim["data-edit"]).toBe("panel.zmanim");
  });

  it("one kind of screen can dress a frame differently", () => {
    const edited = editForDevice(normalizeTvConfig({}), "mobile", (c) => ({
      ...c,
      frameLooks: setFrameLook(c.frameLooks, "clock", { text: "#ffffff" }),
    }));
    expect(edited.frameLooks).toEqual({});
    expect(configForDevice(edited, "mobile").frameLooks).toEqual({ clock: { text: "#ffffff" } });
    // and it survives a save and a load
    expect(configForDevice(normalizeTvConfig(JSON.parse(JSON.stringify(edited))), "mobile").frameLooks).toEqual({
      clock: { text: "#ffffff" },
    });
  });
});

describe("theme colours by layer", () => {
  it("puts every colour under exactly one layer", () => {
    const listed = Object.values(THEME_VAR_LAYERS).flat();
    expect([...listed].sort()).toEqual([...THEME_VARS].sort());
    expect(new Set(listed).size).toBe(listed.length);
  });
});
