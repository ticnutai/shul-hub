import type { SiddurData, TorahBook, TorahChapter } from "./types";

export const TORAH_BOOKS = [
  { id: "bereishit", name: "בראשית" },
  { id: "shemot", name: "שמות" },
  { id: "vayikra", name: "ויקרא" },
  { id: "bamidbar", name: "במדבר" },
  { id: "devarim", name: "דברים" },
] as const;

export const SIDDUR_NUSACHIM = [
  { id: "ashkenaz", name: "אשכנז" },
  { id: "sefard", name: "ספרד" },
  { id: "edot_hamizrach", name: "עדות המזרח" },
  { id: "chabad", name: "חב״ד" },
] as const;

const cache = new Map<string, unknown>();

async function fetchJson<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T;
  const response = await fetch(path, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Content request failed (${response.status})`);
  const value = (await response.json()) as T;
  cache.set(path, value);
  return value;
}

export function loadTorahBook(bookId: string) {
  return fetchJson<TorahBook>(`/torah-data/${bookId}.json`);
}

export function loadSiddur(nusach: string) {
  return fetchJson<SiddurData>(`/torah-data/siddur/siddur_${nusach}.json`);
}

export function chaptersOf(book: TorahBook): TorahChapter[] {
  const chapters = new Map<number, TorahChapter>();
  for (const parsha of book.parshiot) {
    for (const chapter of parsha.perakim) chapters.set(chapter.perek_num, chapter);
  }
  return [...chapters.values()].sort((a, b) => a.perek_num - b.perek_num);
}

export function hebrewNumber(value: number): string {
  const units = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  if (value === 15) return "ט״ו";
  if (value === 16) return "ט״ז";
  if (value < 10) return `${units[value]}׳`;
  const raw = `${tens[Math.floor(value / 10)] ?? ""}${units[value % 10] ?? ""}`;
  return raw.length === 1 ? `${raw}׳` : `${raw.slice(0, -1)}״${raw.slice(-1)}`;
}

export function sanitizeTorahHtml(html: string): string {
  return html
    .replace(/<(?!\/?(?:b|br|span)(?:\s|>|\/))[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}
