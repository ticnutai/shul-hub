import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const account: { editorPrefs?: unknown } = {};
const update = vi.fn((s: { editorPrefs?: unknown }) => Object.assign(account, s));
vi.mock("@/contexts/DisplayModeContext", () => ({
  useDisplayMode: () => ({ displaySettings: account, updateDisplaySettings: update }),
}));

import { readEditorPrefs, useEditorPrefsSync } from "./editorPrefs";

describe("the editor's look, kept with the account", () => {
  beforeEach(() => {
    localStorage.clear();
    update.mockClear();
    delete account.editorPrefs;
  });

  it("takes only the keys it knows, as text", () => {
    expect(readEditorPrefs({ "tv-tile-size": "small", other: "x", "tv-slider-layout": 3 })).toEqual({ "tv-tile-size": "small" });
    expect(readEditorPrefs(null)).toEqual({});
  });

  it("brings the account's to this browser, and says so", () => {
    account.editorPrefs = { "tv-save-bar-spot": '{"x":0.1,"y":0.2}', "tv-tile-size": "large" };
    const heard = vi.fn();
    window.addEventListener("tv-save-bar-spot:from-account", heard);
    renderHook(() => useEditorPrefsSync());
    expect(localStorage.getItem("tv-save-bar-spot")).toBe('{"x":0.1,"y":0.2}');
    expect(localStorage.getItem("tv-tile-size")).toBe("large");
    expect(heard).toHaveBeenCalled();
    // Brought, not sent back.
    expect(update).not.toHaveBeenCalled();
  });

  it("sends a change made here to the account", () => {
    renderHook(() => useEditorPrefsSync());
    act(() => {
      localStorage.setItem("tv-save-bar-spot", '{"x":0.5,"y":0.1}');
      window.dispatchEvent(new Event("tv-save-bar-spot"));
    });
    expect(update).toHaveBeenCalledWith({ editorPrefs: { "tv-save-bar-spot": '{"x":0.5,"y":0.1}' } });
  });
});
