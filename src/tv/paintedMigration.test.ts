import { describe, expect, it } from "vitest";
import { normalizeTvConfig } from "./config";
import { coloursOnScreen } from "./designs";
import { migratePainted } from "./paintedMigration";

describe("moving a painted board onto its design", () => {
  it("puts it on the medallion with the matching background and frames", () => {
    const c = migratePainted(normalizeTvConfig({ screenLayout: "illustrated", illustration: "stone" }));
    expect(c.screenLayout).toBe("medallion");
    expect(c.backgroundImage).toBe("backdrop:wall");
    expect(c.frame.shape).toBe("arch");
    expect(c.frameStyle.fill).toBe("#f3e7cc");
    expect(coloursOnScreen(c)["--tv-text"]).toBe("#3a2a12");
  });

  it("keeps what the gabbai adjusted on the painting, in the part that owns it now", () => {
    const c = migratePainted(
      normalizeTvConfig({
        screenLayout: "illustrated",
        illustration: "modern",
        hidden: ["header.address", "header.weekday"],
        illustratedStyle: { scale: 0.9, rows: 8, hue: -5, brightness: 0.95, frameLine: "#72716e", frameLineWidth: 4, frameDepth: 1, ink: "#fafafa" },
      }),
    );
    expect(c.textScale).toBe(0.9);
    expect(c.illustratedStyle.rows).toBe(8);
    expect(c.backgroundTune).toMatchObject({ hue: -5, brightness: 0.95 });
    expect(c.frameStyle).toMatchObject({ line: "#72716e", lineWidth: 4, depth: 1 });
    expect(coloursOnScreen(c)["--tv-text"]).toBe("#fafafa");
    // The painting always showed the weekday; the medallion honours "hidden", so it comes back.
    expect(c.hidden).toEqual(["header.address"]);
  });

  it("leaves boards that are not painted, or whose painting has no design, as they are", () => {
    const flat = normalizeTvConfig({ screenLayout: "dashboard" });
    expect(migratePainted(flat)).toBe(flat);
    const own = {
      id: "i_abcdef12",
      name: "משלנו",
      hint: "",
      ink: "#2e2414",
      accent: "#6a4a12",
      clockInk: "#2e2414",
      boxes: { clock: [44, 4, 56, 22], plaqueR: [62, 6, 90, 18], plaqueL: [10, 6, 38, 18], panelR: [53, 28, 90, 86], panelL: [10, 28, 47, 86] },
      image: "https://cdn.example/a.jpg",
    };
    const imported = normalizeTvConfig({ screenLayout: "illustrated", illustration: own.id, customIllustrations: [own] });
    expect(imported.illustration).toBe(own.id);
    expect(migratePainted(imported)).toBe(imported);
  });
});
