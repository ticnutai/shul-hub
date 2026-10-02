/**
 * Where an occasion's design is worn (occasions.ts `designOn`): on its own
 * screen only - the board's ordinary screens keeping their look - or on the
 * whole board while it is on. הושענא רבה תשפ״ז in carved wood, on the navy
 * board of אושר של יהודי, taking turns with the ordinary screen.
 */
import { describe, expect, it } from "vitest";
import { boardConfig } from "./boardConfig";
import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "./config";
import { readOccasions, type Occasion } from "./occasions";

const HOSHANA_RABA = new Date("2026-10-02T10:00:00+03:00");

function board(designOn: Occasion["designOn"]): TvConfig {
  const base = { ...structuredClone(DEFAULT_TV_CONFIG), theme: "navy", screenLayout: "medallion" as const };
  const occasions = readOccasions(base).map((o) =>
    o.id === "cal:hoshana_raba" ? { ...o, enabled: true, display: "turns" as const, design: "d_wood", designOn } : o,
  );
  return normalizeTvConfig(JSON.parse(JSON.stringify({ ...base, occasions })));
}

const at = (c: TvConfig, slideId?: string) =>
  boardConfig(c, { deviceClass: "tv", now: HOSHANA_RABA, settings: null, slideId });

describe("an occasion's design", () => {
  it("is read as 'its screen only' unless the board was told otherwise", () => {
    expect(board("screen").occasions.find((o) => o.id === "cal:hoshana_raba")!.designOn).toBe("screen");
    const stored = JSON.parse(JSON.stringify(board("screen")));
    delete stored.occasions.find((o: { id: string }) => o.id === "cal:hoshana_raba").designOn;
    expect(normalizeTvConfig(stored).occasions.find((o) => o.id === "cal:hoshana_raba")!.designOn).toBe("screen");
  });

  it("on its screen only: the occasion's screen in wood, the ordinary screens in their own navy", () => {
    const c = board("screen");
    expect(at(c).frameStyle.image).toBeNull();
    expect(at(c).theme).toBe("navy");
    expect(at(c, "screen:main").frameStyle.image).toBeNull();
    expect(at(c, "occasion:cal:hoshana_raba").frameStyle.image).toBe("frame:carved-wood");
    expect(at(c, "occasion:cal:hoshana_raba:screen").theme).toBe("stone");
  });

  it("on the whole board: every screen in wood while it is on", () => {
    const c = board("board");
    expect(at(c).frameStyle.image).toBe("frame:carved-wood");
    expect(at(c, "screen:main").frameStyle.image).toBe("frame:carved-wood");
  });
});
