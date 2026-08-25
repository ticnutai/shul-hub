import { useEffect, useState, useRef } from "react";
import { FlatPasuk } from "@/types/torah";
import { supabase } from "@/integrations/supabase/client";

/** Map key: "seferId-perek-pasuk" → commentary text */
export type CommentaryMap = Map<string, string>;

export type CommentaryMode = "off" | "inline" | "click";

export interface CommentatorConfig {
  id: string;
  hebrewName: string;
  /** Display order (lower = first after pasuk) */
  order: number;
  mode: CommentaryMode;
}

/** All available commentators with their local file mappings */
export const ALL_COMMENTATORS: Omit<CommentatorConfig, "mode" | "order">[] = [
  { id: "Rashi",       hebrewName: "רש״י" },
  { id: "Ramban",      hebrewName: "רמב״ן" },
  { id: "Ibn_Ezra",   hebrewName: "אבן עזרא" },
  { id: "Sforno",     hebrewName: "ספורנו" },
  { id: "Or_HaChaim", hebrewName: "אור החיים" },
  { id: "Kli_Yakar",  hebrewName: "כלי יקר" },
  { id: "Chizkuni",   hebrewName: "חזקוני" },
  { id: "Malbim",     hebrewName: "מלב״ים" },
];

export const TEHILLIM_COMMENTATORS: Omit<CommentatorConfig, "mode" | "order">[] = [
  { id: "Rashi", hebrewName: "רש״י" },
  { id: "Ibn_Ezra", hebrewName: "אבן עזרא" },
  { id: "Radak", hebrewName: "רד״ק" },
  { id: "Metzudat_David", hebrewName: "מצודת דוד" },
  { id: "Malbim", hebrewName: "מלבי״ם" },
];

type BundledCommentary = { default: { text: unknown[] } };
const LOCAL_TEHILLIM_LOADERS: Record<string, () => Promise<BundledCommentary>> = {
  Rashi: () => import("@/data/sefaria/Rashi_on_Psalms.json"),
  Ibn_Ezra: () => import("@/data/sefaria/Ibn_Ezra_on_Psalms.json"),
  Radak: () => import("@/data/sefaria/Radak_on_Psalms.json"),
  Metzudat_David: () => import("@/data/sefaria/Metzudat_David_on_Psalms.json"),
  Malbim: () => import("@/data/sefaria/Malbim_on_Psalms.json"),
};

/** Local JSON files available per commentator per sefer (1-based).
 * These are bundled in the app and work offline.
 * Supabase is always tried first (online), local is the fallback. */
const LOCAL_FILES: Record<string, Record<number, string>> = {
  Rashi: {
    1: "Rashi_on_Genesis",
    2: "Rashi_on_Exodus",
    3: "Rashi_on_Leviticus",
    4: "Rashi_on_Numbers",
    5: "Rashi_on_Deuteronomy",
  },
  Ramban: {
    1: "Ramban_on_Genesis",
    2: "Ramban_on_Exodus",
    3: "Ramban_on_Leviticus",
    4: "Ramban_on_Numbers",
    5: "Ramban_on_Deuteronomy",
  },
  Ibn_Ezra: {
    1: "Ibn_Ezra_on_Genesis",
    2: "Ibn_Ezra_on_Exodus",
    3: "Ibn_Ezra_on_Leviticus",
    4: "Ibn_Ezra_on_Numbers",
    5: "Ibn_Ezra_on_Deuteronomy",
  },
  Sforno: {
    1: "Sforno_on_Genesis",
    2: "Sforno_on_Exodus",
    3: "Sforno_on_Leviticus",
    4: "Sforno_on_Numbers",
    5: "Sforno_on_Deuteronomy",
  },
  Or_HaChaim: {
    1: "Or_HaChaim_on_Genesis",
    2: "Or_HaChaim_on_Exodus",
    3: "Or_HaChaim_on_Leviticus",
    4: "Or_HaChaim_on_Numbers",
    5: "Or_HaChaim_on_Deuteronomy",
  },
  Kli_Yakar: {
    1: "Kli_Yakar_on_Genesis",
    2: "Kli_Yakar_on_Exodus",
    3: "Kli_Yakar_on_Leviticus",
    4: "Kli_Yakar_on_Numbers",
    5: "Kli_Yakar_on_Deuteronomy",
  },
  Chizkuni: {
    1: "Chizkuni_on_Genesis",
    2: "Chizkuni_on_Exodus",
    3: "Chizkuni_on_Leviticus",
    4: "Chizkuni_on_Numbers",
    5: "Chizkuni_on_Deuteronomy",
  },
  Malbim: {
    1: "Malbim_on_Genesis",
    2: "Malbim_on_Exodus",
    // Malbim on Leviticus is not available on Sefaria
    4: "Malbim_on_Numbers",
    5: "Malbim_on_Deuteronomy",
  },
};

const commentaryKey = (seferId: number, perek: number, pasuk: number) =>
  `${seferId}-${perek}-${pasuk}`;

/** Preserve Sefaria's semantic dibbur-hamatchil bold markers while removing
 * every other HTML tag. The UI renders these tokens as React <strong> nodes. */
