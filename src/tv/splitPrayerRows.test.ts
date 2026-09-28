/**
 * A day's minyanim over as many screens as it takes.
 *
 * Photographed off the wall at אהל אברהם: eleven ma'ariv minyanim, six
 * shacharis and five mincha, and the list ran off the bottom of the screen.
 * The answer a board must not give is smaller type - it is read from the
 * back of a hall - so it takes another screen.
 *
 * What is held down here is where the break falls. A row count alone would
 * cut shacharis in half and put the rest on the next screen, which is not
 * how anybody reads a board; it breaks where the prayer changes.
 */
import { describe, expect, it } from "vitest";
import type { ResolvedMinyan } from "@community/lib/minyan-time";

import { splitPrayerRows } from "./useBoardData";

/** Only the fields the split looks at. */
const row = (prayer: string, label: string): ResolvedMinyan =>
  ({ minyan: { prayer, label }, time: "07:00", minutes: 420, source: "fixed" }) as unknown as ResolvedMinyan;

const rows = (...spec: [string, number][]) =>
  spec.flatMap(([prayer, n]) => Array.from({ length: n }, (_, i) => row(prayer, `${prayer} ${i + 1}`)));

const prayersOn = (page: ResolvedMinyan[]) => [...new Set(page.map((r) => r.minyan.prayer))];

describe("a day that needs more than one screen", () => {
  it("leaves a day that fits alone", () => {
    const day = rows(["shacharis", 3], ["mincha", 2]);
    expect(splitPrayerRows(day, 14)).toEqual([day]);
  });

  it("takes another screen rather than shrinking the type", () => {
    const day = rows(["maariv", 11], ["shacharis", 6], ["mincha", 5]);
    const pages = splitPrayerRows(day, 14);
    expect(pages.length).toBeGreaterThan(1);
    // Nothing is lost on the way.
    expect(pages.flat()).toHaveLength(day.length);
    expect(pages.flat().map((r) => r.minyan.label)).toEqual(day.map((r) => r.minyan.label));
  });

  it("breaks where the prayer changes, not in the middle of one", () => {
    const pages = splitPrayerRows(rows(["maariv", 11], ["shacharis", 6], ["mincha", 5]), 14);
    // Each prayer belongs to one screen; none is split across two.
    const seen = new Map<string, number>();
    pages.forEach((page, i) => {
      for (const prayer of prayersOn(page)) {
        expect(seen.has(prayer) ? seen.get(prayer) : i, `${prayer} is on two screens`).toBe(i);
        seen.set(prayer, i);
      }
    });
  });

  it("keeps every screen within what the screen holds", () => {
    const pages = splitPrayerRows(rows(["maariv", 11], ["shacharis", 6], ["mincha", 5]), 14);
    for (const page of pages) expect(page.length).toBeLessThanOrEqual(14);
  });

  it("cuts a single prayer only when it alone is too long", () => {
    // Twenty ma'ariv minyanim and nothing else: there is nothing to do but
    // split them, and the pages are still full rather than one row each.
    const pages = splitPrayerRows(rows(["maariv", 20]), 14);
    expect(pages.map((p) => p.length)).toEqual([14, 6]);
  });

  it("follows the setting, because the right number depends on the screen", () => {
    const day = rows(["shacharis", 4], ["mincha", 4], ["maariv", 4]);
    expect(splitPrayerRows(day, 12)).toHaveLength(1);
    // A smaller screen takes the same day over more of them.
    expect(splitPrayerRows(day, 4)).toHaveLength(3);
  });
});
