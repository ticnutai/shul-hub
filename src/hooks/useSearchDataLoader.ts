/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchableItem } from './useSearchIndex';
import { normalizeMefareshName } from '@/utils/names';

type BookStatus = 'pending' | 'loading' | 'completed' | 'error';

interface BookLoadState {
  name: string;
  status: BookStatus;
  progress: number;
}

const SEFR_FILES = ['bereishit', 'shemot', 'vayikra', 'bamidbar', 'devarim'] as const;
const SEFER_NAMES = ['בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים'] as const;
const CACHE_KEY = 'search_items_v3';
const DB_NAME = 'torah_search_db';
const DB_VERSION = 2;
const STORE_NAME = 'search_index';

// Dedicated IndexedDB for search items - separate from general cache
class SearchIndexDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init() {
    if (this.db) {
      try {
        if (!this.db.objectStoreNames.contains(STORE_NAME)) {
          this.db.close();
          this.db = null;
          this.initPromise = null;
        } else {
          return;
        }
      } catch {
        this.db = null;
        this.initPromise = null;
      }
    }
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => { this.initPromise = null; reject(request.error); };
      request.onsuccess = () => { this.db = request.result; resolve(); };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        db.createObjectStore(STORE_NAME);
      };
    });
    return this.initPromise;
  }

  private reset() {
    if (this.db) try { this.db.close(); } catch { /* ignore */ }
    this.db = null;
    this.initPromise = null;
  }

  async get(key: string): Promise<SearchableItem[] | null> {
    try {
      await this.init();
      if (!this.db || !this.db.objectStoreNames.contains(STORE_NAME)) {
        this.reset();
        return null;
      }
      return new Promise((resolve) => {
        try {
          const tx = this.db!.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        } catch {
          this.reset();
          resolve(null);
        }
      });
    } catch {
      this.reset();
      return null;
    }
  }

  async set(key: string, data: SearchableItem[]): Promise<void> {
    try {
      await this.init();
      if (!this.db || !this.db.objectStoreNames.contains(STORE_NAME)) {
        this.reset();
        return;
      }
      return new Promise((resolve) => {
        try {
          const tx = this.db!.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(data, key);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        } catch {
          this.reset();
          resolve();
        }
      });
    } catch { /* ignore */ }
  }
}

const searchDB = new SearchIndexDB();

// Convert raw book data to searchable items (runs in main thread but chunked)
function buildSearchableItems(sefer: any, seferIndex: number): SearchableItem[] {
  const items: SearchableItem[] = [];
  const parshiot = sefer.parshiot || [];

  for (const parsha of parshiot) {
    for (const perek of (parsha.perakim || [])) {
      for (const pasuk of (perek.pesukim || [])) {
        items.push({
          type: 'pasuk',
          id: `pasuk-${pasuk.id}`,
          sefer: seferIndex + 1,
          perek: perek.perek_num,
          pasuk_num: pasuk.pasuk_num,
          text: pasuk.text,
          originalItem: { id: pasuk.id, sefer: seferIndex + 1, perek: perek.perek_num, pasuk_num: pasuk.pasuk_num, text: pasuk.text }
        });

        for (const content of (pasuk.content || [])) {
          for (const question of (content.questions || [])) {
            items.push({
              type: 'question',
              id: `question-${question.id}`,
              sefer: seferIndex + 1,
              perek: perek.perek_num,
              pasuk_num: pasuk.pasuk_num,
              text: question.text,
              questionText: question.text,
              originalItem: { pasuk: { id: pasuk.id, sefer: seferIndex + 1, perek: perek.perek_num, pasuk_num: pasuk.pasuk_num, text: pasuk.text }, question }
            });

            for (const perush of (question.perushim || [])) {
              items.push({
                type: 'perush',
                id: `perush-${perush.id}`,
                sefer: seferIndex + 1,
                perek: perek.perek_num,
                pasuk_num: pasuk.pasuk_num,
                text: perush.text,
                mefaresh: normalizeMefareshName(perush.mefaresh),
                questionText: question.text,
                originalItem: { pasuk: { id: pasuk.id, sefer: seferIndex + 1, perek: perek.perek_num, pasuk_num: pasuk.pasuk_num, text: pasuk.text }, question, perush }
              });
            }
          }
        }
      }
    }
  }
  return items;
}

async function loadSingleBook(fileName: string, index: number): Promise<SearchableItem[]> {
  const module = await import(`@/data/${fileName}.json`);
  return buildSearchableItems(module.default, index);
}

export function useSearchDataLoader(enabled: boolean) {
  const [searchableItems, setSearchableItems] = useState<SearchableItem[]>([]);
  const [books, setBooks] = useState<BookLoadState[]>(
    SEFER_NAMES.map(name => ({ name, status: 'pending' as BookStatus, progress: 0 }))
  );
  const [isReady, setIsReady] = useState(false);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const loadedRef = useRef(false);
  const itemsAccumulator = useRef<SearchableItem[]>([]);

  useEffect(() => {
    if (!enabled || loadedRef.current) return;
    loadedRef.current = true;

    const load = async () => {
      // 1. Try cache first - instant load
      const cached = await searchDB.get(CACHE_KEY);
      if (cached && cached.length > 0) {
        setSearchableItems(cached);
        setBooks(prev => prev.map(b => ({ ...b, status: 'completed', progress: 100 })));
        setIsReady(true);
        setIsFullyLoaded(true);
        return;
      }

      // 2. Load ALL books in parallel, but update searchableItems incrementally
      setBooks(prev => prev.map(b => ({ ...b, status: 'loading', progress: 10 })));
      itemsAccumulator.current = [];

      const results = await Promise.allSettled(
        SEFR_FILES.map((file, i) =>
          loadSingleBook(file, i).then(items => {
            // Update book status
            setBooks(prev => {
              const updated = [...prev];
              updated[i] = { ...updated[i], status: 'completed', progress: 100 };
              return updated;
            });

            // Accumulate and publish items incrementally
            itemsAccumulator.current = [...itemsAccumulator.current, ...items];
            setSearchableItems([...itemsAccumulator.current]);

            // Mark ready as soon as first book loads
            setIsReady(true);

            return { index: i, items };
          })
        )
      );

      // Mark failed books
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          setBooks(prev => {
            const updated = [...prev];
            updated[i] = { ...updated[i], status: 'error', progress: 0 };
            return updated;
          });
        }
      });

      setIsFullyLoaded(true);

      // Cache in background
      searchDB.set(CACHE_KEY, itemsAccumulator.current).catch(() => {});
    };

    load();
  }, [enabled]);

  const completedCount = books.filter(b => b.status === 'completed').length;
  const totalProgress = books.reduce((sum, b) => sum + b.progress, 0) / books.length;

  return {
    searchableItems,
    books,
    isReady,
    isFullyLoaded,
    completedCount,
    totalProgress
  };
}
