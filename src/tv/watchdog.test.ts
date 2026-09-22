import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  blockedRatio,
  createBreaker,
  createRunawayWatch,
  setWatchdogReport,
  watchMainThread,
} from "./watchdog";

/**
 * jsdom has no long-task reporting, so the browser's half is stood in for:
 * the test decides how long the main thread was blocked, and the watchdog
 * has to draw the right conclusion from it.
 */
function stubLongTasks() {
  let deliver: ((ms: number) => void) | null = null;
  class Stub {
    constructor(private cb: (list: { getEntries: () => { duration: number }[] }) => void) {}
    observe() {
      deliver = (ms) => this.cb({ getEntries: () => [{ duration: ms }] });
    }
    disconnect() {
      deliver = null;
    }
    static supportedEntryTypes = ["longtask"];
  }
  vi.stubGlobal("PerformanceObserver", Stub);
  return {
    block: (ms: number) => deliver?.(ms),
    get observing() {
      return deliver !== null;
    },
  };
}

/** A clock we hold still, so the window is the test's and not the machine's. */
function clock(start = 0) {
  let t = start;
  return { now: () => t, tick: (ms: number) => (t += ms) };
}

beforeEach(() => {
  setWatchdogReport(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("the breaker", () => {
  it("lets the honest case through: a burst, a pause, another burst", () => {
    const c = clock();
    const b = createBreaker({ name: "fit", limit: 10, windowMs: 1000, now: c.now });

    for (let slide = 0; slide < 50; slide++) {
      // A slide change: a few measurements, then twenty quiet seconds.
      for (let i = 0; i < 5; i++) expect(b.allow()).toBe(true);
      c.tick(20_000);
    }
    expect(b.tripped).toBe(false);
  });

  it("trips on a spin, and stays off afterwards", () => {
    const c = clock();
    const onTrip = vi.fn();
    const b = createBreaker({ name: "fit", limit: 10, windowMs: 1000, onTrip, now: c.now });

    let allowed = 0;
    for (let i = 0; i < 1000; i++) {
      if (b.allow()) allowed++;
      c.tick(1); // a loop that runs every millisecond
    }

    expect(allowed).toBe(10);
    expect(b.tripped).toBe(true);
    expect(onTrip).toHaveBeenCalledTimes(1);
    expect(onTrip).toHaveBeenCalledWith({ name: "fit", runs: 11, windowMs: 1000 });
  });

  it("says so, once, through the board's link", () => {
    const report = vi.fn();
    setWatchdogReport(report);
    const b = createBreaker({ name: "התאמת גודל טקסט", limit: 2, windowMs: 1000 });

    for (let i = 0; i < 20; i++) b.allow();

    expect(report).toHaveBeenCalledTimes(1);
    const [level, kind, message] = report.mock.calls[0];
    expect(level).toBe("error");
    expect(kind).toBe("watchdog");
    expect(message).toContain("התאמת גודל טקסט");
  });

  it("survives a link that throws", () => {
    setWatchdogReport(() => {
      throw new Error("offline");
    });
    const b = createBreaker({ name: "fit", limit: 1, windowMs: 1000 });
    expect(() => {
      b.allow();
      b.allow();
      b.allow();
    }).not.toThrow();
    expect(b.tripped).toBe(true);
  });

  it("counts a rolling window, not runs since the start", () => {
    const c = clock();
    const b = createBreaker({ name: "fit", limit: 3, windowMs: 1000, now: c.now });
    for (let i = 0; i < 100; i++) {
      expect(b.allow()).toBe(true);
      c.tick(400); // under the limit for any one second
    }
  });
});

describe("the main-thread watch", () => {
  it("measures how much of a window was blocked", () => {
    expect(blockedRatio(0, 10_000)).toBe(0);
    expect(blockedRatio(5_000, 10_000)).toBe(0.5);
    expect(blockedRatio(99_000, 10_000)).toBe(1); // never over 1
    expect(blockedRatio(100, 0)).toBe(0); // no window, no verdict
  });

  it("ignores one busy window - a slide change is allowed to cost", () => {
    const w = createRunawayWatch();
    expect(w.sample(9_000, 10_000)).toBe(false);
    expect(w.sample(200, 10_000)).toBe(false);
    expect(w.sample(9_000, 10_000)).toBe(false);
  });

  it("calls it a runaway when the blockage does not let up", () => {
    const w = createRunawayWatch();
    expect(w.sample(9_000, 10_000)).toBe(false);
    expect(w.sample(9_500, 10_000)).toBe(true);
  });

  it("does not fire twice for one spin; it waits for two fresh windows", () => {
    const w = createRunawayWatch();
    w.sample(9_000, 10_000);
    expect(w.sample(9_000, 10_000)).toBe(true);
    expect(w.sample(9_000, 10_000)).toBe(false);
    expect(w.sample(9_000, 10_000)).toBe(true);
  });
});

describe("the watchdog on the board", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  it("does nothing while the board behaves", () => {
    const tasks = stubLongTasks();
    const report = vi.fn();
    const reload = vi.fn();
    setWatchdogReport(report);
    const stop = watchMainThread({ reload, windowMs: 10_000 });

    for (let i = 0; i < 100; i++) {
      tasks.block(300); // a slide change now and then
      vi.advanceTimersByTime(10_000);
    }

    expect(report).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    stop();
    expect(tasks.observing).toBe(false);
  });

  it("reports a spin and reloads the board", () => {
    const tasks = stubLongTasks();
    const report = vi.fn();
    const reload = vi.fn();
    setWatchdogReport(report);
    watchMainThread({ reload, windowMs: 10_000 });

    for (let i = 0; i < 2; i++) {
      tasks.block(9_500);
      vi.advanceTimersByTime(10_000);
    }

    expect(reload).toHaveBeenCalledTimes(1);
    expect(report.mock.calls.map((c) => c[2]).join(" ")).toContain("95%");
  });

  it("reloads at most once an hour - a board in a reload loop is worse", () => {
    const tasks = stubLongTasks();
    const reload = vi.fn();
    setWatchdogReport(vi.fn());
    watchMainThread({ reload, windowMs: 10_000 });

    for (let i = 0; i < 20; i++) {
      tasks.block(9_500);
      vi.advanceTimersByTime(10_000);
    }

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("keeps out of the way where the browser cannot report long tasks", () => {
    vi.stubGlobal("PerformanceObserver", undefined);
    const reload = vi.fn();
    expect(() => watchMainThread({ reload })()).not.toThrow();
    expect(reload).not.toHaveBeenCalled();
  });
});
