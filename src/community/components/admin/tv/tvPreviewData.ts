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
    case "shabbat":
      return "שבת שלום";
  }
}
