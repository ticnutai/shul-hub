/**
 * Every kit the library offers is built of parts - the built-in ones and the
 * shared catalogue's, the Shabbat kits among them - and each carries the
 * board's topics as parts that can be taken off or added: the prayers, the
 * day's times, the lessons, the announcements.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILTIN_DESIGNS } from "@/tv/designs";
import { catalogCategory } from "@/tv/catalogCategories";
import type { SavedDesign } from "@/tv/designs";
import { ofParts } from "@/tv/designs";

const catalog = JSON.parse(readFileSync("public/new-shul-catalog.json", "utf8")) as { designs: SavedDesign[] };

describe("the kits offered", () => {
  it("are all built of parts, built-in and shared", () => {
    expect(BUILTIN_DESIGNS.filter((d) => !ofParts(d)).map((d) => d.id)).toEqual([]);
    const offered = catalog.designs.filter(ofParts);
    expect(offered.every((d) => d.values.screenLayout === "composition" && (d.values.elements?.length ?? 0) > 10)).toBe(true);
    // The old layouts, the medallions with three ornaments over them among them, are not offered.
    expect(catalog.designs.filter((d) => !ofParts(d)).map((d) => d.id).sort()).toEqual(
      ["d_curtain", "d_modern", "d_new_marble", "d_new_marble-dark", "d_new_wood", "d_sapphireparts", "d_stone", "d_wood"],
    );
  });

  it("for Shabbat carry every topic as a part of its own", () => {
    const shabbat = catalog.designs.filter((d) => ofParts(d) && catalogCategory(d) === "שבת");
    expect(shabbat.length).toBeGreaterThanOrEqual(7);
    for (const d of shabbat) {
      const topics = new Set(d.values.elements!.map((e) => e.binding));
      for (const t of ["prayers", "zmanim", "lessons", "announcements", "parasha", "clock", "date"]) expect([d.id, topics.has(t as never)]).toEqual([d.id, true]);
    }
  });
});
