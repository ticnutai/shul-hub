import { useMemo } from "react";
import { useNow } from "@community/lib/realtime";
import type { TvConfig } from "@/tv/config";
import { buildSlides, useBoardData, useDayZmanim, type BoardSlide } from "@/tv/useBoardData";
import { applyRecordEdits } from "./tvRecords";

export function useTvSlides(config: TvConfig, nowOverride?: Date | null) {
  // The site already keeps this data fresh; no second realtime socket and no
  // writes to the TV's offline copy.
  const raw = useBoardData({ persist: false, live: false });
  // Unsaved content edits from the board editor, shown as if already saved.
  const data = useMemo(() => applyRecordEdits(raw, config._records), [raw, config._records]);
  const clock = useNow(1000);
  const now = nowOverride ?? clock;
  const zmanim = useDayZmanim(now, data.settings);
  const minuteStamp = Math.floor(now.getTime() / 60_000);
  const minuteNow = useMemo(() => new Date(minuteStamp * 60_000), [minuteStamp]);
  const slides = useMemo(() => buildSlides(data, config, minuteNow, zmanim), [data, config, minuteNow, zmanim]);
  return { data, now, zmanim, slides };
}

/** A slide's own occasion screen: its card, or a screen built around the card. */
const isOccasionSlide = (s: BoardSlide) =>
  s.kind === "occasion" || (s.kind === "composed" && s.id.startsWith("occasion:"));

/**
 * The slides a screen can be sent to that look different from each other.
 *
 * A board of parts draws everything in one picture: the prayers, the daf, the
 * announcements and the lessons are all on it at once, so its turns between
 * them look exactly alike - the screens panel offered seven buttons, five of
 * which changed nothing (אושר של יהודי, 11.10.2026). There the board is one
 * button ("הלוח"), and each occasion's screen another. Any other board: every
 * slide, as it is. `index` is the slide's place in the full list.
 */
export function distinctSlides(slides: BoardSlide[], config: Pick<TvConfig, "screenLayout">): { index: number; label: string }[] {
  if (config.screenLayout !== "composition") return slides.map((s, index) => ({ index, label: slideLabel(s) }));
  const out: { index: number; label: string }[] = [];
  const board = slides.findIndex((s) => !isOccasionSlide(s));
  if (board >= 0) out.push({ index: board, label: "הלוח" });
  slides.forEach((s, index) => isOccasionSlide(s) && out.push({ index, label: slideLabel(s) }));
  return out;
}

/** Which of those entries the slide up now is: on a board of parts, any ordinary slide is "הלוח". */
export function distinctIndex(slides: BoardSlide[], entries: { index: number }[], index: number): number {
  if (entries.some((e) => e.index === index)) return index;
  return slides[index] && !isOccasionSlide(slides[index]) ? (entries[0]?.index ?? index) : index;
}

export function slideLabel(s: BoardSlide): string {
  switch (s.kind) {
    case "prayer":
      return s.title ? `תפילות · ${s.title}` : "תפילות";
    case "learning":
      return "לימוד יומי";
    case "announcements":
      return s.pages > 1 ? `מודעות ${s.page}/${s.pages}` : "מודעות";
    case "shiurim":
      return "שיעורים";
    case "slideshow":
      return "מצגת";
    case "occasion":
      return s.page.main.occasion.name;
    case "composed":
      return s.screen.name;
  }
}
