/**
 * Every container has one board and one frame, drawn or painted: the board
 * takes the colour or the gallery's background, the frame is replaced - never
 * a second one - and a painted piece becomes a part of its own where it
 * stands. Kept through saving, drawn in its shape.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ElementArt } from "./BoardElements";
import { newElement, normalizeElements, type BoardElement } from "./elements";
import { builtinBackgrounds } from "./backgrounds";
import { wearsPaint } from "./partPaint";
import { colourBoards, colourFrames, containersOf, paintBoards, roleOf, wearFrame } from "./containerParts";

afterEach(cleanup);
const at = (e: BoardElement, x: number, y: number, width = 20, height = 40): BoardElement => ({ ...e, x, y, width, height });
const box = (id: string, x: number): BoardElement => at({ ...newElement("box"), id, name: `תיבה ${id}` }, x, 30);
const clouds = builtinBackgrounds().find((b) => b.id === "x_m_clouds_gold")!;
/** A container as the kits paint it: a fill and a frame cut from the picture, a heading inside. */
const painted = (): BoardElement[] => [
  at({ ...newElement("image"), id: "fill", name: "מילוי זמני תפילות", image: "/new-shul-assets/a.webp", crop: { x: 0, y: 0, width: 50, height: 50 } }, 10, 20, 24, 60),
  at({ ...newElement("image"), id: "frame", name: "מסגרת זמני תפילות", image: "/new-shul-assets/a.webp", crop: { x: 0, y: 0, width: 52, height: 52 } }, 9, 19, 26, 62),
  at({ ...newElement("text"), id: "head", name: "כותרת זמני תפילות" }, 13, 30, 18, 6),
];

