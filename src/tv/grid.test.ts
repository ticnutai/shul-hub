import { describe, expect, it } from "vitest";

import type { BlockEntry, ScreenRow } from "./config";
import { arrange, gridOf, moveBlock, percents, setHeight, setRowShare, setShare } from "./grid";

const blocks: BlockEntry[] = [
  { block: "header" },
  { block: "prayers" },
  { block: "zmanim" },
  { block: "learning" },
  { block: "announcements" },
  { block: "shiurim" },
];
const ids = (rows: ScreenRow[]) => rows.map((r) => r.blocks.join("+"));

describe("a screen's rows", () => {
  it("without a hand arrangement, as the areas place them, all of a size", () => {
    const rows = arrange(blocks);
    expect(rows.map((r) => r.entries.map((e) => e.block).join("+"))).toEqual(["prayers+zmanim", "learning+announcements", "shiurim"]);
    expect(rows.every((r) => r.height === 1 && r.widths.every((w) => w === 1))).toBe(true);
  });

  it("with one, as arranged; what is switched off drops out, what is new joins at the bottom", () => {
    const grid: ScreenRow[] = [
      { blocks: ["zmanim", "slideshow"], widths: [2, 1], height: 1.5 },
      { blocks: ["prayers"], widths: [1], height: 1 },
    ];
    const rows = arrange(blocks, grid);
    expect(rows.map((r) => r.entries.map((e) => e.block).join("+"))).toEqual(["zmanim", "prayers", "learning+announcements", "shiurim"]);
    expect(rows[0]).toMatchObject({ widths: [2], height: 1.5 });
  });
});

describe("arranging by hand", () => {
  const start = gridOf(arrange(blocks));

  it("moves a block beside another, and into a row of its own", () => {
    expect(ids(moveBlock(start, "shiurim", { row: 0, index: 1 })!)).toEqual(["prayers+shiurim+zmanim", "learning+announcements"]);
    expect(ids(moveBlock(start, "prayers", { newRowAt: 0 })!)).toEqual(["prayers", "zmanim", "learning+announcements", "shiurim"]);
  });

  it("moves a block along its own row, keeping its width", () => {
    const wide = setShare(start, 0, 0, 0.7);
    const moved = moveBlock(wide, "prayers", { row: 0, index: 2 })!;
    expect(ids(moved)[0]).toBe("zmanim+prayers");
    expect(moved[0].widths).toEqual([wide[0].widths[1], wide[0].widths[0]]);
  });

  it("will not put a fourth block in a row", () => {
    const three = moveBlock(start, "shiurim", { row: 0, index: 0 })!;
    expect(moveBlock(three, "learning", { row: 0, index: 0 })).toBeNull();
  });

  it("splits a row between two blocks, never under 15% each", () => {
    expect(percents(setShare(start, 0, 0, 0.62)[0].widths)).toEqual([62, 38]);
    expect(percents(setShare(start, 0, 0, 0.02)[0].widths)).toEqual([15, 85]);
  });

  it("makes a row taller or shorter, within reason", () => {
    expect(setHeight(start, 1, 1.75)[1].height).toBe(1.75);
    expect(setHeight(start, 1, 9)[1].height).toBe(3);
    expect(setHeight(start, 1, 0)[1].height).toBe(0.4);
  });
});

describe("the shares shown", () => {
  it("always add up to the whole row", () => {
    expect(percents([0.73, 0.27]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(percents([1, 1, 1])).toEqual([33, 33, 34]);
  });
});

describe("the line between two rows", () => {
  const start = gridOf(arrange(blocks));
  it("gives one row what it takes from the other, and leaves the rest", () => {
    const next = setRowShare(start, 0, 0.7);
    expect(next[0].height).toBe(1.4);
    expect(next[1].height).toBe(0.6);
    expect(next[2].height).toBe(start[2].height);
  });
  it("keeps both rows readable, and does nothing past the last row", () => {
    const tight = setRowShare(start, 0, 0.99);
    expect(tight[1].height).toBeCloseTo(0.3, 2);
    expect(setRowShare(start, 2, 0.5)).toBe(start);
  });
});
