/**
 * Shabbat and the festivals on a board built of screens.
 *
 * Two things went wrong when the board became screens. Shabbat had been a
 * mode that took the whole board from candle lighting; on a composed board
 * that takeover was switched off - nothing may take the board uninvited - and
 * nothing took its place, so תורה ואהבתה would have shown its weekday screens
 * with their notices right through Shabbat. And the day's screen stayed in the
 * rotation on ordinary days, drawing nothing for its forty seconds.
 *
 * Now both are screens that appear in their time, and only then.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { zmanimFor } from "@community/lib/minyan-time";

import { forgetServerTime } from "./clock";
import { DEFAULT_TV_CONFIG, type Screen, type TvConfig } from "./config";
import { buildSlides, composedRows, type BoardData } from "./useBoardData";

beforeEach(() => forgetServerTime());

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

const BOARD: Screen = { id: "board", name: "הלוח", seconds: 40, blocks: [{ block: "header" }, { block: "zmanim" }] };
const FESTIVAL: Screen = { id: "festival", name: "מסך החג", seconds: 40, blocks: [{ block: "festival" }] };
const SHABBAT: Screen = { id: "shabbat", name: "שבת", seconds: 40, blocks: [{ block: "shabbat" }] };

const board = (screens: Screen[], patch: Partial<TvConfig> = {}): TvConfig => ({
  ...structuredClone(DEFAULT_TV_CONFIG),
  screens,
  ...patch,
});

/** Which screens are on the wall at this moment (Jerusalem time). */
function onWall(config: TvConfig, at: string): string[] {
  const now = new Date(`${at}+03:00`);
  return buildSlides(data, config, now, zmanimFor(now, null)).map((s) => `${s.id}:${s.kind}`);
}

const ALL = [BOARD, FESTIVAL, SHABBAT];

describe("on a board built of screens", () => {
  it("an ordinary weekday shows the ordinary screens, and no empty day's screen", () => {
    // Wednesday 14.10.2026: no festival, no Shabbat.
    expect(onWall(board(ALL), "2026-10-14T10:00:00")).toEqual(["screen:board:composed"]);
  });

  it("on chol hamoed the day's screen takes its turn with the board", () => {
    // Tuesday 29.9.2026, chol hamoed Sukkot.
    expect(onWall(board(ALL), "2026-09-29T10:00:00")).toEqual([
      "screen:board:composed",
      "screen:festival:composed",
    ]);
  });

  it("Friday morning is still a weekday", () => {
    expect(onWall(board(ALL), "2026-10-09T11:00:00")).toEqual(["screen:board:composed"]);
  });

  it("from candle lighting, the Shabbat screen", () => {
    expect(onWall(board(ALL), "2026-10-09T18:45:00")).toEqual(["screen:shabbat:shabbat"]);
  });

  it("all through Shabbat, and nothing else - no notices on Shabbat", () => {
    // Shabbat Bereshit, 10.10.2026.
    expect(onWall(board(ALL), "2026-10-10T10:00:00")).toEqual(["screen:shabbat:shabbat"]);
  });

  it("and the weekday board is back after Shabbat ends", () => {
    expect(onWall(board(ALL), "2026-10-10T20:30:00")).toEqual(["screen:board:composed"]);
  });

  it("what is on the Shabbat screen is the gabbai's to decide", () => {
    const withTimes: Screen = { ...SHABBAT, blocks: [{ block: "shabbat" }, { block: "zmanim" }] };
    const slides = buildSlides(
      data,
      board([BOARD, withTimes]),
      new Date("2026-10-10T10:00:00+03:00"),
      zmanimFor(new Date("2026-10-10T10:00:00+03:00"), null),
    );
    expect(slides).toHaveLength(1);
    expect(slides[0].kind).toBe("composed");
    const parts = slides[0].kind === "composed" ? slides[0].parts.map((p) => p.block) : [];
    expect(parts).toEqual(["shabbat", "zmanim"]);
  });

  it("a board he built without a Shabbat screen keeps its screens on Shabbat", () => {
    // Nothing takes the board that was not put on it.
    expect(onWall(board([BOARD]), "2026-10-10T10:00:00")).toEqual(["screen:board:composed"]);
  });

  it("the Shabbat switch still switches it off", () => {
    const off = board(ALL, { shabbat: { ...DEFAULT_TV_CONFIG.shabbat, enabled: false } });
    expect(onWall(off, "2026-10-10T10:00:00")).toEqual(["screen:board:composed"]);
  });
});

describe("the day's block beside other content", () => {
  const BOARD_WITH_DAY: Screen = { ...BOARD, blocks: [...BOARD.blocks, { block: "festival" }] };

  it("keeps the screen itself on a festival, with the day as a card rather than a cell", () => {
    // Saved like this on תורה ואהבתה: the board with the day's block turned on.
    // Drawn as the day's full screen it hid every time on it all chol hamoed.
    const now = new Date("2026-09-29T10:00:00+03:00");
    const [first] = buildSlides(data, board([BOARD_WITH_DAY, FESTIVAL]), now, zmanimFor(now, null));
    expect(first.kind).toBe("composed");
    if (first.kind !== "composed") return;
    expect(first.parts.map((p) => p.block)).toEqual(["zmanim", "festival"]);
    // The grid has no empty cell for it.
    expect(composedRows(first.parts).flat().map((p) => p.block)).toEqual(["zmanim"]);
  });

  it("and on an ordinary day is simply the board", () => {
    expect(onWall(board([BOARD_WITH_DAY, FESTIVAL]), "2026-10-14T10:00:00")).toEqual(["screen:board:composed"]);
  });

  it("a Shabbat screen with prayer times on it is not shown on a weekday", () => {
    const shabbatWithTimes: Screen = { ...SHABBAT, blocks: [{ block: "shabbat" }, { block: "zmanim" }] };
    expect(onWall(board([BOARD, shabbatWithTimes]), "2026-10-14T10:00:00")).toEqual(["screen:board:composed"]);
  });
});
