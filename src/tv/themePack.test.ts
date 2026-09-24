import { describe, expect, it } from "vitest";
import pack from "../../docs/theme-packs/לוח-ערכות-נושא-חבילה-1.json";
import { newCustomThemeId, newGradientId } from "./themes";
import { mergeImport, parseImport } from "./transfer";
import { normalizeTvConfig } from "./config";

/**
 * The ready-made theme pack in docs/theme-packs/ is meant to be imported as
 * is, from Admin > TV > Tools. It goes through the real import here, so a
 * colour the board would reject shows up as a failing test, not as
 * "N items skipped" on somebody's screen.
 */
describe("theme pack 1", () => {
  const r = parseImport(JSON.stringify(pack), newCustomThemeId, newGradientId);

  it("imports every theme and gradient, skipping nothing", () => {
    expect(r.themes).toHaveLength(16);
    expect(r.gradients).toHaveLength(12);
    expect(r.skipped).toBe(0);
  });

  it("files the light themes as light", () => {
    const light = r.themes.filter((t) => t.light).map((t) => t.name);
    expect(light).toEqual(["ימים נוראים", "פסח", "שבועות", "אבן ירושלים בהירה"]);
  });

  it("fits alongside the themes a synagogue already has", () => {
    const merged = mergeImport(normalizeTvConfig({}), r);
    expect(merged.customThemes).toHaveLength(16);
    expect(merged.gradients).toHaveLength(12);
  });
});
