/**
 * How a day's prayers are drawn on the website. Chosen in one place, the
 * admin's "איך יראו זמני התפילות" (PrayerDisplaySettings) - for every day
 * alike, or per day tab (minyan_categories.display_mode). The board has its
 * own layouts (tv/config.ts SLIDE_LAYOUTS).
 *
 * The values are pinned by CHECK constraints on minyan_categories.display_mode
 * and settings.minyan_layout: a new one needs a migration with it.
 */
export type PrayerLayoutMode = "tabs" | "list" | "table" | "timeline" | "cards";

export const PRAYER_LAYOUTS: Array<{ value: PrayerLayoutMode; label: string; description: string }> = [
  { value: "tabs", label: "תפילה אחת בכל פעם", description: "לשוניות שחרית / מנחה / ערבית" },
  { value: "list", label: "כל התפילות ברשימה", description: "שחרית, ואחריה מנחה, ואחריה ערבית" },
  { value: "table", label: "טבלה אחת ליום", description: "כל מנייני היום בטבלה אחת" },
  { value: "timeline", label: "לפי סדר השעות", description: "המניין הבא מודגש" },
  { value: "cards", label: "כרטיסיות", description: "ריבועים גדולים עם שעה בולטת" },
];

const VALID_LAYOUTS = new Set<string>(PRAYER_LAYOUTS.map((layout) => layout.value));

/**
 * Falls back to "tabs" for anything unrecognised. A category saved by a newer
 * build, or a value the database has but this bundle does not know about, must
 * still render a schedule rather than an empty panel.
 */
export function normalizePrayerLayout(value?: string | null): PrayerLayoutMode {
  return value && VALID_LAYOUTS.has(value) ? (value as PrayerLayoutMode) : "tabs";
}
