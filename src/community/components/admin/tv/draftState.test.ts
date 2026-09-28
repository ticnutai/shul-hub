/**
 * An editor left open follows the board, and keeps only its own work.
 *
 * Seen on the board of תורה ואהבתה: an editor open for hours said "יש שינויים
 * שלא נשמרו" although nobody had touched it - the board had changed on the
 * server, and the editor counted the difference as its own. Saving then put
 * the old board back. Unsaved now means changed here, and a change on the
 * server is taken in under whatever was changed here.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_TV_CONFIG, type TvConfig } from "@/tv/config";
import { sameJson } from "@/tv/configMerge";
import { draftReducer, type DraftState } from "./draftState";

const board = (patch: Partial<TvConfig> = {}): TvConfig => ({ ...structuredClone(DEFAULT_TV_CONFIG), ...patch });

const opened = board({ texts: { "header.title": "בית הכנסת אפי קפיטל" } });
const start = (): DraftState =>
  draftReducer(
    { past: [], present: DEFAULT_TV_CONFIG, base: DEFAULT_TV_CONFIG, future: [], lastKey: null, lastAt: 0, editedAt: 0 },
    { type: "load", config: opened },
  );
const unsaved = (s: DraftState) => !sameJson(s.present, s.base);

describe("an editor left open", () => {
  it("that was not touched follows the server, and has nothing unsaved", () => {
    const server = board({ texts: {} });
    const s = draftReducer(start(), { type: "rebase", config: server });
    expect(s.present.texts).toEqual({});
    expect(unsaved(s)).toBe(false);
  });

  it("that was touched keeps its change and takes the server's", () => {
    const edited = draftReducer(start(), {
      type: "edit",
      key: "brightness",
      update: (c) => ({ ...c, illustratedStyle: { ...c.illustratedStyle, brightness: 1.35 } }),
    });
    const s = draftReducer(edited, { type: "rebase", config: board({ texts: {} }) });
    expect(s.present.texts).toEqual({});
    expect(s.present.illustratedStyle.brightness).toBe(1.35);
    // Still unsaved - the slider - and only the slider.
    expect(unsaved(s)).toBe(true);
    expect(sameJson({ ...s.present, illustratedStyle: s.base.illustratedStyle }, s.base)).toBe(true);
  });

  it("undo after a change on the server does not lose track of what is saved", () => {
    const edited = draftReducer(start(), { type: "edit", key: "theme", update: (c) => ({ ...c, theme: "parchment" }) });
    const moved = draftReducer(edited, { type: "rebase", config: board({ texts: {} }) });
    const undone = draftReducer(moved, { type: "undo" });
    expect(undone.base.texts).toEqual({});
  });
});
