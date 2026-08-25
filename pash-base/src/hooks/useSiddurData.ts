/**
 * useSiddurData
 * Loads siddur sections for a given nusach + category.
 *
 * Performance strategy:
 *   1. Race Supabase (fetches only the needed category) vs split local JSON
 *      (siddur_{nusach}_{catId}.json — small per-category file) simultaneously.
 *      First valid result wins.
 *   2. Per-category files are ~50-200 KB instead of the old monolithic 3 MB
 *      nusach JSON, so the local path is now much faster on first load.
 *   3. Full nusach JSON (siddur_{nusach}.json) kept as a fallback in case a
 *      split file doesn't exist yet.
 *   4. All results are cached in memory so category switches are instant.
 */
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiddurSection  = { title: string; lines: string[] };
export type SiddurCategory = { name: string; sections: SiddurSection[] };
export type SiddurData     = Record<string, SiddurCategory>;

// Glob for per-category split files  (siddur_{nusach}_{catId}.json)
const SIDDUR_CAT_FILES = import.meta.glob<{ default: SiddurCategory }>(
  "../data/siddur/siddur_*_*.json"
);

// Glob for legacy full-nusach files  (siddur_{nusach}.json) — fallback only
// NOTE: import.meta.glob accepts a SINGLE pattern string — multiple args are invalid.
// Using siddur_*.json matches both nusach files and split files, but loadLocalNusach
// does exact key lookup so there is no collision.
const SIDDUR_NUSACH_FILES = import.meta.glob<{ default: SiddurData }>(
  "../data/siddur/siddur_*.json"
);

// Global caches
const sectionsCache:   Record<string, SiddurSection[]> = {};
const catNameCache:    Record<string, string>           = {};
const catPending:      Record<string, Promise<SiddurCategory | null>> = {};
const nusachCache:     Record<string, SiddurData>       = {};
const nusachPending:   Record<string, Promise<SiddurData | null>>     = {};

/**
 * Load (or cache) a single category's split JSON.
 * File: siddur_{nusach}_{catId}.json → { name, sections }
 */
async function loadLocalCategory(nusach: string, catId: string): Promise<SiddurCategory | null> {
  const key     = `${nusach}:${catId}`;
  if (catPending[key]) return catPending[key];

  catPending[key] = (async () => {
    try {
      const fileKey = `../data/siddur/siddur_${nusach}_${catId}.json`;
      const importer = SIDDUR_CAT_FILES[fileKey];
      if (!importer) return null;
      const mod = await importer();
      return mod.default ?? null;
    } catch {
      return null;
    } finally {
      delete catPending[key];
    }
  })();

  return catPending[key];
}

/**
 * Fallback: load (or return cached) the full nusach JSON.
 * Only used when no split file exists for a category.
 */
async function loadLocalNusach(nusach: string): Promise<SiddurData | null> {
  if (nusachCache[nusach]) return nusachCache[nusach];
  if (!nusachPending[nusach]) {
    nusachPending[nusach] = (async () => {
      try {
        const fileKey = `../data/siddur/siddur_${nusach}.json`;
        const importer = SIDDUR_NUSACH_FILES[fileKey];
        if (!importer) return null;
        const mod = await importer();
        nusachCache[nusach] = mod.default;
        return mod.default;
      } catch {
        return null;
      } finally {
        delete nusachPending[nusach];
      }
    })();
  }
  return nusachPending[nusach];
}

/**
 * Preload the split JSON for a specific category in the background.
 * Call when the user hovers / focuses a category tab so it's ready before click.
 */
export function preloadSiddurNusach(nusach: string) {
  // No-op — preloading an entire nusach is no longer useful since we use
  // per-category files. Category preloading happens on mouse-over in the UI.
}

