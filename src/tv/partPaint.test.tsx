/**
 * The boards of a board of parts dressed from the backgrounds' gallery: the
 * ones chosen and no other, kept through saving, drawn in their shape - and
 * taken off again, or given one colour of their own.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ElementArt } from "./BoardElements";
import { newElement, normalizeElements, type BoardElement } from "./elements";
import { builtinBackgrounds } from "./backgrounds";
import { colourParts, paintParts, wearsPaint } from "./partPaint";

afterEach(cleanup);
const box = (id: string): BoardElement => ({ ...newElement("box"), id });
const clouds = builtinBackgrounds().find((b) => b.id === "x_m_clouds_gold")!;

describe("a board's own background", () => {
  it("goes on the boxes chosen only, and is kept through saving", () => {
    const text = { ...newElement("text"), id: "t" };
    const out = paintParts([box("a"), box("b"), text], ["a", "t"], clouds);
    expect(out[0].paint).toEqual({ fill: null, picture: clouds.picture, overlay: clouds.overlay, strength: clouds.strength });
    expect(out[1].paint).toBeUndefined();
    expect(out[2].paint).toBeUndefined();
    expect(wearsPaint(out[0], clouds)).toBe(true);
    expect(normalizeElements(JSON.parse(JSON.stringify(out)))[0].paint).toEqual(out[0].paint);
  });

  it("is drawn in its shape: the picture, its overlay, the line", () => {
    const [e] = paintParts([{ ...box("a"), shape: "arch" }], ["a"], clouds);
    const { container } = render(<ElementArt element={e} />);
    const painted = container.querySelector<HTMLElement>("[data-part-paint]")!;
    expect(painted.style.clipPath).toMatch(/^url\(#/);
    expect(container.querySelector("clipPath path")).toBeTruthy();
    expect([...painted.querySelectorAll<HTMLElement>("div")].some((d) => d.style.backgroundImage.includes("url("))).toBe(true);
  });

  it("is taken off, or replaced by one colour of its own", () => {
    const [painted] = paintParts([box("a")], ["a"], clouds);
    expect(paintParts([painted], ["a"], null)[0].paint).toBeUndefined();
    const [coloured] = colourParts([painted], ["a"], "#123456");
    expect([coloured.fill, coloured.paint]).toEqual(["#123456", undefined]);
  });

  it("refuses what is not a background", () => {
    const [bad] = normalizeElements([{ ...box("a"), paint: { fill: "url(javascript:alert(1))", picture: "x\" onerror", overlay: null, strength: 9 } }]);
    expect(bad.paint).toBeUndefined();
  });
});
