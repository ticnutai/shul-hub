import { HDate, HebrewCalendar, flags, type Event } from "@hebcal/core";
import type { MinyanCategory } from "./data";
import { dayTypeFor, jerusalemDateKey, jerusalemWeekday } from "./minyan-time";
import type { Zmanim } from "./zmanim";

/**
 * Shabbatot, festivals, fasts and the rest of the Jewish year.
 *
 * Each kind of day ("יום כיפור", "צום גדליה", "שבת זכור") has a key. The
 * gabbai gives a day its own timetable by switching it on in the admin: that
 * creates a minyan category with system_key "event:<key>". On the day itself
 * that category replaces the ordinary one (ימות החול / יום שישי / שבת) on the
 * website and on the wall; tabs the gabbai made himself stay as they are.
 *
 * Nothing is stored per year: the dates come from the Hebrew calendar (Israel)
 * every time, so a timetable set up for Yom Kippur is there again next year.
 *
 * National days are in the list so they can be prepared, but they never
 * replace the timetable and never show on the board.
 */

export type SpecialGroup = "noraim" | "sukkot" | "chanukah_purim" | "pesach_shavuot" | "fasts" | "shabbatot" | "other" | "national";

export const GROUP_LABELS: Record<SpecialGroup, string> = {
  noraim: "ימים נוראים",
  sukkot: "סוכות",
  chanukah_purim: "חנוכה ופורים",
  pesach_shavuot: "פסח ושבועות",
  fasts: "צומות",
  shabbatot: "שבתות מיוחדות",
  other: "ראש חודש ומועדים נוספים",
  national: "ימים לאומיים (לא מוצגים)",
};

export interface SpecialDayDef {
  key: string;
  name: string;
  group: SpecialGroup;
  /** hebcal's English description(s) of the day. */
  match: RegExp;
  national?: boolean;
}

