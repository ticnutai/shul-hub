import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STATUS_MESSAGE_MS, useBriefly } from "./useBriefly";

describe("a status message is up for one minute", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows for a minute, hides, and comes back for a minute when the status changes", () => {
    const { result, rerender } = renderHook(({ k }) => useBriefly(k), { initialProps: { k: "offline" } });
    expect(result.current).toBe(true);
    act(() => void vi.advanceTimersByTime(STATUS_MESSAGE_MS - 1000));
    expect(result.current).toBe(true);
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current).toBe(false);
    rerender({ k: "offline" }); // same status: stays hidden
    expect(result.current).toBe(false);
    rerender({ k: "live" }); // changed: a minute again
    expect(result.current).toBe(true);
    act(() => void vi.advanceTimersByTime(STATUS_MESSAGE_MS + 1));
    expect(result.current).toBe(false);
  });
});
