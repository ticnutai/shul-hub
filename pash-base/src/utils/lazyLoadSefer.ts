import { Sefer } from "@/types/torah";
import { torahDB } from "@/utils/torahDB";

// In-memory cache for instant access
const memoryCache = new Map<number, Sefer>();
const ESTHER_SEFER_ID = 101;
const ESTHER_EXPECTED_VERSE_COUNT = 167;

const NEVIIM_IDS = new Set([101, 102, 103, 104, 105, 106, 107]);

const SEFER_NAMES = ['בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים'];

const decodeHtmlEntities = (value: string): string => {
  return value
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
    .replace(/[\u0591-\u05AF\u05BD]/g, "")
    .replace(/\s{2,}/g, " ")
    .normalize("NFC")
    .trim();
};

const normalizeSeferText = (sefer: Sefer): Sefer => {
  return {
    ...sefer,
    parshiot: sefer.parshiot.map((parsha) => ({
      ...parsha,
      perakim: parsha.perakim.map((perek) => ({
        ...perek,
        pesukim: perek.pesukim.map((pasuk) => ({
          ...pasuk,
          text: decodeHtmlEntities(pasuk.text || ""),
          text_en: pasuk.text_en ? decodeHtmlEntities(pasuk.text_en) : pasuk.text_en,
        })),
      })),
    })),
  };
};

const countPesukim = (sefer: Sefer): number => {
  return sefer.parshiot.reduce(
    (parshaSum, parsha) =>
      parshaSum + parsha.perakim.reduce((perekSum, perek) => perekSum + perek.pesukim.length, 0),
    0
  );
};

const isValidCachedSefer = (seferId: number, sefer: Sefer): boolean => {
  if (seferId !== ESTHER_SEFER_ID) return true;
  return countPesukim(sefer) >= ESTHER_EXPECTED_VERSE_COUNT;
};

/**
 * Lazy load sefer data with 3-tier caching:
 * 1. Memory cache (instant)
 * 2. IndexedDB cache (fast, ~10ms)
 * 3. Bundle import (slower, network/disk)
 */
export const lazyLoadSefer = async (seferId: number): Promise<Sefer> => {
  // Tier 1: Memory cache
  if (memoryCache.has(seferId)) {
    const cached = memoryCache.get(seferId)!;
    if (isValidCachedSefer(seferId, cached)) {
      return cached;
    }
    memoryCache.delete(seferId);
  }

  // Tier 2: IndexedDB cache
  try {
    const cached = await torahDB.getSefer(seferId);
    if (cached) {
      const seferData = normalizeSeferText(cached as Sefer);
      if (isValidCachedSefer(seferId, seferData)) {
        memoryCache.set(seferId, seferData);
        return seferData;
      }
    }
  } catch (e) {
    // IndexedDB failed, continue to bundle
  }

  // Tier 3: Bundle import
  let module;
  switch (seferId) {
    case 1: module = await import("@/data/bereishit.json"); break;
    case 2: module = await import("@/data/shemot.json"); break;
    case 3: module = await import("@/data/vayikra.json"); break;
    case 4: module = await import("@/data/bamidbar.json"); break;
    case 5: module = await import("@/data/devarim.json"); break;
    case 101: module = await import("@/data/esther.json"); break;
    case 102: module = await import("@/data/joshua.json"); break;
    case 103: module = await import("@/data/judges.json"); break;
    case 104: module = await import("@/data/i_samuel.json"); break;
    case 105: module = await import("@/data/ii_samuel.json"); break;
    case 106: module = await import("@/data/i_kings.json"); break;
    case 107: module = await import("@/data/ii_kings.json"); break;
    default: throw new Error(`Unknown sefer ID: ${seferId}`);
  }

  const data = normalizeSeferText(module.default as Sefer);
  
  // Store in both caches
  memoryCache.set(seferId, data);
  torahDB.saveSefer(seferId, data).catch(() => {});

  return data;
};

/**
 * Preload next sefer in background for smooth navigation
 */
const NEVIIM_ORDER = [101, 102, 103, 104, 105, 106, 107];

export const preloadNextSefer = (currentSeferId: number) => {
  let nextSeferId: number;
  if (NEVIIM_IDS.has(currentSeferId)) {
    const idx = NEVIIM_ORDER.indexOf(currentSeferId);
    nextSeferId = NEVIIM_ORDER[(idx + 1) % NEVIIM_ORDER.length];
  } else {
    nextSeferId = currentSeferId < 5 ? currentSeferId + 1 : 1;
  }
  setTimeout(() => {
    lazyLoadSefer(nextSeferId).catch(() => {});
  }, 2000);
};

/**
 * Download all sefarim for offline use
 */
export const downloadAllSefarim = async (
  onProgress?: (completed: number, total: number, currentName: string) => void
): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    const seferId = i + 1;
    onProgress?.(i, 5, SEFER_NAMES[i]);
    await lazyLoadSefer(seferId);
  }
  onProgress?.(5, 5, '');
};

/**
 * Clear all sefer caches
 */
export const clearAllSeferCache = async () => {
  memoryCache.clear();
  await torahDB.clearSefarim();
};
