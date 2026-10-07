/**
 * A board made of parts shows what its parts ask for.
 *
 * The parts read their content from the board's slides, and the slides were
 * cut to the screens of the ordinary board: on a board whose screens had no
 * announcements, the announcements part said "אין הודעות כרגע" with notices
 * waiting, and the prayers part went empty while a screen of only the shiurim
 * was up. A board of parts has no screens to arrange - the layout tab says so
 * - so nothing there may decide what its parts show.
 */
import { describe, expect, it } from "vitest";
import { zmanimFor } from "@community/lib/minyan-time";

import { DEFAULT_TV_CONFIG, type TvConfig } from "./config";
import { elementData } from "./elementContent";
import { PREMIUM_DESIGNS } from "./premiumDesigns";
import { buildSlides, type BoardData } from "./useBoardData";

const now = new Date("2026-09-16T10:00:00+03:00");
const z = zmanimFor(now, null);
const data = {
  settings: null,
  minyanim: [],
  categories: [],
  announcements: [{ id: "a1", title: "שיעור מיוחד", body: "הערב בשמונה", expires_at: null }],
  shiurim: [{ id: "s1", title: "דף יומי", teacher: "הרב כהן", time_text: "08:45", active: true, schedule_type: "daily", day_of_week: null }],
  overrides: [],
  stale: false,
  anyLoaded: true,
  sync: { status: "live", lastSyncedAt: null },
} as unknown as BoardData;

const board = (patch: Partial<TvConfig>): TvConfig => ({
  ...structuredClone(DEFAULT_TV_CONFIG),
  ...structuredClone(PREMIUM_DESIGNS[0].values),
  ...patch,
} as TvConfig);

describe("a board of parts and its content", () => {
  it("shows the announcements and the shiurim though no screen of the ordinary board has them", () => {
    const config = board({
      screens: [{ id: "a", name: "הלוח", seconds: 0, blocks: [{ block: "prayers" }] }],
    });
    const slides = buildSlides(data, config, now, z);
    // Not cut into the ordinary board's screens: the board hands its parts the whole list.
    expect(slides.some((s) => s.kind === "composed")).toBe(false);
    const d = elementData(slides, now, { config, name: "בית הכנסת", zmanim: z });
    expect(d.announcements).toContain("שיעור מיוחד");
    expect(d.lessons.map((r) => r[0])).toContain("דף יומי · הרב כהן");
  });

  it("shows them though they were switched off on the ordinary board", () => {
    const config = board({ slides: DEFAULT_TV_CONFIG.slides.map((s) => ({ ...s, enabled: false })) });
    const d = elementData(buildSlides(data, config, now, z), now, { config, name: "בית הכנסת", zmanim: z });
    expect(d.announcements).toContain("שיעור מיוחד");
    expect(d.lessons).toHaveLength(1);
  });

  it("leaves the ordinary board's screens deciding for an ordinary board", () => {
    const config: TvConfig = {
      ...structuredClone(DEFAULT_TV_CONFIG),
      screens: [{ id: "a", name: "הלוח", seconds: 0, blocks: [{ block: "prayers" }] }],
    };
    const slides = buildSlides(data, config, now, z);
    expect(slides.some((s) => s.kind === "announcements")).toBe(false);
  });
});
