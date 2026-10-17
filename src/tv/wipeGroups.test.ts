/**
 * Deleting by groups: every setting of the board in exactly one group, all of
 * them together the board as a new synagogue's, and one alone touching only
 * what it holds.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, type TvConfig } from "./config";
import { WIPE_GROUPS, WIPE_GROUP_KEYS, wipeGroups, type WipeGroup } from "./wipeGroups";

const used = (): TvConfig => ({
  ...structuredClone(DEFAULT_TV_CONFIG),
  theme: "night-gold",
  texts: { "header.title": "אהל אברהם" },
  logos: [{ id: "l1", url: "https://logos.test/a.png", name: "קהילה" }] as TvConfig["logos"],
  ticker: { enabled: true, text: "שבת שלום" },
  screens: [{ id: "screen1", name: "מסך 1", seconds: 15, blocks: [] }],
});

describe("deleting by groups", () => {
  it("holds every setting of the board in exactly one group", () => {
    const all = Object.values(WIPE_GROUP_KEYS).flat();
    expect(all.length).toBe(new Set(all).size);
    for (const k of Object.keys(DEFAULT_TV_CONFIG)) expect([k, all.includes(k as keyof TvConfig)]).toEqual([k, true]);
    expect(WIPE_GROUPS.map((g) => g.id).sort()).toEqual((Object.keys(WIPE_GROUP_KEYS) as WipeGroup[]).sort());
  });

  it("all together: the board as a new synagogue's", () => {
    const out = wipeGroups(used(), WIPE_GROUPS.map((g) => g.id));
    expect(out).toEqual(DEFAULT_TV_CONFIG);
  });

  it("one alone touches only what it holds", () => {
    const out = wipeGroups(used(), ["logos"]);
    expect(out.logos).toEqual(DEFAULT_TV_CONFIG.logos);
    expect(out.texts["header.title"]).toBe("אהל אברהם");
    expect(out.theme).toBe("night-gold");
    expect(out.ticker.text).toBe("שבת שלום");
    const looks = wipeGroups(used(), ["look"]);
    expect(looks.theme).toBe(DEFAULT_TV_CONFIG.theme);
    expect(looks.logos).toHaveLength(1);
  });
});
