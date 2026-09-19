import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "./config";
import { elementStyleCss, setElementStyle } from "./boardEdit";
import { seasonalPrayers } from "./learning";
import { buildSlides, type BoardData } from "./useBoardData";
import { zmanimFor } from "@community/lib/minyan-time";

describe("screen layout and clock", () => {
  it("defaults to the rotating board with a digital clock, and keeps valid choices", () => {
    expect(normalizeTvConfig({}).screenLayout).toBe("rotate");
    expect(normalizeTvConfig({}).clockStyle).toBe("digital");
    const c = normalizeTvConfig({ screenLayout: "dashboard", clockStyle: "both" });
    expect([c.screenLayout, c.clockStyle]).toEqual(["dashboard", "both"]);
    const bad = normalizeTvConfig({ screenLayout: "grid", clockStyle: "sundial" });
    expect([bad.screenLayout, bad.clockStyle]).toEqual(["rotate", "digital"]);
  });

  it("split: prayer slides use the timeline layout (the side column already has the zmanim)", () => {
    const data: BoardData = {
      settings: null,
      minyanim: [],
      categories: [],
      announcements: [],
      shiurim: [],
      stale: false,
      anyLoaded: true,
      sync: { status: "live", lastSyncedAt: null },
    };
    const now = new Date("2026-09-16T10:00:00+03:00"); // a Wednesday
    const z = zmanimFor(now, null);
    const split = buildSlides(
      data,
      { ...structuredClone(DEFAULT_TV_CONFIG), screenLayout: "split" },
      now,
      z,
    );
    const rotate = buildSlides(data, structuredClone(DEFAULT_TV_CONFIG), now, z);
    expect(split.filter((s) => s.kind === "prayer").every((s) => s.layout === "timeline")).toBe(
      true,
    );
    const defaultPrayer = DEFAULT_TV_CONFIG.slides.find((s) => s.kind === "prayer")!.layout;
    expect(rotate.find((s) => s.kind === "prayer")?.layout).toBe(defaultPrayer);
  });
});

describe("element look: weight, background, opacity", () => {
  it("normalizes into range and drops unsafe values", () => {
    const c = normalizeTvConfig({
      styles: {
        "header.title": { weight: 1234, bg: "#102030", opacity: 0.01 },
        "zman.alot": { bg: "url(x)", opacity: 1 },
      },
    });
    expect(c.styles).toEqual({ "header.title": { weight: 900, bg: "#102030", opacity: 0.15 } });
  });

  it("renders as CSS, and clearing a property removes it", () => {
    const css = elementStyleCss({ weight: 800, bg: "#102030", opacity: 0.5 }) as Record<
      string,
      string
    >;
    expect(css.fontWeight).toBe("800");
    expect(css.backgroundColor).toBe("#102030");
    expect(css.opacity).toBe("0.5");
    let c = setElementStyle(structuredClone(DEFAULT_TV_CONFIG), "k", { bg: "#fff", opacity: 0.5 });
    c = setElementStyle(c, "k", { bg: undefined, opacity: 1 });
    expect(c.styles).toEqual({});
  });
});

describe("seasonal insertions (Eretz Yisrael)", () => {
  it("summer: מוריד הטל · ותן ברכה", () => {
    expect(seasonalPrayers(new Date("2026-07-01T12:00:00")).text).toBe("מוריד הטל · ותן ברכה");
  });
  it("from Shemini Atzeret: geshem, but not yet tal umatar", () => {
    const s = seasonalPrayers(new Date("2026-10-05T12:00:00")); // 24 Tishrei 5787
    expect([s.geshem, s.talUmatar]).toEqual([true, false]);
  });
  it("from 7 Cheshvan until Pesach: both", () => {
    expect(seasonalPrayers(new Date("2026-12-15T12:00:00")).text).toBe(
      "משיב הרוח ומוריד הגשם · ותן טל ומטר לברכה",
    );
    expect(seasonalPrayers(new Date("2027-04-10T12:00:00"))).toMatchObject({
      geshem: true,
      talUmatar: true,
    }); // 3 Nisan 5787
  });
  it("from the first day of Pesach: back to summer", () => {
    expect(seasonalPrayers(new Date("2027-04-25T12:00:00")).text).toBe("מוריד הטל · ותן ברכה");
  });
});
