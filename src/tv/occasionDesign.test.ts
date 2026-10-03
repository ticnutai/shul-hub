import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "./config";
import { BUILTIN_DESIGNS, findDesign } from "./designs";
import { calendarId, readOccasions } from "./occasions";
import { editOccasionDesign, occasionLook } from "./occasionDesign";

const YK = calendarId("yom_kippur");
const RH = calendarId("rosh_hashana");
const board = (): TvConfig => normalizeTvConfig(structuredClone(DEFAULT_TV_CONFIG));
const paint = (colour: string) => (c: TvConfig): TvConfig => ({ ...c, themeOverrides: { ...c.themeOverrides, "--tv-bg-a": colour } });
const occ = (c: TvConfig, id: string) => readOccasions(c).find((o) => o.id === id)!;

describe("editing an occasion's own design in the design tab", () => {
  it("changes the occasion's look, and leaves the board's as it was", () => {
    const before = board();
    const after = editOccasionDesign(before, YK, paint("#123456"));
    expect(after.themeOverrides).toEqual(before.themeOverrides);
    const yk = occ(after, YK);
    expect(yk.design).toMatch(/^d_/);
    expect(yk.designOn).toBe("screen");
    expect(findDesign(after, yk.design)?.name).toBe("עיצוב יום כיפור");
    expect(occasionLook(after, YK).themeOverrides["--tv-bg-a"]).toBe("#123456");
    // Another day is untouched.
    expect(occ(after, RH).design).toBe(occ(before, RH).design);
  });

  it("a second change goes into the same design, not a new one", () => {
    const once = editOccasionDesign(board(), YK, paint("#123456"));
    const twice = editOccasionDesign(once, YK, paint("#654321"));
    expect(twice.designs).toHaveLength(once.designs.length);
    expect(occ(twice, YK).design).toBe(occ(once, YK).design);
    expect(occasionLook(twice, YK).themeOverrides["--tv-bg-a"]).toBe("#654321");
  });

  it("copies a ready-made design, or one another day wears, before changing it", () => {
    const ready = BUILTIN_DESIGNS[0]!;
    let c = board();
    c = { ...c, occasions: readOccasions(c).map((o) => (o.id === YK || o.id === RH ? { ...o, design: ready.id } : o)) };
    const after = editOccasionDesign(c, YK, paint("#123456"));
    expect(occ(after, YK).design).not.toBe(ready.id);
    expect(occ(after, RH).design).toBe(ready.id);
    expect(findDesign(after, ready.id)).toEqual(ready);

    // Now a design of the shul's own, worn by both: changing one copies it too.
    const shared = { ...after, occasions: readOccasions(after).map((o) => (o.id === RH ? { ...o, design: occ(after, YK).design } : o)) };
    const forked = editOccasionDesign(shared, YK, paint("#abcdef"));
    expect(occ(forked, YK).design).not.toBe(occ(forked, RH).design);
    expect(occasionLook(forked, RH).themeOverrides["--tv-bg-a"]).toBe("#123456");
  });

  it("what is not the look (a text) lands on the board, and makes no design", () => {
    const before = board();
    const after = editOccasionDesign(before, YK, (c) => ({ ...c, texts: { ...c.texts, "dash.zmanim": "זמנים" } }));
    expect(after.texts["dash.zmanim"]).toBe("זמנים");
    expect(after.designs).toEqual(before.designs);
    expect(occ(after, YK).design).toBe(occ(before, YK).design);
  });
});
