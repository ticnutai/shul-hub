import { describe, expect, it } from "vitest";
import { normalizeTvConfig } from "./config";

describe("logos on a board", () => {
  it("a board saved before the logos switch gets it wherever the name is on; after a save it is left alone", () => {
    const old = normalizeTvConfig({
      screens: [
        { id: "a", name: "א", seconds: 10, blocks: [{ block: "header" }, { block: "prayers" }] },
        { id: "b", name: "ב", seconds: 10, blocks: [{ block: "zmanim" }] },
      ],
    });
    expect(old.screens?.[0].blocks.map((b) => b.block)).toContain("logo");
    expect(old.screens?.[1].blocks.map((b) => b.block)).not.toContain("logo");
    expect(old.logos).toEqual([]);
    const saved = normalizeTvConfig({ logos: [], screens: [{ id: "a", name: "א", seconds: 10, blocks: [{ block: "header" }] }] });
    expect(saved.screens?.[0].blocks.map((b) => b.block)).not.toContain("logo");
  });

  it("keeps only logos with a safe address", () => {
    const c = normalizeTvConfig({
      logos: [
        { id: "a", name: "טוב", url: "https://x/a.png", urlDark: "javascript:alert(1)" },
        { id: "b", name: "רע", url: "http://x/b.png" },
        { id: "a", name: "כפול", url: "https://x/a2.png" },
      ],
    });
    expect(c.logos).toEqual([{ id: "a", name: "טוב", url: "https://x/a.png" }]);
  });
});
