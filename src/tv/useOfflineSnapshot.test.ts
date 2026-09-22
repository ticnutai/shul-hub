import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useOfflineSnapshot } from "./useOfflineSnapshot";

const PREFIX = "shul-tv-snapshot:";
const put = (key: string, data: unknown) =>
  localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), data }));

describe("the board's copy on disk", () => {
  beforeEach(() => localStorage.clear());

  it("hands back live data and writes it down", () => {
    const { result } = renderHook(() => useOfflineSnapshot("minyanim", [1, 2, 3]));
    expect(result.current.data).toEqual([1, 2, 3]);
    expect(result.current.isStale).toBe(false);
    expect(JSON.parse(localStorage.getItem(PREFIX + "minyanim")!).data).toEqual([1, 2, 3]);
  });

  it("falls back to the disk when there is nothing live, and says it is stale", () => {
    put("minyanim", [1, 2, 3]);
    const { result } = renderHook(() => useOfflineSnapshot<number[]>("minyanim", undefined));
    expect(result.current.data).toEqual([1, 2, 3]);
    expect(result.current.isStale).toBe(true);
  });

  /**
   * The bug this exists for. A screen that boots with no internet does not
   * know its synagogue on the first render, so it asks for the settings of
   * no synagogue. One render later it knows - and used to keep showing the
   * default board with the real one sitting unread on the disk.
   */
  it("looks again when the key changes under it", () => {
    put("tv_config:shul-a", { theme: "gold" });

    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useOfflineSnapshot<{ theme: string }>(key, undefined),
      { initialProps: { key: "tv_config:none" } },
    );
    expect(result.current.data).toBeNull();

    act(() => rerender({ key: "tv_config:shul-a" }));
    expect(result.current.data).toEqual({ theme: "gold" });
    expect(result.current.isStale).toBe(true);
  });

  it("goes back to nothing when the new key has nothing", () => {
    put("tv_config:shul-a", { theme: "gold" });
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useOfflineSnapshot<{ theme: string }>(key, undefined),
      { initialProps: { key: "tv_config:shul-a" } },
    );
    expect(result.current.data).toEqual({ theme: "gold" });
    act(() => rerender({ key: "tv_config:shul-b" }));
    expect(result.current.data).toBeNull();
  });

  it("does not touch the disk when persistence is off", () => {
    put("minyanim", [9]);
    const { result } = renderHook(() => useOfflineSnapshot("minyanim", [1], false));
    expect(result.current.data).toEqual([1]);
    expect(JSON.parse(localStorage.getItem(PREFIX + "minyanim")!).data).toEqual([9]);
  });

  it("survives a disk that cannot be read", () => {
    localStorage.setItem(PREFIX + "minyanim", "not json");
    const { result } = renderHook(() => useOfflineSnapshot<number[]>("minyanim", undefined));
    expect(result.current.data).toBeNull();
  });
});
