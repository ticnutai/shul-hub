/**
 * The guard that keeps one vocabulary from becoming two.
 *
 * The whole proposal rests on a single claim: that a block groups elements
 * that already exist rather than inventing a parallel set. A claim like that
 * decays quietly - somebody adds an element and no block owns it, or renames
 * one and a block still points at the old key - and by then there are two
 * registries again and nobody noticed the day it happened.
 *
 * So the claim is checked rather than stated. The last test is the one that
 * matters: every editable element belongs to exactly one block, with one
 * declared exception. Adding an element without placing it fails here, which
 * is the point at which it costs a minute instead of a release.
 */
import { describe, expect, it } from "vitest";

import { BLOCKS, BLOCK_BY_ID, BLOCK_FOR_SLIDE, UNOWNED_ELEMENTS, visibleElements } from "./blocks";
import { EDITABLE } from "./boardEdit";
import { DEFAULT_TV_CONFIG } from "./config";

describe("the blocks a board is made of", () => {
  it("names only elements the board actually has", () => {
    const missing: string[] = [];
    for (const block of BLOCKS)
      for (const key of block.elements) if (!(key in EDITABLE)) missing.push(`${block.id} → ${key}`);
    expect(missing).toEqual([]);
  });

  it("gives every element one owner, so no switch appears twice", () => {
    const owner = new Map<string, string>();
    const twice: string[] = [];
    for (const block of BLOCKS)
      for (const key of block.elements) {
        if (owner.has(key)) twice.push(`${key}: ${owner.get(key)} + ${block.id}`);
        owner.set(key, block.id);
      }
    expect(twice).toEqual([]);
  });

  it("has an id and a name for each block, and no repeated id", () => {
    const ids = BLOCKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of BLOCKS) expect(b.name.trim().length).toBeGreaterThan(0);
    expect(Object.keys(BLOCK_BY_ID).length).toBe(BLOCKS.length);
  });

  it("can read every rotating slide the board already has", () => {
    // A kind with no block would be content that silently disappears the
    // moment an existing config is read as screens.
    for (const slide of DEFAULT_TV_CONFIG.slides) {
      expect(BLOCK_FOR_SLIDE[slide.kind], `no block for ${slide.kind}`).toBeTruthy();
    }
  });

  it("leaves a hidden element out, and never claims a hidden minyan", () => {
    const prayers = BLOCK_BY_ID.prayers;
    // "minyan:<id>" in `hidden` is one minyan the gabbai took off the board.
    // It is not a layout decision and must not touch the block's elements.
    const config = { hidden: ["dash.prayers", "minyan:e555e30a-b9f5-4392-b8a3-f15fcecb43d5"] };
    const shown = visibleElements(prayers, config);
    expect(shown).not.toContain("dash.prayers");
    expect(shown).toContain("panel.minyanim");
    expect(shown.some((k) => k.startsWith("minyan:"))).toBe(false);
  });

  it("survives a board whose config was never filled in", () => {
    // One community's row is empty - every field undefined, the board running
    // on defaults. Reading it must not throw.
    expect(() => visibleElements(BLOCK_BY_ID.header, {} as { hidden: string[] })).not.toThrow();
  });

  /**
   * The one that catches the drift, in both directions.
   */
  it("places every editable element in a block, except the board itself", () => {
    const placed = new Set(BLOCKS.flatMap((b) => b.elements));
    const orphans = Object.keys(EDITABLE).filter(
      (key) => !placed.has(key) && !UNOWNED_ELEMENTS.includes(key),
    );
    expect(orphans, "these elements belong to no block - add them to one in blocks.ts").toEqual([]);
  });
});
