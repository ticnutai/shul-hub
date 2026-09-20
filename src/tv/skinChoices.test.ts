import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOARD_SKINS } from "./config";

/**
 * The editor's skin picker is written by hand, so a skin can exist in the
 * config and never appear in the panel - it happened. This reads the panel's
 * source rather than importing it (the panel pulls in Supabase and
 * react-query) and checks the two lists match, with no repeats.
 */
describe("skin picker", () => {
  const source = readFileSync("src/community/components/admin/tv/TvDesignPanel.tsx", "utf8");
  const block = source.slice(source.indexOf("const SKIN_CHOICES"));
  const listed = [...block.slice(0, block.indexOf("\n];")).matchAll(/id: "([a-z]+)"/g)].map((m) => m[1]);

  it("offers every skin the board knows", () => {
    expect([...listed].sort()).toEqual([...BOARD_SKINS].sort());
  });

  it("offers each one once", () => {
    expect(new Set(listed).size).toBe(listed.length);
  });
});
