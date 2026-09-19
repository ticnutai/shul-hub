import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "./config";
import { nextCandleLighting, shabbatNow } from "./shabbat";
import { buildSlides, type BoardData } from "./useBoardData";
import { zmanimFor } from "@community/lib/minyan-time";

// Friday 18 Sept 2026 and Saturday 19 Sept 2026, Israel time (UTC+3).
const at = (iso: string) => new Date(iso);
const friday = zmanimFor(at("2026-09-18T12:00:00+03:00"), null);
const saturday = zmanimFor(at("2026-09-19T12:00:00+03:00"), null);

const data: BoardData = {
  settings: null,
  minyanim: [],
  categories: [],
  announcements: [],
  shiurim: [],
  stale: false,
  anyLoaded: true,
  sync: { status: "live", lastSyncedAt: null },
};
const cfg = (over: Partial<TvConfig> = {}): TvConfig => ({
  ...structuredClone(DEFAULT_TV_CONFIG),
  ...over,
});

describe("Shabbat window", () => {
  it("starts exactly at candle lighting on Friday", () => {
    const candle = friday.candle!;
    expect(shabbatNow(new Date(candle.getTime() - 60_000), null, 40)).toBeNull();
    const t = shabbatNow(new Date(candle.getTime() + 1000), null, 40);
    expect(t?.candle?.getTime()).toBe(candle.getTime());
    // Friday night already knows when Shabbat ends and Saturday's latest Shema.
    expect(t?.end?.getTime()).toBe(saturday.sunset!.getTime() + 40 * 60_000);
    expect(t?.shma?.getTime()).toBe(saturday.sof_zman_shma!.getTime());
  });

  it("lasts through Saturday and ends at sunset + the configured minutes", () => {
    expect(shabbatNow(at("2026-09-19T10:00:00+03:00"), null, 40)).not.toBeNull();
    const end = saturday.sunset!.getTime() + 72 * 60_000;
    expect(shabbatNow(new Date(end - 60_000), null, 72)).not.toBeNull();
    expect(shabbatNow(new Date(end + 1000), null, 72)).toBeNull();
  });

  it("is never on a weekday", () => {
    expect(shabbatNow(at("2026-09-17T21:00:00+03:00"), null, 40)).toBeNull();
    expect(shabbatNow(at("2026-09-20T10:00:00+03:00"), null, 40)).toBeNull();
  });

  it("the next candle lighting from a weekday is this Friday's", () => {
    expect(nextCandleLighting(at("2026-09-16T10:00:00+03:00"), null)?.getTime()).toBe(
      friday.candle!.getTime(),
    );
  });
});

describe("the board on Shabbat", () => {
  const shabbatTime = at("2026-09-19T11:00:00+03:00");

  it("shows only the Shabbat screen - no rotation", () => {
    const slides = buildSlides(data, cfg(), shabbatTime, saturday);
    expect(slides.map((s) => s.kind)).toEqual(["shabbat"]);
  });

  it("rotates as usual when the Shabbat screen is switched off", () => {
    const slides = buildSlides(
      data,
      cfg({ shabbat: { ...DEFAULT_TV_CONFIG.shabbat, enabled: false } }),
      shabbatTime,
      saturday,
    );
    expect(slides.some((s) => s.kind === "shabbat")).toBe(false);
    expect(slides.length).toBeGreaterThan(0);
  });

  it("an older saved config (no shabbat field) gets the Shabbat screen on, ending 40 minutes after sunset", () => {
    expect(normalizeTvConfig({ theme: "navy" }).shabbat).toEqual({
      enabled: true,
      endMinutesAfterSunset: 40,
      scenes: ["art:classic"],
      photos: [],
      rotate: false,
      secondsPerScene: 60,
    });
    expect(
      normalizeTvConfig({ shabbat: { enabled: false, endMinutesAfterSunset: 500 } }).shabbat,
    ).toMatchObject({ enabled: false, endMinutesAfterSunset: 90 });
  });
});

describe("Shabbat pictures", () => {
  const shabbatTime = at("2026-09-19T11:00:00+03:00");
  const photo = "https://example.supabase.co/storage/v1/object/public/tv/a.jpg";

  it("keeps built-in drawings and https photos, drops the rest, never empty", () => {
    const c = normalizeTvConfig({
      shabbat: {
        scenes: ["art:kiddush", "art:nope", "javascript:alert(1)", "http://x/a.jpg", photo, photo],
        rotate: true,
        secondsPerScene: 2,
      },
    });
    expect(c.shabbat.scenes).toEqual(["art:kiddush", photo]);
    expect(c.shabbat.secondsPerScene).toBe(10);
    expect(normalizeTvConfig({ shabbat: { scenes: ["bad"] } }).shabbat.scenes).toEqual([
      "art:classic",
    ]);
  });

  it("a slideshow passes every picture to the slide; without it only the first", () => {
    const shabbat = {
      ...DEFAULT_TV_CONFIG.shabbat,
      scenes: ["art:jerusalem", photo],
      secondsPerScene: 30,
    };
    const on = buildSlides(
      data,
      cfg({ shabbat: { ...shabbat, rotate: true } }),
      shabbatTime,
      saturday,
    )[0];
    const off = buildSlides(
      data,
      cfg({ shabbat: { ...shabbat, rotate: false } }),
      shabbatTime,
      saturday,
    )[0];
    expect(on.kind === "shabbat" && on.scenes).toEqual(["art:jerusalem", photo]);
    expect(on.kind === "shabbat" && on.secondsPerScene).toBe(30);
    expect(off.kind === "shabbat" && off.scenes).toEqual(["art:jerusalem"]);
  });
});
