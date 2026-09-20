import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "./config";
import {
  familyKey,
  familyOf,
  makeBoardEdit,
  resolveElementStyle,
  setElementStyle,
  styleTargetKey,
} from "./boardEdit";

const base = (over: Partial<TvConfig> = {}): TvConfig => ({
  ...structuredClone(DEFAULT_TV_CONFIG),
  ...over,
});
const MINYAN_A = "minyan:11111111-1111-1111-1111-111111111111";
const MINYAN_B = "minyan:22222222-2222-2222-2222-222222222222";

describe("element families", () => {
  it("knows which elements have look-alikes and which are one of a kind", () => {
    expect(familyOf(MINYAN_A)).toBe("minyan");
    expect(familyOf(`${MINYAN_A}:label`)).toBe("minyan:label");
    expect(familyOf("zman.alot")).toBe("zman");
    expect(familyOf("ann:abc:title")).toBe("ann:title");
    expect(familyOf("shiur:abc:teacher")).toBe("shiur:teacher");
    expect(familyOf("header.title")).toBeNull();
    expect(familyOf("dash.clock")).toBeNull();
    expect(familyKey("zman.tzeit")).toBe("kind:zman");
  });
});

describe("one change for every element of a kind", () => {
  it("a family rule styles every member, on any slide, layout and device", () => {
    const c = setElementStyle(base(), "kind:minyan", { scale: 1.3 });
    expect(resolveElementStyle(c, MINYAN_A)?.scale).toBe(1.3);
    expect(resolveElementStyle(c, MINYAN_B)?.scale).toBe(1.3);
    // The board reads the same resolution the editor does.
    expect(makeBoardEdit(c, false).attr(MINYAN_B).style).toMatchObject({ "--es": "1.3" });
    // A different kind is untouched.
    expect(resolveElementStyle(c, "zman.alot")).toBeUndefined();
  });

  it("one element can still differ from its family: own values win, the rest inherit", () => {
    let c = setElementStyle(base(), "kind:minyan", { scale: 1.3, color: "#ff0000" });
    c = setElementStyle(c, MINYAN_A, { color: "#00ff00" });
    expect(resolveElementStyle(c, MINYAN_A)).toMatchObject({ scale: 1.3, color: "#00ff00" });
    expect(resolveElementStyle(c, MINYAN_B)).toMatchObject({ scale: 1.3, color: "#ff0000" });
  });

  it("edits follow the scope in force: the family when only it exists, otherwise the element", () => {
    const family = setElementStyle(base(), "kind:zman", { scale: 1.2 });
    expect(styleTargetKey(family, "zman.alot")).toBe("kind:zman");
    const own = setElementStyle(family, "zman.alot", { color: "#fff" });
    expect(styleTargetKey(own, "zman.alot")).toBe("zman.alot");
    expect(styleTargetKey(base(), "header.title")).toBe("header.title");
  });
});

describe("theme scope", () => {
  it("by default a change holds in every theme", () => {
    const c = setElementStyle(base(), "header.title", { scale: 1.4 });
    expect(resolveElementStyle({ ...c, theme: "navy" }, "header.title")?.scale).toBe(1.4);
    expect(resolveElementStyle({ ...c, theme: "shabbat" }, "header.title")?.scale).toBe(1.4);
  });

  it("an entry limited to one theme applies only there - element and family alike", () => {
    let c = setElementStyle(base({ theme: "navy" }), "header.title", {
      color: "#ff0000",
      theme: "navy",
    });
    c = setElementStyle(c, "kind:zman", { scale: 1.5, theme: "royal" });
    expect(resolveElementStyle({ ...c, theme: "navy" }, "header.title")?.color).toBe("#ff0000");
    expect(resolveElementStyle({ ...c, theme: "royal" }, "header.title")).toBeUndefined();
    expect(resolveElementStyle({ ...c, theme: "royal" }, "zman.alot")?.scale).toBe(1.5);
    expect(resolveElementStyle({ ...c, theme: "navy" }, "zman.alot")).toBeUndefined();
  });

  it("a family limited to one theme still lets an element's own always-on rule through", () => {
    let c = setElementStyle(base({ theme: "navy" }), "kind:minyan", { scale: 1.5, theme: "royal" });
    c = setElementStyle(c, MINYAN_A, { color: "#0000ff" });
    expect(resolveElementStyle(c, MINYAN_A)).toEqual({ color: "#0000ff" });
    expect(resolveElementStyle({ ...c, theme: "royal" }, MINYAN_A)).toMatchObject({
      scale: 1.5,
      color: "#0000ff",
    });
  });
});

describe("what gets saved", () => {
  it("keeps family keys and a valid theme, drops a theme that no longer exists", () => {
    const c = normalizeTvConfig({
      theme: "navy",
      styles: {
        "kind:minyan": { scale: 1.2, theme: "royal" },
        "header.title": { scale: 1.1, theme: "c_deleted0" },
        "kind:nonsense": { scale: 1.4 },
      },
    });
    expect(c.styles["kind:minyan"]).toEqual({ scale: 1.2, theme: "royal" });
    // The theme is gone, but the styling itself survives - now in every theme.
    expect(c.styles["header.title"]).toEqual({ scale: 1.1 });
    // An unknown family name is kept as a plain key; it simply matches nothing.
    expect(familyOf("kind:nonsense")).toBeNull();
  });
});
