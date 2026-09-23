/**
 * The small grey line under a minyan's name.
 *
 * It carries whatever is true about this minyan that its name does not say -
 * the room, a standing note, how its time is worked out - and, on the one day
 * there is one, the exception. The exception goes first: on that day it is
 * the thing that changed, and it is the only part that stops being true
 * tomorrow.
 */
import { describe, expect, it } from "vitest";

import { details } from "./PrayerScheduleLayouts";
import type { ResolvedMinyan } from "@community/lib/minyan-time";

const row = (over: Partial<ResolvedMinyan> = {}): ResolvedMinyan =>
  ({
    minyan: { id: "m", label: "מנחה", room: "", note: "" } as never,
    time: "13:30",
    minutes: 810,
    source: "שעה קבועה",
    ...over,
  }) as ResolvedMinyan;

describe("the line under a minyan", () => {
  it("says how the time is worked out", () => {
    expect(details(row())).toBe("שעה קבועה");
  });

  it("puts the room and the standing note before it", () => {
    const r = row({ minyan: { id: "m", label: "מנחה", room: "בית מדרש", note: "לגברים" } as never });
    expect(details(r)).toBe("בית מדרש · לגברים · שעה קבועה");
  });

  it("puts today's exception first of all", () => {
    const r = row({ source: "היום בלבד", note: "היום בבית מדרש", overridden: true });
    expect(details(r)).toBe("היום בבית מדרש · היום בלבד");
  });

  it("says nothing extra when there is no exception", () => {
    expect(details(row()).includes("היום")).toBe(false);
  });
});
