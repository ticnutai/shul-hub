/**
 * The board drawing what the gabbai composed.
 *
 * Two claims are worth holding down here, and only two. The first is that a
 * board that never opened the composer is not touched by any of this - there
 * are four of them on walls and none of them asked for a new model. The
 * second is that composing reuses the content rules rather than repeating
 * them: which minyanim belong to today and which notices have expired stay in
 * buildSlides, so a composed screen shows exactly what the old screen showed,
 * only arranged differently.
 */
import { describe, expect, it } from "vitest";
import { zmanimFor } from "@community/lib/minyan-time";

import { DEFAULT_TV_CONFIG, type Screen, type TvConfig } from "./config";
import { buildSlides, type BoardData } from "./useBoardData";

const now = new Date("2026-09-16T10:00:00+03:00"); // a Wednesday
const z = zmanimFor(now, null);

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

const withScreens = (screens: Screen[]): TvConfig => ({
  ...structuredClone(DEFAULT_TV_CONFIG),
  screens,
});

describe("a board built in the composer", () => {
  it("leaves a board that never opened the composer exactly as it was", () => {
    const before = buildSlides(data, structuredClone(DEFAULT_TV_CONFIG), now, z);
    expect(before.some((s) => s.kind === "composed")).toBe(false);
    expect(before.length).toBeGreaterThan(0);
  });

  it("turns each screen into one slide, so rotation and the arrows need no change", () => {
    const slides = buildSlides(
      data,
      withScreens([
        { id: "a", name: "תפילות וזמנים", seconds: 20, blocks: [{ block: "prayers" }, { block: "zmanim" }] },
        { id: "b", name: "לימוד", seconds: 12, blocks: [{ block: "learning" }] },
      ]),
      now,
      z,
    );
    expect(slides.map((s) => s.kind)).toEqual(["composed", "composed"]);
    expect(slides.map((s) => s.id)).toEqual(["screen:a", "screen:b"]);
    expect(slides.map((s) => s.seconds)).toEqual([20, 12]);
  });

  it("carries the content buildSlides worked out, not a second copy of the rules", () => {
    const [screen] = buildSlides(
      data,
      withScreens([{ id: "a", name: "הלוח", seconds: 0, blocks: [{ block: "prayers" }, { block: "zmanim" }] }]),
      now,
      z,
    );
    if (screen.kind !== "composed") throw new Error("expected a composed screen");
    const prayer = screen.parts.find((p) => p.block === "prayers");
    expect(prayer?.slide?.kind).toBe("prayer");
    // The zmanim are a panel in every layout and appear in no slide list, so
    // they travel as a part with no content of their own.
    const zmanim = screen.parts.find((p) => p.block === "zmanim");
    expect(zmanim).toBeTruthy();
    expect(zmanim?.slide).toBeUndefined();
  });

  it("a single screen holds the board rather than turning over", () => {
    const slides = buildSlides(
      data,
      withScreens([{ id: "only", name: "הלוח", seconds: 0, blocks: [{ block: "prayers" }] }]),
      now,
      z,
    );
    expect(slides).toHaveLength(1);
    // Nothing to rotate to, so it must not expire and leave the wall blank.
    expect(slides[0].seconds).toBeGreaterThan(600);
  });

  it("drops a screen whose blocks had nothing on them today", () => {
    // No announcements exist in this data, so a screen of only announcements
    // would take its turn on the wall as an empty rectangle.
    const slides = buildSlides(
      data,
      withScreens([
        { id: "a", name: "תפילות", seconds: 20, blocks: [{ block: "prayers" }] },
        { id: "b", name: "הודעות", seconds: 12, blocks: [{ block: "announcements" }] },
      ]),
      now,
      z,
    );
    expect(slides.map((s) => s.id)).toEqual(["screen:a"]);
  });

  it("falls back to the ordinary board when every screen came out empty", () => {
    const slides = buildSlides(
      data,
      withScreens([{ id: "b", name: "הודעות", seconds: 12, blocks: [{ block: "announcements" }] }]),
      now,
      z,
    );
    // Better the board as it was than a wall with nothing on it.
    expect(slides.length).toBeGreaterThan(0);
    expect(slides.some((s) => s.kind === "composed")).toBe(false);
  });

  it("still lets Shabbat take the whole wall", () => {
    const friday = new Date("2026-09-18T19:30:00+03:00");
    const slides = buildSlides(
      data,
      withScreens([{ id: "a", name: "הלוח", seconds: 0, blocks: [{ block: "prayers" }] }]),
      friday,
      zmanimFor(friday, null),
    );
    // The Shabbat screen is decided before anything is composed, and must
    // stay that way: it is the one thing that takes the board whole.
    expect(slides[0].kind).toBe("shabbat");
  });
});
