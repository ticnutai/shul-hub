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

  it("follows a synagogue that ends Shabbat by רבנו תם", () => {
    show({ shabbat: { ...DEFAULT_TV_CONFIG.shabbat, endMinutesAfterSunset: 72 } });
    const z = zmanimOn(new Date("2026-09-26T09:00:00Z"));
    const rt = new Date(z.sunset!.getTime() + 72 * 60_000);
    const hhmm = rt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
    expect(screen.getByText("צאת השבת והחג").closest("div")!.textContent).toContain(hhmm);
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

describe("everything of the day, and days that meet", () => {
  const schedulesFor = () => [
    {
      id: "c",
      title: "שבת",
      rows: [
        { minyan: { prayer: "shacharit", label: "שחרית א׳" }, time: "08:30", minutes: 510, source: "" },
        { minyan: { prayer: "shacharit", label: "שחרית ב׳" }, time: "10:00", minutes: 600, source: "" },
        { minyan: { prayer: "mincha", label: "מנחה" }, time: "17:45", minutes: 1065, source: "" },
      ] as never,
    },
  ];

  it("by default: every zman of the day and the day's minyanim, one line per prayer", () => {
    const { container } = render(
      <EventSplash categories={[]} config={DEFAULT_TV_CONFIG} now={now} zmanim={zmanimOn(now)} zmanimOn={zmanimOn} schedulesFor={schedulesFor} />,
    );
    expect(container.querySelector(".tv-event-splash")?.classList.contains("is-full")).toBe(true);
    for (const z of ["עלות השחר", "הנץ החמה", "חצות היום", "שקיעה", "צאת הכוכבים", "צאת השבת והחג"]) expect(screen.getByText(z)).toBeTruthy();
    const prayers = screen.getByTestId("event-prayers");
    expect(prayers.textContent).toContain("שחרית");
    expect(prayers.textContent).toContain("08:30");
    expect(prayers.textContent).toContain("10:00");
    expect(prayers.textContent).toContain("מנחה");
  });

  it("'short' keeps the old card: its own times, Shema and Tefila, no minyanim", () => {
    render(
      <EventSplash categories={[]} config={{ ...DEFAULT_TV_CONFIG, eventDetail: "short" }} now={now} zmanim={zmanimOn(now)} zmanimOn={zmanimOn} schedulesFor={schedulesFor} />,
    );
    expect(screen.queryByText("עלות השחר")).toBeNull();
    expect(screen.queryByTestId("event-prayers")).toBeNull();
    expect(screen.getByText("סוף זמן ק״ש")).toBeTruthy();
  });

  it("one screen for Shabbat and Sukkot together, or a screen for each in turn", () => {
    const one = render(<EventSplash categories={[]} config={DEFAULT_TV_CONFIG} now={now} zmanim={zmanimOn(now)} zmanimOn={zmanimOn} />);
    expect(one.container.querySelector(".tv-event-title")?.textContent).toBe("שבת · סוכות");
    one.unmount();
    const titles = new Set<string>();
    for (const at of [0, 20, 40, 60]) {
      const t = new Date(now.getTime() + at * 1000);
      const r = render(
        <EventSplash categories={[]} config={{ ...DEFAULT_TV_CONFIG, eventCombine: "separate" }} now={t} zmanim={zmanimOn(t)} zmanimOn={zmanimOn} />,
      );
      titles.add(r.container.querySelector(".tv-event-title")?.textContent ?? "");
      expect(r.container.querySelectorAll(".tv-event-pages span").length).toBe(2);
      r.unmount();
    }
    expect([...titles].sort()).toEqual(["סוכות", "שבת קודש"].sort());
  });
});

describe("the day's screen all day, and the remote", () => {
  // Sunday 27.9.2026 14:00 in Jerusalem, Chol HaMoed: not a holy day, so nothing holds it.
  const chm = (sec: number) => new Date(Date.parse("2026-09-27T11:00:00Z") + sec * 1000);
  const at = (sec: number, config: Partial<TvConfig> = {}) =>
    render(<EventSplash categories={[]} config={{ ...DEFAULT_TV_CONFIG, ...config }} now={chm(sec)} zmanim={zmanimOn(chm(sec))} zmanimOn={zmanimOn} />);

  it("with everything of the day it stays up the whole day; the short card takes turns", () => {
    for (const sec of [0, 20, 45, 80]) {
      const r = at(sec);
      expect(r.container.querySelector(".tv-event-splash")).not.toBeNull();
      r.unmount();
    }
    const phase = Math.floor(chm(0).getTime() / 1000) % 90;
    const off = phase < 15 ? 30 : 0; // a moment outside the 15 seconds
    const r = at(off, { eventDetail: "short" });
    const shownShort = !!r.container.querySelector(".tv-event-splash");
    expect(shownShort).toBe((Math.floor(chm(off).getTime() / 1000) % 90) < 15);
  });

  it("an arrow on the remote steps back to the ordinary board, then the day returns", async () => {
    const { act } = await import("@testing-library/react");
    const { vi } = await import("vitest");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(chm(0));
    const r = at(0);
    expect(r.container.querySelector(".tv-event-splash")).not.toBeNull();
    act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" })));
    // Right after the key: the ordinary board.
    const soon = chm(5);
    r.rerender(<EventSplash categories={[]} config={DEFAULT_TV_CONFIG} now={soon} zmanim={zmanimOn(chm(0))} zmanimOn={zmanimOn} />);
    expect(r.container.querySelector(".tv-event-splash")).toBeNull();
    // Two minutes on, the day's screen is back (it is still Chol HaMoed).
    const later = chm(180);
    r.rerender(<EventSplash categories={[]} config={DEFAULT_TV_CONFIG} now={later} zmanim={zmanimOn(chm(0))} zmanimOn={zmanimOn} />);
    expect(r.container.querySelector(".tv-event-splash")).not.toBeNull();
    vi.useRealTimers();
  });
});
