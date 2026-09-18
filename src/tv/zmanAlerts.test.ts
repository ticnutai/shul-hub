import { describe, expect, it } from "vitest";
import type { Zmanim } from "@community/lib/zmanim";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "./config";
import { currentZmanAlert, describeMinutes, formatCountdown } from "./zmanAlerts";

const at = (h: number, m: number, s = 0) => new Date(2026, 8, 18, h, m, s);

const zmanim = {
  sof_zman_shma: at(9, 31),
  sof_zman_tefila: at(10, 33),
  sunset: at(18, 45),
  candle: at(18, 5),
} as unknown as Zmanim;

const alerts = DEFAULT_TV_CONFIG.alerts; // leads 30 / 15 / 5, popup 40 s

describe("currentZmanAlert", () => {
  it("is silent well before any deadline", () => {
    expect(currentZmanAlert(at(8, 0), zmanim, alerts, false)).toBeNull();
  });

  it("shows only the footer chip between leads", () => {
    const a = currentZmanAlert(at(9, 10), zmanim, alerts, false);
    expect(a?.event).toBe("sof_zman_shma");
    expect(a?.popup).toBe(false);
    expect(a?.secondsLeft).toBe(21 * 60);
  });

  it("pops the reminder card exactly at a lead, for popupSeconds", () => {
    const start = currentZmanAlert(at(9, 16), zmanim, alerts, false); // 15:00 left
    expect(start?.popup).toBe(true);
    expect(start?.lead).toBe(15);
    const end = currentZmanAlert(at(9, 16, 41), zmanim, alerts, false); // 40 s later
    expect(end?.popup).toBe(false);
  });

  it("disappears once the deadline has passed", () => {
    expect(currentZmanAlert(at(9, 31, 1), zmanim, alerts, false)).toBeNull();
  });

  it("only warns about candle lighting on Friday", () => {
    expect(currentZmanAlert(at(17, 50), zmanim, alerts, false)).toBeNull();
    expect(currentZmanAlert(at(17, 50), zmanim, alerts, true)?.event).toBe("candle");
  });

  it("prefers the closest deadline", () => {
    // 18:20 on Friday: candle 18:05 has passed, sunset 18:45 is 25 min away.
    expect(currentZmanAlert(at(18, 20), zmanim, alerts, true)?.event).toBe("sunset");
  });

  it("respects the admin switching alerts off", () => {
    expect(currentZmanAlert(at(9, 16), zmanim, { ...alerts, enabled: false }, false)).toBeNull();
  });
});

describe("countdown text", () => {
  it("formats minutes:seconds and hours", () => {
    expect(formatCountdown(14 * 60 + 5)).toBe("14:05");
    expect(formatCountdown(3725)).toBe("1:02:05");
  });

  it("describes remaining minutes in Hebrew", () => {
    expect(describeMinutes(30)).toBe("בעוד פחות מדקה");
    expect(describeMinutes(15 * 60)).toBe("בעוד 15 דקות");
  });
});

describe("normalizeTvConfig", () => {
  it("returns a full default config for garbage", () => {
    expect(normalizeTvConfig("nonsense")).toEqual(DEFAULT_TV_CONFIG);
    expect(normalizeTvConfig(null).slides).toHaveLength(DEFAULT_TV_CONFIG.slides.length);
  });

  it("keeps the admin's slide order and drops unknown kinds", () => {
    const cfg = normalizeTvConfig({
      slides: [
        { kind: "shiurim", enabled: true, seconds: 10, layout: "cards" },
        { kind: "bogus", enabled: true },
        { kind: "prayer", enabled: false, seconds: 999, layout: "nope" },
      ],
    });
    expect(cfg.slides[0]).toEqual({ kind: "shiurim", enabled: true, seconds: 10, layout: "cards" });
    // clamped seconds, unknown layout falls back to the default
    expect(cfg.slides[1]).toEqual({ kind: "prayer", enabled: false, seconds: 300, layout: "split" });
    // kinds missing from the saved row are appended so they can be switched on
    expect(cfg.slides.map((s) => s.kind)).toContain("learning");
  });

  it("rejects non-https images and unknown themes", () => {
    const cfg = normalizeTvConfig({
      theme: "hotpink",
      backgroundImage: "javascript:alert(1)",
      slideshow: { images: [{ url: "http://x/a.jpg" }, { url: "https://x/b.jpg" }] },
    });
    expect(cfg.theme).toBe("navy");
    expect(cfg.backgroundImage).toBeNull();
    expect(cfg.slideshow.images).toEqual([{ url: "https://x/b.jpg", caption: undefined }]);
  });
});
