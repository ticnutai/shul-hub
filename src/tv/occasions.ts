import { HDate } from "@hebcal/core";
import type { Settings } from "@community/lib/data";
import { jerusalemDateKey, jerusalemWeekday } from "@community/lib/minyan-time";
import { SPECIAL_DAYS, holyWindow, isHolyDay, specialDaysOn, type SpecialDayDef } from "@community/lib/specialDays";
import type { Zmanim } from "@community/lib/zmanim";
import { civilHDate } from "@/lib/jewishDay";
import type { BlockId, Screen, TvConfig } from "./config";
import { eventSlides, stylesFor } from "./eventSlides";
import { shabbatNow } from "./shabbat";

/**
 * Occasions: Shabbat, the festivals, Rosh Chodesh, and the days a shul adds
 * for itself (a hillula, the day the shul was founded) - one system.
 *
 * There used to be five: the Shabbat screen with its own settings, the
 * festival's screen with seven switches of its own, "a look per day", the
 * Shabbat and festival blocks of the composer, and an order of precedence
 * fixed in code. Each answered part of one question - what does the board
 * show on a day that is not an ordinary one - and they disagreed at the
 * edges (Shabbat on Chanukah was decided by whichever of them ran last).
 *
 * Now every such day is an Occasion, in ONE list whose order is the order of
 * importance. Each says:
 *   when          every Shabbat / a day of the calendar / a Hebrew date every
 *                 year / one date / a weekday every week
 *   window        "holy": from candle lighting on the eve until it ends (the
 *                 way Shabbat and Yom Tov are kept); "day": the calendar day
 *   what shows    the card's parts (name, date, verse, times, the Torah
 *                 reading, the day's minyanim...), items of its own (a line
 *                 of text, a time with a label), and blocks of the ordinary
 *                 board (announcements, shiurim...)
 *   how           "hold": it has the board to itself while it is on;
 *                 "turns": it takes turns with the ordinary screens;
 *                 "off": no screen of its own - and `banner` adds a line
 *                 along the bottom of the ordinary screens
 *   overlap       when it meets another occasion: only itself, both on one
 *                 screen, or each on its own screen. When two meet, the one
 *                 higher in the list decides, and comes first.
 *   design        a design (designs.ts) the whole board wears while it is on
 *
 * A board that never saved occasions reads them from its old settings
 * (fromLegacy), so nothing changes on the wall until the gabbai changes it.
 */

/* --------------------------------------------------------------- model -- */

export type OccasionWhen =
  | { type: "shabbat" }
  | { type: "calendar"; key: string }
  | { type: "weekly"; weekday: number }
  /** hebcal month numbers: 1 ניסן ... 7 תשרי ... 12 אדר (א׳ in a leap year), 13 אדר ב׳. */
  | { type: "hebrew"; month: number; day: number }
  | { type: "date"; date: string };

export type OccasionWindow = "holy" | "day";
export type OccasionDisplay = "hold" | "turns" | "off";
export type OccasionOverlap = "only" | "together" | "separate";

/** The parts of the occasion's own card, in the order the card draws them. */
export const CARD_ELEMENTS = [
  "title",
  "date",
  "also",
  "verse",
  "parasha",
  "items",
  "times",
  "shma",
  "zmanim",
  "prayers",
  "torah",
  "haftarah",
  "pictures",
] as const;
export type CardElement = (typeof CARD_ELEMENTS)[number];

export const CARD_ELEMENT_LABELS: Record<CardElement, string> = {
  title: "שם המועד",
  date: "התאריך העברי",
  also: "מועדים נוספים באותו יום",
  verse: "פסוק",
  parasha: "פרשת השבוע",
  items: "השורות שהוספתם",
  times: "זמני המועד (הדלקת נרות, צאת, תענית)",
  shma: "סוף זמן קריאת שמע ותפילה",
  zmanim: "כל זמני היום",
  prayers: "תפילות המועד",
  torah: "קריאת התורה",
  haftarah: "הפטרה",
  pictures: "תמונות ברקע",
};

/** Blocks of the ordinary board an occasion's screen can carry beside its card. */
export const OCCASION_BLOCKS: readonly BlockId[] = ["announcements", "shiurim", "learning", "slideshow", "ticker"];

export interface OccasionItem {
  id: string;
  kind: "text" | "time";
  /** For a time: what it is ("סעודה שלישית"). For text: an optional heading. */
  label: string;
  /** For a time: "HH:MM". For text: the text. */
  value: string;
}