/** In order of precedence: when two fall on one day, the first one with a timetable wins. */
export const SPECIAL_DAYS: SpecialDayDef[] = [
  { key: "yom_kippur", name: "יום כיפור", group: "noraim", match: /^Yom Kippur$/ },
  { key: "erev_yom_kippur", name: "ערב יום כיפור", group: "noraim", match: /^Erev Yom Kippur$/ },
  { key: "rosh_hashana", name: "ראש השנה", group: "noraim", match: /^Rosh Hashana( \d+| II)$/ },
  { key: "erev_rosh_hashana", name: "ערב ראש השנה", group: "noraim", match: /^Erev Rosh Hashana$/ },
  { key: "shabbat_shuva", name: "שבת שובה", group: "shabbatot", match: /^Shabbat Shuva$/ },
  { key: "tisha_bav", name: "תשעה באב", group: "fasts", match: /^Tish'a B'Av$/ },
  { key: "erev_tisha_bav", name: "ערב תשעה באב", group: "fasts", match: /^Erev Tish'a B'Av$/ },
  { key: "tzom_gedaliah", name: "צום גדליה", group: "fasts", match: /^Tzom Gedaliah$/ },
  { key: "asara_btevet", name: "עשרה בטבת", group: "fasts", match: /^Asara B'Tevet$/ },
  { key: "taanit_esther", name: "תענית אסתר", group: "fasts", match: /^Ta'anit Esther$/ },
  { key: "shiva_asar_btamuz", name: "י״ז בתמוז", group: "fasts", match: /^Tzom Tammuz$/ },
  { key: "taanit_bechorot", name: "תענית בכורות", group: "fasts", match: /^Ta'anit Bechorot$/ },
  { key: "sukkot", name: "סוכות (יום טוב)", group: "sukkot", match: /^Sukkot I$/ },
  { key: "erev_sukkot", name: "ערב סוכות", group: "sukkot", match: /^Erev Sukkot$/ },
  { key: "hoshana_raba", name: "הושענא רבה", group: "sukkot", match: /Hoshana Raba/ },
  { key: "chol_hamoed_sukkot", name: "חול המועד סוכות", group: "sukkot", match: /^Sukkot (II|III|IV|V|VI) \(CH''M\)$/ },
  { key: "shmini_atzeret", name: "שמיני עצרת ושמחת תורה", group: "sukkot", match: /^Shmini Atzeret$/ },
  { key: "pesach", name: "פסח (יום טוב ראשון)", group: "pesach_shavuot", match: /^Pesach I$/ },
  { key: "shvii_shel_pesach", name: "שביעי של פסח", group: "pesach_shavuot", match: /^Pesach VII$/ },
  { key: "erev_pesach", name: "ערב פסח", group: "pesach_shavuot", match: /^Erev Pesach$/ },
  { key: "chol_hamoed_pesach", name: "חול המועד פסח", group: "pesach_shavuot", match: /^Pesach (II|III|IV|V|VI) \(CH''M\)$/ },
  { key: "shavuot", name: "שבועות", group: "pesach_shavuot", match: /^Shavuot$/ },
  { key: "erev_shavuot", name: "ערב שבועות", group: "pesach_shavuot", match: /^Erev Shavuot$/ },
  { key: "purim", name: "פורים", group: "chanukah_purim", match: /^Purim$/ },
  { key: "erev_purim", name: "ליל פורים (ערב פורים)", group: "chanukah_purim", match: /^Erev Purim$/ },
  { key: "shushan_purim", name: "שושן פורים", group: "chanukah_purim", match: /^Shushan Purim$/ },
  { key: "chanukah", name: "חנוכה", group: "chanukah_purim", match: /^Chanukah: / },
  { key: "shabbat_hagadol", name: "שבת הגדול", group: "shabbatot", match: /^Shabbat HaGadol$/ },
  { key: "shabbat_zachor", name: "שבת זכור", group: "shabbatot", match: /^Shabbat Zachor$/ },
  { key: "shabbat_parah", name: "שבת פרה", group: "shabbatot", match: /^Shabbat Parah$/ },
  { key: "shabbat_hachodesh", name: "שבת החודש", group: "shabbatot", match: /^Shabbat HaChodesh$/ },
  { key: "shabbat_shekalim", name: "שבת שקלים", group: "shabbatot", match: /^Shabbat Shekalim$/ },
  { key: "shabbat_chazon", name: "שבת חזון", group: "shabbatot", match: /^Shabbat Chazon$/ },
  { key: "shabbat_nachamu", name: "שבת נחמו", group: "shabbatot", match: /^Shabbat Nachamu$/ },
  { key: "shabbat_shirah", name: "שבת שירה", group: "shabbatot", match: /^Shabbat Shirah$/ },
  { key: "lag_baomer", name: "ל״ג בעומר", group: "other", match: /^Lag BaOmer$/ },
  { key: "tu_bishvat", name: "ט״ו בשבט", group: "other", match: /^Tu BiShvat$/ },
  { key: "tu_bav", name: "ט״ו באב", group: "other", match: /^Tu B'Av$/ },
  { key: "pesach_sheni", name: "פסח שני", group: "other", match: /^Pesach Sheni$/ },
  { key: "rosh_chodesh", name: "ראש חודש", group: "other", match: /^Rosh Chodesh / },
  { key: "yom_hashoah", name: "יום השואה", group: "national", match: /^Yom HaShoah$/, national: true },
  { key: "yom_hazikaron", name: "יום הזיכרון", group: "national", match: /^Yom HaZikaron$/, national: true },
  { key: "yom_haatzmaut", name: "יום העצמאות", group: "national", match: /^Yom HaAtzma'ut$/, national: true },
  { key: "yom_yerushalayim", name: "יום ירושלים", group: "national", match: /^Yom Yerushalayim$/, national: true },
];

export const EVENT_KEY_PREFIX = "event:";
export const eventSystemKey = (key: string) => `${EVENT_KEY_PREFIX}${key}`;
export const isEventCategory = (c: Pick<MinyanCategory, "system_key">) =>
  Boolean(c.system_key?.startsWith(EVENT_KEY_PREFIX));
export const specialDayByKey = (key: string) => SPECIAL_DAYS.find((d) => d.key === key);

/** hebcal's events on Jerusalem's calendar day of `date` (Israel schedule). */
function hebcalEventsOn(date: Date): Event[] {
  const [y, m, d] = jerusalemDateKey(date).split("-").map(Number);
  return HebrewCalendar.getHolidaysOnDate(new HDate(new Date(y!, m! - 1, d!, 12)), true) ?? [];
}

/** The special days that fall on `date`, in order of precedence. */
export function specialDaysOn(date: Date): SpecialDayDef[] {
  const descs = hebcalEventsOn(date).map((e) => e.getDesc());
  return SPECIAL_DAYS.filter((def) => descs.some((d) => def.match.test(d)));
}

/** The next dates (YYYY-MM-DD, Jerusalem) a special day falls on, from `from` on. */
export function nextDatesOf(key: string, from: Date, count = 1): string[] {
  const def = specialDayByKey(key);
  if (!def) return [];
  const start = new Date(from.getTime());
  const end = new Date(from.getTime() + 400 * 86_400_000);
  const events = HebrewCalendar.calendar({ start, end, il: true, sedrot: false, candlelighting: false, omer: false });
  const out: string[] = [];
  for (const e of events) {
    if (!def.match.test(e.getDesc())) continue;
    const g = e.getDate().greg();
    const keyDate = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`;
    if (!out.includes(keyDate)) out.push(keyDate);
    if (out.length >= count) break;
  }
  return out;
}

/** The system key of the ordinary day: "shabbat" on Saturday when that tab exists, else what dayTypeFor says. */
export function ordinaryDayKey(date: Date, categories: Pick<MinyanCategory, "system_key" | "active">[]): string {
  if (jerusalemWeekday(date) === 6 && categories.some((c) => c.active && c.system_key === "shabbat")) return "shabbat";
  return dayTypeFor(date);
}

/**
 * Which timetable tabs today has, and which one leads.
 *
 * On a special day with an active tab of its own: that tab, then the tabs the
 * gabbai made himself - the ordinary day tabs step aside. Any other day: the
 * ordinary tabs, never an event's. Categories outside their visible dates
 * are left out as before.
 */
export function todaysCategories<C extends Pick<MinyanCategory, "id" | "system_key" | "active" | "visible_from" | "visible_until">>(
  categories: C[],
  date: Date,
): { event: SpecialDayDef | null; categories: C[]; preferred: C | undefined; ordinaryKey: string } {
  const todayKey = jerusalemDateKey(date);
  const visible = categories.filter(
    (c) =>
      c.active &&
      (!c.visible_from || c.visible_from <= todayKey) &&
      (!c.visible_until || c.visible_until >= todayKey),
  );
  const ordinaryKey = ordinaryDayKey(date, categories);
  for (const def of specialDaysOn(date)) {
    if (def.national) continue;
    const own = visible.find((c) => c.system_key === eventSystemKey(def.key));
    if (own) {
      return { event: def, categories: [own, ...visible.filter((c) => !c.system_key)], preferred: own, ordinaryKey };
    }
  }
  const ordinary = visible.filter((c) => !isEventCategory(c));
  return {
    event: null,
    categories: ordinary,
    preferred: ordinary.find((c) => c.system_key === ordinaryKey),
    ordinaryKey,
  };
}

export interface SpecialZman {
  key: string;
  label: string;
  time: Date | null;
}

/**
 * The day's own times, shown beside the ordinary zmanim: when a fast starts
 * and ends, candle lighting before a festival, when the festival ends.
 * Everything comes from the same zmanim as the rest of the board.
 */
export function specialZmanim(date: Date, z: Zmanim): SpecialZman[] {
  const events = hebcalEventsOn(date).filter((e) => !(e.getFlags() & flags.MODERN_HOLIDAY));
  const out: SpecialZman[] = [];
  const add = (key: string, label: string, time: Date | null) => {
    if (!out.some((r) => r.key === key)) out.push({ key, label, time });
  };
  const friday = jerusalemWeekday(date) === 5;
  for (const e of events) {
    const f = e.getFlags();
    const desc = e.getDesc();
    if (desc === "Erev Yom Kippur") {
      add("candle", "הדלקת נרות · תחילת הצום", z.candle);
      continue;
    }
    if (desc === "Yom Kippur") {
      add("fast_end", "צאת החג וסוף הצום", z.tzeit);
      continue;
    }
    if (desc === "Erev Tish'a B'Av") add("fast_start", "תחילת הצום", z.sunset);
    else if (desc === "Tish'a B'Av") add("fast_end", "סוף הצום", z.tzeit);
    else if (f & flags.MINOR_FAST && desc !== "Ta'anit Bechorot") {
      add("fast_start", "תחילת הצום", z.alot);
      add("fast_end", "סוף הצום", z.tzeit);
    }
    if (f & flags.LIGHT_CANDLES && !friday) add("candle", "הדלקת נרות", z.candle);
    if (f & flags.LIGHT_CANDLES_TZEIS) add("candle2", "הדלקת נרות (מאש קיים)", z.tzeit);
    if (f & flags.CHAG && f & flags.YOM_TOV_ENDS) add("chag_end", "צאת החג", z.tzeit);
    if (f & flags.CHANUKAH_CANDLES) add("chanukah", "הדלקת נרות חנוכה", friday ? z.candle : z.tzeit);
  }
  return out;
}

/** The name to show for today's special day, if it is not a national day. */
export function specialDayTitle(date: Date): string | null {
  const def = specialDaysOn(date).find((d) => !d.national);
  return def?.name ?? null;
}

/** The next date of every special day, in one pass over the coming year. */
export function nextDatesAll(from: Date): Record<string, string | null> {
  const events = HebrewCalendar.calendar({
    start: new Date(from.getTime()),
    end: new Date(from.getTime() + 400 * 86_400_000),
    il: true,
    sedrot: false,
    candlelighting: false,
    omer: false,
  });
  const out: Record<string, string | null> = Object.fromEntries(SPECIAL_DAYS.map((d) => [d.key, null]));
  for (const e of events) {
    const desc = e.getDesc();
    for (const def of SPECIAL_DAYS) {
      if (out[def.key] || !def.match.test(desc)) continue;
      const g = e.getDate().greg();
      out[def.key] = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`;
    }
  }
  return out;
}

/** Shabbat, or a festival on which work is forbidden (יום טוב, יום כיפור). */
export function isHolyDay(date: Date): boolean {
  if (jerusalemWeekday(date) === 6) return true;
  return hebcalEventsOn(date).some((e) => e.getFlags() & flags.CHAG && !(e.getFlags() & flags.MODERN_HOLIDAY));
}

/**
 * From candle lighting on the eve until nightfall at the end of Shabbat or a
 * festival: the holy day that is on now, with its date and times, or null.
 * `zmanimOn` gives the times of another day (the eve looks at tomorrow's).
 */
export function holyWindow<Z extends { candle: Date | null; tzeit: Date | null }>(
  now: Date,
  today: Z,
  zmanimOn: (date: Date) => Z,
): { date: Date; zmanim: Z } | null {
  if (isHolyDay(now) && today.tzeit && now < today.tzeit) return { date: now, zmanim: today };
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  if (today.candle && now >= today.candle && isHolyDay(tomorrow)) return { date: tomorrow, zmanim: zmanimOn(tomorrow) };
  return null;
}

/** The day to show today, if any: the first non-national special day the gabbai set up. */
export function boardSpecialDay(
  categories: Pick<MinyanCategory, "system_key" | "active">[] | undefined,
  config: { eventImages: Record<string, string[]> },
  now: Date,
): SpecialDayDef | null {
  for (const def of specialDaysOn(now)) {
    if (def.national) continue;
    const configured = (categories ?? []).some((c) => c.active && c.system_key === eventSystemKey(def.key));
    if (configured || config.eventImages[def.key]?.length) return def;
  }
  return null;
}

/* ------------------------------------------------ verses and combined days -- */

/**
 * A verse for each special day, shown quietly under its name on the board.
 * Written without vowels (the board's type has none), with the source.
 */
const VERSES: Record<string, { text: string; source: string }> = {
  shabbat: { text: "וקראת לשבת ענג לקדוש ה' מכבד", source: "ישעיה נח, יג" },
  rosh_hashana: { text: "תקעו בחדש שופר בכסה ליום חגנו", source: "תהילים פא, ד" },
  erev_rosh_hashana: { text: "תקעו בחדש שופר בכסה ליום חגנו", source: "תהילים פא, ד" },
  yom_kippur: { text: "כי ביום הזה יכפר עליכם לטהר אתכם", source: "ויקרא טז, ל" },
  erev_yom_kippur: { text: "כי ביום הזה יכפר עליכם לטהר אתכם", source: "ויקרא טז, ל" },
  shabbat_shuva: { text: "שובה ישראל עד ה' אלקיך", source: "הושע יד, ב" },
  sukkot: { text: "בסכת תשבו שבעת ימים", source: "ויקרא כג, מב" },
  erev_sukkot: { text: "בסכת תשבו שבעת ימים", source: "ויקרא כג, מב" },
  chol_hamoed_sukkot: { text: "ושמחת בחגך והיית אך שמח", source: "דברים טז, יד-טו" },
  hoshana_raba: { text: "אנא ה' הושיעה נא", source: "תהילים קיח, כה" },
  shmini_atzeret: { text: "ביום השמיני עצרת תהיה לכם", source: "במדבר כט, לה" },
  chanukah: { text: "כי אתה תאיר נרי ה' אלקי יגיה חשכי", source: "תהילים יח, כט" },
  purim: { text: "ליהודים היתה אורה ושמחה וששן ויקר", source: "אסתר ח, טז" },
  erev_purim: { text: "ליהודים היתה אורה ושמחה וששן ויקר", source: "אסתר ח, טז" },
  shushan_purim: { text: "ליהודים היתה אורה ושמחה וששן ויקר", source: "אסתר ח, טז" },
  pesach: { text: "והגדת לבנך ביום ההוא", source: "שמות יג, ח" },
  erev_pesach: { text: "והגדת לבנך ביום ההוא", source: "שמות יג, ח" },
  chol_hamoed_pesach: { text: "את חג המצות תשמר", source: "שמות כג, טו" },
  shvii_shel_pesach: { text: "אז ישיר משה ובני ישראל את השירה הזאת", source: "שמות טו, א" },
  shavuot: { text: "וחג שבעת תעשה לך", source: "שמות לד, כב" },
  erev_shavuot: { text: "וחג שבעת תעשה לך", source: "שמות לד, כב" },
  tzom_gedaliah: { text: "שובו אלי ואשובה אליכם", source: "מלאכי ג, ז" },
  asara_btevet: { text: "שובו אלי ואשובה אליכם", source: "מלאכי ג, ז" },
  taanit_esther: { text: "לכו כנוס את כל היהודים", source: "אסתר ד, טז" },
  shiva_asar_btamuz: { text: "שובו אלי ואשובה אליכם", source: "מלאכי ג, ז" },
  tisha_bav: { text: "השיבנו ה' אליך ונשובה חדש ימינו כקדם", source: "איכה ה, כא" },
  erev_tisha_bav: { text: "השיבנו ה' אליך ונשובה חדש ימינו כקדם", source: "איכה ה, כא" },
  shabbat_zachor: { text: "זכור את אשר עשה לך עמלק", source: "דברים כה, יז" },
  shabbat_parah: { text: "וזרקתי עליכם מים טהורים וטהרתם", source: "יחזקאל לו, כה" },
  shabbat_hachodesh: { text: "החדש הזה לכם ראש חדשים", source: "שמות יב, ב" },
  shabbat_hagadol: { text: "הנה אנכי שלח לכם את אליה הנביא", source: "מלאכי ג, כג" },
  shabbat_shekalim: { text: "זה יתנו כל העבר על הפקדים מחצית השקל", source: "שמות ל, יג" },
  shabbat_chazon: { text: "ציון במשפט תפדה ושביה בצדקה", source: "ישעיה א, כז" },
  shabbat_nachamu: { text: "נחמו נחמו עמי יאמר אלקיכם", source: "ישעיה מ, א" },
  shabbat_shirah: { text: "אז ישיר משה ובני ישראל את השירה הזאת", source: "שמות טו, א" },
  rosh_chodesh: { text: "החדש הזה לכם ראש חדשים", source: "שמות יב, ב" },
  lag_baomer: { text: "וספרתם לכם ממחרת השבת", source: "ויקרא כג, טו" },
  tu_bishvat: { text: "כי האדם עץ השדה", source: "דברים כ, יט" },
};

export function verseFor(key: string): { text: string; source: string } | null {
  return VERSES[key] ?? null;
}

/**
 * The day as the board names it when days meet: a festival on Shabbat reads
 * "שבת חול המועד סוכות" or "שבת · סוכות (יום טוב)", and the other days of
 * the date (ראש חודש on Chanukah) follow as a quiet second line. Weekly
 * Shabbat is not a special day of its own; it joins by the calendar.
 */
export function combinedDay(def: SpecialDayDef, date: Date): { title: string; also: string[]; shabbat: boolean } {
  const shabbat = jerusalemWeekday(date) === 6 && def.group !== "shabbatot";
  const others = specialDaysOn(date)
    .filter((d) => d.key !== def.key && !d.national)
    .map((d) => d.name);
  // The admin's list says "סוכות (יום טוב)"; the board says "סוכות".
  let title = def.name.replace(/\s*\([^)]*\)\s*$/, "");
  if (shabbat) title = def.key.startsWith("chol_hamoed") ? `שבת ${title}` : `שבת · ${title}`;
  return { title, also: others, shabbat };
}
