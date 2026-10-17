/**
 * "מחיקה" in the design tab's "התחלה מחדש": the board's settings in groups,
 * each deleted on its own or all together - back to a new synagogue's.
 *
 * Every setting of the board is in exactly one group (wipeGroups.test.ts), so
 * all of them together are the whole board as a new one, and none is deleted
 * twice or by surprise. The minyanim, notices and lessons are not the board's
 * settings and are never touched here.
 */
import { DEFAULT_TV_CONFIG, type TvConfig } from "./config";
import { DESIGN_KEYS } from "./designs";

export type WipeGroup = "look" | "screens" | "texts" | "logos" | "occasions" | "pictures" | "galleries" | "mine" | "alerts";

type Key = keyof TvConfig;

/** The groups other than the look, by what they hold. */
const OTHERS: Record<Exclude<WipeGroup, "look">, Key[]> = {
  screens: ["slides", "screens", "partPages", "layouts", "prayerRowsPerScreen", "prayerDays", "overflow"],
  texts: ["texts", "header"],
  logos: ["logos"],
  occasions: [
    "occasions", "pinnedOccasions", "shabbat", "dayLooks", "eventImages", "eventStyles", "eventHold", "eventSplash",
    "eventAuto", "eventNationalAuto", "eventDetail", "eventEverySeconds", "eventCombine",
  ],
  pictures: ["slideshow"],
  galleries: ["backgrounds", "gradients", "frameUploads", "customThemes", "customIllustrations", "myBoardFrames", "hiddenReady"],
  mine: ["designs", "customBoxes", "elementLibrary", "library"],
  alerts: ["alerts", "ticker", "countdown"],
};
const taken = new Set(Object.values(OTHERS).flat());

/** The look: everything a kit carries and the parts themselves, and whatever else no other group holds. */
const LOOK: Key[] = [
  ...new Set<Key>([...DESIGN_KEYS, "elements", "containers", "elementDefaults", "perDevice", "hidden", "flipped"]),
  ...(Object.keys(DEFAULT_TV_CONFIG) as Key[]),
].filter((k, i, all) => !taken.has(k) && all.indexOf(k) === i);

export const WIPE_GROUP_KEYS: Record<WipeGroup, Key[]> = { look: LOOK, ...OTHERS };

/** In the list's order, each with what it holds in a few words. */
export const WIPE_GROUPS: { id: WipeGroup; name: string; note: string }[] = [
  { id: "look", name: "המראה והחלקים של הלוח", note: "רקע, מסגרות, צבעים, החלקים וסידורם" },
  { id: "screens", name: "המסכים והעמודים", note: "העמודים של הלוח, סדר המסכים וזמני ההחלפה" },
  { id: "texts", name: "הנוסחים", note: "שם בית הכנסת והנוסחים ששיניתם על הלוח" },
  { id: "logos", name: "הלוגואים", note: "הלוגואים שהוספתם ללוח" },
  { id: "occasions", name: "המועדים", note: "הגדרות השבת, החגים והמועדים, והערכות שלהם" },
  { id: "pictures", name: "תמונות ומצגת", note: "התמונות שמוצגות במצגת" },
  { id: "galleries", name: "הגלריות", note: "רקעים, מעברי צבע ומסגרות שהעליתם" },
  { id: "mine", name: "הערכות והתיבות שלי", note: "ערכות ששמרתם, תיבות שהוספתם, החלקים שלי וסדר הספרייה" },
  { id: "alerts", name: "תזכורות ופס רץ", note: "התזכורות לפני הזמנים, הספירה לתפילה הבאה והטקסט הרץ" },
];

/** The board with the groups chosen back to a new synagogue's; the rest as it was. */
export function wipeGroups(config: TvConfig, groups: readonly WipeGroup[]): TvConfig {
  const out = { ...config } as Record<string, unknown>;
  for (const g of groups)
    for (const k of WIPE_GROUP_KEYS[g]) {
      if (k in DEFAULT_TV_CONFIG) out[k] = structuredClone(DEFAULT_TV_CONFIG[k]);
      else delete out[k];
    }
  return out as unknown as TvConfig;
}
