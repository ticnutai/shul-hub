/**
 * What can stand on a board, named once.
 *
 * The board grew four layouts, and each of them invented its own names for
 * the same things. The panel of prayer times is `dash.prayers` in the full
 * board, a heading in the rotating one and `split.next` beside the split. So
 * "show the prayer times" is a different switch in every layout, and adding a
 * fifth layout means inventing the set a fifth time. That is the duplication,
 * and it is also why an arrow on the remote did nothing on the אהבת התורה
 * screen: `slides[].enabled` means "one of the things that take turns" in the
 * rotating layout and nothing at all in the illustrated one, which merges
 * them into a single picture. One field, two meanings, depending on a setting
 * somewhere else.
 *
 * So: a BLOCK is a region of content - the prayer times, the zmanim, the
 * day's screen - named the same whatever draws it. A screen is a list of
 * blocks. The number of screens is the only thing that decides whether the
 * board turns over, which is the question the gabbai actually asks ("one
 * screen or several?") and which no setting answered before.
 *
 * What a block is NOT is a replacement for the 43 editable elements in
 * boardEdit.ts. Those are the details inside a region - the wording of a
 * heading, whether the address shows - and they work. A block GROUPS them
 * (`elements` below), so the two levels stay one system: the composer offers
 * blocks, clicking into one offers the elements already there. Rewriting them
 * as blocks would be the same duplication in a new place.
 *
 * The rule that keeps this from drifting, enforced in blocks.test.ts: every
 * block names elements that exist, and no element belongs to two blocks. A
 * hand-kept list is exactly where a new block gets forgotten and an old one
 * lingers, so nothing here is hand-kept - the composer's switches are built
 * from this array.
 */
import { EDITABLE, SHOWN_ZMANIM } from "./boardEdit";
import { BLOCK_IDS, type BlockId, type SlideKind, type TvConfig } from "./config";

export type { BlockId };

/**
 * The zmanim rows, taken from the same list the board draws them from.
 *
 * Written out by hand this would be eight strings to keep in step with
 * SHOWN_ZMANIM, and the first test run proved the point: eight `zman.*` keys
 * were missing here precisely because they are generated over there and a
 * hand-written list had no way to know. Derive rather than copy.
 */
const ZMAN_ELEMENTS = SHOWN_ZMANIM.map((z) => `zman.${z}`);

/** Where a block sits: the bars above and below, or the body between them. */
export type BlockZone = "top" | "main" | "bottom";

export interface BlockSpec {
  id: BlockId;
  /** As the gabbai would say it, because this is what the switch is labelled. */
  name: string;
  note?: string;
  zone: BlockZone;
  /**
   * Roughly how much room it wants, for the automatic layout. Not pixels and
   * not a fraction: only the order matters, so a board with one big block and
   * two small ones lays out the way a person would expect.
   */
  weight: number;
  /** Keys in boardEdit.EDITABLE that belong to this region. */
  elements: readonly string[];
  /**
   * The rotating slide this block stands for, where there was one. It is what
   * lets an existing config be read as screens without anybody re-entering it.
   */
  slideKind?: SlideKind;
  /** Chrome is always available; the rest need their content to exist. */
  chrome?: boolean;
}