export function useSiddurSections(nusach: string, catId: string) {
  const [sections, setSections] = useState<SiddurSection[] | null>(
    sectionsCache[`${nusach}:${catId}`] ?? null
  );
  const [catName, setCatName] = useState(catNameCache[`${nusach}:${catId}`] ?? "");
  const [loading, setLoading] = useState(sections === null);
  const [error, setError]     = useState<string | null>(null);
  const [source, setSource]   = useState<"supabase" | "local" | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    const key = `${nusach}:${catId}`;
    if (sectionsCache[key]) {
      setSections(sectionsCache[key]);
      setCatName(catNameCache[key] ?? "");
      setLoading(false);
      return;
    }

    abortRef.current = false;
    setLoading(true);
    setError(null);
    setSections(null);

    // "done" flag ensures only the first valid result updates state
    let done = false;

    const commit = (
      secs: SiddurSection[],
      name: string,
      src: "supabase" | "local",
    ) => {
      if (done || abortRef.current) return;
      done = true;
      sectionsCache[key] = secs;
      catNameCache[key]  = name;
      setSections(secs);
      setCatName(name);
      setSource(src);
      setLoading(false);
    };

    // ── Supabase ──────────────────────────────────────────────
    const supabaseLoad = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rows, error: sbErr } = await (supabase as any)
          .from("siddur")
          .select("title, lines, cat_name, section_idx")
          .eq("nusach", nusach)
          .eq("category", catId)
          .order("section_idx");
        if (!sbErr && rows && rows.length > 0) {
          commit(
            rows.map((r: { title: string; lines: string[] }) => ({ title: r.title, lines: r.lines })),
            rows[0].cat_name,
            "supabase",
          );
        }
      } catch { /* fall through */ }
    };

    // ── Local JSON (split per-category file — fast path) ─────
    const localLoad = async () => {
      // Try the small per-category file first (e.g. siddur_sefard_shacharit.json)
      const cat = await loadLocalCategory(nusach, catId);
      if (cat) {
        commit(cat.sections, cat.name, "local");
        return;
      }
      // Fallback: load the full nusach JSON (legacy, larger)
      const nusachData = await loadLocalNusach(nusach);
      if (!nusachData) return;
      const catFallback = nusachData[catId];
      if (catFallback) {
        commit(catFallback.sections, catFallback.name, "local");
      } else {
        // Category doesn't exist in this nusach
        if (!done && !abortRef.current) {
          done = true;
          setSections([]);
          setLoading(false);
        }
      }
    };

    // Race: both run simultaneously, first valid result wins
    Promise.all([supabaseLoad(), localLoad()]).then(() => {
      if (!done && !abortRef.current) {
        setError("לא ניתן לטעון — בדוק חיבור אינטרנט");
        setLoading(false);
      }
    });

    return () => { abortRef.current = true; };
  }, [nusach, catId]);

  return { sections, catName, loading, error, source };
}

/**
 * useSiddurCategories
 * Returns the available categories for a nusach.
 * Races Supabase vs local JSON — whichever has valid data first wins.
 */
const CATEGORIES_ORDER = [
  "shacharit", "mincha", "arvit",
  "shabbat_kabbalat", "shabbat_arvit", "shabbat_shacharit",
  "shabbat_musaf", "shabbat_mincha", "brachot", "other",
];

// Categories small enough to eagerly preload in the background (~10-130 KB each).
// "other" (~1.2 MB) is intentionally excluded — load on demand only.
const EAGER_PRELOAD_CATS = CATEGORIES_ORDER.filter(c => c !== "other");

// Tracks which nusachim have already had background preloading kicked off.
const preloadTriggered = new Set<string>();

/**
 * Fire-and-forget: load all small categories for a nusach in parallel so that
 * switching tabs feels instant.  "other" is excluded (too large).
 * Safe to call multiple times — runs only once per nusach.
 */
function backgroundPreloadCategories(nusach: string, availableCatIds: string[]) {
  if (preloadTriggered.has(nusach)) return;
  preloadTriggered.add(nusach);

  const toLoad = availableCatIds.filter(id => EAGER_PRELOAD_CATS.includes(id));
  const idle: (cb: () => void) => void =
    typeof requestIdleCallback === "function"
      ? cb => requestIdleCallback(cb)
      : cb => setTimeout(cb, 50);

  idle(() => {
    // Load all small categories in parallel — results land in sectionsCache
    // so the next useSiddurSections call returns immediately from cache.
    Promise.all(
      toLoad.map(async catId => {
        const key = `${nusach}:${catId}`;
        if (sectionsCache[key]) return; // already cached
        const cat = await loadLocalCategory(nusach, catId);
        if (cat && !sectionsCache[key]) {
          sectionsCache[key] = cat.sections;
          catNameCache[key]  = cat.name;
        }
      })
    ).catch(() => { /* best-effort */ });
  });
}

const catListCache: Record<string, { id: string; name: string }[]> = {};

