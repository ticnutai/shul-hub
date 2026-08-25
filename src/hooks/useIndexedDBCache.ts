/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';

interface CacheEntry {
  data: any;
  timestamp: number;
  version: string;
}

const DB_NAME = 'torah_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'cache_store';
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init() {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
    });

    return this.initPromise;
  }

  async get(key: string): Promise<any | null> {
    try {
      await this.init();
      if (!this.db) return null;

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result as (CacheEntry & { key: string }) | undefined;
          if (!result) {
            resolve(null);
            return;
          }

          const isExpired = Date.now() - result.timestamp > CACHE_DURATION;
          if (isExpired) {
            this.delete(key);
            resolve(null);
            return;
          }

          resolve(result.data);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB get error:', error);
      return null;
    }
  }

  async set(key: string, data: any, version: string = 'v1'): Promise<void> {
    try {
      await this.init();
      if (!this.db) return;

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const entry = {
          key,
          data,
          timestamp: Date.now(),
          version
        };

        const request = store.put(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.init();
      if (!this.db) return;

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB delete error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.init();
      if (!this.db) return;

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB clear error:', error);
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      await this.init();
      if (!this.db) return [];

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAllKeys();

        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDB getAllKeys error:', error);
      return [];
    }
  }
}

const dbCache = new IndexedDBCache();

export const useIndexedDBCache = () => {
  const getFromCache = useCallback(async (key: string): Promise<any | null> => {
    return dbCache.get(key);
  }, []);

  const saveToCache = useCallback(async (key: string, data: any, version = 'v1'): Promise<void> => {
    return dbCache.set(key, data, version);
  }, []);

  const clearCache = useCallback(async (): Promise<void> => {
    return dbCache.clear();
  }, []);

  const deleteFromCache = useCallback(async (key: string): Promise<void> => {
    return dbCache.delete(key);
  }, []);

  const getAllCacheKeys = useCallback(async (): Promise<string[]> => {
    return dbCache.getAllKeys();
  }, []);

  return {
    getFromCache,
    saveToCache,
    clearCache,
    deleteFromCache,
    getAllCacheKeys
  };
};
