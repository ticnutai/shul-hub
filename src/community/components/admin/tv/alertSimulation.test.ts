/**
 * The simulation's clock in the editor: it starts a minute before the first
 * step, runs at the speed chosen, stops a minute after the time, jumps to a
 * step, and gives the preview back - to the real time, or to whatever other
 * control took it.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { zmanimFor } from "@community/lib/minyan-time";
import { DEFAULT_TV_CONFIG, type TvConfig } from "@/tv/config";
import { useAlertSimulation } from "./alertSimulation";

const alerts: TvConfig["alerts"] = { ...DEFAULT_TV_CONFIG.alerts, mode: "staged", events: ["sof_zman_shma"], stages: { highlight: 30, panel: 20, board: 10 } };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date("2026-10-14T03:00:00Z")); // a Wednesday, early
});
afterEach(() => vi.useRealTimers());

describe("the reminder's simulation in the editor", () => {
  it("runs the preview's clock up to the time and a minute past it, at the speed chosen", () => {
    const show = vi.fn<(at: Date | null) => void>();
    const { result } = renderHook(() => useAlertSimulation(alerts, null, show));
    const shma = zmanimFor(new Date(), null).sof_zman_shma!;
    expect(result.current.at?.getTime()).toBe(shma.getTime());
    expect(result.current.dayNote).toBe("היום");

    act(() => result.current.play());
    // A minute before the first step.
    expect(result.current.moment?.getTime()).toBe(shma.getTime() - 31 * 60_000);
    expect(show).toHaveBeenLastCalledWith(result.current.moment);
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.moment?.getTime()).toBe(shma.getTime() - 31 * 60_000 + 200);

    act(() => result.current.setSpeed(60));
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.moment?.getTime()).toBe(shma.getTime() - 31 * 60_000 + 200 + 12_000);

    // To the end: a minute after the time, and there it waits.
    for (let i = 0; i < 300 && result.current.playing; i++) act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.playing).toBe(false);
    expect(result.current.moment?.getTime()).toBe(shma.getTime() + 60_000);
  });

  it("jumps to a step, and gives the preview back - to the real time, or to the control that took it", () => {
    const show = vi.fn<(at: Date | null) => void>();
    const { result } = renderHook(() => useAlertSimulation(alerts, null, show));
    const shma = result.current.at!.getTime();
    act(() => result.current.jump(10));
    expect(result.current.moment?.getTime()).toBe(shma - 10 * 60_000 + 3_000);
    act(() => result.current.stop());
    expect(result.current.moment).toBeNull();
    expect(show).toHaveBeenLastCalledWith(null);

    act(() => result.current.jump(20));
    show.mockClear();
    // "תצוגה בתאריך" took the preview: the simulation lets go and touches nothing.
    act(() => result.current.halt());
    expect(result.current.moment).toBeNull();
    expect(show).not.toHaveBeenCalled();
  });

  it("on Friday takes Sunday's times", () => {
    vi.setSystemTime(new Date("2026-10-16T03:00:00Z"));
    const { result } = renderHook(() => useAlertSimulation(alerts, null, () => {}));
    expect(result.current.dayNote).toBe("ביום ראשון");
    expect(result.current.at!.getTime() - Date.now()).toBeGreaterThan(2 * 86_400_000 - 86_400_000);
  });
});
