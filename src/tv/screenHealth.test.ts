/**
 * The wall says what is cut off on it.
 *
 * At אהל אברהם the zmanim panel's last two rows hung under its frame, and the
 * only way anybody found out was a photograph. The board now measures its own
 * lists and panels on each slide and writes what does not fit to the log.
 * There is no layout in the test environment, so the sizes a browser would
 * report are given here by hand - the arithmetic is what is under test.
 */
import { afterEach, describe, expect, it } from "vitest";

import { findClipped } from "./screenHealth";

afterEach(() => {
  document.body.innerHTML = "";
});

function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

function place(el: Element, top: number, height: number, content = height, shown = true) {
  Object.defineProperty(el, "getBoundingClientRect", { value: () => rect(top, height) });
  Object.defineProperty(el, "offsetParent", { value: shown ? document.body : null });
  Object.defineProperty(el, "clientHeight", { value: height });
  Object.defineProperty(el, "scrollHeight", { value: content });
}

/** A zmanim panel 300px tall whose rows, 40px each, start at 60px. */
function zmanimPanel(rows: string[], shown = true) {
  document.body.innerHTML = `
    <div class="tv-frame"><div class="tv-panel"><h3 class="tv-panel-title">זמני היום</h3>
    <dl class="tv-zman-list">${rows.map((r) => `<div class="tv-zman-row">${r}</div>`).join("")}</dl></div></div>`;
  const panel = document.querySelector(".tv-panel")!;
  const list = document.querySelector(".tv-zman-list")!;
  place(panel, 0, 300, 300, shown);
  place(list, 60, 240, 240, shown);
  document.querySelectorAll(".tv-zman-row").forEach((row, i) => place(row, 60 + i * 40, 40));
}

describe("what is cut off on the wall", () => {
  it("names the panel and the last line that hangs outside it", () => {
    zmanimPanel(["עלות השחר 05:20", "נץ החמה 06:33", "חצות 12:30", "פלג המנחה 17:13", "שקיעה 18:28", "צאת הכוכבים 18:48", "חצות הלילה 00:30"]);
    const clipped = findClipped(document);
    expect(clipped).toHaveLength(1);
    expect(clipped[0].what).toBe("זמני היום");
    expect(clipped[0].lastLine).toContain("חצות הלילה");
    // Seven rows of 40 from 60 end at 340; the frame ends at 300.
    expect(clipped[0].hidden).toBe(40);
  });

  it("says nothing about a panel that fits", () => {
    zmanimPanel(["עלות השחר 05:20", "נץ החמה 06:33", "שקיעה 18:28"]);
    expect(findClipped(document)).toEqual([]);
  });

  it("ignores what is not on screen", () => {
    zmanimPanel(["a", "b", "c", "d", "e", "f", "g", "h"], false);
    expect(findClipped(document)).toEqual([]);
  });
});
