import { useState, useCallback } from 'react';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours
const CACHE_KEY_PREFIX = 'sefaria_cache_';

export const useSefariaCache = () => {
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0 });

  // Get from cache
  const getFromCache = useCallback((key: string): unknown | null => {
    try {
      const cacheKey = CACHE_KEY_PREFIX + key;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
        return null;
      }

      const entry: CacheEntry = JSON.parse(cached);
      const isExpired = Date.now() - entry.timestamp > CACHE_DURATION;

      if (isExpired) {
        localStorage.removeItem(cacheKey);
        setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
        return null;
      }

      setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
      return entry.data;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }, []);

  // Clear old cache entries
  const clearOldCache = useCallback(() => {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_KEY_PREFIX));
      
      const entries = cacheKeys.map(key => {
        try {
          const entry = JSON.parse(localStorage.getItem(key) || '{}');
          return { key, timestamp: entry.timestamp || 0 };
        } catch {
          return { key, timestamp: 0 };
        }
      });

      // Sort by timestamp and remove oldest 50%
      entries.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = entries.slice(0, Math.floor(entries.length / 2));
      
      toRemove.forEach(({ key }) => localStorage.removeItem(key));
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }, []);

  // Save to cache
  const saveToCache = useCallback((key: string, data: unknown) => {
    try {
      const cacheKey = CACHE_KEY_PREFIX + key;
      const entry: CacheEntry = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
      console.error('Cache write error:', error);
      // If quota exceeded, clear old entries
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        clearOldCache();
      }
    }
  }, [clearOldCache]);

  // Prefetch data for background loading
  const prefetch = useCallback(async (
    key: string, 
    fetcher: () => Promise<unknown>
  ) => {
    const cached = getFromCache(key);
    if (cached) return cached;

    try {
      const data = await fetcher();
      saveToCache(key, data);
      return data;
    } catch (error) {
      console.error('Prefetch error:', error);
      return null;
    }
  }, [getFromCache, saveToCache]);

  return {
    getFromCache,
    saveToCache,
    clearOldCache,
    prefetch,
    cacheStats
  };
};
