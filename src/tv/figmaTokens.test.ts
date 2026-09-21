import { describe, expect, it } from "vitest";
import { guessRoles, parseFigmaColors } from "./figmaTokens";

describe("reading a Figma export", () => {
  it("reads the REST API's variables body", () => {
    const text = JSON.stringify({
      meta: {
        variables: {
          "VariableID:1": {
            name: "brand/primary",
            resolvedType: "COLOR",
            valuesByMode: { "1:0": { r: 1, g: 0.5, b: 0, a: 1 } },
          },
          "VariableID:2": { name: "spacing/md", resolvedType: "FLOAT", valuesByMode: { "1:0": 8 } },
        },
      },
    });
    expect(parseFigmaColors(text)).toEqual([{ name: "brand/primary", value: "#ff8000" }]);
  });

  it("reads the W3C design-tokens format, groups and all", () => {
    const text = JSON.stringify({
      color: {
        background: { $value: "#0b1628", $type: "color" },
        text: { $value: "rgb(244, 247, 251)", $type: "color" },
      },
      spacing: { md: { $value: "8px", $type: "dimension" } },
    });
    expect(parseFigmaColors(text)).toEqual([
      { name: "color/background", value: "#0b1628" },
      { name: "color/text", value: "rgb(244, 247, 251)" },
    ]);
  });

  it("reads the older value/type format and a plain map", () => {
    expect(parseFigmaColors(JSON.stringify({ accent: { value: "#f0c35c", type: "color" } }))).toEqual([
      { name: "accent", value: "#f0c35c" },
    ]);
    expect(parseFigmaColors(JSON.stringify({ gold: "#c9a227" }))).toEqual([
      { name: "gold", value: "#c9a227" },
    ]);
  });

  it("keeps an alpha channel and refuses anything that is not a colour", () => {
    const text = JSON.stringify({
      meta: { variables: { a: { name: "veil", resolvedType: "COLOR", valuesByMode: { m: { r: 0, g: 0, b: 0, a: 0.5 } } } } },
    });
    expect(parseFigmaColors(text)[0].value).toBe("#00000080");
    expect(() => parseFigmaColors("not json")).toThrow(/JSON/);
    expect(() => parseFigmaColors(JSON.stringify({ spacing: { md: "8px" } }))).toThrow(/צבעים/);
  });

  it("guesses a role from the usual names, and never twice", () => {
    const roles = guessRoles([
      { name: "color/bg", value: "#111111" },
      { name: "color/surface", value: "#222222" },
      { name: "color/text", value: "#eeeeee" },
      { name: "color/text-muted", value: "#999999" },
      { name: "color/primary", value: "#f0c35c" },
    ]);
    expect(roles.background).toBe("#111111");
    expect(roles.surface).toBe("#222222");
    expect(roles.text).toBe("#eeeeee");
    expect(roles.textMuted).toBe("#999999");
    expect(roles.accent).toBe("#f0c35c");
    // nothing in the palette says "on accent"
    expect(roles.onAccent).toBeNull();
  });
});
