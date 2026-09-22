import { describe, expect, it } from "vitest";

import { TV_BACKDROPS, backdropRef, backdropUrl, findBackdrop, isBackdropRef } from "./backdrops";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "./config";

describe("the ready-made backgrounds", () => {
  it("are all there, named, and each has its own picture", () => {
    expect(TV_BACKDROPS.length).toBeGreaterThanOrEqual(8);
    const ids = TV_BACKDROPS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of TV_BACKDROPS) {
      expect(b.name.trim()).not.toBe("");
      expect(b.note.trim()).not.toBe("");
      expect(b.url).toBeTruthy();
      expect(b.thumb).toBeTruthy();
      expect(b.url).not.toBe(b.thumb);
    }
  });

  it("offers both light and dark ones, or half the themes have nothing to stand on", () => {
    expect(TV_BACKDROPS.some((b) => b.light)).toBe(true);
    expect(TV_BACKDROPS.some((b) => !b.light)).toBe(true);
  });

  it("is stored by name, so a rebuild cannot break a board", () => {
    const ref = backdropRef("night");
    expect(ref).toBe("backdrop:night");
    expect(isBackdropRef(ref)).toBe(true);
    expect(findBackdrop(ref)?.name).toBe("ליל כוכבים");
    expect(backdropUrl(ref)).toBe(TV_BACKDROPS.find((b) => b.id === "night")!.url);
  });

  it("hands an uploaded picture back untouched", () => {
    const mine = "https://example.com/my-picture.jpg";
    expect(isBackdropRef(mine)).toBe(false);
    expect(backdropUrl(mine)).toBe(mine);
    expect(findBackdrop(mine)).toBeNull();
  });

  it("shows nothing rather than a broken image for one that is gone", () => {
    expect(backdropUrl("backdrop:no-such-thing")).toBeNull();
    expect(backdropUrl(null)).toBeNull();
    expect(backdropUrl("")).toBeNull();
  });
});

describe("a background surviving the database", () => {
  const round = (backgroundImage: string | null) =>
    normalizeTvConfig(
      JSON.parse(JSON.stringify({ ...structuredClone(DEFAULT_TV_CONFIG), backgroundImage })),
    ).backgroundImage;

  it("keeps one of ours", () => {
    expect(round("backdrop:dawn")).toBe("backdrop:dawn");
  });

  it("keeps an uploaded one", () => {
    expect(round("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
  });

  it("refuses anything else, including a script url", () => {
    expect(round("javascript:alert(1)")).toBeNull();
    expect(round("http://example.com/a.jpg")).toBeNull();
    expect(round("/etc/passwd")).toBeNull();
  });
});
