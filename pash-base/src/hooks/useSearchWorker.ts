/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef } from 'react';
import { SearchableItem } from './useSearchIndex';

interface SearchFilters {
  sefer: number | null;
  searchType: 'all' | 'question' | 'perush' | 'pasuk';
  mefaresh: string;
  useWildcard?: boolean;
}

const removeNiqqud = (text: string) => text.replace(/[\u0591-\u05C7]/g, '');

export const useSearchWorker = () => {
  const [isReady, setIsReady] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const itemsRef = useRef<SearchableItem[]>([]);
  const normalizedTextsRef = useRef<string[]>([]);

  const initializeIndex = useCallback((items: SearchableItem[]) => {
    itemsRef.current = items;
    // Pre-compute normalized texts
    normalizedTextsRef.current = items.map(item => removeNiqqud(item.text));
    setIsReady(true);
  }, []);

  const search = useCallback(
    (query: string, filters: SearchFilters): Promise<any[]> => {
      return new Promise((resolve) => {
        if (!isReady || itemsRef.current.length === 0) {
          resolve([]);
          return;
        }

        setIsSearching(true);

        // Use requestAnimationFrame to not block UI
        requestAnimationFrame(() => {
          const normalizedQuery = removeNiqqud(query.trim());
          if (!normalizedQuery) {
            setIsSearching(false);
            resolve([]);
            return;
          }

          let pattern: string;
          if (filters?.useWildcard && normalizedQuery.includes('*')) {
            // Replace * with .* for wildcard matching, escape the rest
            pattern = normalizedQuery.split('*').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
          } else {
            pattern = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          }
          let regex: RegExp;
          try {
            regex = new RegExp(pattern, 'gi');
          } catch {
            setIsSearching(false);
            resolve([]);
            return;
          }

          const items = itemsRef.current;
          const normalizedTexts = normalizedTextsRef.current;
          const results: Array<{ item: SearchableItem; score: number; matches: any[] }> = [];
          const MAX_RESULTS = 200;

          for (let i = 0; i < items.length && results.length < MAX_RESULTS; i++) {
            const item = items[i];

            // Apply filters early
            if (filters) {
              if (filters.sefer && item.sefer !== filters.sefer) continue;
              if (filters.searchType !== 'all' && item.type !== filters.searchType) continue;
              if (filters.mefaresh !== 'הכל' && item.mefaresh !== filters.mefaresh) continue;
            }

            const normalizedText = normalizedTexts[i];
            regex.lastIndex = 0;
            const textMatch = regex.exec(normalizedText);

            let mefareshMatch = false;
            let questionMatch = false;
            if (!textMatch) {
              if (item.mefaresh) {
                regex.lastIndex = 0;
                mefareshMatch = regex.test(removeNiqqud(item.mefaresh));
              }
              if (!mefareshMatch && item.questionText) {
                regex.lastIndex = 0;
                questionMatch = regex.test(removeNiqqud(item.questionText));
              }
            }

            if (textMatch || mefareshMatch || questionMatch) {
              const matches: any[] = [];
              if (textMatch) {
                matches.push({
                  key: 'text',
                  indices: [[textMatch.index, textMatch.index + textMatch[0].length - 1]]
                });
              }
              results.push({ item, score: textMatch ? 0.1 : 0.5, matches });
            }
          }

          results.sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            if (a.item.sefer !== b.item.sefer) return a.item.sefer - b.item.sefer;
            if (a.item.perek !== b.item.perek) return a.item.perek - b.item.perek;
            return a.item.pasuk_num - b.item.pasuk_num;
          });

          setIsSearching(false);
          resolve(results);
        });
      });
    },
    [isReady]
  );

  return {
    initializeIndex,
    search,
    isReady,
    isSearching
  };
};