describe("a container's board", () => {
  it("takes the gallery's background - its own, no other's - kept through saving", () => {
    const out = paintBoards([box("a", 5), box("b", 60)], ["a"], clouds);
    expect(out[0].paint).toEqual({ fill: null, picture: clouds.picture, overlay: clouds.overlay, strength: clouds.strength });
    expect(out[1].paint).toBeUndefined();
    expect(wearsPaint(out[0], clouds)).toBe(true);
    expect(normalizeElements(JSON.parse(JSON.stringify(out)))[0].paint).toEqual(out[0].paint);
  });

  it("painted: becomes a board of its own where it stands, in the shape it nearly has, from any part of its container", () => {
    const out = paintBoards(painted(), ["head"], clouds);
    const board = out.find((e) => e.id === "fill")!;
    expect(board).toMatchObject({ kind: "box", x: 10, y: 20, width: 24, height: 60, shape: "arch", image: "" });
    expect(board.crop).toBeUndefined();
    expect(board.paint?.picture).toBe(clouds.picture);
    // The frame and the heading as they were.
    expect(out.find((e) => e.id === "frame")!.kind).toBe("image");
  });

  it("is drawn in its shape: the picture, its overlay, the line", () => {
    const [e] = paintBoards([{ ...box("a", 5), shape: "arch" }], ["a"], clouds);
    const { container } = render(<ElementArt element={e} />);
    const p = container.querySelector<HTMLElement>("[data-part-paint]")!;
    expect(p.style.clipPath).toMatch(/^url\(#/);
    expect([...p.querySelectorAll<HTMLElement>("div")].some((d) => d.style.backgroundImage.includes("url("))).toBe(true);
  });

  it("is taken off, or given one colour of its own", () => {
    const [p] = paintBoards([box("a", 5)], ["a"], clouds);
    expect(paintBoards([p], ["a"], null)[0].paint).toBeUndefined();
    const [c] = colourBoards([p], ["a"], "#123456");
    expect([c.fill, c.paint]).toEqual(["#123456", undefined]);
  });
});

describe("a container's frame", () => {
  it("painted: replaced where it stands - never a second frame", () => {
    const { elements } = wearFrame(painted(), ["frame"], "frame:gold");
    expect(elements.filter((e) => roleOf(e) === "frame")).toHaveLength(1);
    expect(elements.find((e) => e.id === "frame")).toMatchObject({ kind: "frame", x: 9, y: 19, width: 26, height: 62 });
  });

  it("a picture frame goes on any shape: on a curved one along its outline, on a straight one as always", () => {
    const curved = wearFrame(painted(), ["head"], "frame:gold-ornate").elements.find((e) => e.id === "frame")!;
    expect(curved).toMatchObject({ kind: "frame", image: "frame:gold-ornate", shape: "arch" });
    const { container } = render(<ElementArt element={curved} />);
    // A band in the picture's tone, its texture over it.
    const strokes = [...container.querySelectorAll("[data-shaped-picture-frame] > path")].map((p) => p.getAttribute("stroke"));
    expect(strokes.some((x) => /^url\(#/.test(x ?? ""))).toBe(true);
    cleanup();
    // An octagon: the corner ornament on each of its eight corners.
    const { container: oct } = render(<ElementArt element={{ ...curved, shape: "octagon" }} />);
    expect(oct.querySelectorAll("[data-shaped-picture-frame] > svg")).toHaveLength(8);
    const straight = wearFrame([{ ...box("a", 5), shape: "rounded" }, at({ ...newElement("frame"), id: "f", shape: "rounded" }, 5, 30)], ["a"], "frame:gold");
    expect(straight.elements.find((e) => e.id === "f")).toMatchObject({ image: "frame:gold" });
    expect(straight.elements.find((e) => e.id === "f")!.shape).toBeUndefined();
  });

  it("keeps its picture when its container changes shape", async () => {
    const { setSectionShape } = await import("./sectionGeometry");
    const parts = [{ ...box("a", 5), shape: "rounded" as const }, at({ ...newElement("frame"), id: "f", image: "frame:gold-ornate" }, 5, 30)];
    const out = setSectionShape(parts, "a", "dome");
    expect(out.find((e) => e.id === "f")).toMatchObject({ image: "frame:gold-ornate", shape: "dome" });
  });

  it("a container without one gets one around its board, in its shape, right over it", () => {
    const { elements } = wearFrame([{ ...box("a", 5), shape: "dome" }], ["a"], null);
    expect(elements).toHaveLength(2);
    expect(elements[1]).toMatchObject({ kind: "frame", x: 5, y: 30, width: 20, height: 40, shape: "dome" });
    expect(containersOf(elements, ["a"])[0].frame?.id).toBe(elements[1].id);
  });

  it("takes a line colour - a painted one becomes a line", () => {
    const out = colourFrames(painted(), ["fill"], "#123456");
    expect(out.find((e) => e.id === "frame")).toMatchObject({ kind: "frame", color: "#123456", shape: "arch" });
  });
});

describe("the main background", () => {
  it("painted over the board's own: known, hidden when the board's own is chosen, and back again", async () => {
    const { hideBackdrops, isBackdrop, showBackdrops } = await import("./containerParts");
    const wall = at({ ...newElement("image"), id: "wall", name: "רקע המקור ללא חלקי העיצוב", image: "/new-shul-assets/a.webp" }, 0, 0, 100, 100);
    expect(roleOf(wall)).toBe("backdrop");
    expect(isBackdrop(box("a", 5))).toBe(false);
    const hidden = hideBackdrops([wall, box("a", 5)]);
    expect(hidden.map((e) => Boolean(e.hidden))).toEqual([true, false]);
    expect(showBackdrops(hidden)[0].hidden).toBe(false);
  });
});

describe("a new container", () => {
  it("is a board, a frame and a heading, where asked, in the shape asked", async () => {
    const { newContainerParts } = await import("./containers");
    const { container, parts } = newContainerParts({ x: 10, y: 20, width: 30, height: 44 }, "arch");
    expect(parts.map((e) => [e.kind, e.shape ?? null, e.group])).toEqual([["box", "arch", container.id], ["frame", "arch", container.id], ["text", null, container.id]]);
    expect(parts[0]).toMatchObject({ x: 10, y: 20, width: 30, height: 44 });
    const { board, frame } = containersOf(parts, [parts[2].id])[0];
    expect([board?.id, frame?.id]).toEqual([parts[0].id, parts[1].id]);
  });
});

describe("a kit's frame and board, from either of them", () => {
  it("are the same pair whichever is chosen - on the board, the frame comes first", async () => {
    const { BUILTIN_DESIGNS, applyDesign } = await import("./designs");
    const { DEFAULT_TV_CONFIG } = await import("./config");
    const c = applyDesign(structuredClone(DEFAULT_TV_CONFIG), BUILTIN_DESIGNS.find((d) => d.id === "d_sapphirelayers")!);
    const by = (n: string) => c.elements.find((e) => e.name === n)!;
    for (const [frame, board] of [["מסגרת מרכזית מהמקור", "מילוי התיבה המרכזית"], ["מסגרת תפילות מהמקור", "מילוי תפילות"]]) {
      const fromFrame = containersOf(c.elements, [by(frame).id])[0];
      expect([fromFrame.board?.name, fromFrame.frame?.name]).toEqual([board, frame]);
      // The board's colour, from the frame chosen.
      const painted = paintBoards(c.elements, [by(frame).id], clouds).find((e) => e.name === board)!;
      expect(painted.paint?.picture).toBe(clouds.picture);
    }
  });
});
