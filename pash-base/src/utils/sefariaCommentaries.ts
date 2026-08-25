/* eslint-disable @typescript-eslint/no-explicit-any */
import { SEFARIA_BOOK_NAMES, MEFARESH_MAPPING, AVAILABLE_COMMENTARIES, SefariaCommentary } from "@/types/sefaria";
import { supabase } from "@/integrations/supabase/client";
import { torahDB } from "@/utils/torahDB";

// ===== In-memory caches =====
const commentaryCache = new Map<string, any>();
const verseCache = new Map<string, string>();

// ===== Concurrency control =====
const MAX_CONCURRENT = 4; // max simultaneous API calls

const sanitizeCommentaryText = (text: string): string => {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/;(thinsp|nbsp|amp|quot|lt|gt|apos|#\d+|#x[\da-f]+)&/gi, " ")
    .replace(/&thinsp;|&#8201;|&#x2009;/gi, " ")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&rlm;|&lrm;|&#8206;|&#8207;|&#x200e;|&#x200f;/gi, "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s{2,}/g, " ")
    .normalize("NFC")
    .trim();
};

/**
 * Get the Sefaria book name from internal book ID
 */
export const getSefariaSeferName = (seferId: number): string => {
  const seferMap: Record<number, string> = {
    1: "Genesis",
    2: "Exodus",
    3: "Leviticus",
    4: "Numbers",
    5: "Deuteronomy",
    101: "Esther",
  };
  return seferMap[seferId] || "Genesis";
};

/**
 * Get English sefer name for internal use
 */
export const getEnglishSeferName = (seferId: number): string => {
  const seferMap: Record<number, string> = {
    1: "bereishit",
    2: "shemot",
    3: "vayikra",
    4: "bamidbar",
    5: "devarim",
    101: "esther",
  };
  return seferMap[seferId] || "bereishit";
};

/**
 * Load a full commentary file from local Sefaria data.
 * Uses 3-tier cache: memory → IndexedDB → dynamic import.
 */
export const loadSefariaCommentary = async (
  sefer: string,
  mefareshEn: string
): Promise<any> => {
  const cacheKey = `${sefer}-${mefareshEn}`;
  
  if (commentaryCache.has(cacheKey)) {
    return commentaryCache.get(cacheKey);
  }

  try {
    const cached = await torahDB.getCommentary(cacheKey);
    if (cached) {
      commentaryCache.set(cacheKey, cached);
      return cached;
    }
  } catch (e) {
    // IndexedDB read failed, continue to bundle
  }

  try {
    const data = await import(`@/data/sefaria/${mefareshEn}_on_${sefer}.json`);
    const result = data.default || data;
    commentaryCache.set(cacheKey, result);
    torahDB.saveCommentary(cacheKey, result).catch(() => {});
    return result;
  } catch {
    return null;
  }
};

/**
 * Fetch a single commentary from Sefaria API via edge function.
 * Results are cached in memory and IndexedDB.
 */
export const fetchCommentaryFromAPI = async (
  book: string,
  commentaryName: string,
  chapter: number,
  verse: number
): Promise<string | null> => {
  const verseCacheKey = `${book}-${commentaryName}-${chapter}-${verse}`;

  if (verseCache.has(verseCacheKey)) {
    return verseCache.get(verseCacheKey)!;
  }

  try {
    const cached = await torahDB.getCommentary(verseCacheKey);
    if (cached && typeof cached === 'string') {
      verseCache.set(verseCacheKey, cached);
      return cached;
    }
  } catch {
    // IndexedDB read failed, continue to API
  }

  try {
    const { data, error } = await supabase.functions.invoke('fetch-sefaria', {
      body: { commentaryName, book, chapter, verse }
    });

    if (error) {
      console.warn(`[Sefaria] API error for ${commentaryName}:`, error);
      return null;
    }

    const text = data?.text || null;

    if (text) {
      verseCache.set(verseCacheKey, text);
      torahDB.saveCommentary(verseCacheKey, text).catch(() => {});
    }

    return text;
  } catch (error) {
    console.warn(`[Sefaria] Failed to fetch ${commentaryName}:`, error);
    return null;
  }
};

/**
 * Load a single commentary for a verse (local or API).
 */
const loadSingleCommentary = async (
  sefer: string,
  perek: number,
  pasuk: number,
  commentary: typeof AVAILABLE_COMMENTARIES[0],
  index: number
): Promise<SefariaCommentary | null> => {
  try {
    // Try loading from full commentary file
    const localData = await loadSefariaCommentary(sefer, commentary.english);
    
    if (localData) {
      const perekData = localData.text?.[perek - 1];
      const pasukText = perekData?.[pasuk - 1];

      if (pasukText) {
        const normalized = sanitizeCommentaryText(Array.isArray(pasukText) ? pasukText.join(" ") : pasukText);
        if (!normalized) return null;
        return {
          id: index + 1000,
          mefaresh: commentary.hebrew,
          mefareshEn: commentary.english,
          text: normalized
        };
      }
    }

    // Fallback: fetch from API
    const apiText = await fetchCommentaryFromAPI(sefer, commentary.english, perek, pasuk);
    
    if (apiText) {
      const normalizedApiText = sanitizeCommentaryText(apiText);
      if (!normalizedApiText) return null;
      return {
        id: index + 1000,
        mefaresh: commentary.hebrew,
        mefareshEn: commentary.english,
        text: normalizedApiText
      };
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Run tasks with limited concurrency.
 */
const runWithConcurrency = async <T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number,
  onResult?: (result: T, index: number) => void
): Promise<T[]> => {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  const runNext = async (): Promise<void> => {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex++;
      const result = await tasks[currentIndex]();
      results[currentIndex] = result;
      onResult?.(result, currentIndex);
    }
  };

  const workers = Array.from(
    { length: Math.min(maxConcurrent, tasks.length) },
    () => runNext()
  );

  await Promise.all(workers);
  return results;
};

/**
 * Get available commentaries for a specific verse — PROGRESSIVE version.
 * Calls onUpdate each time a new commentary is loaded so UI updates incrementally.
 */
export const getAvailableCommentariesProgressive = async (
  seferId: number,
  perek: number,
  pasuk: number,
  onUpdate: (commentaries: SefariaCommentary[]) => void,
  signal?: AbortSignal
): Promise<SefariaCommentary[]> => {
  const sefer = getSefariaSeferName(seferId);
  const loaded: SefariaCommentary[] = [];

  const tasks = AVAILABLE_COMMENTARIES.map((commentary, index) => {
    return async (): Promise<SefariaCommentary | null> => {
      if (signal?.aborted) return null;
      return loadSingleCommentary(sefer, perek, pasuk, commentary, index);
    };
  });

  await runWithConcurrency(tasks, MAX_CONCURRENT, (result) => {
    if (result && (result as any)?.text?.length > 0) {
      loaded.push(result as SefariaCommentary);
      if (!signal?.aborted) {
        onUpdate([...loaded]);
      }
    }
  });

  return loaded;
};

/**
 * Get available commentaries (non-progressive, legacy).
 */
export const getAvailableCommentaries = async (
  seferId: number,
  perek: number,
  pasuk: number
): Promise<SefariaCommentary[]> => {
  const sefer = getSefariaSeferName(seferId);
  
  const tasks = AVAILABLE_COMMENTARIES.map((commentary, index) => {
    return () => loadSingleCommentary(sefer, perek, pasuk, commentary, index);
  });

  const results = await runWithConcurrency(tasks, MAX_CONCURRENT);
  return results.filter((c): c is SefariaCommentary => c !== null && c.text?.length > 0);
};

/**
 * Prefetch neighboring verses in the background.
 * Silently caches results for instant access when user navigates.
 */
export const prefetchNeighboringVerses = (
  seferId: number,
  perek: number,
  pasuk: number
) => {
  // Use requestIdleCallback (or setTimeout fallback) to avoid blocking
  const schedule = typeof requestIdleCallback === 'function' 
    ? requestIdleCallback 
    : (cb: () => void) => setTimeout(cb, 2000);

  schedule(() => {
    // Prefetch next verse
    getAvailableCommentaries(seferId, perek, pasuk + 1).catch(() => {});
    
    // Prefetch previous verse (if > 1)
    if (pasuk > 1) {
      setTimeout(() => {
        getAvailableCommentaries(seferId, perek, pasuk - 1).catch(() => {});
      }, 3000);
    }
  });
};

// ===== Existing utility functions =====

export const downloadAllCommentaries = async (
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<void> => {
  const sefarim = [
    { id: 1, name: "Genesis", hebrew: "בראשית" },
    { id: 2, name: "Exodus", hebrew: "שמות" },
    { id: 3, name: "Leviticus", hebrew: "ויקרא" },
    { id: 4, name: "Numbers", hebrew: "במדבר" },
    { id: 5, name: "Deuteronomy", hebrew: "דברים" },
  ];

  const total = sefarim.length * AVAILABLE_COMMENTARIES.length;
  let completed = 0;

  for (const sefer of sefarim) {
    for (const commentary of AVAILABLE_COMMENTARIES) {
      const label = `${commentary.hebrew} על ${sefer.hebrew}`;
      onProgress?.(completed, total, label);
      
      try {
        const data = await loadSefariaCommentary(sefer.name, commentary.english);
        if (!data) {
          await fetchCommentaryFromAPI(sefer.name, commentary.english, 1, 1);
        }
      } catch {
        // Skip failures
      }
      
      completed++;
    }
  }

  onProgress?.(total, total, '');
};

export const downloadCommentaryByMefaresh = async (
  mefareshEn: string,
  mefareshHebrew: string,
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<void> => {
  const sefarim = [
    { id: 1, name: "Genesis", hebrew: "בראשית" },
    { id: 2, name: "Exodus", hebrew: "שמות" },
    { id: 3, name: "Leviticus", hebrew: "ויקרא" },
    { id: 4, name: "Numbers", hebrew: "במדבר" },
    { id: 5, name: "Deuteronomy", hebrew: "דברים" },
  ];

  const total = sefarim.length;
  let completed = 0;

  for (const sefer of sefarim) {
    onProgress?.(completed, total, `${mefareshHebrew} על ${sefer.hebrew}`);
    
    try {
      const data = await loadSefariaCommentary(sefer.name, mefareshEn);
      if (!data) {
        await fetchCommentaryFromAPI(sefer.name, mefareshEn, 1, 1);
      }
    } catch {
      // Skip failures
    }
    
    completed++;
  }

  onProgress?.(total, total, '');
};

export const getPasukSefariaUrl = (seferId: number, perek: number, pasuk: number): string => {
  const sefer = getSefariaSeferName(seferId);
  return `https://www.sefaria.org/${sefer}.${perek}.${pasuk}?lang=he`;
};

export const getMefareshSefariaUrl = (
  seferId: number,
  perek: number,
  pasuk: number,
  mefareshHebrew: string
): string => {
  const sefer = getSefariaSeferName(seferId);
  const mefareshEn = MEFARESH_MAPPING[mefareshHebrew];
  
  if (!mefareshEn) {
    return getPasukSefariaUrl(seferId, perek, pasuk);
  }

  if (mefareshEn === "Onkelos") {
    return `https://www.sefaria.org/Onkelos_${sefer}.${perek}.${pasuk}?lang=he`;
  }
  
  return `https://www.sefaria.org/${mefareshEn.replace(/_/g, '_')}_on_${sefer}.${perek}.${pasuk}?lang=he`;
};

export const clearCommentaryCache = () => {
  commentaryCache.clear();
  verseCache.clear();
};
