/**
 * Reading the four boards that are actually on walls.
 *
 * The fixtures below are the real shapes, taken from a backup of tv_config on
 * 28.9.2026 with the ids removed: two illustrated boards, one rotating, and
 * one row that is almost entirely undefined because that synagogue never
 * opened the settings and the board has been running on defaults. That last
 * one is the useful one - a reader written against tidy configs falls over on
 * it, and it is a live board.
 *
 * What is being proved is narrow and it is the thing that matters before any
 * of this touches drawing: an existing config can be read as screens without
 * losing anything the gabbai turned on.
 */
import { describe, expect, it } from "vitest";

import type { TvConfig } from "./config";
import { place, toScreens, type BlockEntry } from "./screens";

/** The five slides every one of the four rows carries, slideshow off. */
const SLIDES = [
  { kind: "prayer" as const, enabled: true, seconds: 20, layout: "split" },
  { kind: "learning" as const, enabled: true, seconds: 15, layout: "cards" },
  { kind: "announcements" as const, enabled: true, seconds: 18, layout: "grid" },
  { kind: "shiurim" as const, enabled: true, seconds: 18, layout: "list" },
  { kind: "slideshow" as const, enabled: false, seconds: 30, layout: "kenburns" },
];

const REAL: Record<string, Partial<TvConfig>> = {
  // תורה ואהבתה: illustrated, and the only one with the day's screen on.
  illustratedWithFestival: {
    screenLayout: "illustrated",
    slides: SLIDES,
    hidden: ["header.address", "header.weekday", "minyan:00000000-0000-0000-0000-000000000000"],
    eventSplash: true,
  } as Partial<TvConfig>,
  // אהל אברהם: the rotating board.
  rotating: { screenLayout: "rotate", slides: SLIDES, hidden: [] } as Partial<TvConfig>,
  // בית הכנסת: illustrated, day's screen never switched on.
  illustratedPlain: {
    screenLayout: "illustrated",
    slides: SLIDES,
    hidden: ["header.address", "header.weekday"],
  } as Partial<TvConfig>,
  // תורה ושמחתה: the row nobody ever filled in.
  untouched: {} as Partial<TvConfig>,
};

const ids = (list: BlockEntry[]) => list.map((e) => e.block);

describe("reading an existing board as screens", () => {
  it("an illustrated board is one screen of content, and the day's screen is a second", () => {
    // It used to read as a single screen, which is why an arrow had nowhere
    // to go. The day's screen is no longer an overlay that decides for
    // itself when to take the board: it is a screen beside it, taking turns.
    const screens = toScreens(REAL.illustratedWithFestival);
    expect(screens.map((s) => s.id)).toEqual(["board", "festival"]);
    expect(ids(screens[0].blocks)).toEqual(
      expect.arrayContaining(["prayers", "zmanim", "learning", "announcements", "shiurim"]),
    );
    // Both hold for a turn, rather than one of them holding the week.
    expect(screens.every((s) => s.seconds > 0)).toBe(true);
  });

  it("gives the day its own screen, and none at all where it was never turned on", () => {
    const withIt = toScreens(REAL.illustratedWithFestival);
    expect(withIt.find((s) => s.id === "festival")).toBeTruthy();
    // A board that never switched it on stays a single screen.
    const without = toScreens(REAL.illustratedPlain);
    expect(without).toHaveLength(1);
    expect(without.flatMap((s) => ids(s.blocks))).not.toContain("festival");
  });

  it("a rotating board keeps one screen per slide, in the order they were in", () => {
    const screens = toScreens(REAL.rotating);
    expect(screens.map((s) => s.id)).toEqual(["prayers", "learning", "announcements", "shiurim"]);
    expect(screens.map((s) => s.seconds)).toEqual([20, 15, 18, 18]);
  });

  it("loses nothing the gabbai switched on", () => {
    for (const [name, config] of Object.entries(REAL)) {
      const screens = toScreens(config);
      const shown = new Set(screens.flatMap((s) => ids(s.blocks)));
      for (const slide of config.slides ?? []) {
        if (!slide.enabled) continue;
        const expected = ({ prayer: "prayers", learning: "learning", announcements: "announcements", shiurim: "shiurim", slideshow: "slideshow" } as const)[slide.kind];
        expect(shown.has(expected), `${name}: ${slide.kind} disappeared`).toBe(true);
      }
      // And nothing switched off appears.
      if ((config.slides ?? []).some((s) => s.kind === "slideshow" && !s.enabled))
        expect(shown.has("slideshow"), `${name}: slideshow was off`).toBe(false);
    }
  });

  it("reads the board whose config was never filled in", () => {
    const screens = toScreens(REAL.untouched);
    expect(screens.length).toBeGreaterThan(0);
    // Chrome and the zmanim, which have no slide and would otherwise vanish.
    expect(ids(screens[0].blocks)).toEqual(expect.arrayContaining(["header", "footer", "zmanim"]));
  });

  it("changes nothing in the config it was given", () => {
    const before = JSON.stringify(REAL.illustratedWithFestival);
    toScreens(REAL.illustratedWithFestival);
    expect(JSON.stringify(REAL.illustratedWithFestival)).toBe(before);
  });
});

describe("where the blocks go", () => {
  const e = (block: string, area?: string) => ({ block, area } as BlockEntry);

  it("one block takes the board", () => {
    expect(place([e("prayers")])).toEqual([[e("prayers")]]);
  });

  it("two stand side by side rather than one above an empty half", () => {
    const rows = place([e("prayers"), e("zmanim")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(2);
  });

  it("a pinned block holds its side and the rest arrange around it", () => {
    const rows = place([e("zmanim", "right"), e("prayers"), e("announcements")]);
    expect(rows[0][0].block).toBe("zmanim");
    const placed = rows.flat().map((x) => x.block);
    expect(placed).toContain("prayers");
    expect(placed).toContain("announcements");
  });

  it("a block pinned wide gets a row to itself", () => {
    const rows = place([e("festival", "wide"), e("prayers"), e("zmanim")]);
    expect(rows[0]).toEqual([e("festival", "wide")]);
    expect(rows[1]).toHaveLength(2);
  });

  it("leaves the bars out of the body", () => {
    const rows = place([e("header"), e("footer"), e("prayers")]);
    expect(rows.flat().map((x) => x.block)).toEqual(["prayers"]);
  });
});
