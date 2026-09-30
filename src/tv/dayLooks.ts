import type { Settings } from "@community/lib/data";
import { zmanimFor } from "@community/lib/minyan-time";
import { checkClock } from "./clock";
import type { TvConfig } from "./config";
import { applyDesign, findDesign } from "./designs";
import { occasionDesign, occasionPagesNow } from "./occasions";

/**
 * The board as it should look right now: the design of the occasion that is
 * on (occasions.ts), over the ordinary look.
 *
 * This was "a look per day" - a layout, painted board and theme per kind of
 * day - which is one of the five things occasions replaced: each occasion
 * now names the design it wears, and the most important occasion on that
 * names one wins. A board that set looks per day reads them as its
 * occasions' designs until it saves occasions of its own.
 *
 * Never on a clock that cannot be trusted: a board that believes it is
 * Shabbat on a Tuesday would otherwise dress for it.
 */
export function applyDayLook(config: TvConfig, now: Date, settings: Settings | null | undefined): TvConfig {
  if (!checkClock(now).trusted) return config;
  const { active } = occasionPagesNow(config, settings, now, (d) => zmanimFor(d, settings));
  const design = findDesign(config, occasionDesign(active));
  return design ? applyDesign(config, design) : config;
}
