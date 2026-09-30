import { describe, expect, it } from "vitest";
import { zmanimFor } from "@community/lib/minyan-time";
import { BLOCK_IDS, normalizeTvConfig } from "./config";
import {
  SHABBAT_ID,
  activeOccasions,
  calendarId,
  fromLegacy,
  nextDateOf,
  normalizeOccasions,
  occasionDesign,
  occasionPages,
  readOccasions,
  type Occasion,
} from "./occasions";

/** An hour in Israel (UTC+3 in these months), whatever the machine's timezone. */
const il = (iso: string, hour: number) => new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00+03:00`);
const ctx = { settings: null, endMinutes: 40, zmanimFor: (d: Date) => zmanimFor(d, null) };
const ids = (list: { occasion: Occasion }[]) => list.map((a) => a.occasion.id);

describe("occasions read from a board's older settings", () => {
  it("keep what a board that never saved them shows today", () => {
    const list = fromLegacy(normalizeTvConfig({}));
    const shabbat = list.find((o) => o.id === SHABBAT_ID)!;
    expect(shabbat).toMatchObject({ enabled: true, display: "hold", title: "שבת שלום", pictures: ["art:classic"] });
    expect(shabbat.items[0].value).toContain("בּוֹאִי");
    const sukkot = list.find((o) => o.id === calendarId("sukkot"))!;
    expect(sukkot).toMatchObject({ enabled: true, window: "holy", display: "hold", overlap: "together" });
    expect(list.find((o) => o.id === calendarId("chol_hamoed_sukkot"))!.display).toBe("turns");
    expect(list.find((o) => o.id === calendarId("yom_haatzmaut"))!.enabled).toBe(false);
    // Festivals ahead of Shabbat: on Shabbat Chanukah the day leads, as it always did.
    const order = list.map((o) => o.id);
    expect(order.indexOf(calendarId("chanukah"))).toBeLessThan(order.indexOf(SHABBAT_ID));
  });

  it("bring a composed board's Shabbat screen along: its prayer times and blocks", () => {
    const c = normalizeTvConfig({
      screens: [
        { id: "a", name: "הלוח", seconds: 40, blocks: [{ block: "header" }, { block: "prayers" }, { block: "festival" }] },
        { id: "b", name: "מסך החג", seconds: 40, blocks: [{ block: "festival" }] },
        {
          id: "c",
          name: "מסך השבת",
          seconds: 50,
          blocks: [{ block: "shabbat" }, { block: "prayers" }, { block: "zmanim" }, { block: "announcements" }, { block: "clock" }],
        },
      ],
      hidden: ["shabbat.blessing"],
      texts: { "shabbat.title": "שבת קודש" },
    });
    const list = fromLegacy(c);
    const shabbat = list.find((o) => o.id === SHABBAT_ID)!;
    expect(shabbat.elements).toEqual(expect.arrayContaining(["prayers", "zmanim"]));
    expect(shabbat.blocks).toEqual(["announcements"]);
    expect(shabbat.seconds).toBe(50);
    expect(shabbat.items).toEqual([]);
    expect(shabbat.title).toBe("שבת קודש");
    const sukkot = list.find((o) => o.id === calendarId("sukkot"))!;
    // Its own screen taking turns, a line on the ordinary screens, and a screen each beside Shabbat.
    expect(sukkot).toMatchObject({ display: "turns", banner: true, overlap: "separate", seconds: 40 });
  });

  it("stop reading the old settings once the gabbai saves occasions, and keep new calendar days", () => {
    const saved = fromLegacy(normalizeTvConfig({})).slice(0, 3).map((o) => ({ ...o, enabled: false }));
    const c = normalizeTvConfig({ occasions: saved });
    const list = readOccasions(c);
    expect(list.slice(0, 3).every((o) => !o.enabled)).toBe(true);
    expect(list.some((o) => o.id === SHABBAT_ID)).toBe(true);
    expect(new Set(list.map((o) => o.id)).size).toBe(list.length);
  });
});

describe("which occasions are on", () => {
  const list = fromLegacy(normalizeTvConfig({}));

  it("Shabbat from candle lighting on Friday until it ends, and not on Friday morning", () => {
    expect(ids(activeOccasions(list, il("2026-10-09", 10), ctx))).toEqual([]);
    expect(ids(activeOccasions(list, il("2026-10-09", 19), ctx))).toEqual([SHABBAT_ID]);
    expect(ids(activeOccasions(list, il("2026-10-10", 12), ctx))).toEqual([SHABBAT_ID]);
    expect(ids(activeOccasions(list, il("2026-10-10", 21), ctx))).toEqual([]);
  });

  it("a festival on Shabbat: both, the festival first, from the eve", () => {
    // Shmini Atzeret 5787 falls on Shabbat, 3 October 2026; its eve is Friday.
    const eve = activeOccasions(list, il("2026-10-02", 19), ctx);
    expect(ids(eve)).toEqual([calendarId("shmini_atzeret"), SHABBAT_ID]);
    expect(eve[0].date.getDate()).toBe(3);
    // Hoshana Raba, the Friday morning itself, is a day occasion of its own.
    expect(ids(activeOccasions(list, il("2026-10-02", 10), ctx))).toEqual([calendarId("hoshana_raba")]);
  });

  it("the one higher in the list decides how they meet", () => {
    const on = activeOccasions(list, il("2026-10-03", 11), ctx);
    expect(occasionPages(on)).toHaveLength(1);
    expect(occasionPages(on)[0].main.occasion.id).toBe(calendarId("shmini_atzeret"));
    expect(ids(occasionPages(on)[0].with)).toEqual([SHABBAT_ID]);

    const shabbatFirst = [list.find((o) => o.id === SHABBAT_ID)!, ...list.filter((o) => o.id !== SHABBAT_ID)].map((o) =>
      o.id === SHABBAT_ID ? { ...o, overlap: "only" as const } : o,
    );
    const pages = occasionPages(activeOccasions(shabbatFirst, il("2026-10-03", 11), ctx));
    expect(pages).toEqual([expect.objectContaining({ with: [] })]);
    expect(pages[0].main.occasion.id).toBe(SHABBAT_ID);

    const separate = shabbatFirst.map((o) => (o.id === SHABBAT_ID ? { ...o, overlap: "separate" as const } : o));
    expect(occasionPages(activeOccasions(separate, il("2026-10-03", 11), ctx)).map((p) => p.main.occasion.id)).toEqual([
      SHABBAT_ID,
      calendarId("shmini_atzeret"),
    ]);
  });

  it("a switched-off occasion is not on", () => {
    const off = list.map((o) => (o.id === SHABBAT_ID ? { ...o, enabled: false } : o));
    expect(ids(activeOccasions(off, il("2026-10-10", 12), ctx))).toEqual([]);
  });
});

describe("the shul's own occasions", () => {
  const own = (when: unknown, extra: object = {}) =>
    normalizeOccasions([{ id: "o_test1234", name: "הילולא", when, window: "day", elements: ["title"], ...extra }], BLOCK_IDS)[0];

  it("a Hebrew date every year, Adar II falling on Adar in an ordinary year", () => {
    const o = own({ type: "hebrew", month: 13, day: 14 });
    // 14 Adar 5787 (an ordinary year) is 23 March 2027.
    expect(ids(activeOccasions([o], il("2027-03-23", 12), ctx))).toEqual(["o_test1234"]);
    expect(nextDateOf(o, il("2026-10-01", 12))!.toISOString().slice(0, 10)).toBe("2027-03-23");
  });

  it("the 30th of a month that has 29 days that year falls on the 29th", () => {
    // Tevet always has 29 days; 29 Tevet 5787 is 8 January 2027.
    const o = own({ type: "hebrew", month: 10, day: 30 });
    expect(nextDateOf(o, il("2026-10-01", 12))!.toISOString().slice(0, 10)).toBe("2027-01-08");
  });

  it("one date, and a weekday every week", () => {
    expect(ids(activeOccasions([own({ type: "date", date: "2026-11-05" })], il("2026-11-05", 9), ctx))).toEqual(["o_test1234"]);
    expect(activeOccasions([own({ type: "date", date: "2026-11-05" })], il("2026-11-06", 9), ctx)).toEqual([]);
    expect(ids(activeOccasions([own({ type: "weekly", weekday: 2 })], il("2026-10-06", 9), ctx))).toEqual(["o_test1234"]);
  });

  it("nothing unsafe or malformed is kept", () => {
    const list = normalizeOccasions(
      [
        { id: "o_bad", when: { type: "date", date: "2026-11-05" } },
        { id: "o_good12", when: { type: "hebrew", month: 99, day: 1 } },
        {
          id: "o_ok1234",
          name: "x",
          when: { type: "date", date: "2026-11-05" },
          pictures: ["javascript:alert(1)", "https://cdn.example/a.jpg", "art:classic"],
          items: [{ kind: "time", label: "סעודה", value: "25:00" }, { kind: "text", value: "שלום" }],
          blocks: ["announcements", "nope"],
          design: "d_curtain",
        },
      ],
      BLOCK_IDS,
    );
    expect(list.map((o) => o.id)).toEqual(["o_ok1234"]);
    expect(list[0].pictures).toEqual(["https://cdn.example/a.jpg", "art:classic"]);
    expect(list[0].items.map((i) => i.value)).toEqual(["שלום"]);
    expect(list[0].blocks).toEqual(["announcements"]);
    expect(occasionDesign([{ occasion: list[0], date: new Date() }])).toBe("d_curtain");
  });
});

describe("a special Shabbat", () => {
  it("is on from candle lighting until Shabbat ends, with Shabbat itself", () => {
    const list = fromLegacy(normalizeTvConfig({}));
    // Shabbat Shuva 5787 is 19 September 2026.
    expect(ids(activeOccasions(list, il("2026-09-18", 19), ctx))).toEqual([calendarId("shabbat_shuva"), SHABBAT_ID]);
    expect(ids(activeOccasions(list, il("2026-09-19", 21), ctx))).toEqual([]);
  });
});
