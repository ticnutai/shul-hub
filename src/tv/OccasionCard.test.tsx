/**
 * An occasion's screen, on the evening the old day's screen went wrong:
 * Sukkot that is also Shabbat, 5787. Three things were seen on the wall at
 * אהבת התורה - no clock for a whole Shabbat, an end time twenty minutes
 * early, and a day that showed only because somebody had set it up by hand.
 * The same checks, on the one screen every occasion is drawn by now.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { zmanimFor } from "@community/lib/minyan-time";
import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "./config";
import { OccasionCard, type DaySchedule } from "./OccasionCard";
import { fromLegacy, occasionPagesNow, SHABBAT_ID } from "./occasions";

afterEach(cleanup);

// Friday 25.9.2026, 19:30 in Jerusalem: after candle lighting, Sukkot and Shabbat have begun.
const now = new Date("2026-09-25T16:30:00Z");
const zmanimOn = (d: Date) => zmanimFor(d, null);

function show(patch: Partial<TvConfig> = {}, schedules?: DaySchedule[], page = 0) {
  const config = normalizeTvConfig({ ...structuredClone(DEFAULT_TV_CONFIG), ...patch });
  const { pages } = occasionPagesNow(config, null, now, zmanimOn);
  return render(
    <OccasionCard
      page={pages[page]}
      mode="stage"
      now={now}
      settings={null}
      endMinutes={config.shabbat.endMinutesAfterSunset}
      zmanimFor={zmanimOn}
      schedules={schedules}
    />,
  );
}

const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

describe("Shabbat and Sukkot together", () => {
  it("on one screen by itself, with nobody having set it up", () => {
    const { container } = show();
    expect(screen.getByRole("region").getAttribute("aria-label")).toContain("סוכות");
    expect(container.querySelector(".tv-event-title")?.textContent).toBe("שבת · סוכות");
  });

  it("keeps a clock on the wall while the picture covers the board", () => {
    const { container } = show();
    expect(container.querySelector(".tv-event-clock")?.textContent).toMatch(/^\d{1,2}:\d{2}$/);
  });

  it("ends Shabbat and the festival together, at the later time", () => {
    show();
    const z = zmanimOn(new Date("2026-09-26T09:00:00Z"));
    const bySunset = new Date(z.sunset!.getTime() + DEFAULT_TV_CONFIG.shabbat.endMinutesAfterSunset * 60_000);
    const later = bySunset > z.tzeit! ? bySunset : z.tzeit!;
    expect(screen.getByText("צאת השבת והחג").closest("div")!.textContent).toContain(hhmm(later));
    // And the board does not add a second end of Shabbat beside it.
    expect(screen.queryByText("צאת השבת")).toBeNull();
  });

  it("follows a synagogue that ends Shabbat by רבנו תם", () => {
    show({ shabbat: { ...DEFAULT_TV_CONFIG.shabbat, endMinutesAfterSunset: 72 } });
    const z = zmanimOn(new Date("2026-09-26T09:00:00Z"));
    expect(screen.getByText("צאת השבת והחג").closest("div")!.textContent).toContain(hhmm(new Date(z.sunset!.getTime() + 72 * 60_000)));
  });

  it("or a screen each, when the one higher in the list says so", () => {
    const occasions = fromLegacy(normalizeTvConfig({})).map((o) => (o.id === "cal:sukkot" ? { ...o, overlap: "separate" as const } : o));
    const titles = [0, 1].map((i) => {
      const r = show({ occasions }, undefined, i);
      const t = r.container.querySelector(".tv-event-title")?.textContent;
      r.unmount();
      return t;
    });
    expect(titles).toEqual(["סוכות", "שבת שלום"]);
  });
});

describe("what the gabbai chose for the screen, and nothing else", () => {
  const schedules: DaySchedule[] = [
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
    const { container } = show({}, schedules);
    expect(container.querySelector(".tv-event-splash")?.classList.contains("is-full")).toBe(true);
    for (const z of ["עלות השחר", "הנץ החמה", "חצות היום", "שקיעה", "צאת הכוכבים", "צאת השבת והחג"]) expect(screen.getByText(z)).toBeTruthy();
    const prayers = screen.getByTestId("event-prayers");
    expect(prayers.textContent).toContain("שחרית");
    expect(prayers.textContent).toContain("08:30");
    expect(prayers.textContent).toContain("10:00");
    expect(prayers.textContent).toContain("מנחה");
  });

  it("a festival's tab in the order of its sections: tonight's ערבית before the next night's", () => {
    // אהל אברהם, שמחת תורה 2.10.2026: by the clock alone, tonight's 19:05 stood
    // between מוצאי החג's 18:59 and 19:09.
    const chag: DaySchedule[] = [
      {
        id: "chag",
        title: "שמחת תורה",
        subcategories: [{ id: "night" }, { id: "day" }, { id: "motzei" }],
        rows: [
          { minyan: { prayer: "day", label: "שחרית" }, time: "08:00", minutes: 480, source: "" },
          { minyan: { prayer: "motzei", label: "ערבית מנין א" }, time: "18:59", minutes: 1139, source: "" },
          { minyan: { prayer: "night", label: "ערבית ליל החג" }, time: "19:05", minutes: 1145, source: "" },
          { minyan: { prayer: "motzei", label: "ערבית מנין ב" }, time: "19:09", minutes: 1149, source: "" },
        ] as never,
      },
    ];
    show({}, chag);
    const text = screen.getByTestId("event-prayers").textContent ?? "";
    const at = (t: string) => text.indexOf(t);
    expect(at("19:05")).toBeLessThan(at("08:00"));
    expect(at("08:00")).toBeLessThan(at("18:59"));
    expect(at("18:59")).toBeLessThan(at("19:09"));
  });

  it("only what is ticked: without the zmanim and the minyanim, just its own times and Shema", () => {
    const occasions = fromLegacy(normalizeTvConfig({})).map((o) =>
      o.id === "cal:sukkot" ? { ...o, elements: ["title", "times", "shma"] as typeof o.elements } : o,
    );
    const { container } = show({ occasions }, schedules);
    expect(screen.queryByText("עלות השחר")).toBeNull();
    expect(screen.queryByTestId("event-prayers")).toBeNull();
    expect(screen.getByText("סוף זמן ק״ש")).toBeTruthy();
    expect(container.querySelector(".tv-event-layer"), "no pictures unless ticked").toBeNull();
    expect(container.querySelector(".tv-event-date")).toBeNull();
  });

  it("lines of its own: a text and a time", () => {
    const occasions = fromLegacy(normalizeTvConfig({})).map((o) =>
      o.id === "cal:sukkot"
        ? {
            ...o,
            items: [
              { id: "a", kind: "text" as const, label: "", value: "חג שמח לכל הקהל" },
              { id: "b", kind: "time" as const, label: "קידוש בסוכה", value: "11:30" },
            ],
          }
        : o,
    );
    show({ occasions });
    expect(screen.getByText("חג שמח לכל הקהל")).toBeTruthy();
    expect(screen.getByText("קידוש בסוכה").closest("div")!.textContent).toContain("11:30");
  });

  it("an ordinary Shabbat says 'שבת שלום', its parasha and its times", () => {
    const at = new Date("2026-10-10T08:00:00Z");
    const config = normalizeTvConfig({});
    const { pages } = occasionPagesNow(config, null, at, zmanimOn);
    expect(pages[0].main.occasion.id).toBe(SHABBAT_ID);
    const { container } = render(
      <OccasionCard page={pages[0]} mode="stage" now={at} settings={null} endMinutes={40} zmanimFor={zmanimOn} />,
    );
    expect(container.querySelector(".tv-event-title")?.textContent).toBe("שבת שלום");
    expect(container.textContent).toContain("בראשית");
    expect(screen.getByText("הדלקת נרות")).toBeTruthy();
    expect(screen.getByText("צאת השבת")).toBeTruthy();
  });
});
