import { describe, expect, it } from "vitest";

import { readLogos } from "./logos";

describe("a synagogue's logos, as stored", () => {
  it("keeps well-formed logos in order", () => {
    const logos = [
      { id: "a", url: "https://x/a.png", path: "logos/c/a.png", name: "ראשי" },
      { id: "b", url: "https://x/b.png", path: "logos/c/b.png", name: "לבן" },
    ];
    expect(readLogos(logos)).toEqual(logos);
  });

  it("skips what is not a logo rather than breaking the header", () => {
    expect(readLogos([{ id: "a" }, null, "x", { id: "b", url: "u", path: "p", name: "n" }])).toEqual([
      { id: "b", url: "u", path: "p", name: "n" },
    ]);
    expect(readLogos(null)).toEqual([]);
    expect(readLogos({})).toEqual([]);
  });
});
