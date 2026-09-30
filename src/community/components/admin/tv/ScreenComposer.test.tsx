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
import { DAY_BLOCKS } from "@/tv/screens";
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
  const onSelect = vi.fn<(i: number, s: Screen) => void>();
  const r = render(<ScreenComposer config={config} current={0} onChange={onChange} onSelect={onSelect} />);
  return { ...r, onChange, onSelect };
}

describe("the screen composer", () => {
  it("opens on the board as it is, not on an empty sheet", () => {
    show();
    // Illustrated merges its content into one screen. Shabbat and the day's
    // screen are occasions, set in their own tab - and it says where.
    expect(screen.getByText(/מסך אחד — הלוח עומד/)).toBeTruthy();
    expect(screen.getByText(/בשבת ובחגים - בלשונית מועדים/)).toBeTruthy();
    expect(screen.getByLabelText("תפילות היום")).toBeTruthy();
  });

  it("offers a switch for every block in the registry, none written by hand", () => {
    show();
    for (const block of BLOCKS.filter((b) => !DAY_BLOCKS.includes(b.id))) {
      expect(screen.getByLabelText(block.name), `no switch for ${block.id}`).toBeTruthy();
    }
  });

  it("leaves Shabbat and the day's screen to the occasions: no screens or switches of theirs here", () => {
    const { onChange } = show();
    expect(screen.queryByLabelText("מסך החג")).toBeNull();
    expect(screen.queryByLabelText("מסך השבת")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /מסך החג|מסך השבת/ })).toHaveLength(0);
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
    // It opened on the board alone (Shabbat and the day are occasions), so adding makes two.
    expect(next).toHaveLength(2);
    expect(current).toBe(1);
    // A new screen is never blank on a wall: it starts with the bars.
    expect(next[1].blocks.map((b) => b.block)).toContain("header");
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

describe("a screen with nothing on it", () => {
  // Saved on the real board of תורה ואהבתה: a third screen with only the bars,
  // which the wall skips. The composer said "3 screens" and the wall had two.
  const withEmpty: TvConfig = {
    ...DEFAULT_TV_CONFIG,
    screens: [
      { id: "a", name: "הלוח", seconds: 40, blocks: [{ block: "prayers" }] },
      { id: "b", name: "מסך החג", seconds: 40, blocks: [{ block: "festival" }] },
      { id: "c", name: "מסך 3", seconds: 15, blocks: [{ block: "header" }, { block: "clock" }, { block: "footer" }] },
    ],
  };

  it("is marked as one the board will not show, and not counted", () => {
    show(withEmpty);
    // One ordinary screen (the day's screen comes in only in its time), and
    // the empty one is neither.
    expect(screen.getByText(/מסך אחד — הלוח עומד/)).toBeTruthy();
    expect(screen.getByText(/מסך אחד ריק ולא יוצג/)).toBeTruthy();
    const tab = screen.getAllByRole("button").find((b) => b.textContent?.includes("מסך 3"))!;
    expect(within(tab).getByText("לא יוצג")).toBeTruthy();
  });
});

describe("opening a screen", () => {
  it("is not an edit: it chooses the screen, and nothing is saved", () => {
    const built: TvConfig = {
      ...DEFAULT_TV_CONFIG,
      screens: [
        { id: "a", name: "תפילות", seconds: 20, blocks: [{ block: "prayers" }] },
        { id: "b", name: "הודעות", seconds: 12, blocks: [{ block: "announcements" }] },
      ],
    };
    const { onChange, onSelect } = show(built);
    fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent?.includes("הודעות"))!);
    expect(onChange).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith(1, expect.objectContaining({ id: "b" }));
  });
});
