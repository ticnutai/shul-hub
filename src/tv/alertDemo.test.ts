/**
 * The reminder's example: the same moment on the editor's preview and on a
 * connected screen, carried there in a message an older app can still read.
 */
import { describe, expect, it } from "vitest";
import type { Zmanim } from "@community/lib/zmanim";
import { DEFAULT_TV_CONFIG, type TvConfig } from "./config";
import { ALERT_DEMO_OLD_APP_TEXT, alertDemoPayload, alertExampleMoment, readAlertDemo } from "./alertDemo";
import { stagedZmanAlerts } from "./zmanAlerts";

const SHMA = new Date("2026-10-14T06:33:00Z");
const day = (d: Date) => ({ sof_zman_shma: new Date(SHMA.getTime() + (d.getTime() - SHMA.getTime() > 3 * 86_400_000 ? 5 * 86_400_000 : 0)), sunset: null } as unknown as Zmanim);
const staged = (): TvConfig["alerts"] => ({ ...DEFAULT_TV_CONFIG.alerts, mode: "staged", stages: { highlight: 30, panel: 20, board: 10 } });

describe("the reminder's example", () => {
  it("stands a few seconds into the step asked for, before the first time the reminders are on for", () => {
    const now = new Date("2026-10-14T05:00:00Z"); // a Wednesday
    const board = alertExampleMoment(staged(), "board", day, 3, now)!;
    expect(board.event).toBe("sof_zman_shma");
    expect(SHMA.getTime() - board.at.getTime()).toBe((10 * 60 - 5) * 1000);
    // What the board shows at that moment: the whole-board card.
    expect(stagedZmanAlerts(board.at, day(now), staged(), false)[0].stage).toBe("board");
    const panel = alertExampleMoment(staged(), "panel", day, 3, now)!;
    expect(stagedZmanAlerts(panel.at, day(now), staged(), false)[0].stage).toBe("panel");
  });

  it("on Friday and Saturday uses the coming Sunday, out of Shabbat", () => {
    const friday = new Date("2026-10-16T05:00:00Z");
    const at = alertExampleMoment(staged(), "board", day, 5, friday)!.at;
    expect(at.getTime()).toBeGreaterThan(friday.getTime() + 2 * 86_400_000);
  });

  it("goes in a message an older app shows as text, and a new one reads back with its clock running from there", () => {
    const at = new Date("2026-10-14T06:23:05Z");
    const payload = alertDemoPayload({ ...staged(), enabled: false }, at);
    expect(payload.text).toBe(ALERT_DEMO_OLD_APP_TEXT);
    const sent = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    const real = Date.parse("2026-10-16T12:00:00Z");
    const demo = readAlertDemo(sent, real)!;
    expect(real + demo.offset).toBe(at.getTime());
    expect(demo.until - real).toBe(20_000);
    // The editor's reminders, on even if they are off - it is an example of them.
    expect(demo.alerts).toMatchObject({ mode: "staged", enabled: true, stages: { highlight: 30, panel: 20, board: 10 } });
  });

  it("is nothing in a plain message, or a broken one", () => {
    expect(readAlertDemo({ text: "שלום", seconds: 30 })).toBeNull();
    expect(readAlertDemo({ alertDemo: { at: "לא תאריך" } })).toBeNull();
    // Its length kept within reason.
    expect(readAlertDemo({ alertDemo: { at: new Date().toISOString(), seconds: 9999 } }, 0)!.until).toBe(60_000);
  });
});
