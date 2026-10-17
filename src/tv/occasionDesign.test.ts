import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "./config";
import { BUILTIN_DESIGNS, applyDesign, findDesign } from "./designs";
import { calendarId, readOccasions } from "./occasions";
import { editOccasionDesign, isOccasionKit, occasionLook } from "./occasionDesign";

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

  it("keeps one box's own shape and frame picture in the occasion's design", () => {
    // Edited in the occasion's 🎨 scope, a box's shape was dropped from its design.
    const after = editOccasionDesign(board(), YK, (c) => ({
      ...c,
      frameLooks: { ...c.frameLooks, zmanim: { shape: "hexagon", image: "frame:double-gold" } },
    }));
    expect(occasionLook(after, YK).frameLooks.zmanim).toEqual({ shape: "hexagon", image: "frame:double-gold" });
    expect(after.frameLooks.zmanim).toBeUndefined();
  });

  it("what is not the look (a text) lands on the board, and makes no design", () => {
    const before = board();
    const after = editOccasionDesign(before, YK, (c) => ({ ...c, texts: { ...c.texts, "dash.zmanim": "זמנים" } }));
    expect(after.texts["dash.zmanim"]).toBe("זמנים");
    expect(after.designs).toEqual(before.designs);
    expect(occ(after, YK).design).toBe(occ(before, YK).design);
  });
});

describe("an occasion's own kit, apart from the gabbai's", () => {
  it("is marked for its occasion, kept through saving, and not counted among one's own kits", () => {
    const after = editOccasionDesign(board(), YK, paint("#123456"));
    const kit = findDesign(after, occ(after, YK).design)!;
    expect(kit.occasion).toBe(YK);
    expect(isOccasionKit(after, kit)).toBe(true);
    const saved = normalizeTvConfig(JSON.parse(JSON.stringify(after)));
    expect(saved.designs.find((d) => d.id === kit.id)?.occasion).toBe(YK);
  });

  it("a kit of one's own worn by an occasion and changed there stays one's own", () => {
    const mine = { ...structuredClone(BUILTIN_DESIGNS[0]), id: "d_mine1234", name: "שלי" };
    const start = board();
    const withMine: TvConfig = { ...start, designs: [mine], occasions: readOccasions(start).map((o) => (o.id === YK ? { ...o, design: mine.id } : o)) };
    const after = editOccasionDesign(withMine, YK, paint("#123456"));
    const kit = after.designs.find((d) => d.id === mine.id)!;
    expect(kit.occasion).toBeUndefined();
    expect(isOccasionKit(after, kit)).toBe(false);
  });
});

describe("a kit made an occasion's own from the library (קבע לשבת ופתח)", () => {
  it("is the same setting as choosing it in מועדים: a copy of the occasion's, named and marked after the kit; the board and kit untouched", async () => {
    const { wearForOccasion, wornBy } = await import("./occasionDesign");
    const { BUILTIN_DESIGNS } = await import("./designs");
    const { DEFAULT_TV_CONFIG } = await import("./config");
    const { readOccasions } = await import("./occasions");
    const board = structuredClone(DEFAULT_TV_CONFIG);
    const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
    const shabbat = readOccasions(board).find((o) => o.name === "שבת")!;
    const out = wearForOccasion(board, shabbat.id, kit);
    const worn = readOccasions(out).find((o) => o.id === shabbat.id)!;
    const own = out.designs.find((d) => d.id === worn.design)!;
    expect(own).toMatchObject({ name: kit.name, from: kit.id, occasion: shabbat.id });
    expect(worn.designOn).toBe("screen");
    expect(out.screenLayout).toBe(board.screenLayout);
    expect(wornBy(out, kit.id).map((o) => o.id)).toEqual([shabbat.id]);
    // Changed on its page: still marked.
    const { editOccasionDesign } = await import("./occasionDesign");
    const edited = editOccasionDesign(out, shabbat.id, (c) => ({ ...c, theme: "night-gold" }));
    expect(wornBy(edited, kit.id).map((o) => o.id)).toEqual([shabbat.id]);
  });
});

describe("a kit made an occasion's own when the board wears it every day", () => {
  it("is still the occasion's own - a kit of parts, so its screen is the kit, not the card", async () => {
    const { wearForOccasion, wornBy } = await import("./occasionDesign");
    const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
    const board = applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit);
    const shabbat = readOccasions(board).find((o) => o.name === "שבת")!;
    const out = wearForOccasion(board, shabbat.id, kit);
    const worn = readOccasions(out).find((o) => o.id === shabbat.id)!;
    const own = findDesign(out, worn.design)!;
    expect(own.values.screenLayout).toBe("composition");
    expect(own.values.elements?.length).toBe(board.elements.length);
    expect(wornBy(out, kit.id).map((o) => o.id)).toEqual([shabbat.id]);
    // Twice: the same kit of its own, not a second one.
    expect(wearForOccasion(out, shabbat.id, kit).designs.length).toBe(out.designs.length);
  });
});

describe("every occasion", () => {
  it("takes a kit of parts as its own - Shabbat, Rosh Chodesh, the festivals, the fasts", async () => {
    const { wearForOccasion } = await import("./occasionDesign");
    const kit = BUILTIN_DESIGNS.find((d) => d.id === "d_premium_jerusalem-stone")!;
    const board = applyDesign(structuredClone(DEFAULT_TV_CONFIG), kit);
    const all = readOccasions(board);
    expect(all.length).toBeGreaterThan(10);
    for (const o of all) {
      const out = wearForOccasion(board, o.id, kit);
      const own = findDesign(out, readOccasions(out).find((x) => x.id === o.id)!.design);
      expect([o.name, own?.values.screenLayout, own?.occasion]).toEqual([o.name, "composition", o.id]);
    }
  });
});