export function useSiddurCategories(nusach: string) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    catListCache[nusach] ?? []
  );
  const [loading, setLoading] = useState(!catListCache[nusach]);

  useEffect(() => {
    if (catListCache[nusach]) {
      setCategories(catListCache[nusach]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let done      = false;
    setLoading(true);

    const commit = (cats: { id: string; name: string }[]) => {
      if (done || cancelled) return;
      done = true;
      catListCache[nusach] = cats;
      setCategories(cats);
      setLoading(false);
      // Kick off background preloading of all small categories for this nusach
      backgroundPreloadCategories(nusach, cats.map(c => c.id));
    };

    // ── Supabase ──────────────────────────────────────────────
    const supabaseLoad = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rows } = await (supabase as any)
          .from("siddur")
          .select("category, cat_name, section_idx")
          .eq("nusach", nusach)
          .eq("section_idx", 0);
        if (rows && rows.length > 0) {
          commit(
            rows
              .map((r: { category: string; cat_name: string }) => ({ id: r.category, name: r.cat_name }))
              .sort((a: { id: string }, b: { id: string }) =>
                CATEGORIES_ORDER.indexOf(a.id) - CATEGORIES_ORDER.indexOf(b.id),
              ),
          );
        }
      } catch { /* fall through */ }
    };

    // ── Local JSON (derive category list from available split files) ──
    const localLoad = async () => {
      // Try to build category list from split files (fast — each is small)
      const splitCats: { id: string; name: string }[] = [];
      await Promise.all(
        CATEGORIES_ORDER.map(async catId => {
          const cat = await loadLocalCategory(nusach, catId);
          if (cat && cat.sections.length > 0) {
            splitCats.push({ id: catId, name: cat.name });
          }
        })
      );
      if (splitCats.length > 0) {
        commit(CATEGORIES_ORDER.filter(k => splitCats.find(c => c.id === k)).map(k => splitCats.find(c => c.id === k)!));
        return;
      }
      // Fallback: full nusach JSON
      const nusachData = await loadLocalNusach(nusach);
      if (!nusachData) return;
      commit(
        CATEGORIES_ORDER
          .filter(k => nusachData[k] && nusachData[k].sections.length > 0)
          .map(k => ({ id: k, name: nusachData[k].name })),
      );
    };

    // Race: both run simultaneously
    Promise.all([supabaseLoad(), localLoad()]).then(() => {
      if (!done && !cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [nusach]);

  return { categories, loading };
}

/**
 * useTehillimData
 * Loads all 150 chapters.
 * Races Supabase + local JSON — first valid result wins.
 */
export type TehillimChapter = { chapter: number; title: string; lines: string[] };
export type TehillimMap     = Record<string, TehillimChapter>;

const TEHILLIM_FILE = import.meta.glob<{ default: TehillimMap }>(
  "../data/tehillim.json"
);

let tehillimCache: TehillimMap | null = null;

export function useTehillimData() {
  const [tehillim, setTehillim] = useState<TehillimMap | null>(tehillimCache);
  const [loading, setLoading]   = useState(tehillimCache === null);
  const [source, setSource]     = useState<"supabase" | "local" | null>(null);
  const loaded = useRef(tehillimCache !== null);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);

    let done = false;

    const commit = (map: TehillimMap, src: "supabase" | "local") => {
      if (done) return;
      done = true;
      tehillimCache = map;
      setTehillim(map);
      setSource(src);
      setLoading(false);
    };

    // ── Supabase ──────────────────────────────────────────────
    const supabaseLoad = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rows, error: sbErr } = await (supabase as any)
          .from("tehillim")
          .select("chapter, title, lines")
          .order("chapter");
        if (!sbErr && rows && rows.length > 0) {
          const map: TehillimMap = {};
          for (const r of rows) {
            map[String(r.chapter)] = { chapter: r.chapter, title: r.title, lines: r.lines as string[] };
          }
          commit(map, "supabase");
        }
      } catch { /* fall through */ }
    };

    // ── Local JSON ────────────────────────────────────────────
    const localLoad = async () => {
      try {
        const key = "../data/tehillim.json";
        const importer = TEHILLIM_FILE[key];
        if (!importer) return;
        const mod = await importer();
        commit(mod.default, "local");
      } catch { /* ignore */ }
    };

    // Race: both run simultaneously
    Promise.all([supabaseLoad(), localLoad()]).then(() => {
      if (!done) setLoading(false);
    });
  }, []);

  return { tehillim, loading, source };
}
