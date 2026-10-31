import { backdropUrl } from "./backdrops";
import type { TvConfig } from "./config";

/**
 * The pictures a page of the board is drawn on, as one key: two pages with the
 * same key turn in place; a page with others is drawn behind the one up now
 * and comes forward only once they are painted (TvApp).
 *
 * A page in a design of its own (Shabbat's kit, say) was put up the moment its
 * turn came, and its room picture was decoded only then: for a moment - on the
 * TV box a good part of a second - the bare board showed, a pale stone page
 * with grey boxes on the way in, a navy page of plain text on the way back,
 * and then the picture over it (אפי קפיטל, 31.10.2026). Fetching and decoding
 * the picture first was not enough: the board's own new <img> still painted
 * one frame empty.
 */
export function pageImages(config: TvConfig): string {
  const urls: string[] = [];
  if (config.backgroundImage) urls.push(backdropUrl(config.backgroundImage) ?? config.backgroundImage);
  for (const e of config.elements ?? []) if (e.kind === "image" && e.image && !e.hidden) urls.push(e.image);
  return `${config.screenLayout}|${urls.join("|")}`;
}

/** How long the page that was up takes to fade away over the next one. */
export const PAGE_FADE_MS = 450;
