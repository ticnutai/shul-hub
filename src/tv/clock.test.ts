import { beforeEach, describe, expect, it } from "vitest";

import { checkClock, forgetServerTime, noteServerTime } from "./clock";

/**
 * A board that does not know what time it is shows the wrong times, neatly,
 * and looks entirely deliberate about it. These checks are the only thing
 * standing between that and the wall.
 */
describe("whether the board can believe its clock", () => {
  beforeEach(() => forgetServerTime());

  it("believes an ordinary clock with nothing remembered", () => {
    expect(checkClock(new Date(2026, 8, 22, 18, 0)).trusted).toBe(true);
  });

  it("does not believe a date from before the software existed", () => {
    // What a box with no memory and no network comes back with.
    const c = checkClock(new Date(1970, 0, 1));
    expect(c.trusted).toBe(false);
    expect(c.reason).toContain("לפני התוכנה");
    expect(checkClock(new Date(2020, 5, 1)).trusted).toBe(false);
  });

  it("does not believe a clock that has gone backwards", () => {
    noteServerTime(new Date(2026, 8, 22, 18, 0).getTime());
    // The box lost power and came back thinking it was last week.
    const c = checkClock(new Date(2026, 8, 15, 18, 0));
    expect(c.trusted).toBe(false);
    expect(c.reason).toContain("אחורה");
  });

  it("is not upset by clocks disagreeing by a minute", () => {
    noteServerTime(new Date(2026, 8, 22, 18, 0).getTime());
    expect(checkClock(new Date(2026, 8, 22, 17, 58)).trusted).toBe(true);
    expect(checkClock(new Date(2026, 8, 22, 18, 30)).trusted).toBe(true);
  });

  it("keeps the latest time it was told, not the last one it heard", () => {
    noteServerTime(new Date(2026, 8, 22, 18, 0).getTime());
    noteServerTime(new Date(2026, 8, 22, 12, 0).getTime()); // an older answer
    // Still judged against the later one.
    expect(checkClock(new Date(2026, 8, 22, 13, 0)).trusted).toBe(false);
  });

  it("ignores a server time that is itself nonsense", () => {
    noteServerTime(NaN);
    noteServerTime(0);
    noteServerTime(new Date(1999, 0, 1).getTime());
    expect(checkClock(new Date(2026, 8, 22, 18, 0)).trusted).toBe(true);
  });

  it("says no to a clock that is not a time at all", () => {
    expect(checkClock(new Date(NaN)).trusted).toBe(false);
  });
});
