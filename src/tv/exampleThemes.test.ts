import { describe, expect, it } from "vitest";
import example from "../../docs/design-tokens-kit/example-themes.json";
import { newCustomThemeId, newGradientId } from "./themes";
import { parseImport } from "./transfer";

/**
 * docs/design-tokens-kit/example-themes.json is the file the import guide
 * (docs/THEMES_IMPORT_EXPORT_GUIDE.md) hands to anyone building a theme.
 * If the format or the validation ever changes, this is where it shows -
 * not in somebody else's failed import.
 */
describe("the example theme file in the docs", () => {
  it("imports whole: three themes, two gradients, nothing skipped", () => {
    const r = parseImport(JSON.stringify(example), newCustomThemeId, newGradientId);
    expect(r.themes.map((t) => t.name)).toEqual(["לילה כחול (דוגמה)", "חגים (מינימלית)", "קלף בהיר"]);
    expect(r.themes[2].light).toBe(true);
    expect(r.gradients.map((g) => g.name)).toEqual(["ערב", "זריחה"]);
    expect(r.skipped).toBe(0);
  });

  it("fills the roles a minimal theme leaves out", () => {
    const r = parseImport(JSON.stringify(example), newCustomThemeId, newGradientId);
    const minimal = r.themes[1];
    expect(minimal.vars["--tv-bg-a"]).toBe("#101828");
    expect(minimal.vars["--tv-panel"]).toBeTruthy();
    expect(Object.values(minimal.vars).every(Boolean)).toBe(true);
  });
});