export const BLOCKS: readonly BlockSpec[] = [
  {
    id: "header",
    name: "שם בית הכנסת",
    note: "עם התאריך, הפרשה והדף",
    zone: "top",
    weight: 0,
    chrome: true,
    elements: [
      "header.logo",
      "header.title",
      "header.address",
      "header.weekday",
      "header.date",
      "header.parasha",
      "header.daf",
    ],
  },
  {
    id: "logo",
    name: "לוגואים",
    note: "של בית הכנסת ושל התורמים - נבחרים בעיצוב",
    zone: "top",
    weight: 0,
    chrome: true,
    elements: ["header.sponsor"],
  },
  {
    id: "clock",
    name: "שעון",
    zone: "top",
    weight: 0,
    chrome: true,
    elements: ["dash.clock", "header.clock"],
  },
  {
    id: "prayers",
    name: "תפילות היום",
    note: "המניינים לפי סדרם",
    zone: "main",
    weight: 3,
    slideKind: "prayer",
    elements: ["dash.prayers", "heading.prayer", "panel.minyanim", "hero.kicker", "split.next"],
  },
  {
    id: "zmanim",
    name: "זמני היום",
    note: "מעלות השחר עד צאת הכוכבים",
    zone: "main",
    weight: 3,
    elements: ["dash.zmanim", "panel.zmanim", ...ZMAN_ELEMENTS],
  },
  {
    id: "announcements",
    name: "הודעות",
    zone: "main",
    weight: 2,
    slideKind: "announcements",
    elements: ["dash.announcement", "heading.announcements"],
  },
  {
    id: "shiurim",
    name: "שיעורים",
    zone: "main",
    weight: 2,
    slideKind: "shiurim",
    elements: ["dash.shiurim", "heading.shiurim"],
  },
  {
    id: "learning",
    name: "הדף היומי",
    note: "והעמוד היומי",
    zone: "main",
    weight: 1,
    slideKind: "learning",
    elements: ["dash.amud", "heading.learning", "learning.parasha", "learning.daf", "learning.upcoming"],
  },
  {
    id: "slideshow",
    name: "מצגת תמונות",
    zone: "main",
    weight: 3,
    slideKind: "slideshow",
    elements: [],
  },
  {
    // The occasion's own card, on the occasion's screen (occasions.ts): its
    // name, date, times and pictures, as set in the מועדים tab.
    id: "festival",
    name: "כרטיס המועד",
    note: "השם, התאריך, הזמנים והתמונות - מה שבו נקבע בהגדרות המועד",
    zone: "main",
    weight: 4,
    elements: [],
  },
  {
    // Shabbat was a mode, not a block: from candle lighting it took the whole
    // board. On a board built of screens that mode was switched off - nothing
    // may take the board uninvited - and nothing took its place, so a
    // composed board showed its weekday screens right through Shabbat.
    id: "shabbat",
    name: "מסך השבת",
    note: "מופיע רק בשבת, מהדלקת נרות עד צאת השבת",
    zone: "main",
    weight: 4,
    elements: ["shabbat.title", "shabbat.blessing", "shabbat.art", "shabbat.times"],
  },
  {
    id: "ticker",
    name: "כתובית רצה",
    note: "שורת טקסט בתחתית",
    zone: "bottom",
    weight: 0,
    elements: ["ticker"],
  },
  {
    id: "footer",
    name: "שורת הפרשה והנרות",
    zone: "bottom",
    weight: 0,
    chrome: true,
    elements: ["dash.strip", "dash.seasonal", "footer.dots", "footer.status"],
  },
];

/**
 * The one element no block owns, and deliberately: "board.background" is the
 * whole board - its ground, frames and style - not a region standing on it.
 * The test below allows exactly this one, so a genuinely forgotten element
 * still fails rather than joining a growing list of exceptions.
 */
export const UNOWNED_ELEMENTS: readonly string[] = ["board.background"];

export const BLOCK_BY_ID: Readonly<Record<BlockId, BlockSpec>> = Object.fromEntries(
  BLOCKS.map((b) => [b.id, b]),
) as Record<BlockId, BlockSpec>;

/**
 * Any block's name and place, a box added by hand included: it is content,
 * stands in the body of the screen, and is named by its title.
 */
export function blockSpec(id: BlockId, customBoxes: ReadonlyArray<{ id: string; title: string }> = []): BlockSpec {
  const builtin = (BLOCK_BY_ID as Partial<Record<string, BlockSpec>>)[id];
  if (builtin) return builtin;
  return { id, name: customBoxes.find((b) => b.id === id)?.title || "תיבה שלי", zone: "main", weight: 2, elements: [] };
}

/** The blocks a slide kind maps to, for reading an existing config. */
export const BLOCK_FOR_SLIDE: Readonly<Partial<Record<SlideKind, BlockId>>> = Object.fromEntries(
  BLOCKS.filter((b) => b.slideKind).map((b) => [b.slideKind as SlideKind, b.id]),
);

/**
 * Element keys this block owns that the board has not been told to hide.
 *
 * `config.hidden` holds two kinds of key: board wording ("header.address")
 * and content records ("minyan:<id>", "ann:<id>"). Only the first kind is a
 * layout decision, and a block must never claim the second - hiding one
 * minyan is not the same as turning off the prayer times.
 */
export function visibleElements(block: BlockSpec, config: Pick<TvConfig, "hidden">): string[] {
  const hidden = new Set(config.hidden ?? []);
  return block.elements.filter((key) => !hidden.has(key));
}
