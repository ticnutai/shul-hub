import type { SiddurSection } from "@/hooks/useSiddurData";

/**
 * Siddur search: find a prayer by its name or by words in it.
 * Matching ignores niqqud and te'amim, since nobody types them.
 */

/** Niqqud and te'amim off, maqaf to a space, tags out: what somebody types. */
export const normalizeHebrew = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/־/g, " ")
    .replace(/[֑-ׇ]/g, "")
    .replace(/[״"׳']/g, "")
    .replace(/\s+/g, " ")
    .trim();

export interface IndexedSection {
  catId: string;
  catName: string;
  index: number;
  title: string;
  titleNorm: string;
  textNorm: string;
}

export interface SiddurSearchHit {
  catId: string;
  catName: string;
  index: number;
  title: string;
  /** Words around the match, when the match is in the text and not the title */
  snippet?: string;
}

const MAX_TEXT_HITS = 60;

export function searchSections(sections: IndexedSection[], query: string): SiddurSearchHit[] {
  const q = normalizeHebrew(query);
  if (q.length < 2) return [];
  const titleHits: SiddurSearchHit[] = [];
  const textHits: SiddurSearchHit[] = [];
  for (const s of sections) {
    if (s.titleNorm.includes(q)) {
      titleHits.push({ catId: s.catId, catName: s.catName, index: s.index, title: s.title });
      continue;
    }
    if (textHits.length >= MAX_TEXT_HITS) continue;
    const at = s.textNorm.indexOf(q);
    if (at < 0) continue;
    const from = Math.max(0, s.textNorm.lastIndexOf(" ", Math.max(0, at - 30)));
    const to = s.textNorm.indexOf(" ", Math.min(s.textNorm.length, at + q.length + 30));
    textHits.push({
      catId: s.catId,
      catName: s.catName,
      index: s.index,
      title: s.title,
      snippet: `${from > 0 ? "… " : ""}${s.textNorm.slice(from, to < 0 ? undefined : to).trim()}${to > 0 ? " …" : ""}`,
    });
  }
  // A title that starts with the query is what was meant more often than one that merely contains it.
  titleHits.sort((a, b) => Number(!normalizeHebrew(a.title).startsWith(q)) - Number(!normalizeHebrew(b.title).startsWith(q)));
  return [...titleHits, ...textHits];
}

export function indexSections(catId: string, catName: string, sections: SiddurSection[]): IndexedSection[] {
  return sections.map((sec, index) => ({
    catId,
    catName,
    index,
    title: sec.title,
    titleNorm: normalizeHebrew(sec.title),
    textNorm: normalizeHebrew(sec.lines.join(" ")),
  }));
}
