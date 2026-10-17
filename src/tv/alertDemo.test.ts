/**
 * The reminder's simulation: a time's steps on a line, what the board shows at
 * each moment, and the run carried to a screen in a message an older app can
 * still read - at the speed chosen.
 */
import { describe, expect, it } from "vitest";
import type { Zmanim } from "@community/lib/zmanim";
import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "./config";
import {
  ALERT_DEMO_OLD_APP_TEXT,
  alertDemoPayload,
  alertTimeline,
  demoNow,
  readAlertDemo,
  screenSeconds,
  simulationDay,
  simulationTimes,
  whatShows,
} from "./alertDemo";

const SHMA = new Date("2026-10-14T06:33:00Z");
const staged = (): TvConfig["alerts"] => ({ ...DEFAULT_TV_CONFIG.alerts, mode: "staged", stages: { highlight: 30, panel: 20, board: 10 } });
const before = (minutes: number, seconds = 0) => new Date(SHMA.getTime() - minutes * 60_000 + seconds * 1000);

describe("the reminder's simulation", () => {
  it("takes today's times - on Friday and Saturday the coming Sunday's, out of Shabbat - without candle lighting", () => {
    const wednesday = new Date("2026-10-14T05:00:00Z");
    expect(simulationDay(3, wednesday)).toBe(wednesday);
    expect(simulationDay(5, wednesday).getTime() - wednesday.getTime()).toBe(2 * 86_400_000);
    const zmanim = { sof_zman_shma: SHMA, sunset: null, candle: new Date() } as unknown as Zmanim;
    const times = simulationTimes({ ...staged(), events: ["candle", "sunset", "sof_zman_shma"] }, zmanim);
    expect(times).toEqual([{ event: "sof_zman_shma", at: SHMA }]);
  });

  it("puts the steps on a line, a minute before the first to the time itself - a time's own minutes too", () => {
    expect(alertTimeline(staged(), "sof_zman_shma")).toEqual({
      from: 31,
      marks: [
        { minutes: 30, label: "הזמן מסומן ברשימה" },
        { minutes: 20, label: "ספירה במקום התפילות" },
        { minutes: 10, label: "ספירה על כל הלוח" },
        { minutes: 0, label: "הזמן עצמו" },
      ],
    });
    // Two steps at one minute are one mark; a step of 0 is left out.
    const own = { ...staged(), own: { sunset: { stages: { highlight: 15, panel: 15, board: 0 }, leadMinutes: [10] } } };
    expect(alertTimeline(own, "sunset").marks.map((m) => m.minutes)).toEqual([15, 0]);
    expect(alertTimeline(own, "sunset").marks[0].label).toBe("הזמן מסומן ברשימה + ספירה במקום התפילות");
    // The pulsing card: the strip comes with the first.
    const pulse = { ...DEFAULT_TV_CONFIG.alerts };
    expect(alertTimeline(pulse, "sunset").marks.map((m) => `${m.minutes} ${m.label}`)).toEqual(["30 פס קטן וכרטיס קופץ", "15 כרטיס קופץ", "5 כרטיס קופץ", "0 הזמן עצמו"]);
  });

  it("says what the board shows at each moment, as the board itself reckons it", () => {
    const a = staged();
    expect(whatShows(a, "sof_zman_shma", SHMA, before(40))).toBe("עוד אין תזכורת על הלוח");
    expect(whatShows(a, "sof_zman_shma", SHMA, before(25))).toBe("הזמן מסומן ברשימה");
    expect(whatShows(a, "sof_zman_shma", SHMA, before(15))).toBe("ספירה במקום התפילות");
    expect(whatShows(a, "sof_zman_shma", SHMA, before(5))).toBe("ספירה על כל הלוח");
    expect(whatShows(a, "sof_zman_shma", SHMA, new Date(SHMA.getTime() + 1000))).toBe("הזמן הגיע - התזכורת יורדת מהלוח");
    // Even with the reminders off: it is a picture of what they would do.
    const pulse = { ...DEFAULT_TV_CONFIG.alerts, enabled: false };
    expect(whatShows(pulse, "sunset", SHMA, before(15, 5))).toBe("כרטיס קופץ");
    expect(whatShows(pulse, "sunset", SHMA, before(20))).toBe("פס קטן בתחתית הלוח");
  });

  it("goes to a screen in a message an older app shows as text; a new one runs the board's clock from there, at its speed", () => {
    const from = before(9, 55);
    const payload = alertDemoPayload({ ...staged(), enabled: false }, from, 60, screenSeconds(9 * 60 + 55, 60));
    expect(payload.text).toBe(ALERT_DEMO_OLD_APP_TEXT);
    const real = Date.parse("2026-10-16T12:00:00Z");
    const demo = readAlertDemo(JSON.parse(JSON.stringify(payload)), real)!;
    expect(demoNow(demo, real).getTime()).toBe(from.getTime());
    // A second on the wall, a minute on the board.
    expect(demoNow(demo, real + 1000).getTime()).toBe(from.getTime() + 60_000);
    // Long enough to reach a little past the time: 625 seconds at 60 a second - 11.
    expect(demo.until - real).toBe(11_000);
    // The editor's reminders, on even if they are off - it is an example of them.
    expect(demo.alerts).toMatchObject({ mode: "staged", enabled: true, stages: { highlight: 30, panel: 20, board: 10 } });
  });

  it("stays on a screen between 10 seconds and a minute", () => {
    expect(screenSeconds(30 * 60, 1)).toBe(60);
    expect(screenSeconds(60, 60)).toBe(10);
  });

  it("is nothing in a plain message, or a broken one; an unknown speed is the real one", () => {
    expect(readAlertDemo({ text: "שלום", seconds: 30 })).toBeNull();
    expect(readAlertDemo({ alertDemo: { at: "לא תאריך" } })).toBeNull();
    const odd = readAlertDemo({ alertDemo: { at: new Date().toISOString(), seconds: 9999, speed: 7 } }, 0)!;
    expect([odd.until, odd.speed]).toEqual([60_000, 1]);
  });
});

describe("a time with minutes of its own", () => {
  it("is kept through saving; anything broken is left out", () => {
    const a = normalizeTvConfig({
      alerts: {
        own: {
          sunset: { stages: { highlight: 15, panel: 10, board: 5 }, leadMinutes: [15, 5] },
          nonsense: { stages: { highlight: 1 } },
          sof_zman_shma: "שלושים",
        },
      },
    }).alerts;
    expect(a.own).toEqual({ sunset: { stages: { highlight: 15, panel: 10, board: 5 }, leadMinutes: [15, 5] } });
    expect(normalizeTvConfig({}).alerts.own).toEqual({});
  });
});