export interface Occasion {
  /** "shabbat", "cal:<key>" for the calendar's days, "o_<random>" for the shul's own. */
  id: string;
  name: string;
  /** What the card says as its name, when not the occasion's own name. */
  title: string | null;
  /** On: it appears by itself when its day comes. */
  enabled: boolean;
  when: OccasionWhen;
  window: OccasionWindow;
  display: OccasionDisplay;
  /** A line along the bottom of the ordinary screens while it is on. */
  banner: boolean;
  overlap: OccasionOverlap;
  /** How long its screen holds when it takes turns (or when there are several). */
  seconds: number;
  elements: CardElement[];
  blocks: BlockId[];
  items: OccasionItem[];
  /** "art:<id>" (a Shabbat drawing), "style:<n>" (a built-in design), or an uploaded picture's https URL. */
  pictures: string[];
  pictureSeconds: number;
  /** A design (designs.ts) the board wears while this is on. */
  design: string | null;
  /**
   * Its screen, built in the composer like any other ("פריסה"): the card is
   * one block there ("festival", כרטיס המועד) beside the board's own -
   * prayers, zmanim, announcements - each where the gabbai put it. Null: the
   * card over the whole board, as every occasion was drawn before, and still
   * is until somebody arranges it.
   */
  screen: Screen | null;
}

/** The card's block on an occasion's screen. */
export const CARD_BLOCK: BlockId = "festival";

/**
 * The screen an occasion starts from in the composer: the bars, its card,
 * and the blocks it already carried beside the card.
 */
export function occasionScreenOf(o: Occasion): Screen {
  if (o.screen) return o.screen;
  const blocks: BlockId[] = ["header", "clock", CARD_BLOCK, ...o.blocks.filter((b) => b !== "ticker"), "footer"];
  return { id: `occasion-${o.id.replace(/[^a-z0-9_-]/gi, "_")}`.slice(0, 40), name: o.name, seconds: o.seconds, blocks: blocks.map((block) => ({ block })) };
}

export const SHABBAT_ID = "shabbat";
export const calendarId = (key: string) => `cal:${key}`;
const CUSTOM_ID_RE = /^o_[a-z0-9]{4,16}$/;
export const newOccasionId = () => `o_${Math.random().toString(36).slice(2, 10)}`;
export const MAX_OCCASIONS = 120;
export const MAX_OCCASION_PICTURES = 12;
export const SHABBAT_BLESSING = "בּוֹאִי בְשָׁלוֹם עֲטֶרֶת בַּעְלָהּ, גַּם בְּשִׂמְחָה וּבְצָהֳלָה";

/** The festivals kept from candle lighting to nightfall, like Shabbat. */
const YOM_TOV = new Set(["rosh_hashana", "yom_kippur", "sukkot", "shmini_atzeret", "pesach", "shvii_shel_pesach", "shavuot"]);

/** Days kept from candle lighting on the eve until nightfall: Yom Tov and the special Shabbatot. */
const keptFromEve = (def: SpecialDayDef) => YOM_TOV.has(def.key) || def.group === "shabbatot";

const FULL: CardElement[] = ["title", "date", "also", "verse", "items", "times", "zmanim", "prayers", "torah", "haftarah", "pictures"];
const SHORT: CardElement[] = ["title", "date", "also", "verse", "items", "times", "shma", "pictures"];
const SHABBAT_ELEMENTS: CardElement[] = ["title", "parasha", "items", "times", "shma", "pictures"];

function builtinDefault(def: SpecialDayDef | null): Occasion {
  if (!def)
    return {
      id: SHABBAT_ID,
      name: "שבת",
      title: "שבת שלום",
      enabled: true,
      when: { type: "shabbat" },
      window: "holy",
      display: "hold",
      banner: false,
      overlap: "together",
      seconds: 45,
      elements: SHABBAT_ELEMENTS,
      blocks: [],
      items: [{ id: "blessing", kind: "text", label: "", value: SHABBAT_BLESSING }],
      pictures: ["art:classic"],
      pictureSeconds: 60,
      design: null,
      screen: null,
    };
  const holy = keptFromEve(def);
  return {
    id: calendarId(def.key),
    name: def.name,
    title: null,
    enabled: !def.national,
    when: { type: "calendar", key: def.key },
    window: holy ? "holy" : "day",
    display: holy ? "hold" : "turns",
    banner: false,
    overlap: "together",
    seconds: 45,
    elements: FULL,
    blocks: [],
    items: [],
    pictures: eventSlides(undefined, stylesFor(def)).map((s) => ("image" in s ? s.image : `style:${s.variant}`)),
    pictureSeconds: 30,
    design: null,
    screen: null,
  };
}

