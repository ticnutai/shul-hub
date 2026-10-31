import { describe, expect, it } from "vitest";
import { bakeableRuns, runBox } from "./bakedParts";
import type { BoardElement } from "./elements";

const part = (id: string, kind: BoardElement["kind"], extra: Partial<BoardElement> = {}) =>
  ({ id, kind, name: id, x: 10, y: 10, width: 20, height: 20, image: kind === "image" ? "/a.webp" : "", crop: kind === "image" ? { x: 10, y: 10, width: 20, height: 20 } : undefined, ...extra }) as BoardElement;

describe("pieces of picture painted as one", () => {
  it("joins the pieces that follow one another, and keeps a text between them where it was", () => {
    const runs = bakeableRuns([part("a", "image"), part("b", "image"), part("t", "text"), part("c", "image"), part("d", "image", { x: 50 }), part("e", "image")]);
    expect(runs.map((r) => r.map((e) => e.id))).toEqual([["a", "b"], ["c", "d", "e"]]);
  });

  it("leaves alone a piece alone, and a piece that changes on the screen", () => {
    expect(bakeableRuns([part("a", "image"), part("t", "text"), part("b", "image")])).toEqual([]);
    const runs = bakeableRuns([part("a", "image"), part("b", "image", { rotation: 5 }), part("c", "image", { imageTune: { hue: 10, saturation: 1, brightness: 1 } } as Partial<BoardElement>)]);
    expect(runs).toEqual([]);
  });

  it("stands where its pieces stand", () => {
    expect(runBox([part("a", "image"), part("b", "image", { x: 50, y: 0, width: 60, height: 5 })])).toEqual({ x: 10, y: 0, width: 90, height: 30 });
  });
});
