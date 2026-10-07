/**
 * The countdown reminders, drawn on a board: in the look the gabbai chose,
 * where it was chosen, and - on a board of parts, which has no footer - the
 * small strip standing at the foot of the board on its own.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { zmanimFor } from "@community/lib/minyan-time";

import { DEFAULT_TV_CONFIG, type TvConfig } from "./config";
import { applyDesign } from "./designs";
import { PREMIUM_DESIGNS } from "./premiumDesigns";
import { TvBoard } from "./TvBoard";
import { buildSlides, type BoardData } from "./useBoardData";

afterEach(cleanup);

const data: BoardData = {
  settings: null, minyanim: [], categories: [], announcements: [], shiurim: [], overrides: [],
  stale: false, anyLoaded: true, sync: { status: "live", lastSyncedAt: null },
};
// A Wednesday morning, before the end of the time for the shma.
const day = new Date("2026-10-07T07:00:00+03:00");
const shma = zmanimFor(day, null).sof_zman_shma!;
const draw = (config: TvConfig, minutesBefore: number) => {
  const at = new Date(shma.getTime() - minutesBefore * 60_000 + 1000);
  const zm = zmanimFor(at, null);
  return render(
    <TvBoard data={data} config={config} now={at} zmanim={zm} slides={buildSlides(data, config, at, zm)} index={0} cycle={0} progress={0} paused={false} />,
  );
};
const pulse = (patch: Partial<TvConfig["alerts"]> = {}): TvConfig => ({
  ...structuredClone(DEFAULT_TV_CONFIG),
  alerts: { ...DEFAULT_TV_CONFIG.alerts, mode: "pulse", events: ["sof_zman_shma"], leadMinutes: [15], popupSeconds: 40, ...patch },
});

describe("the reminder's look, on the board", () => {
  it("draws the card where and as chosen: colours, shape, size, place, what is behind, its symbol", () => {
    const look = { ...DEFAULT_TV_CONFIG.alerts.look, style: "crimson" as const, shape: "arch" as const, size: "small" as const, position: "top" as const, dim: "none" as const, icon: "candle" as const };
    const { container } = draw(pulse({ look }), 15);
    const backdrop = container.querySelector<HTMLElement>('[data-testid="board-deadline"]')!;
    expect(backdrop).toBeTruthy();
    expect(backdrop.dataset).toMatchObject({ position: "top", dim: "none" });
    expect(container.querySelector(".tv-alert-card")!.getAttribute("data-shape")).toBe("arch");
    expect(container.querySelector(".tv-alert-icon")!.textContent).toBe("🕯️");
    const root = container.querySelector<HTMLElement>(".tv-root")!;
    expect(root.style.getPropertyValue("--al-bg")).toBe("#4a0e17");
    expect(root.style.getPropertyValue("--al-scale")).toBe("0.72");
  });

  it("keeps the board's own colours by default, and no symbol when none is chosen", () => {
    const { container } = draw(pulse({ look: { ...DEFAULT_TV_CONFIG.alerts.look, icon: "none" } }), 15);
    const root = container.querySelector<HTMLElement>(".tv-root")!;
    expect(root.style.getPropertyValue("--al-bg")).toBe("");
    expect(container.querySelector(".tv-alert-card")).toBeTruthy();
    expect(container.querySelector(".tv-alert-icon")).toBeNull();
  });

  it("shows the small strip at the foot of a board of parts, which has no footer", () => {
    const parts = { ...applyDesign(structuredClone(DEFAULT_TV_CONFIG), PREMIUM_DESIGNS[0]), alerts: pulse().alerts };
    const { container } = draw(parts, 12);
    const chip = container.querySelector('[data-testid="floating-deadline"]');
    expect(chip?.textContent).toContain("סוף זמן קריאת שמע");
    // An ordinary board keeps it in its footer, not floating.
    cleanup();
    const ordinary = draw(pulse(), 12);
    expect(ordinary.container.querySelector('[data-testid="floating-deadline"]')).toBeNull();
    expect(ordinary.container.querySelector(".tv-footer .tv-alert-chip")).toBeTruthy();
  });

  it("follows the gabbai's steps on the board: the whole board at its step", () => {
    const staged = (board: number) => pulse({ mode: "staged", stages: { highlight: 30, panel: 20, board } });
    expect(draw(staged(10), 8).container.querySelector('[data-testid="board-deadline"]')).toBeTruthy();
    cleanup();
    expect(draw(staged(5), 8).container.querySelector('[data-testid="board-deadline"]')).toBeNull();
  });
});