/** Every occasion the board knows without being told, in their default order. */
export function builtinOccasions(): Occasion[] {
  const days = SPECIAL_DAYS.filter((d) => !d.national).map(builtinDefault);
  const national = SPECIAL_DAYS.filter((d) => d.national).map(builtinDefault);
  // Shabbat after the days of the calendar: when a festival falls on Shabbat
  // the festival leads ("שבת · סוכות", its pictures), as the board always did.
  return [...days, builtinDefault(null), ...national];
}

/* ------------------------------------------------------------ reading -- */

/**
 * The board's occasions. A board that saved its own list has it (with any
 * occasion added to the calendar since, at the end); any other board reads
 * them from the settings it had before there were occasions.
 */
export function readOccasions(config: TvConfig): Occasion[] {
  if (!config.occasions.length) return fromLegacy(config);
  const have = new Set(config.occasions.map((o) => o.id));
  return [...config.occasions, ...builtinOccasions().filter((o) => !have.has(o.id))];
}

/**
 * Which day a stored screen belonged to (the same rule as screens.dayScreen,
 * written here so this file does not import the screens, which import the
 * config, which imports this): a Shabbat block makes a Shabbat screen; a
 * screen of only the day's block, bars aside, is the day's screen.
 */
function legacyDayScreen(s: { blocks: { block: string }[] }): "shabbat" | "festival" | null {
  if (s.blocks.some((b) => b.block === "shabbat")) return "shabbat";
  const content = s.blocks.filter((b) => !["header", "clock", "footer"].includes(b.block));
  return content.length > 0 && content.every((b) => b.block === "festival") ? "festival" : null;
}

/** The old settings, read as occasions: what each board shows today, unchanged. */
export function fromLegacy(c: TvConfig): Occasion[] {
  const screens = c.screens ?? [];
  const composed = screens.length > 0;
  const shabbatScreens = screens.filter((s) => legacyDayScreen(s) === "shabbat");
  const festivalAlone = screens.find((s) => legacyDayScreen(s) === "festival");
  const festivalBanner = screens.some((s) => legacyDayScreen(s) === null && s.blocks.some((b) => b.block === "festival"));
  const onShabbatScreen = new Set(shabbatScreens.flatMap((s) => s.blocks.map((b) => b.block)));
  const hidden = new Set(c.hidden);
  const designFor = (kind: keyof TvConfig["dayLooks"]) => c.dayLooks[kind]?.design ?? null;

  return builtinOccasions().map((o) => {
    if (o.id === SHABBAT_ID) {
      const elements = SHABBAT_ELEMENTS.filter(
        (e) =>
          !((e === "times" || e === "shma") && hidden.has("shabbat.times")) &&
          !(e === "pictures" && hidden.has("shabbat.art")),
      );
      // A Shabbat screen with the prayer times on it: they come along.
      if (onShabbatScreen.has("prayers")) elements.push("prayers");
      if (onShabbatScreen.has("zmanim")) elements.push("zmanim");
      return {
        ...o,
        title: c.texts["shabbat.title"] ?? o.title,
        enabled: c.shabbat.enabled && (!composed || shabbatScreens.length > 0),
        seconds: shabbatScreens[0]?.seconds || o.seconds,
        elements: CARD_ELEMENTS.filter((e) => elements.includes(e)),
        blocks: OCCASION_BLOCKS.filter((b) => onShabbatScreen.has(b)),
        items: hidden.has("shabbat.blessing")
          ? []
          : [{ id: "blessing", kind: "text" as const, label: "", value: c.texts["shabbat.blessing"] ?? SHABBAT_BLESSING }],
        pictures: c.shabbat.rotate ? c.shabbat.scenes : c.shabbat.scenes.slice(0, 1),
        pictureSeconds: c.shabbat.secondsPerScene,
        design: designFor("shabbat"),
      };
    }
    const key = (o.when as { key: string }).key;
    const def = SPECIAL_DAYS.find((d) => d.key === key)!;
    const images = c.eventImages[key] ?? [];
    const enabled =
      c.eventSplash && (!def.national || c.eventNationalAuto) && (c.eventAuto !== "off" || images.length > 0);
    // A composed board shows the day as a screen of its own when it has one,
    // and as a line on its ordinary screens when the day's block is on them.
    const display: OccasionDisplay = composed
      ? festivalAlone
        ? "turns"
        : "off"
      : c.eventAuto === "info" && !images.length
        ? "off"
        : c.eventHold && keptFromEve(def)
          ? "hold"
          : "turns";
    return {
      ...o,
      enabled,
      display,
      banner: composed ? festivalBanner : c.eventAuto === "info" && !images.length,
      // Both a Shabbat screen and the day's screen: the board showed them one after the other.
      overlap: c.eventCombine === "separate" || (composed && festivalAlone && shabbatScreens.length) ? "separate" : "together",
      seconds: festivalAlone?.seconds || c.eventEverySeconds,
      elements: c.eventDetail === "short" ? SHORT : FULL,
      pictures: eventSlides(images, stylesFor(def), c.eventStyles[key]).map((s) => ("image" in s ? s.image : `style:${s.variant}`)),
      design: key === "rosh_chodesh" ? designFor("roshChodesh") : def.group === "national" ? null : designFor("festival"),
    };
  });
}

