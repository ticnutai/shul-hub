/**
 * Which screens are worth waking somebody for.
 *
 * The rule has to survive two opposite mistakes. Cry too early and the alert
 * is on the page every day, which teaches everyone to ignore it - and the one
 * morning it means something, it will be ignored too. Cry too late and you
 * find out on Sunday evening that the wall has been dark since shabbat.
 */
import { describe, expect, it } from "vitest";

import { SILENT_ALERT_MS, silentScreens } from "./tvAdminData";

const NOW = Date.UTC(2026, 8, 27, 12, 0, 0);
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const screen = (over: Record<string, unknown> = {}) =>
  ({
    id: "d1",
    name: "מסך בית הכנסת",
    approved: true,
    last_seen_at: ago(10_000),
    ...over,
  }) as never;

describe("a screen nobody has heard from", () => {
  it("says nothing while the screens are reporting", () => {
    expect(silentScreens([screen()], NOW)).toEqual([]);
  });

  it("says nothing about the ordinary gap - a router restarting, a reload", () => {
    expect(silentScreens([screen({ last_seen_at: ago(5 * 60_000) })], NOW)).toEqual([]);
  });

  it("speaks once the silence is past all of that", () => {
    const out = silentScreens([screen({ last_seen_at: ago(SILENT_ALERT_MS + 1000) })], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].device.name).toBe("מסך בית הכנסת");
  });

  it("ignores a box that was never paired - that is a setup waiting, not a failure", () => {
    const waiting = screen({ approved: false, last_seen_at: ago(SILENT_ALERT_MS * 10) });
    expect(silentScreens([waiting], NOW)).toEqual([]);
  });

  it("ignores a screen that has never reported at all", () => {
    expect(silentScreens([screen({ last_seen_at: null })], NOW)).toEqual([]);
  });

  it("puts the one that has been quiet longest first", () => {
    const out = silentScreens(
      [
        screen({ id: "a", name: "קרוב", last_seen_at: ago(SILENT_ALERT_MS + 60_000) }),
        screen({ id: "b", name: "רחוק", last_seen_at: ago(SILENT_ALERT_MS * 40) }),
      ],
      NOW,
    );
    expect(out.map((s) => s.device.name)).toEqual(["רחוק", "קרוב"]);
  });

  it("carries how long, so the message can say it", () => {
    const out = silentScreens([screen({ last_seen_at: ago(3 * 60 * 60_000) })], NOW);
    expect(out[0].silentMs).toBe(3 * 60 * 60_000);
  });
});
