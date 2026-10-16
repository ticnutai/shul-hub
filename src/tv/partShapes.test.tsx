import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PART_SHAPES, isPartShape, partShapePath } from "./partShapes";
import { SECTION_SHAPES, setSectionShape } from "./sectionGeometry";
import { newElement, normalizeElements, ratioResize } from "./elements";
import { ElementArt } from "./BoardElements";

describe("the shapes of a board of parts", () => {
  it("are the board's one list: every shape has a name, a path, and is offered for a section", () => {
    for (const s of PART_SHAPES) {
      expect(isPartShape(s.id)).toBe(true);
      expect(partShapePath(s.id)).toMatch(/^M/);
      expect(SECTION_SHAPES[s.id]).toBe(s.name);
    }
    // The ordinary board's corners, now for parts too.
    for (const id of ["bevel", "scoop", "notch", "dome", "onion", "lancet", "scallop", "octagon", "pill"]) expect(isPartShape(id)).toBe(true);
    expect(isPartShape("star")).toBe(false);
  });

  it("are kept through saving, on boxes and frames only", () => {
    const box = { ...newElement("box"), shape: "scallop" };
    const text = { ...newElement("text"), shape: "scallop" };
    const odd = { ...newElement("frame"), shape: "star" };
    const [b, t, o] = normalizeElements([box, text, odd]);
    expect(b.shape).toBe("scallop");
    expect(t.shape).toBeUndefined();
    expect(o.shape).toBeUndefined();
  });

  it("draw the shape's own path on the board", () => {
    const { container } = render(<ElementArt element={{ ...newElement("box"), shape: "dome" }} />);
    expect(container.querySelector('[data-geometric-shape="dome"] path')?.getAttribute("d")).toBe(partShapePath("dome"));
  });

  it("go on the whole section: the box and its frame take the same shape", () => {
    const box = { ...newElement("box"), id: "b", group: "g", x: 10, y: 10, width: 30, height: 40 };
    const frame = { ...newElement("frame"), id: "f", group: "g", x: 10, y: 10, width: 30, height: 40 };
    const out = setSectionShape([box, frame], "f", "notch");
    expect(out.map((e) => e.shape)).toEqual(["notch", "notch"]);
  });
});

describe("a frame of the gallery on a frame part", () => {
  it("is kept by its name in the gallery, on a frame only", () => {
    const [frame, image] = normalizeElements([
      { ...newElement("frame"), image: "frame:sapphire-silver" },
      { ...newElement("image"), image: "frame:sapphire-silver" },
    ]);
    expect(frame.image).toBe("frame:sapphire-silver");
    expect(image.image).toBe("");
  });

  it("is drawn from the gallery's picture, with its own edge", () => {
    const { container } = render(<ElementArt element={{ ...newElement("frame"), image: "frame:sapphire-silver" }} />);
    const art = container.querySelector<HTMLElement>("[data-art-frame]")!;
    expect(art.style.borderImage).toContain("sapphire-modular-panel-frame.webp");
  });
});

describe("a picture of one's own", () => {
  it("keeps its shape, how it fills it and its proportions through saving - a piece of a kit's painting takes none", () => {
    const [own, piece] = normalizeElements([
      { ...newElement("image"), image: "/new-shul-assets/a.webp", shape: "dome", fit: "cover", ratio: true },
      { ...newElement("image"), image: "/new-shul-assets/a.webp", crop: { x: 0, y: 0, width: 50, height: 50 }, shape: "dome", fit: "cover" },
    ]);
    expect([own.shape, own.fit, own.ratio]).toEqual(["dome", "cover", true]);
    expect(piece.shape).toBeUndefined();
  });

  it("is cut to its shape on the board, in its own box (never stretched)", () => {
    const { container } = render(<ElementArt element={{ ...newElement("image"), image: "/new-shul-assets/a.webp", shape: "scallop", fit: "cover" }} />);
    const img = container.querySelector<HTMLImageElement>('[data-geometric-shape="scallop"] img')!;
    expect(img.style.objectFit).toBe("cover");
    expect(img.style.clipPath).toMatch(/^url\(#/);
    expect(container.querySelector("clipPath")?.getAttribute("clipPathUnits")).toBe("objectBoundingBox");
  });

  it("takes its container's shape with the rest of it", () => {
    const box = { ...newElement("box"), id: "b", group: "g", x: 10, y: 10, width: 30, height: 40 };
    const pic = { ...newElement("image"), id: "p", group: "g", image: "/new-shul-assets/a.webp", x: 12, y: 12, width: 26, height: 36 };
    const out = setSectionShape([box, pic], "b", "arch");
    expect(out.find((e) => e.id === "p")).toMatchObject({ shape: "arch", image: "/new-shul-assets/a.webp", x: 12, width: 26 });
  });

  it("keeps its proportions from any handle, the far corner staying", () => {
    const b = { x: 10, y: 10, width: 40, height: 20 };
    expect(ratioResize("e", b, 20, 0)).toEqual({ handle: "se", dx: 20, dy: 10 });
    expect(ratioResize("nw", b, 10, 99)).toEqual({ handle: "nw", dx: 10, dy: 5 });
    expect(ratioResize("s", b, 0, 10)).toEqual({ handle: "se", dx: 20, dy: 10 });
  });
});
