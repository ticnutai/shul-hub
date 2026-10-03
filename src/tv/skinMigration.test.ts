import { describe, expect, it } from "vitest";
import { normalizeTvConfig } from "./config";

/**
 * A board saved with one of the old designed frames comes back as the parts
 * it was made of - and only where the board had not chosen that part itself.
 */
describe("an old designed frame, read as parts", () => {
  it("becomes a frame for the board, a title style, a shape and a frame picture", () => {
    const c = normalizeTvConfig({ skin: "heichal" });
    expect(c.boardFrame).toBe("heichal");
    expect(c.titleStyle).toBe("plate");
    expect(c.frameStyle.image).toBe("frame:fan-corners");
    expect("skin" in c).toBe(false);

    const dome = normalizeTvConfig({ skin: "dome" });
    expect(dome.frame.shape).toBe("onion");
    expect(dome.titleStyle).toBe("pill");
  });

  it("leaves alone every part the board already chose", () => {
    const c = normalizeTvConfig({
      skin: "medallion",
      titleStyle: "underline",
      frame: { shape: "hexagon", top: null, bottom: null },
    });
    expect(c.titleStyle).toBe("underline");
    expect(c.frame.shape).toBe("hexagon");
  });

  it("a plain board, or an unknown skin, is simply as it was", () => {
    const plain = normalizeTvConfig({ skin: "plain", theme: "navy" });
    expect(plain.boardFrame).toBeNull();
    expect(plain.titleStyle).toBe("plain");
    expect(plain.frame.shape).toBe("auto");
    expect(normalizeTvConfig({ skin: "nonsense" }).boardFrame).toBeNull();
  });

  it("reaches each screen's own settings and the saved designs too", () => {
    const c = normalizeTvConfig({
      perDevice: { tv: { skin: "curtain" } },
      designs: [{ id: "d_abcd1234", name: "x", parts: ["frames"], theme: "navy", colours: {}, values: { skin: "pillars" } }],
    });
    expect(c.perDevice.tv).toMatchObject({ boardFrame: "parochet", titleStyle: "ribbon" });
    expect(c.designs[0].values.boardFrame).toBe("columns");
  });
});
