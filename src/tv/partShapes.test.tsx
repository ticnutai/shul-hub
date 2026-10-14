import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PART_SHAPES, isPartShape, partShapePath } from "./partShapes";
import { SECTION_SHAPES, setSectionShape } from "./sectionGeometry";
import { newElement, normalizeElements } from "./elements";
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
