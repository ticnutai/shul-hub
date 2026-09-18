import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "./config";
import { elementStyleCss, makeBoardEdit, setElementStyle } from "./boardEdit";
import { allThemes, getTheme, isLightColor, themeStyle } from "./themes";

const base = (): TvConfig => structuredClone(DEFAULT_TV_CONFIG);
const vars = {
  "--tv-bg-a": "#101010",
  "--tv-bg-b": "#202020",
  "--tv-bg-c": "#303030",
  "--tv-accent": "#ffcc00",
  "--tv-accent-2": "#cc9900",
  "--tv-text": "#ffffff",
  "--tv-text-dim": "#aaaaaa",
  "--tv-panel": "rgba(255, 255, 255, 0.05)",
  "--tv-on-accent": "#101010",
  "--tv-pinned": "#ff8800",
};

describe("custom themes", () => {
  it("normalize keeps a complete safe theme and selects it", () => {
    const c = normalizeTvConfig({ theme: "c_abcd1234", customThemes: [{ id: "c_abcd1234", name: "חגים", vars }] });
    expect(c.customThemes).toHaveLength(1);
    expect(c.theme).toBe("c_abcd1234");
    expect(getTheme(c.theme, c.customThemes).name).toBe("חגים");
    expect(allThemes(c.customThemes).map((t) => t.id)).toContain("c_abcd1234");
  });

  it("drops themes with a bad id, an unsafe colour or a missing variable; a deleted theme falls back", () => {
    const c = normalizeTvConfig({
      theme: "c_gone",
      customThemes: [
        { id: "navy", name: "x", vars }, // built-in id
        { id: "c_bad0000", name: "x", vars: { ...vars, "--tv-accent": "url(javascript:1)" } },
        { id: "c_missing0", name: "x", vars: { ...vars, "--tv-pinned": undefined } },
        { id: "c_ok0000", name: "y".repeat(80), vars },
      ],
    });
    expect(c.customThemes.map((t) => t.id)).toEqual(["c_ok0000"]);
    expect(c.customThemes[0].name).toHaveLength(40);
    expect(c.theme).toBe("navy");
  });

  it("themeStyle renders a custom theme's colours", () => {
    const c = normalizeTvConfig({ theme: "c_abcd1234", customThemes: [{ id: "c_abcd1234", name: "x", vars }] });
    const style = themeStyle({ theme: c.theme, customThemes: c.customThemes, font: "classic" }) as Record<string, string>;
    expect(style["--tv-accent"]).toBe("#ffcc00");
  });

  it("isLightColor tells light from dark backgrounds", () => {
    expect(isLightColor("#faf6ec")).toBe(true);
    expect(isLightColor("#0b1628")).toBe(false);
    expect(isLightColor("rgba(1,2,3,0.5)")).toBe(false);
  });
});

describe("element styles", () => {
  it("normalize clamps and drops defaults, unsafe colours and bad keys", () => {
    const c = normalizeTvConfig({
      styles: {
        "header.title": { scale: 9, color: "#ff0000", x: -120, y: 0 },
        "zman.alot": { scale: 1, color: "expression(1)" },
        "bad key": { scale: 1.2 },
      },
    });
    expect(c.styles).toEqual({ "header.title": { scale: 2, color: "#ff0000", x: -50 } });
  });

  it("setElementStyle merges, and removes the entry when everything is back to default", () => {
    let c = setElementStyle(base(), "header.title", { scale: 1.2 });
    c = setElementStyle(c, "header.title", { x: 3 });
    expect(c.styles["header.title"]).toEqual({ scale: 1.2, x: 3 });
    c = setElementStyle(c, "header.title", { scale: 1, x: 0 });
    expect(c.styles).toEqual({});
    expect(setElementStyle(setElementStyle(base(), "k", { color: "#fff" }), "k", null).styles).toEqual({});
  });

  it("renders as --fs, color and a screen-percent translate, on the TV as well as while editing", () => {
    const css = elementStyleCss({ scale: 1.5, color: "#ff0000", x: 2.5, y: -1 }) as Record<string, string>;
    expect(css["--fs"]).toBe("calc(var(--u) * var(--tv-scale, 1) * 1.5)");
    expect(css.color).toBe("#ff0000");
    expect(css.transform).toBe("translate(2.5cqw, -1cqh)");
    expect(elementStyleCss(undefined)).toBeUndefined();

    const c = setElementStyle(base(), "header.title", { x: 4 });
    expect(makeBoardEdit(c, false).attr("header.title")).toEqual({ style: { transform: "translate(4cqw, 0cqh)" } });
    expect(makeBoardEdit(c, true).attr("header.title")).toEqual({ "data-edit": "header.title", style: { transform: "translate(4cqw, 0cqh)" } });
    expect(makeBoardEdit(base(), false).attr("header.title")).toEqual({});
  });
});
