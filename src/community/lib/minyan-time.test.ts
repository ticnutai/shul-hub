import { describe, expect, it } from "vitest";

describe("a minyan for a season", () => {
  it("is held through its last day, in Israel, and not after", async () => {
    const { heldOn } = await import("./minyan-time");
    const m = { active_from: null, active_until: "2026-10-11" };
    expect(heldOn(m, new Date("2026-10-11T20:30:00Z"))).toBe(true); // 23:30 on the 11th in Israel
    expect(heldOn(m, new Date("2026-10-11T21:30:00Z"))).toBe(false); // 00:30 on the 12th
    expect(heldOn({ active_from: "2026-10-12", active_until: null }, new Date("2026-10-12T06:00:00Z"))).toBe(true);
    expect(heldOn({}, new Date())).toBe(true);
  });
});
