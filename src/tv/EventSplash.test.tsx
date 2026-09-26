/**
 * The special day on the wall, on the evening it went wrong: Sukkot that is
 * also Shabbat, 5787. Three things were seen on the screen at אהבת התורה -
 * no clock for a whole Shabbat, an end time twenty minutes early, and a day
 * that showed only because somebody had set it up by hand.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { zmanimFor } from "@community/lib/minyan-time";
import { DEFAULT_TV_CONFIG, type TvConfig } from "./config";
import { EventSplash } from "./EventSplash";

afterEach(cleanup);

// Friday 25.9.2026, 19:30 in Jerusalem: after candle lighting, Sukkot and Shabbat have begun.
const now = new Date("2026-09-25T16:30:00Z");
const zmanimOn = (d: Date) => zmanimFor(d, null);

function show(config: Partial<TvConfig> = {}) {
  return render(
    <EventSplash
      categories={[]}
      config={{ ...DEFAULT_TV_CONFIG, ...config }}
      now={now}
      zmanim={zmanimOn(now)}
      zmanimOn={zmanimOn}
    />,
  );
}

describe("the special day on the board", () => {
  it("shows Shabbat-Sukkot by itself, with nobody having set it up", () => {
    show();
    expect(screen.getByRole("region").getAttribute("aria-label")).toContain("סוכות");
  });

  it("keeps a clock on the wall while the picture covers the board", () => {
    const { container } = show();
    expect(container.querySelector(".tv-event-clock")?.textContent).toMatch(/^\d{1,2}:\d{2}$/);
  });

  it("ends Shabbat and the festival together, at the later time", () => {
    show();
    const row = screen.getByText("צאת השבת והחג").closest("div")!;
    const z = zmanimOn(new Date("2026-09-26T09:00:00Z"));
    const bySunset = new Date(z.sunset!.getTime() + DEFAULT_TV_CONFIG.shabbat.endMinutesAfterSunset * 60_000);
    const later = bySunset > z.tzeit! ? bySunset : z.tzeit!;
    const hhmm = later.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
    expect(row.textContent).toContain(hhmm);
  });

  it("'name and times only' puts a card over the board and no picture", () => {
    const { container } = show({ eventAuto: "info" });
    expect(container.querySelector(".tv-event-splash.is-info")).not.toBeNull();
    expect(container.querySelector(".tv-event-layer")).toBeNull();
  });

  it("shows nothing for a day nobody set up when automatic days are off", () => {
    const { container } = show({ eventAuto: "off" });
    expect(container.querySelector(".tv-event-splash")).toBeNull();
  });
});
