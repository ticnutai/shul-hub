/**
 * The composer, checked on the thing it exists to fix.
 *
 * A board set up before the composer has no `screens` field, so the first
 * thing the editor must do is show that board as it actually is rather than
 * an empty sheet - a gabbai opening this on a working wall should recognise
 * what he sees. The rest is the promise that the switches come from the
 * registry, which is only worth making if nothing here is written by hand.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BLOCKS } from "@/tv/blocks";
import { DEFAULT_TV_CONFIG, type Screen, type TvConfig } from "@/tv/config";
import { ScreenComposer } from "./ScreenComposer";

afterEach(cleanup);

/** תורה ואהבתה as it is on the wall: illustrated, four slides, day's screen on. */
const illustrated: TvConfig = {
  ...DEFAULT_TV_CONFIG,
  screenLayout: "illustrated",
  eventSplash: true,
  screens: undefined,
};

function show(config: TvConfig = illustrated) {
  const onChange = vi.fn<(s: Screen[], i: number) => void>();
  const r = render(<ScreenComposer config={config} current={0} onChange={onChange} />);
  return { ...r, onChange };
}

describe("the screen composer", () => {
  it("opens on the board as it is, not on an empty sheet", () => {
    show();
    // Illustrated merges its content into one screen, and the day's screen
    // is a second beside it - so this board reads as two, each taking a turn.
    expect(screen.getByText(/2 מסכים/)).toBeTruthy();
    expect(screen.getByLabelText("תפילות היום")).toBeTruthy();
  });

  it("offers a switch for every block in the registry, none written by hand", () => {
    show();
    for (const block of BLOCKS) {
      expect(screen.getByLabelText(block.name), `no switch for ${block.id}`).toBeTruthy();
    }
  });

  it("gives the day its own screen, which the old settings could not say", () => {
    const { onChange } = show();
    // The first screen is the content; the day has one of its own, so it is
    // not switched on here.
    expect((screen.getByLabelText("מסך החג") as HTMLButtonElement).getAttribute("aria-checked")).toBe("false");
    // It is the second screen, and it can be opened and edited like any other.
    expect(screen.getAllByRole("button", { name: /מסך החג/ }).length).toBeGreaterThan(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("turning a block off takes it off that screen", () => {
    const { onChange } = show();
    fireEvent.click(screen.getByLabelText("שיעורים"));
    expect(onChange).toHaveBeenCalled();
    const [next] = onChange.mock.calls[0];
    expect(next[0].blocks.map((b) => b.block)).not.toContain("shiurim");
    // And nothing else was disturbed.
    expect(next[0].blocks.map((b) => b.block)).toContain("prayers");
  });

  it("adding a screen turns a standing board into a rotating one", () => {
    const { onChange } = show();
    fireEvent.click(screen.getByRole("button", { name: "מסך" }));
    const [next, current] = onChange.mock.calls[0];
    // It opened on two (the board and the day's screen), so adding makes three.
    expect(next).toHaveLength(3);
    expect(current).toBe(2);
    // A new screen is never blank on a wall: it starts with the bars.
    // The new screen is the third; the first two are the board and the day.
    expect(next[2].blocks.map((b) => b.block)).toContain("header");
  });

  it("pinning a block is the same field, not a second mode", () => {
    const { onChange } = show();
    fireEvent.change(screen.getByLabelText("מיקום של זמני היום"), { target: { value: "right" } });
    const [next] = onChange.mock.calls[0];
    expect(next[0].blocks.find((b) => b.block === "zmanim")?.area).toBe("right");

    // And back to automatic removes the field rather than setting another one.
    cleanup();
    const pinned: TvConfig = {
      ...illustrated,
      screens: [{ id: "board", name: "הלוח", seconds: 0, blocks: [{ block: "zmanim", area: "right" }] }],
    };
    const second = show(pinned);
    fireEvent.change(screen.getByLabelText("מיקום של זמני היום"), { target: { value: "auto" } });
    const [after] = second.onChange.mock.calls[0];
    expect("area" in after[0].blocks[0]).toBe(false);
  });

  it("keeps a board that was already built in the composer", () => {
    const built: TvConfig = {
      ...DEFAULT_TV_CONFIG,
      screens: [
        { id: "a", name: "תפילות", seconds: 20, blocks: [{ block: "prayers" }] },
        { id: "b", name: "הודעות", seconds: 12, blocks: [{ block: "announcements" }] },
      ],
    };
    show(built);
    expect(screen.getByText(/2 מסכים/)).toBeTruthy();
    expect((screen.getByLabelText("שם המסך") as HTMLInputElement).value).toBe("תפילות");
  });
});
