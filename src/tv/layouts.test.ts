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
      overrides: [],
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

  /**
   * "לדוד ה' אורי וישעי" is the one that has to take itself off the board:
   * the gabbai should not have to remember, the morning after Simchat
   * Torah, that a line on the wall is now wrong.
   */
  describe("לדוד ה' אורי וישעי", () => {
    const said = (iso: string) => seasonalPrayers(new Date(`${iso}T12:00:00`)).leDavid;

    it("starts at Rosh Chodesh Elul", () => {
      expect(said("2026-08-13")).toBe(false); // 29 Av 5786
      expect(said("2026-08-14")).toBe(true); // 1 Elul 5786
    });

    it("is said right through Elul and the Yamim Noraim", () => {
      expect(said("2026-09-01")).toBe(true); // Elul
      expect(said("2026-09-12")).toBe(true); // Rosh Hashana
      expect(said("2026-09-21")).toBe(true); // Yom Kippur
      expect(said("2026-09-27")).toBe(true); // Sukkot
    });

    it("is said on Shemini Atzeret - Simchat Torah here - and not after", () => {
      expect(said("2026-10-03")).toBe(true); // 22 Tishrei 5787
      expect(said("2026-10-04")).toBe(false); // 23 Tishrei, and it is gone
    });

    it("is not said for the rest of the year", () => {
      expect(said("2026-12-15")).toBe(false);
      expect(said("2027-04-10")).toBe(false);
      expect(said("2027-07-01")).toBe(false);
    });

    it("leads the line while it is said, and leaves no trace when it is not", () => {
      expect(seasonalPrayers(new Date("2026-09-22T12:00:00")).text).toBe(
        "לדוד ה' אורי וישעי · מוריד הטל · ותן ברכה",
      );
      expect(seasonalPrayers(new Date("2026-10-04T12:00:00")).text).toBe(
        "משיב הרוח ומוריד הגשם · ותן ברכה",
      );
    });
  });
});
