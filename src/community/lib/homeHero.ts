/**
 * The strip at the top of the synagogue's home page (on the website and in
 * the app): how it is laid out and how it looks, as the gabbai chose it in
 * the admin's "דף הבית" tab (HomeHeroSettings). Kept in settings.home_hero.
 *
 * It used to be one thing for every synagogue: a tall blue band repeating
 * the name that the header right above it already shows. Now the name in
 * the strip is shown only where the header does not show it (a header with
 * a logo), unless the gabbai says otherwise; and the strip can be thin,
 * in cards, in two columns, or not there at all, in one of several looks.
 */

export type HeroLayout = "classic" | "compact" | "split" | "cards" | "none";
export type HeroLook = "royal" | "night" | "parchment" | "emerald" | "burgundy" | "stone" | "onyx" | "plain";
/** The name in the strip: only when the header does not show it, always, or never. */
export type HeroName = "auto" | "show" | "hide";

export interface HomeHero {
  layout: HeroLayout;
  look: HeroLook;
  name: HeroName;
  subtitle: boolean;
  date: boolean;
  zmanim: boolean;
  /** "התפילה הבאה: מנחה 13:30 · בעוד 25 דקות" - what is looked for on opening the app. */
  next: boolean;
  /** A picture of the synagogue behind the strip (uploaded to its own storage), under a shade. */
  image: string | null;
  /** The shade over the picture: dark under light letters, or light under dark ones. */
  shade: "dark" | "light";
  /** Another layout on a phone (and in the app); null - the same as on a computer. */
  phoneLayout: HeroLayout | null;
}

export const DEFAULT_HOME_HERO: HomeHero = {
  layout: "classic", look: "royal", name: "auto", subtitle: true, date: true, zmanim: true,
  next: true, image: null, shade: "dark", phoneLayout: null,
};

/** A picture the strip may show: only one stored in the synagogue's own picture storage. */
export const HERO_IMAGE = /^https:\/\/[a-z0-9]{20}\.supabase\.co\/storage\/v1\/object\/public\/community-media\/[\w./-]{1,300}$/;

export const HERO_LAYOUTS: { id: HeroLayout; name: string; hint: string }[] = [
  { id: "classic", name: "רצועה מלאה", hint: "כותרת גדולה במרכז, התאריך ונץ ושקיעה מתחתיה" },
  { id: "compact", name: "רצועה דקה", hint: "שורה אחת נמוכה: התאריך ונץ ושקיעה. הדף מתחיל כמעט מיד" },
  { id: "split", name: "שני טורים", hint: "הכותרת בצד אחד, התאריך והזמנים בכרטיסים בצד השני" },
  { id: "cards", name: "כרטיסים", hint: "בלי רצועה צבעונית: שלושה כרטיסים קטנים - תאריך, נץ ושקיעה" },
  { id: "none", name: "בלי רצועה", hint: "הדף מתחיל מיד בזמני התפילות" },
];

/**
 * The looks. "כחול מלכותי" is the strip as it always was - in the colours of
 * the site's theme; the others carry colours of their own.
 */
export const HERO_LOOKS: { id: HeroLook; name: string; swatch: string }[] = [
  { id: "royal", name: "כחול מלכותי (צבעי האתר)", swatch: "linear-gradient(145deg, hsl(var(--sidebar-background)), hsl(var(--primary)))" },
  { id: "night", name: "לילה וזהב", swatch: "linear-gradient(160deg, #0b1628, #1b2a4a)" },
  { id: "parchment", name: "קלף בהיר", swatch: "linear-gradient(160deg, #fbf5e6, #efe1bf)" },
  { id: "emerald", name: "ירוק אמרלד", swatch: "linear-gradient(160deg, #0d3b2e, #17604a)" },
  { id: "burgundy", name: "יין ובורדו", swatch: "linear-gradient(160deg, #3d0f1a, #6e1d2f)" },
  { id: "stone", name: "אבן ירושלים", swatch: "linear-gradient(160deg, #f1e8d6, #d8c7a4)" },
  { id: "onyx", name: "אוניקס וזהב", swatch: "linear-gradient(160deg, #0d0d0f, #26231f)" },
  { id: "plain", name: "שקוף - כמו הדף", swatch: "hsl(var(--background))" },
];

const LAYOUTS = HERO_LAYOUTS.map((l) => l.id);
const LOOKS = HERO_LOOKS.map((l) => l.id);

/** The strip as stored, read safely: anything unknown is the default. */
export function normalizeHomeHero(raw: unknown): HomeHero {
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_HOME_HERO;
  return {
    layout: LAYOUTS.includes(v.layout as HeroLayout) ? (v.layout as HeroLayout) : d.layout,
    look: LOOKS.includes(v.look as HeroLook) ? (v.look as HeroLook) : d.look,
    name: v.name === "show" || v.name === "hide" || v.name === "auto" ? v.name : d.name,
    subtitle: typeof v.subtitle === "boolean" ? v.subtitle : d.subtitle,
    date: typeof v.date === "boolean" ? v.date : d.date,
    zmanim: typeof v.zmanim === "boolean" ? v.zmanim : d.zmanim,
    next: typeof v.next === "boolean" ? v.next : d.next,
    image: typeof v.image === "string" && HERO_IMAGE.test(v.image) ? v.image : null,
    shade: v.shade === "light" ? "light" : "dark",
    phoneLayout: LAYOUTS.includes(v.phoneLayout as HeroLayout) ? (v.phoneLayout as HeroLayout) : null,
  };
}

/** Whether the strip shows the synagogue's name: not twice on one screen, unless asked. */
export const heroShowsName = (hero: HomeHero, headerShowsName: boolean) =>
  hero.name === "show" || (hero.name === "auto" && !headerShowsName);

/** A prayer of today, as the strip needs it. */
export interface HeroPrayer { label: string; time: string; minutes: number; cancelled?: boolean }
export interface NextPrayer extends HeroPrayer { inMinutes: number }

/**
 * The next prayer of today from now (minutes after midnight, in Israel): the
 * first that has not begun and is not called off. Null when the day's are done.
 */
export function nextPrayer(rows: HeroPrayer[], nowMinutes: number): NextPrayer | null {
  const next = rows.filter((r) => !r.cancelled && r.minutes >= nowMinutes).sort((a, b) => a.minutes - b.minutes)[0];
  return next ? { ...next, inMinutes: next.minutes - nowMinutes } : null;
}

/** How long until it, in words: "עכשיו", "בעוד 25 דקות", "בעוד שעה ו־10 דקות". */
export function inWords(minutes: number): string {
  if (minutes <= 0) return "עכשיו";
  if (minutes === 1) return "בעוד דקה";
  if (minutes < 60) return `בעוד ${minutes} דקות`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  const hours = h === 1 ? "שעה" : h === 2 ? "שעתיים" : `${h} שעות`;
  return m === 0 ? `בעוד ${hours}` : `בעוד ${hours} ו־${m === 1 ? "דקה" : `${m} דקות`}`;
}

/** Minutes after midnight in Israel, wherever the phone is. */
export function israelMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}
