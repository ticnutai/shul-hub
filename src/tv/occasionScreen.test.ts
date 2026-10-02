/**
 * An occasion's own screen (occasions.ts, `screen`), built in the composer like
 * any screen: on its day the board shows that one screen - the card a block
 * among the board's, as arranged - and an occasion nobody arranged is drawn as
 * it always was, its card over the whole board.
 */
import { describe, expect, it } from "vitest";
import type { Minyan, MinyanCategory } from "@community/lib/data";
import { zmanimFor } from "@community/lib/minyan-time";

import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "./config";
import { readOccasions } from "./occasions";
import { buildSlides, type BoardData } from "./useBoardData";

const data: BoardData = {
  settings: null,
  minyanim: [
    {
      id: "s1", label: "שחרית שבת", prayer: "shacharit", day_type: "shabbat", category_id: "sh",
      time_mode: "fixed", fixed_time: "08:30:00", relative_to: null, offset_minutes: 0,
      active: true, room: "", note: "", sort_order: 1, active_from: null, active_until: null, community_id: "x",
    } as unknown as Minyan,
  ],
  categories: [
    {
      id: "sh", name: "שבת", system_key: "shabbat", active: true, display_mode: "tabs", sort_order: 1,
      subcategories: [], visible_from: null, visible_until: null, community_id: "x", created_at: "", updated_at: "",
    } as unknown as MinyanCategory,
  ],
  announcements: [],
  shiurim: [],
  overrides: [],
  stale: false,
  anyLoaded: true,
  sync: { status: "live", lastSyncedAt: null },
};

// Shabbat morning, 17 October 2026 (no festival).
const SATURDAY = new Date("2026-10-17T10:00:00+03:00");
const z = zmanimFor(SATURDAY, null);

const withShabbatScreen = (): TvConfig => {
  const base = structuredClone(DEFAULT_TV_CONFIG);
  const occasions = readOccasions(base).map((o) =>
    o.id === "shabbat"
      ? {
          ...o,
          screen: {
            id: "occasion-shabbat",
            name: "שבת",
            seconds: 30,
            blocks: [{ block: "header" as const }, { block: "festival" as const }, { block: "prayers" as const }, { block: "zmanim" as const }],
            grid: [
              { blocks: ["festival" as const], widths: [1], height: 1.4 },
              { blocks: ["prayers" as const, "zmanim" as const], widths: [1, 1], height: 1 },
            ],
          },
        }
      : o,
  );
  // Through the board's own reader, as it comes out of storage.
  return normalizeTvConfig(JSON.parse(JSON.stringify({ ...base, occasions })));
};

describe("an occasion's own screen", () => {
  it("is kept through storage, and dropped if its card was taken off it", () => {
    const config = withShabbatScreen();
    const shabbat = config.occasions.find((o) => o.id === "shabbat")!;
    expect(shabbat.screen?.blocks.map((b) => b.block)).toEqual(["header", "festival", "prayers", "zmanim"]);
    expect(shabbat.screen?.grid?.[0].blocks).toEqual(["festival"]);

    const noCard = JSON.parse(JSON.stringify(config));
    noCard.occasions.find((o: { id: string }) => o.id === "shabbat").screen.blocks = [{ block: "prayers" }];
    expect(normalizeTvConfig(noCard).occasions.find((o) => o.id === "shabbat")!.screen).toBeNull();
  });

  it("on its day is the board's one screen: the card and the blocks, as arranged", () => {
    const slides = buildSlides(data, withShabbatScreen(), SATURDAY, z);
    expect(slides.map((s) => s.id)).toEqual(["occasion:shabbat:screen"]);
    const screen = slides[0];
    if (screen.kind !== "composed") throw new Error("not a composed screen");
    expect(screen.parts.map((p) => p.block)).toEqual(["festival", "prayers", "zmanim"]);
    expect(screen.parts[0].slide?.kind).toBe("occasion");
    expect(screen.screen.grid?.[1].blocks).toEqual(["prayers", "zmanim"]);
    // The bars it was given, and only those.
    expect(screen.screen.blocks.map((b) => b.block)).toContain("header");
  });

  it("not arranged, it is drawn as it always was: its card over the whole board", () => {
    const slides = buildSlides(data, structuredClone(DEFAULT_TV_CONFIG), SATURDAY, z);
    expect(slides[0].id).toBe("occasion:shabbat");
    expect(slides[0].kind).toBe("occasion");
  });
});