/* -------------------------------------------------------- validation -- */

const clamp = (v: unknown, d: number, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
const oneOf = <T extends string>(v: unknown, all: readonly T[], d: T): T => (all.includes(v as T) ? (v as T) : d);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const PICTURE_RE = /^(art:[a-z0-9-]{1,30}|style:\d{1,3}|https:\/\/[^\s"'()<>]{1,500})$/;

function readWhen(v: unknown): OccasionWhen | null {
  const r = (v ?? {}) as Record<string, unknown>;
  switch (r.type) {
    case "shabbat":
      return { type: "shabbat" };
    case "calendar":
      return typeof r.key === "string" && SPECIAL_DAYS.some((d) => d.key === r.key) ? { type: "calendar", key: r.key } : null;
    case "weekly":
      return { type: "weekly", weekday: clamp(r.weekday, 0, 0, 6) };
    case "hebrew": {
      const ok = (n: unknown, hi: number) => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= hi;
      return ok(r.month, 13) && ok(r.day, 30) ? { type: "hebrew", month: r.month as number, day: r.day as number } : null;
    }
    case "date":
      return typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? { type: "date", date: r.date } : null;
  }
  return null;
}

/**
 * A stored list of occasions, checked. Built-in occasions keep their own
 * `when` (it is what makes them what they are); the shul's own are kept only
 * with a valid one.
 */
export function normalizeOccasions(
  raw: unknown,
  blockIds: readonly string[],
  /** The board's own screen reader (config.ts), so an occasion's screen is read by the same rules. */
  readScreen: (raw: unknown) => Screen | undefined = () => undefined,
): Occasion[] {
  if (!Array.isArray(raw)) return [];
  const builtins = new Map(builtinOccasions().map((o) => [o.id, o]));
  const seen = new Set<string>();
  const out: Occasion[] = [];
  for (const v of raw.slice(0, MAX_OCCASIONS)) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const base = builtins.get(id);
    if (seen.has(id) || (!base && !CUSTOM_ID_RE.test(id))) continue;
    const when = base ? base.when : readWhen(r.when);
    if (!when) continue;
    seen.add(id);
    const d = base ?? builtinDefault(null);
    const items = (Array.isArray(r.items) ? r.items : [])
      .slice(0, 12)
      .flatMap((x): OccasionItem[] => {
        const i = (x ?? {}) as Record<string, unknown>;
        const kind = i.kind === "time" ? "time" : "text";
        const value = text(i.value, 400);
        if (kind === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return [];
        if (!value) return [];
        return [{ id: text(i.id, 20) || Math.random().toString(36).slice(2, 8), kind, label: text(i.label, 60), value }];
      });
    out.push({
      id,
      name: text(r.name, 60) || d.name,
      title: typeof r.title === "string" && r.title.trim() ? text(r.title, 80) : null,
      enabled: r.enabled !== false,
      when,
      window: when.type === "shabbat" ? "holy" : oneOf(r.window, ["holy", "day"] as const, d.window),
      display: oneOf(r.display, ["hold", "turns", "off"] as const, d.display),
      banner: r.banner === true,
      overlap: oneOf(r.overlap, ["only", "together", "separate"] as const, d.overlap),
      seconds: clamp(r.seconds, d.seconds, 10, 600),
      elements: CARD_ELEMENTS.filter((e) => Array.isArray(r.elements) && r.elements.includes(e)),
      blocks: OCCASION_BLOCKS.filter((b) => blockIds.includes(b) && Array.isArray(r.blocks) && r.blocks.includes(b)),
      items,
      pictures: (Array.isArray(r.pictures) ? r.pictures : [])
        .filter((p): p is string => typeof p === "string" && PICTURE_RE.test(p.trim()))
        .map((p) => p.trim())
        .slice(0, MAX_OCCASION_PICTURES),
      pictureSeconds: clamp(r.pictureSeconds, d.pictureSeconds, 5, 600),
      design: typeof r.design === "string" && /^d_[a-z0-9_]{2,20}$/.test(r.design) ? r.design : null,
      // Kept only with its card on it: without the card it would not be the occasion's screen.
      screen: (() => {
        const s = r.screen ? readScreen(r.screen) : undefined;
        return s && s.blocks.some((b) => b.block === CARD_BLOCK) ? s : null;
      })(),
    });
  }
  return out;
}

/* ---------------------------------------------------------- on the day -- */

export interface ActiveOccasion {
  occasion: Occasion;
  /** The day it is for: tomorrow, on the eve of a Shabbat or festival after candle lighting. */
  date: Date;
}

export interface OccasionContext {
  settings: Settings | null | undefined;
  /** Minutes after sunset that Shabbat and festivals end. */
  endMinutes: number;
  zmanimFor: (date: Date) => Zmanim;
}

/** Hebrew months as the gabbai names them, for the dialog. */
export const HEBREW_MONTHS: { month: number; name: string }[] = [
  { month: 7, name: "תשרי" },
  { month: 8, name: "חשוון" },
  { month: 9, name: "כסלו" },
  { month: 10, name: "טבת" },
  { month: 11, name: "שבט" },
  { month: 12, name: "אדר (אדר א׳ בשנה מעוברת)" },
  { month: 13, name: "אדר ב׳" },
  { month: 1, name: "ניסן" },
  { month: 2, name: "אייר" },
  { month: 3, name: "סיוון" },
  { month: 4, name: "תמוז" },
  { month: 5, name: "אב" },
  { month: 6, name: "אלול" },
];

/**
 * Whether a Hebrew date falls on `hd`. אדר ב׳ in an ordinary year is אדר; a
 * 30th in a month that has only 29 days that year falls on the 29th - so a
 * day set once comes every year.
 */
function isHebrewDate(hd: HDate, month: number, day: number): boolean {
  const leap = HDate.isLeapYear(hd.getFullYear());
  const m = !leap && month === 13 ? 12 : month;
  if (hd.getMonth() !== m) return false;
  const days = HDate.daysInMonth(m, hd.getFullYear());
  return hd.getDate() === Math.min(day, days);
}

/**
 * The calendar's days on a date, worked out once per date: the board asks
 * about some sixty occasions every minute, and each asking hebcal again for
 * the same date was most of the work.
 */
type DayCache = Map<string, Set<string>>;
function calendarKeys(date: Date, cache?: DayCache): Set<string> {
  const k = jerusalemDateKey(date);
  let keys = cache?.get(k);
  if (!keys) {
    keys = new Set(specialDaysOn(date).map((d) => d.key));
    cache?.set(k, keys);
  }
  return keys;
}

/** Whether the occasion's day is `date` (a civil date; Jerusalem). */
function fallsOn(o: Occasion, date: Date, cache?: DayCache): boolean {
  switch (o.when.type) {
    case "shabbat":
      return jerusalemWeekday(date) === 6;
    case "calendar":
      return calendarKeys(date, cache).has(o.when.key);
    case "weekly":
      return jerusalemWeekday(date) === o.when.weekday;
    case "hebrew":
      return isHebrewDate(civilHDate(date), o.when.month, o.when.day);
    case "date":
      return jerusalemDateKey(date) === o.when.date;
  }
}

/**
 * The occasions on now, most important first.
 *
 * From candle lighting before a Shabbat or festival, the day is the holy day:
 * an ordinary day's occasion (Hoshana Raba, on the Friday before Shmini
 * Atzeret) ends there, and one kept by its calendar day that falls on the
 * holy day (Chanukah, on the Shabbat) begins there.
 */
export function activeOccasions(list: Occasion[], now: Date, ctx: OccasionContext): ActiveOccasion[] {
  const out: ActiveOccasion[] = [];
  const holy = holyWindow(now, ctx.zmanimFor(now), ctx.zmanimFor, ctx.endMinutes);
  const day = holy?.date ?? now;
  const cache: DayCache = new Map();
  for (const o of list) {
    if (!o.enabled) continue;
    if (o.when.type === "shabbat") {
      const times = shabbatNow(now, ctx.settings, ctx.endMinutes);
      if (times) out.push({ occasion: o, date: jerusalemWeekday(now) === 5 ? new Date(now.getTime() + 86_400_000) : now });
      continue;
    }
    if (o.window === "holy" && holy) {
      if (fallsOn(o, holy.date, cache)) out.push({ occasion: o, date: holy.date });
      continue;
    }
    // After a holy day ends (its evening, before midnight) its own occasion is over.
    if (o.window === "holy" && isHolyDay(now)) continue;
    if (fallsOn(o, day, cache)) out.push({ occasion: o, date: day });
  }
  return out;
}

export interface OccasionPage {
  /** The occasion that leads the screen: its card, pictures and parts. */
  main: ActiveOccasion;
  /** The others sharing the screen ("together"). */
  with: ActiveOccasion[];
}

/**
 * What the occasions on now come to on the wall. The one higher in the list
 * decides: only itself, all of them on one screen, or a screen each.
 */
export function occasionPages(active: ActiveOccasion[]): OccasionPage[] {
  if (!active.length) return [];
  const [top, ...rest] = active;
  switch (top.occasion.overlap) {
    case "only":
      return [{ main: top, with: [] }];
    case "together":
      return [{ main: top, with: rest }];
    case "separate":
      return active.map((a) => ({ main: a, with: [] }));
  }
}

/**
 * How a page stands on the wall: the strongest of the occasions on it. On
 * Shabbat Chanukah the page is led by Chanukah, which takes turns - but
 * Shabbat on it holds the board, so the page does.
 */
export function pageDisplay(page: OccasionPage): OccasionDisplay {
  const all = [page.main, ...page.with].map((a) => a.occasion.display);
  return all.includes("hold") ? "hold" : all.includes("turns") ? "turns" : "off";
}

/** The design the board wears now: that of the most important occasion on that has one. */
export function occasionDesign(active: ActiveOccasion[]): string | null {
  return active.find((a) => a.occasion.design)?.occasion.design ?? null;
}

/** The next civil date an occasion falls on, from `from` (for the list and the preview), up to a year and a bit ahead. */
export function nextDateOf(o: Occasion, from: Date, cache: DayCache = new Map()): Date | null {
  for (let i = 0; i < 400; i += 1) {
    const d = new Date(from.getTime() + i * 86_400_000);
    if (fallsOn(o, d, cache)) return d;
  }
  return null;
}

export const describeWhen = (o: Occasion): string => {
  const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  switch (o.when.type) {
    case "shabbat":
      return "כל שבת";
    case "calendar":
      return "לפי הלוח העברי";
    case "weekly":
      return `כל יום ${days[o.when.weekday]}`;
    case "hebrew": {
      const m = o.when.month;
      return `כל שנה, ${o.when.day} ב${HEBREW_MONTHS.find((x) => x.month === m)?.name.replace(/ \(.*\)$/, "") ?? ""}`;
    }
    case "date":
      return `פעם אחת, ${o.when.date.split("-").reverse().join(".")}`;
  }
};

/** When Shabbat and festivals end: the shul's setting, else the board's own. */
export function occasionEndMinutes(config: Pick<TvConfig, "shabbat">, settings: Settings | null | undefined): number {
  return settings?.shabbat_end_minutes ?? config.shabbat.endMinutesAfterSunset;
}

/** The pages on the wall now for this board, in one call. */
export function occasionPagesNow(
  config: TvConfig,
  settings: Settings | null | undefined,
  now: Date,
  zmanimFor: (date: Date) => Zmanim,
): { active: ActiveOccasion[]; pages: OccasionPage[] } {
  const active = activeOccasions(readOccasions(config), now, {
    settings,
    endMinutes: occasionEndMinutes(config, settings),
    zmanimFor,
  });
  return { active, pages: occasionPages(active) };
}