function cleanCommentaryText(raw: string): string {
  return raw
    .replace(/<b\b[^>]*>/gi, "[[B]]")
    .replace(/<\/b>/gi, "[[/B]]")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Per-commentator in-memory cache: commentatorId → (chapterKey → CommentaryMap)
const globalCommentaryCache = new Map<string, Map<string, CommentaryMap>>();
const MAX_CHAPTER_ENTRIES = 50;

function getOrCreateCommentaryCache(commentatorId: string): Map<string, CommentaryMap> {
  if (!globalCommentaryCache.has(commentatorId)) {
    globalCommentaryCache.set(commentatorId, new Map());
  }
  return globalCommentaryCache.get(commentatorId)!;
}

function setCachedChapter(commentatorId: string, chapterKey: string, value: CommentaryMap) {
  const cache = getOrCreateCommentaryCache(commentatorId);
  if (cache.size >= MAX_CHAPTER_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(chapterKey, value);
}

async function loadChapterFromLocal(
  commentatorId: string,
  seferId: number,
  perek: number
): Promise<CommentaryMap | null> {
  if (seferId === 27) {
    const loader = LOCAL_TEHILLIM_LOADERS[commentatorId];
    if (!loader) return null;
    try {
      const mod = await loader();
      const chapter = mod.default.text[perek - 1];
      if (!Array.isArray(chapter)) return null;
      const result = new Map<string, string>();
      chapter.forEach((verseComments, index) => {
        const text = cleanCommentaryText(flattenCommentary(verseComments).join(" "));
        if (text) result.set(commentaryKey(27, perek, index + 1), text);
      });
      return result;
    } catch {
      return null;
    }
  }

  const fileName = LOCAL_FILES[commentatorId]?.[seferId];
  if (!fileName) return null;
  try {
    const mod = await import(`@/data/sefaria/${fileName}.json`);
    const textArr: (string | string[])[][] = (mod.default || mod).text;
    const perekArr = textArr[perek - 1];
    if (!Array.isArray(perekArr)) return null;

    const result = new Map<string, string>();
    for (let i = 0; i < perekArr.length; i++) {
      const raw = perekArr[i];
      const text = cleanCommentaryText(Array.isArray(raw) ? raw.join(" ") : raw ?? "");
      if (!text) continue;
      result.set(commentaryKey(seferId, perek, i + 1), text);
    }
    return result;
  } catch {
    return null;
  }
}

const flattenCommentary = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.flatMap(flattenCommentary);
};

async function fetchChapter(
  commentatorId: string,
  seferId: number,
  perek: number
): Promise<CommentaryMap> {
  const cache = getOrCreateCommentaryCache(commentatorId);
  const ck = `${seferId}-${perek}`;

  if (cache.has(ck)) return cache.get(ck)!;

  // Tehillim ships with all five complete commentary datasets. Prefer them
  // before any cloud query so normal reading performs no commentary request.
  if (seferId === 27) {
    const localTehillim = await loadChapterFromLocal(commentatorId, seferId, perek);
    const bundledResult = localTehillim ?? new Map<string, string>();
    setCachedChapter(commentatorId, ck, bundledResult);
    return bundledResult;
  }

  // 1. Try Supabase (cloud, fast, all books)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("commentaries")
      .select("pasuk, text")
      .eq("commentator", commentatorId)
      .eq("sefer_id", seferId)
      .eq("perek", perek);

    if (!error && data && data.length > 0) {
      const result = new Map<string, string>();
      for (const row of data) {
        result.set(commentaryKey(seferId, perek, row.pasuk), cleanCommentaryText(row.text ?? ""));
      }
      setCachedChapter(commentatorId, ck, result);
      return result;
    }
  } catch {
    // fall through to local JSON
  }

  // 2. Fall back to local bundled JSON (always works offline)
  const local = await loadChapterFromLocal(commentatorId, seferId, perek);
  if (local !== null) {
    setCachedChapter(commentatorId, ck, local);
    return local;
  }

  // Mark as empty so we don’t re-fetch this chapter
  setCachedChapter(commentatorId, ck, new Map());
  return new Map();
}

/**
 * Loads commentary text for all enabled commentators in the given pesukim.
 * Returns a map: commentatorId → (pasukKey → text)
 */
export function useCommentaries(
  pesukim: FlatPasuk[],
  configs: CommentatorConfig[]
): { maps: Record<string, CommentaryMap>; loading: boolean } {
  const activeConfigs = configs.filter((c) => c.mode !== "off");
  const [maps, setMaps] = useState<Record<string, CommentaryMap>>({});
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Stable key so we only re-fetch when sefer/perek or active commentators change
  const depsKey = [
    pesukim.map((p) => `${p.sefer}-${p.perek}`).join(","),
    activeConfigs.map((c) => c.id).join(","),
  ].join("|");

  useEffect(() => {
    if (pesukim.length === 0 || activeConfigs.length === 0) {
      setMaps({});
      return;
    }

    // Unique (sefer, perek) pairs visible right now
    const pairs = new Map<string, { seferId: number; perek: number }>();
    for (const p of pesukim) {
      const k = `${p.sefer}-${p.perek}`;
      if (!pairs.has(k)) pairs.set(k, { seferId: p.sefer, perek: p.perek });
    }

    setLoading(true);

    const fetchAll = async () => {
      const result: Record<string, CommentaryMap> = {};

      for (const config of activeConfigs) {
        const merged = new Map<string, string>();
        for (const { seferId, perek } of pairs.values()) {
          const chapterMap = await fetchChapter(config.id, seferId, perek);
          chapterMap.forEach((v, k) => merged.set(k, v));
        }
        result[config.id] = merged;
      }

      if (mountedRef.current) {
        setMaps(result);
        setLoading(false);
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  return { maps, loading };
}
