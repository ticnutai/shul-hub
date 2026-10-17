import { describe, expect, it } from "vitest";
import { blankBoard, STARTER_BLOCKS, STARTER_DEFAULT } from "./blankBoard";
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
    // Built of parts.
    expect(c.screenLayout).toBe("composition");
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

  it("is built of parts: each block ticked a container - a board, a frame, a heading and its content", () => {
    const c = blankBoard(board(), ["prayers", "zmanim", "shiurim", "header", "footer"]);
    expect(c.containers.map((x) => x.name).sort()).toEqual(["זמני היום", "שורת הפרשה והנרות", "שיעורים", "שם בית הכנסת", "תפילות היום"].sort());
    const prayers = c.containers.find((x) => x.name === "תפילות היום")!;
    const own = c.elements.filter((e) => e.group === prayers.id);
    expect(own.map((e) => e.kind)).toEqual(["box", "frame", "text", "text"]);
    expect(own.find((e) => e.binding)?.binding).toBe("prayers");
    // Inside the board, none over another's place.
    for (const e of c.elements) expect(e.x >= 0 && e.y >= 0 && e.x + e.width <= 100.01 && e.y + e.height <= 100.01).toBe(true);
    const boxes = c.elements.filter((e) => e.kind === "box");
    for (const a of boxes) for (const b of boxes) if (a !== b)
      expect(a.x + a.width <= b.x + 0.01 || b.x + b.width <= a.x + 0.01 || a.y + a.height <= b.y + 0.01 || b.y + b.height <= a.y + 0.01).toBe(true);
    expect(normalizeTvConfig(c).elements).toHaveLength(c.elements.length);
  });

  it("the usual choice - what was the system's basic board - is of parts too", () => {
    const c = blankBoard(board(), STARTER_DEFAULT);
    expect(c.screenLayout).toBe("composition");
    expect(c.containers.map((x) => x.name)).toEqual(expect.arrayContaining(["שם בית הכנסת", "שעון", "תפילות היום", "זמני היום"]));
    expect(c.texts["header.title"]).toBe("אהל אברהם");
  });
});
