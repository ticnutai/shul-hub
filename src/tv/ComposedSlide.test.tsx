/**
 * A composed screen actually drawn, not merely computed.
 *
 * The tests next door prove that the right parts end up on the right screen.
 * They would all still pass if the view that draws those parts threw on
 * mount, which is not a theoretical worry here: a board once passed its type
 * check and its unit tests and then died in the browser on a missing import,
 * and the wall showed nothing. The admin preview needs a signed-in account,
 * so this is where a composed screen gets mounted for real.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { zmanimFor } from "@community/lib/minyan-time";

import { DEFAULT_TV_CONFIG, type Screen, type TvConfig } from "./config";
import { SlideView } from "./TvSlides";
import { buildSlides, type BoardData } from "./useBoardData";

afterEach(cleanup);

const now = new Date("2026-09-16T10:00:00+03:00");
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

function draw(screens: Screen[]) {
  const config: TvConfig = { ...structuredClone(DEFAULT_TV_CONFIG), screens };
  const slide = buildSlides(data, config, now, z)[0];
  if (slide.kind !== "composed") throw new Error(`expected a composed screen, got ${slide.kind}`);
  return { slide, ...render(<SlideView slide={slide} now={now} zmanim={z} paused={false} />) };
}

describe("drawing a composed screen", () => {
  it("mounts, which is the part a type check cannot promise", () => {
    const { container } = draw([
      { id: "a", name: "הלוח", seconds: 0, blocks: [{ block: "prayers" }, { block: "zmanim" }] },
    ]);
    expect(container.querySelector(".tv-composed")).toBeTruthy();
    expect(container.querySelector('[data-screen="a"]')).toBeTruthy();
  });

  it("puts both blocks on the wall, each drawn by the view that always drew it", () => {
    const { container } = draw([
      { id: "a", name: "הלוח", seconds: 0, blocks: [{ block: "prayers" }, { block: "zmanim" }] },
    ]);
    const cells = container.querySelectorAll(".tv-composed-cell");
    expect(cells.length).toBe(2);
    // The zmanim panel is the same panel as everywhere else - it names the
    // day's times - so finding one of them is finding the real component.
    expect(screen.getByText("זמני היום")).toBeTruthy();
    expect(screen.getByText("זמני התפילות")).toBeTruthy();
  });

  it("does not show the zmanim twice when the screen has both blocks", () => {
    // The first thing a composed screen drew had two zmanim panels on it: the
    // prayer panel carries its own in most layouts, and the zmanim block drew
    // another beside it. Exactly the duplication this change is about, so it
    // is held down here rather than remembered.
    draw([{ id: "a", name: "הלוח", seconds: 0, blocks: [{ block: "prayers" }, { block: "zmanim" }] }]);
    expect(screen.getAllByText("זמני היום")).toHaveLength(1);
  });

  it("keeps the prayer panel's own zmanim when there is no zmanim block", () => {
    draw([{ id: "a", name: "הלוח", seconds: 0, blocks: [{ block: "prayers" }] }]);
    expect(screen.getAllByText("זמני היום")).toHaveLength(1);
  });

  it("stands them side by side, which is what the composer's sketch showed", () => {
    const { container } = draw([
      { id: "a", name: "הלוח", seconds: 0, blocks: [{ block: "prayers" }, { block: "zmanim" }] },
    ]);
    const rows = container.querySelectorAll(".tv-composed-row");
    expect(rows.length).toBe(1);
    expect(within(rows[0] as HTMLElement).getAllByText(/./).length).toBeGreaterThan(0);
    expect((rows[0] as HTMLElement).style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
  });

  it("gives a pinned block its own side", () => {
    const { container } = draw([
      {
        id: "a",
        name: "הלוח",
        seconds: 0,
        blocks: [{ block: "zmanim", area: "right" }, { block: "prayers", area: "left" }],
      },
    ]);
    const row = container.querySelector(".tv-composed-row") as HTMLElement;
    expect(row.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    expect(container.querySelectorAll(".tv-composed-cell").length).toBe(2);
  });

  it("one block takes the screen on its own", () => {
    const { container } = draw([{ id: "a", name: "הלוח", seconds: 0, blocks: [{ block: "learning" }] }]);
    const row = container.querySelector(".tv-composed-row") as HTMLElement;
    expect(row.style.gridTemplateColumns).toBe("repeat(1, minmax(0, 1fr))");
  });
});
