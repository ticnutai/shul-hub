/**
 * Where a bookmark leads, and what to call it - one reading of a bookmark's
 * id for every place that opens one (the bookmarks dialog, "המערכת שלי").
 * They each read it their own way, and the profile's way sent a Chumash
 * bookmark to an address that does not exist.
 *
 * The ids, as written by the pages that make them:
 *   tehillim-<chapter>-<verse>   Tehillim (Siddur.tsx); verse 0 = the whole chapter
 *   <sefer>-<perek>-<pasuk>      Chumash (PasukDisplay.tsx)
 *   <sefer>:<perek>:<pasuk>      a commentary page
 */
export const TEHILLIM_PREFIX = "tehillim";

export function tehillimBookmarkId(chapter: number, verse: number | null): string {
  return `${TEHILLIM_PREFIX}-${chapter}-${verse ?? 0}`;
}

export function parseTehillimBookmark(id: string): { chapter: number; verse: number | null } | null {
  const m = /^tehillim-(\d{1,3})-(\d{1,3})$/.exec(id);
  if (!m) return null;
  const chapter = Number(m[1]);
  const verse = Number(m[2]);
  if (chapter < 1 || chapter > 150) return null;
  return { chapter, verse: verse > 0 ? verse : null };
}

export function bookmarkHref(id: string): string | null {
  const tehillim = parseTehillimBookmark(id);
  if (tehillim) {
    return `/siddur?tab=tehillim&perek=${tehillim.chapter}${tehillim.verse ? `&pasuk=${tehillim.verse}` : ""}`;
  }
  if (id.includes(":")) {
    const [sefer, perek, pasuk] = id.split(":");
    return sefer && perek && pasuk ? `/commentaries/${sefer}/${perek}/${pasuk}` : null;
  }
  const parts = id.split("-");
  if (parts.length === 3) {
    const [sefer, perek, pasuk] = parts;
    return `/chumash?sefer=${sefer}&perek=${perek}&pasuk=${pasuk}`;
  }
  return null;
}

/** What to show for the bookmark in a list: "תהילים פרק 23, פסוק 4" rather than its id. */
export function bookmarkLabel(id: string): string {
  const tehillim = parseTehillimBookmark(id);
  if (tehillim) return `תהילים פרק ${tehillim.chapter}${tehillim.verse ? `, פסוק ${tehillim.verse}` : ""}`;
  return id;
}
