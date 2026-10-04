import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "./config";
import { addCustomBox, editCustomBox, removeCustomBox } from "./customBoxes";
import { buildSlides } from "./useBoardData";
import { zmanimFor } from "@community/lib/minyan-time";

const now = new Date("2026-10-05T10:00:00+03:00");

describe("a box of the shul's own", () => {
  it("is made, written, kept through a save, and shown on its screen", () => {
    const { config: added, id } = addCustomBox(structuredClone(DEFAULT_TV_CONFIG), "חוגים");
    const written = editCustomBox(added, id, { text: "שחמט ביום שני\nציור ביום רביעי" });
    const c = normalizeTvConfig({
      ...written,
      screens: [{ id: "a", name: "הלוח", seconds: 20, blocks: [{ block: "zmanim" }, { block: id, area: "left" }] }],
      frameLooks: { [id]: { bg: "#123456" } },
    });
    expect(c.customBoxes).toEqual([{ id, title: "חוגים", text: "שחמט ביום שני\nציור ביום רביעי" }]);
    expect(c.screens![0].blocks.map((b) => b.block)).toEqual(["zmanim", id]);
    expect(c.frameLooks[id]).toEqual({ bg: "#123456" });

    const slides = buildSlides(
      { settings: null, minyanim: [], categories: [], announcements: [], shiurim: [], overrides: [], stale: false } as never,
      c,
      now,
      zmanimFor(now, null),
    );
    const screen = slides.find((s) => s.kind === "composed");
    expect(screen && screen.kind === "composed" && screen.parts.find((p) => p.block === id)?.custom?.title).toBe("חוגים");
  });

  it("taken off leaves nothing pointing at it", () => {
    const { config: added, id } = addCustomBox(structuredClone(DEFAULT_TV_CONFIG));
    const c = normalizeTvConfig({
      ...added,
      screens: [{ id: "a", name: "הלוח", seconds: 20, blocks: [{ block: "zmanim" }, { block: id }], grid: [{ blocks: ["zmanim", id], widths: [1, 1], height: 1 }] }],
      layouts: [{ id: "k1", name: "שתיים", grid: [{ blocks: [id], widths: [1], height: 1 }] }],
      frameLooks: { [id]: { bg: "#123456" } },
    });
    const gone = removeCustomBox(c, id);
    expect(gone.customBoxes).toEqual([]);
    expect(gone.screens![0].blocks.map((b) => b.block)).toEqual(["zmanim"]);
    expect(gone.screens![0].grid).toEqual([{ blocks: ["zmanim"], widths: [1], height: 1 }]);
    expect(gone.layouts).toEqual([]);
    expect(gone.frameLooks[id]).toBeUndefined();
  });

  it("an id that is not well formed is not kept", () => {
    const c = normalizeTvConfig({ customBoxes: [{ id: "custom:<x>", title: "x", text: "" }, { id: "evil", title: "y", text: "" }] });
    expect(c.customBoxes).toEqual([]);
  });
});
