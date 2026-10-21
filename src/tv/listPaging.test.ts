import { describe, expect, it } from "vitest";
import { listPage } from "./listPaging";

describe("how long each page of a list stays", () => {
  const at = (s: number) => new Date(Date.UTC(2026, 9, 21, 10, 0, 0) + s * 1000);
  it("turns every so many seconds, as the part says", () => {
    const pageAt = (s: number, seconds?: number) => listPage(4, 3, -1, at(s), { paused: false, shift: 0 }, seconds);
    expect(pageAt(0, 30)).toBe(pageAt(29, 30));
    expect(pageAt(30, 30)).not.toBe(pageAt(0, 30));
    // Without a word of its own: 15 seconds, as before.
    expect(pageAt(14)).toBe(pageAt(0));
    expect(pageAt(15)).not.toBe(pageAt(0));
  });
  it("never faster than 3 seconds", () => {
    expect(listPage(4, 3, -1, at(1), { paused: false, shift: 0 }, 1)).toBe(listPage(4, 3, -1, at(0), { paused: false, shift: 0 }, 1));
  });
});
