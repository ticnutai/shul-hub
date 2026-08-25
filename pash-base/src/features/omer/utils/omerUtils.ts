import { HebrewCalendar, HDate, flags } from "@hebcal/core";

declare global {
  interface Window {
    __OMER_TEST_NOW__?: string;
  }
}

// @hebcal/core doesn't export TypeScript types for OmerEvent runtime properties
interface OmerEventLike {
  omer: number;
  getTodayIs: (lang: string) => string;
  sefira: (lang: string) => string;
}

export interface OmerDayEntry {
  day: number;              // 1-49
  hebrewDate: string;       // e.g. "16 Nisan 5786"
  gregorianDate: Date;      // JS Date
  hebrewText: string;       // e.g. "א׳ בָּעוֹמֶר"
  countText: string;        // e.g. "הַיּוֹם יוֹם אֶחָד לָעֹמֶר"
  sefira: string;           // e.g. "חֶֽסֶד שֶׁבְּחֶֽסֶד"
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}

export interface OmerBoardData {
  hebrewYear: number;
  currentDay: number | null;   // null if not in counting season
  isInSeason: boolean;
  startDate: Date;
  endDate: Date;
  days: OmerDayEntry[];
}

export const OMER_BLESSING =
  "בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵֽינוּ מֶלֶךְ הָעוֹלָם, אֲשֶׁר קִדְּשָׁנוּ בְּמִצְוֹתָיו, וְצִוָּנוּ עַל סְפִירַת הָעֹֽמֶר";

export const OMER_AFTER_BLESSING =
  "הָרַחֲמָן הוּא יַחֲזִיר לָנוּ עֲבוֹדַת בֵּית הַמִּקְדָּשׁ לִמְקוֹמָהּ, בִּמְהֵרָה בְיָמֵינוּ אָמֵן סֶלָה";

export const OMER_POPUP_ENABLED_KEY = "omer_popup_enabled_v1";

export function isOmerPopupEnabled(): boolean {
  try {
    const raw = localStorage.getItem(OMER_POPUP_ENABLED_KEY);
    // Default is disabled until user explicitly opts in.
    return raw === "true";
  } catch {
    return false;
  }
}

function buildEvents(gregYear: number) {
  return HebrewCalendar.calendar({ year: gregYear, isHebrewYear: false, omer: true }).filter(
    (e) => e.getFlags() & flags.OMER_COUNT,
  );
}

function getOmerNow(now?: Date): Date {
  if (now) return now;
  if (typeof window !== "undefined" && navigator.webdriver && window.__OMER_TEST_NOW__) {
    const testDate = new Date(window.__OMER_TEST_NOW__);
    if (!Number.isNaN(testDate.getTime())) return testDate;
  }
  return new Date();
}

export function getOmerBoardData(at?: Date): OmerBoardData {
  const now = getOmerNow(at);

  // After nightfall (≥18:00 local time) the Jewish day has already advanced —
  // show the next Omer count so users know what to say tonight.
  const effective = new Date(now);
  if (now.getHours() >= 18) {
    effective.setDate(effective.getDate() + 1);
  }

  const gregYear = effective.getFullYear();

  let events = buildEvents(gregYear);

  // If the Omer season for this Gregorian year has fully passed, show next year's
  const lastEvent = events[events.length - 1];
  const lastDate = lastEvent?.getDate().greg();
  const todayMidnight = new Date(effective.getFullYear(), effective.getMonth(), effective.getDate());
  if (lastDate) {
    const lastMidnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
    if (lastMidnight < todayMidnight) {
      const nextEvents = buildEvents(gregYear + 1);
      if (nextEvents.length > 0) events = nextEvents;
    }
  }

  // Guard: @hebcal/core should always return 49 events, but be safe
  if (events.length === 0) {
    return { hebrewYear: gregYear + 3760, currentDay: null, isInSeason: false, startDate: new Date(), endDate: new Date(), days: [] };
  }

  const startDate = events[0].getDate().greg();
  const endDate = events[events.length - 1].getDate().greg();

  const todayEvent = events.find((ev) => {
    const g = ev.getDate().greg();
    return (
      g.getFullYear() === effective.getFullYear() &&
      g.getMonth() === effective.getMonth() &&
      g.getDate() === effective.getDate()
    );
  });

  const currentDay = todayEvent ? (todayEvent as unknown as OmerEventLike).omer : null;
  const isInSeason = currentDay !== null;

  const hebrewYear = (events[0].getDate() as HDate).getFullYear();

  const days: OmerDayEntry[] = events.map((ev) => {
    const omerEv = ev as unknown as OmerEventLike;
    const day = omerEv.omer;
    const g = ev.getDate().greg();
    const gMidnight = new Date(g.getFullYear(), g.getMonth(), g.getDate());

    return {
      day,
      hebrewDate: ev.getDate().toString(),
      gregorianDate: g,
      hebrewText: ev.render("he") as string,
      countText: omerEv.getTodayIs("he"),
      sefira: omerEv.sefira("he"),
      isToday: day === currentDay,
      isPast: gMidnight < todayMidnight,
      isFuture: gMidnight > todayMidnight,
    };
  });

  return { hebrewYear, currentDay, isInSeason, startDate, endDate, days };
}

/** Canonical seasonal gate for every Omer entry point in the application. */
export function isOmerSeason(now?: Date): boolean {
  return getOmerBoardData(now).isInSeason;
}

/** Format a Date as DD/MM */
export function formatDayMonth(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
