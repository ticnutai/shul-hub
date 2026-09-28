/**
 * An editor left open must not put back what changed on the server.
 *
 * The case this was written from, on the board of תורה ואהבתה: the board's
 * title had been edited to another synagogue's name, and the edit was removed
 * on the server. An editor open from before still held the old name in its
 * draft; its user moved the picture sliders and saved, and the old name was
 * on the wall again.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_TV_CONFIG, type TvConfig } from "./config";
import { mergeConfig, mergeJson, sameJson } from "./configMerge";

const board = (patch: Partial<TvConfig> = {}): TvConfig => ({
  ...structuredClone(DEFAULT_TV_CONFIG),
  ...patch,
});

describe("saving only what was changed here", () => {
  it("does not bring back a name removed on the server", () => {
    const opened = board({
      texts: { "header.title": "בית הכנסת אפי קפיטל" },
      illustratedStyle: { ...DEFAULT_TV_CONFIG.illustratedStyle, brightness: 1 },
    });
    // The editor moved one slider and nothing else.
    const mine = board({
      ...opened,
      illustratedStyle: { ...opened.illustratedStyle, brightness: 1.35 },
    });
    // Meanwhile the name was removed on the server.
    const server = board({ ...opened, texts: {} });

    const saved = mergeConfig(opened, mine, server);
    expect(saved.texts).toEqual({});
    expect(saved.illustratedStyle.brightness).toBe(1.35);
  });

  it("keeps a change made elsewhere to a field this editor never touched", () => {
    const opened = board({ theme: "royal" });
    const mine = board({ theme: "royal", screenLayout: "illustrated" });
    const server = board({ theme: "parchment" });
    const saved = mergeConfig(opened, mine, server);
    expect(saved.theme).toBe("parchment");
    expect(saved.screenLayout).toBe("illustrated");
  });

  it("where both changed the same field, the save being made wins", () => {
    expect(mergeJson({ a: 1 }, { a: 2 }, { a: 3 })).toEqual({ a: 2 });
  });

  it("a key removed here stays removed, and one added elsewhere stays", () => {
    expect(mergeJson({ a: 1, b: 1 }, { b: 1 }, { a: 1, b: 1, c: 5 })).toEqual({ b: 1, c: 5 });
  });

  it("a list is one decision, not merged item by item", () => {
    const opened = { screens: [{ id: "a" }, { id: "b" }] };
    const mine = { screens: [{ id: "a" }] };
    const server = { screens: [{ id: "a" }, { id: "b" }, { id: "c" }] };
    expect(mergeJson(opened, mine, server)).toEqual(mine);
  });

  it("an editor with no changes takes the server as it is", () => {
    const opened = board();
    const server = board({ theme: "parchment", screenLayout: "dashboard" });
    expect(mergeConfig(opened, structuredClone(opened), server)).toEqual(server);
  });

  it("compares as data, since the database reorders keys", () => {
    expect(sameJson({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
    expect(sameJson({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(sameJson([1, 2], [2, 1])).toBe(false);
  });
});
