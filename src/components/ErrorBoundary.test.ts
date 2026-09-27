import { describe, expect, it } from "vitest";
import { isStaleChunkError } from "./ErrorBoundary";

describe("stale files after a deploy", () => {
  it("recognises a missing chunk in every browser's wording", () => {
    expect(isStaleChunkError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/TvAdminWatcher-CEueMRnz.js"))).toBe(true);
    expect(isStaleChunkError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isStaleChunkError(new Error("error loading dynamically imported module"))).toBe(true);
    expect(isStaleChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });
});
