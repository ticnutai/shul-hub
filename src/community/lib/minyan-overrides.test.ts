/**
 * A minyan that is different on one day.
 *
 * The thing worth pinning is not that an override works. It is that not
 * having one changes nothing: the timetable is the truth, an exception is a
 * single dated row, and every caller that knows nothing about overrides has
 * to keep behaving exactly as it did.
 */
import { describe, expect, it } from "vitest";

import {
  jerusalemDateKey,
  overridesFor,
  resolveDay,
  resolveMinyan,
  type MinyanOverride,
} from "./minyan-time";
import type { Minyan } from "./data";
import type { Zmanim } from "./zmanim";

const at = (h: number, m: number) => new Date(Date.UTC(2026, 8, 23, h - 3, m));

const ZMANIM = {
  alot: at(5, 16), misheyakir: at(5, 39), sunrise: at(6, 28),
  sof_zman_shma: at(9, 30), sof_zman_tefila: at(10, 31), chatzot: at(12, 33),
  mincha_gedola: at(13, 3), plag: at(17, 21), candle: at(17, 57),
  sunset: at(18, 37), tzeit: at(18, 57),
} as unknown as Zmanim;

const minyan = (over: Partial<Minyan> = {}): Minyan =>
  ({
    id: "m1", label: "מנחה", prayer: "mincha", day_type: "weekday",
    time_mode: "fixed", fixed_time: "13:30:00", relative_to: null,
    offset_minutes: 0, active: true, room: "", note: "", sort_order: 10,
    ...over,
  }) as Minyan;

const override = (over: Partial<MinyanOverride> = {}): MinyanOverride => ({
  minyan_id: "m1", on_date: "2026-09-23", at_time: null, cancelled: false, note: "", ...over,
});

describe("a minyan on an ordinary day", () => {
  it("is the timetable, with nothing added to it", () => {
    const r = resolveMinyan(minyan(), ZMANIM)!;
    expect(r.time).toBe("13:30");
    expect(r.cancelled).toBeUndefined();
    expect(r.overridden).toBeUndefined();
    expect(r.note).toBeUndefined();
  });

  it("is unchanged when overrides exist for other minyanim", () => {
    const map = overridesFor([override({ minyan_id: "somebody-else", at_time: "09:00" })], at(12, 0));
    expect(resolveDay([minyan()], "weekday", ZMANIM, map)[0].time).toBe("13:30");
  });
});

describe("a minyan that is different today", () => {
  it("takes the time it was given", () => {
    const r = resolveMinyan(minyan(), ZMANIM, override({ at_time: "13:00" }))!;
    expect(r.time).toBe("13:00");
    expect(r.minutes).toBe(13 * 60);
    expect(r.overridden).toBe(true);
    expect(r.source).toBe("היום בלבד");
  });

  it("re-sorts by the new time, not the old one", () => {
    const early = minyan({ id: "a", label: "מנחה", fixed_time: "13:30:00" });
    const later = minyan({ id: "b", label: "ערבית", fixed_time: "18:00:00" });
    const map = overridesFor([override({ minyan_id: "a", at_time: "19:00" })], at(12, 0));
    const day = resolveDay([early, later], "weekday", ZMANIM, map);
    expect(day.map((d) => d.minyan.id)).toEqual(["b", "a"]);
  });

  it("stays on the board when it is called off, and says so", () => {
    // Removing the row would be worse than useless: somebody who walks in at
    // the usual time learns nothing from an absence.
    const r = resolveMinyan(minyan(), ZMANIM, override({ cancelled: true }))!;
    expect(r.cancelled).toBe(true);
    expect(r.source).toBe("מבוטל היום");
    expect(r.time).toBe("13:30");
  });

  it("keeps its own time when the override only carries a note", () => {
    const r = resolveMinyan(minyan(), ZMANIM, override({ note: "היום בעזרת הנשים" }))!;
    expect(r.time).toBe("13:30");
    expect(r.note).toBe("היום בעזרת הנשים");
    expect(r.cancelled).toBe(false);
    expect(r.source).toBe("שעה קבועה");
  });

  it("works on a minyan that hangs off a zman, not a clock", () => {
    const relative = minyan({ time_mode: "relative", fixed_time: null, relative_to: "sunset", offset_minutes: -15 });
    expect(resolveMinyan(relative, ZMANIM)!.time).toBe("18:22");
    const r = resolveMinyan(relative, ZMANIM, override({ cancelled: true, note: "אין מניין" }))!;
    expect(r.time).toBe("18:22");
    expect(r.cancelled).toBe(true);
    expect(r.note).toBe("אין מניין");
  });
});

describe("which day an override belongs to", () => {
  it("counts the day in Jerusalem, not wherever the screen thinks it is", () => {
    // 22:30 UTC on the 22nd is already the 23rd in Jerusalem, and the board
    // must read tomorrow's exception, not yesterday's.
    expect(jerusalemDateKey(new Date("2026-09-22T22:30:00Z"))).toBe("2026-09-23");
    expect(jerusalemDateKey(new Date("2026-09-23T20:30:00Z"))).toBe("2026-09-23");
  });

  it("ignores an exception written for another date", () => {
    const map = overridesFor([override({ on_date: "2026-09-24", at_time: "09:00" })], at(12, 0));
    expect(map.size).toBe(0);
    expect(resolveMinyan(minyan(), ZMANIM, map.get("m1"))!.time).toBe("13:30");
  });

  it("finds the exception written for today", () => {
    const map = overridesFor([override({ at_time: "09:00" })], at(12, 0));
    expect(map.get("m1")?.at_time).toBe("09:00");
  });
});
