/**
 * The countdown before סוף זמן קריאת שמע on a board of parts, as אושר של
 * יהודי stores it (scripts/set-alerts.mjs): from 10 minutes before, in the
 * prayers' box; from 5, over the whole board.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { zmanimFor } from "@community/lib/minyan-time";
import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "./config";
import { applyDesign, findDesign } from "./designs";
import { TvBoard } from "./TvBoard";
import { buildSlides, type BoardData } from "./useBoardData";

afterEach(cleanup);

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

const board: TvConfig = normalizeTvConfig(
  JSON.parse(
    JSON.stringify({
      ...applyDesign(structuredClone(DEFAULT_TV_CONFIG), findDesign(DEFAULT_TV_CONFIG, "d_premium_black-onyx")!),
      alerts: {
        enabled: true,
        mode: "staged",
        events: ["sof_zman_shma_mga72", "sof_zman_shma", "sof_zman_tefila_mga72", "sof_zman_tefila"],
        stages: { highlight: 10, panel: 10, board: 5 },
      },
    }),
  ),
);

function drawAt(minutesBefore: number) {
  const z = zmanimFor(new Date("2026-10-12T06:00:00+03:00"), null);
  const now = new Date(z.sof_zman_shma!.getTime() - minutesBefore * 60_000);
  const slides = buildSlides(data, board, now, z);
  return render(<TvBoard data={data} config={board} now={now} zmanim={z} slides={slides} index={0} cycle={0} progress={0} paused={false} />);
}

describe("סוף זמן קריאת שמע on a board of parts", () => {
  it("11 minutes before: nothing yet", () => {
    const { container } = drawAt(11);
    expect(container.querySelector('[data-testid="prayer-deadline"]')).toBeNull();
    expect(container.querySelector('[data-testid="board-deadline"]')).toBeNull();
  });

  it("7 minutes before: the countdown in the prayers' box, the board as it is", () => {
    const { container } = drawAt(7);
    expect(container.querySelector('[data-testid="prayer-deadline"][data-event="sof_zman_shma"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="board-deadline"]')).toBeNull();
  });

  it("3 minutes before: the countdown over the whole board, once", () => {
    const { container } = drawAt(3);
    expect(container.querySelectorAll('[data-testid="board-deadline"][data-event="sof_zman_shma"]')).toHaveLength(1);
  });
});
