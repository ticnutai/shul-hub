import { describe, expect, it } from "vitest";
import { blankBoard, STARTER_BLOCKS } from "./blankBoard";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "./config";

const board = () =>
  normalizeTvConfig({
    theme: "forest",
    backgroundImage: "backdrop:sky",
    boardFrame: "columns",
    titleStyle: "ribbon",
    frameStyle: { line: "#c9a227" },
    frameLooks: { zmanim: { bg: "#5a1a2a" } },
    texts: { "header.title": "אהל אברהם" },
    perDevice: { tv: { boardFrame: "parochet", clockStyle: "analog", texts: { "header.title": "קצר" } } },
    screenLayout: "dashboard",
  });

describe("a board started from nothing", () => {
  it("has one screen with only what was ticked on it", () => {
    const c = blankBoard(board(), ["prayers", "clock", "header"]);
    expect(c.screens).toHaveLength(1);
    expect(c.screens![0].blocks.map((b) => b.block).sort()).toEqual(["clock", "header", "prayers"]);
  });

  it("wears the plainest look there is", () => {
    const c = blankBoard(board(), ["prayers"]);
    expect(c.backgroundImage).toBeNull();
    expect(c.boardFrame).toBeNull();
    expect(c.titleStyle).toBe("plain");
    expect(c.frameStyle).toEqual(DEFAULT_TV_CONFIG.frameStyle);
    expect(c.frameLooks).toEqual({});
    expect(c.theme).toBe(DEFAULT_TV_CONFIG.theme);
    expect(c.screenLayout).toBe(DEFAULT_TV_CONFIG.screenLayout);
  });

  it("keeps the shul's own content, and a screen's settings that are not a look", () => {
    const c = blankBoard(board(), ["prayers"]);
    expect(c.texts["header.title"]).toBe("אהל אברהם");
    expect(c.perDevice.tv).toEqual({ texts: { "header.title": "קצר" } });
  });

  it("offers no day's screen as a block - those are occasions", () => {
    expect(STARTER_BLOCKS).not.toContain("shabbat");
    expect(STARTER_BLOCKS).not.toContain("festival");
    expect(blankBoard(board(), ["shabbat", "prayers"]).screens![0].blocks.map((b) => b.block)).toEqual(["prayers"]);
  });

  it("is an ordinary, valid board", () => {
    const c = blankBoard(board(), ["prayers", "zmanim", "footer"]);
    expect(normalizeTvConfig(c).screens).toEqual(c.screens);
  });
});
