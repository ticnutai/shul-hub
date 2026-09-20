import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, normalizeGradients, normalizeTvConfig, type TvConfig } from "./config";
import { elementStyleCss } from "./boardEdit";
import { isSafeFill, isSafeGradient, newGradientId, themeStyle, TV_GRADIENTS } from "./themes";
import { buildExport, mergeImport, parseImport, TRANSFER_KIND } from "./transfer";

const GRADIENT = "linear-gradient(160deg, #0b1628, #1b3054)";
let n = 0;
const nextThemeId = () => `c_test${(n++).toString().padStart(4, "0")}`;
const nextGradientId = () => `u_test${(n++).toString().padStart(4, "0")}`;

describe("only real gradients are accepted", () => {
  it("takes the gradient functions", () => {
    expect(isSafeGradient(GRADIENT)).toBe(true);
    expect(isSafeGradient("radial-gradient(ellipse at 50% 30%, #fff 0%, #000 70%)")).toBe(true);
    expect(isSafeGradient("repeating-linear-gradient(45deg, #fff 0 10px, #000 10px 20px)")).toBe(true);
    expect(isSafeFill("#112233")).toBe(true);
  });

  it("refuses anything that could escape the declaration or reach out", () => {
    for (const bad of [
      "red",
      "url(https://x/a.png)",
      "linear-gradient(160deg, #fff, #000); background: url(x)",
      "linear-gradient(160deg, var(--x), #000)",
      "linear-gradient(160deg, #fff, #000) } body {",
      "image-set(url(x) 1x)",
      // longer than the 600-character bound
      `linear-gradient(160deg, ${Array.from({ length: 60 }, (_, i) => `#ff00${(i % 10)}0 ${i}%`).join(", ")})`,
    ]) {
      expect(isSafeGradient(bad), bad).toBe(false);
    }
  });
});

describe("a gradient on the board and on an element", () => {
  it("the board background becomes a CSS variable only when it is safe", () => {
    const good = themeStyle({ theme: "navy", font: "classic", backgroundGradient: GRADIENT }) as Record<string, string>;
    expect(good["--tv-bg-gradient"]).toBe(GRADIENT);
    const bad = themeStyle({ theme: "navy", font: "classic", backgroundGradient: "url(x)" }) as Record<string, string>;
    expect(bad["--tv-bg-gradient"]).toBe("none");
  });

  it("an element's gradient is a background-image; a colour still gets its ring", () => {
    const grad = elementStyleCss({ bg: GRADIENT }) as Record<string, string>;
    expect(grad.backgroundImage).toBe(GRADIENT);
    expect(grad.backgroundColor).toBeUndefined();
    const solid = elementStyleCss({ bg: "#112233" }) as Record<string, string>;
    expect(solid.backgroundColor).toBe("#112233");
    expect(solid.backgroundImage).toBeUndefined();
  });

  it("what gets saved keeps valid entries and drops the rest", () => {
    const c = normalizeTvConfig({
      backgroundGradient: GRADIENT,
      gradients: [
        { id: "u_abcd1234", name: "ערב", value: GRADIENT },
        { id: "g_night", name: "מתחזה לבנוי", value: GRADIENT },
        { id: "u_bad00000", name: "", value: GRADIENT },
        { id: "u_unsafe11", name: "מסוכן", value: "url(https://x)" },
      ],
    });
    expect(c.backgroundGradient).toBe(GRADIENT);
    expect(c.gradients).toEqual([{ id: "u_abcd1234", name: "ערב", value: GRADIENT }]);
    expect(normalizeTvConfig({ backgroundGradient: "expression(1)" }).backgroundGradient).toBeNull();
    expect(normalizeGradients("nonsense")).toEqual([]);
  });
});

describe("import and export", () => {
  const full = (): TvConfig => ({
    ...structuredClone(DEFAULT_TV_CONFIG),
    customThemes: [{ id: "c_abcd1234", name: "חגים", description: "", light: false, vars: structuredClone(DEFAULT_TV_CONFIG.themeOverrides) as never }],
    gradients: [{ id: "u_abcd1234", name: "ערב", value: GRADIENT }],
  });

  it("a round trip carries the admin's own themes and gradients, and nothing else", () => {
    const source = normalizeTvConfig({
      ...full(),
      customThemes: [
        {
          id: "c_abcd1234",
          name: "חגים",
          vars: {
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
          },
        },
      ],
      gradients: [{ id: "u_abcd1234", name: "ערב", value: GRADIENT }],
    });
    const file = buildExport(source);
    expect(file.kind).toBe(TRANSFER_KIND);
    const imported = parseImport(JSON.stringify(file), nextThemeId, nextGradientId);
    expect(imported.themes.map((t) => t.name)).toEqual(["חגים"]);
    expect(imported.gradients.map((g) => g.value)).toEqual([GRADIENT]);
    // Fresh ids: importing into the same board cannot overwrite what is there.
    expect(imported.themes[0].id).not.toBe("c_abcd1234");

    const merged = mergeImport(source, imported);
    expect(merged.customThemes.map((t) => t.name)).toEqual(["חגים", "חגים (2)"]);
    expect(merged.gradients.map((g) => g.name)).toEqual(["ערב", "ערב (2)"]);
  });

  it("only themes, or only gradients, is a valid file", () => {
    const onlyGradients = buildExport(normalizeTvConfig(full()), { themes: false });
    expect(onlyGradients.themes).toEqual([]);
    expect(parseImport(JSON.stringify(onlyGradients), nextThemeId, nextGradientId).gradients).toHaveLength(1);
  });

  it("refuses a file that is not ours, is broken, or holds nothing valid", () => {
    expect(() => parseImport("{", nextThemeId, nextGradientId)).toThrow(/JSON/);
    expect(() => parseImport(JSON.stringify({ kind: "something-else" }), nextThemeId, nextGradientId)).toThrow(/לא קובץ עיצוב/);
    expect(() =>
      parseImport(JSON.stringify({ kind: TRANSFER_KIND, themes: [{ name: "x" }], gradients: [{ name: "y", value: "url(x)" }] }), nextThemeId, nextGradientId),
    ).toThrow(/לא נמצאו/);
  });

  it("a half-valid file imports what it can and reports the rest", () => {
    const file = {
      kind: TRANSFER_KIND,
      gradients: [
        { id: "u_a1111111", name: "טוב", value: GRADIENT },
        { id: "u_b2222222", name: "רע", value: "javascript:alert(1)" },
      ],
    };
    const result = parseImport(JSON.stringify(file), nextThemeId, nextGradientId);
    expect(result.gradients).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("deleting a saved gradient leaves a board that already uses it untouched", () => {
    let c = normalizeTvConfig({ ...full(), backgroundGradient: GRADIENT, gradients: [{ id: "u_abcd1234", name: "ערב", value: GRADIENT }] });
    c = { ...c, gradients: c.gradients.filter((g) => g.id !== "u_abcd1234") };
    expect(c.backgroundGradient).toBe(GRADIENT);
    expect(newGradientId()).toMatch(/^u_[a-z0-9]{4,24}$/);
    expect(TV_GRADIENTS.every((g) => isSafeGradient(g.value))).toBe(true);
  });
});
