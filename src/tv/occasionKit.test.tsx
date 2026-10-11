/**
 * A ready kit picked for an occasion - ראש חודש חשון תשפ״ז (ל׳ תשרי), on the
 * board of אושר של יהודי.
 *
 * Reported: the gabbai picked a ראש חודש kit in the occasion's settings, and
 * nothing changed. Two things stood in the way. The ready kits' ids carry
 * hyphens and run long (d_premium_rc_night-moon), and the occasions were read
 * with a pattern that allowed neither - the choice was dropped on saving. And
 * the occasion's screen drew its card over the whole board, so even a kit
 * that was kept was hidden behind it.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { zmanimFor } from "@community/lib/minyan-time";
import { boardConfig } from "./boardConfig";
import { applyDesign, findDesign } from "./designs";
import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "./config";
import { readOccasions, type Occasion } from "./occasions";
import { TvBoard } from "./TvBoard";
import { buildSlides, type BoardData } from "./useBoardData";
import { distinctIndex, distinctSlides } from "@community/components/admin/tv/tvPreviewData";

afterEach(cleanup);

const RC_DAY_1 = new Date("2026-10-11T11:00:00+03:00");
const z = zmanimFor(RC_DAY_1, null);
const KIT = "d_premium_rc_night-moon";

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

/** The board as it is stored and read back, with ראש חודש changed as asked. */
function board(rc: Partial<Occasion>, base: Partial<TvConfig> = {}): TvConfig {
  const c = { ...structuredClone(DEFAULT_TV_CONFIG), ...base };
  const occasions = readOccasions(c).map((o) =>
    o.id === "cal:rosh_chodesh" ? { ...o, enabled: true, display: "turns" as const, ...rc } : o,
  );
  return normalizeTvConfig(JSON.parse(JSON.stringify({ ...c, occasions })));
}

const rcOf = (c: TvConfig) => c.occasions.find((o) => o.id === "cal:rosh_chodesh")!;

/** The occasion's screen, drawn as the wall draws it (TvApp: its design over the board). */
function drawOccasion(c: TvConfig) {
  const slides = buildSlides(data, c, RC_DAY_1, z);
  const index = slides.findIndex((s) => s.id === "occasion:cal:rosh_chodesh");
  expect(index).toBeGreaterThanOrEqual(0);
  const dressed = boardConfig(c, { deviceClass: "tv", now: RC_DAY_1, settings: null, slideId: slides[index].id });
  return render(
    <TvBoard data={data} config={dressed} now={RC_DAY_1} zmanim={z} slides={slides} index={index} cycle={0} progress={0} paused={false} />,
  );
}

describe("a ready kit for an occasion", () => {
  it("is kept when the board is saved and read back", () => {
    expect(rcOf(board({ design: KIT })).design).toBe(KIT);
    expect(rcOf(board({ design: "d_premium_luminous-ivory" })).design).toBe("d_premium_luminous-ivory");
    // Still refuses what is not an id.
    expect(rcOf(board({ design: "javascript:alert(1)" })).design).toBeNull();
  });

  it("is the occasion's screen: the kit's picture and the day's name, not the card over it", () => {
    const { container } = drawOccasion(board({ design: KIT }));
    expect(container.querySelector(`img[src*="rosh-chodesh-night-moon"]`)).not.toBeNull();
    expect(container.querySelector(".tv-occasion")).toBeNull();
    expect(container.textContent).toContain("ראש חודש חשון");
  });

  it("an occasion with no kit keeps its card, even on a board that is a kit every day", () => {
    const ivory = applyDesign(structuredClone(DEFAULT_TV_CONFIG), findDesign(DEFAULT_TV_CONFIG, "d_premium_black-onyx")!);
    expect(ivory.screenLayout).toBe("composition");
    const { container } = drawOccasion(board({ design: null }, ivory));
    expect(container.querySelector(".tv-occasion")).not.toBeNull();
  });
});

describe("hiding an occasion's screens", () => {
  const ids = (c: TvConfig) => buildSlides(data, c, RC_DAY_1, z).map((s) => s.id);

  it("the extra screen of the board's blocks hides, and its blocks are kept for later", () => {
    const shown = board({ blocks: ["learning"] });
    expect(ids(shown)).toContain("occasion:cal:rosh_chodesh:blocks");
    const hidden = board({ blocks: ["learning"], blocksOff: true });
    expect(ids(hidden)).not.toContain("occasion:cal:rosh_chodesh:blocks");
    expect(ids(hidden)).toContain("occasion:cal:rosh_chodesh");
    expect(rcOf(hidden).blocks).toEqual(["learning"]);
  });

  it("the occasion's own screen hides too", () => {
    expect(ids(board({ display: "off" })).some((id) => id.startsWith("occasion:cal:rosh_chodesh"))).toBe(false);
  });
});

describe("on a board of parts", () => {
  // Everything is in one picture there: the board's turns look exactly alike.
  const parts = applyDesign(structuredClone(DEFAULT_TV_CONFIG), findDesign(DEFAULT_TV_CONFIG, "d_premium_black-onyx")!);
  const slides = (c: TvConfig) => buildSlides(data, c, RC_DAY_1, z);

  it("an occasion adds no screen of the board's blocks - it would be the board again", () => {
    const ids = slides(board({ blocks: ["learning"] }, parts)).map((s) => s.id);
    expect(ids).toContain("occasion:cal:rosh_chodesh");
    expect(ids).not.toContain("occasion:cal:rosh_chodesh:blocks");
  });

  it("the screens panel offers the board once and each occasion's screen, not seven look-alikes", () => {
    const c = board({ blocks: ["learning"] }, parts);
    const all = slides(c);
    expect(all.length).toBeGreaterThan(2);
    const entries = distinctSlides(all, c);
    expect(entries.map((e) => e.label)).toEqual(["הלוח", "ראש חודש"]);
    // An ordinary slide up on the wall shows as "הלוח".
    const ordinary = all.findIndex((s, i) => s.kind !== "occasion" && i !== entries[0].index);
    if (ordinary >= 0) expect(distinctIndex(all, entries, ordinary)).toBe(entries[0].index);
    // Any other board: every slide, as before.
    expect(distinctSlides(slides(board({ blocks: ["learning"] })), DEFAULT_TV_CONFIG).length).toBe(slides(board({ blocks: ["learning"] })).length);
  });
});
