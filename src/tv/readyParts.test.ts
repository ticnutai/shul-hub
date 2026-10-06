import { describe, expect, it } from "vitest";
import { READY_PARTS } from "./readyParts";
import { exportElementSet, importElementSet } from "./elements";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "./config";

describe("ready parts from the designs", () => {
  it("every part the gallery offers is there, alone and with its own cut", () => {
    expect(READY_PARTS).toHaveLength(13);
    for (const set of READY_PARTS) {
      expect(set.elements.length).toBeGreaterThan(0);
      for (const e of set.elements) {
        expect(e.image).toMatch(/^\/new-shul-assets\/[\w-]+\.webp$/);
        // A masked piece of a painting, or a picture of its own: never the wall around it.
        expect(Boolean(e.sourceMask) || Boolean(e.crop)).toBe(true);
      }
    }
  });

  it("is put on any board as a fresh copy, cut and grouping kept", () => {
    const columns = READY_PARTS.find((s) => s.name === "שיש מואר · זוג עמודים")!;
    const added = importElementSet(exportElementSet(columns.elements));
    expect(added.map((e) => e.sourceMask)).toEqual(columns.elements.map((e) => e.sourceMask));
    expect(new Set(added.map((e) => e.group)).size).toBe(1);
    expect(added[0].id).not.toBe(columns.elements[0].id);
    // On a plain board, saved and read back, nothing of the part is lost.
    const board = normalizeTvConfig({ ...structuredClone(DEFAULT_TV_CONFIG), elements: added });
    expect(board.elements).toEqual(added);
  });
});
