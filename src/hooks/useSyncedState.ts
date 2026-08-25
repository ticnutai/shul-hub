import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

interface UseSyncedStateOptions<T> {
  localStorageKey: string;
  tableName?: string;
  column?: string;
  userId?: string | null;
  syncToCloud?: boolean;
  defaultValue: T;
  debounceMs?: number;
}

interface SyncState<T> {
  data: T;
  status: SyncStatus;
  lastSynced: number | null;
}

interface LocalSyncMeta {
  updatedAt: number;
  lastCloudUpdatedAt?: number;
  lastCloudValue?: string;
}

export function useSyncedState<T>({
  localStorageKey,
  tableName,
  column,
  userId,
  syncToCloud = true,
  defaultValue,
  debounceMs = 1000,
}: UseSyncedStateOptions<T>) {
  const [syncState, setSyncState] = useState<SyncState<T>>(() => {
    try {
      const saved = localStorage.getItem(localStorageKey);
      if (!saved) {
        return {
          data: defaultValue,
          status: 'synced' as SyncStatus,
          lastSynced: null,
        };
      }

      try {
        const parsed = JSON.parse(saved);
        const merged =
          typeof parsed === 'object' && parsed !== null && typeof defaultValue === 'object' && defaultValue !== null
            ? { ...defaultValue, ...parsed }
            : parsed;

        return {
          data: merged,
          status: 'synced' as SyncStatus,
          lastSynced: null,
        };
      } catch {
        return {
          data: saved as T,
          status: 'synced' as SyncStatus,
          lastSynced: null,
        };
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return {
        data: defaultValue,
        status: 'synced' as SyncStatus,
        lastSynced: null,
      };
    }
  });

  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const syncQueueRef = useRef<T | null>(null);
  const isOnlineRef = useRef(navigator.onLine);

  const readLocalMeta = useCallback((): LocalSyncMeta => {
    try {
      const raw = localStorage.getItem(`${localStorageKey}__meta`);
      if (!raw) return { updatedAt: 0 };
      const parsed = JSON.parse(raw) as Partial<LocalSyncMeta>;
      return {
        updatedAt: Number(parsed.updatedAt) || 0,
        lastCloudUpdatedAt: Number(parsed.lastCloudUpdatedAt) || 0,
        lastCloudValue: typeof parsed.lastCloudValue === 'string' ? parsed.lastCloudValue : undefined,
      };
    } catch {
      return { updatedAt: 0 };
    }
  }, [localStorageKey]);

  const writeLocalMeta = useCallback((patch: Partial<LocalSyncMeta>) => {
    try {
      const current = readLocalMeta();
      const next: LocalSyncMeta = {
        updatedAt: patch.updatedAt ?? current.updatedAt ?? 0,
        lastCloudUpdatedAt: patch.lastCloudUpdatedAt ?? current.lastCloudUpdatedAt,
        lastCloudValue: patch.lastCloudValue ?? current.lastCloudValue,
      };
      localStorage.setItem(`${localStorageKey}__meta`, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, [localStorageKey, readLocalMeta]);

  const safeSerialize = useCallback((value: unknown): string | undefined => {
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }, []);

  // Save to localStorage immediately and update local edit timestamp.
  const saveToLocalStorage = useCallback((data: T, tsOverride?: number) => {
    localStorage.setItem(localStorageKey, JSON.stringify(data));
    const ts = tsOverride !== undefined ? tsOverride : Date.now();
    writeLocalMeta({ updatedAt: ts });
  }, [localStorageKey, writeLocalMeta]);

  // Re-read from localStorage when key changes (e.g., device type switch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(localStorageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const merged =
            typeof parsed === 'object' && parsed !== null && typeof defaultValue === 'object' && defaultValue !== null
              ? { ...defaultValue, ...parsed }
              : parsed;
          setSyncState((prev) => ({ ...prev, data: merged }));
        } catch {
          setSyncState((prev) => ({ ...prev, data: saved as T }));
        }
      } else {
        setSyncState((prev) => ({ ...prev, data: defaultValue }));
      }
    } catch {
      // ignore
    }
  }, [localStorageKey, defaultValue]);

  // Save to Supabase (debounced)
  const saveToCloud = useCallback(async (data: T) => {
    if (!syncToCloud || !userId || !tableName || !column) return;

    try {
      setSyncState((prev) => ({ ...prev, status: 'syncing' }));

      const upsertData = { user_id: userId, [column]: data, updated_at: new Date().toISOString() };
      const { error } = await supabase.from(tableName as never).upsert(upsertData as never, { onConflict: 'user_id' });

      if (error) throw error;

      const now = Date.now();
      writeLocalMeta({
        lastCloudUpdatedAt: now,
        lastCloudValue: safeSerialize(data),
      });

      setSyncState((prev) => ({
        ...prev,
        status: 'synced',
        lastSynced: now,
      }));
    } catch (error) {
      console.error('Cloud sync error:', error);
      setSyncState((prev) => ({ ...prev, status: 'error' }));
      syncQueueRef.current = data;
    }
  }, [syncToCloud, userId, tableName, column, writeLocalMeta, safeSerialize]);

  // Load from cloud on mount and resolve conflict by real value changes, not only row updated_at.
  useEffect(() => {
    const loadFromCloud = async () => {
      if (!syncToCloud || !userId || !tableName || !column) return;

      try {
        const { data: cloudData, error } = await supabase
          .from(tableName as never)
          .select(`${column},updated_at` as never)
          .eq('user_id', userId)
          .maybeSingle();

        if (error) throw error;

        if (!cloudData || (cloudData as Record<string, unknown>)[column] == null) return;

        const cloudValueRaw = (cloudData as Record<string, unknown>)[column] as T;
        const cloudValue =
          typeof cloudValueRaw === 'object' && cloudValueRaw !== null && typeof defaultValue === 'object' && defaultValue !== null
            ? ({ ...defaultValue, ...cloudValueRaw } as T)
            : cloudValueRaw;

        const rawCloudTs = (cloudData as Record<string, unknown>)['updated_at'];
        const cloudUpdatedAt = rawCloudTs ? new Date(rawCloudTs as string).getTime() : 0;

        const localMeta = readLocalMeta();
        const localUpdatedAt = localMeta.updatedAt || 0;
        const lastCloudUpdatedAt = localMeta.lastCloudUpdatedAt || 0;
        const lastCloudValue = localMeta.lastCloudValue;

        const localRaw = localStorage.getItem(localStorageKey);
        let localValue: T | null = null;
        if (localRaw) {
          try {
            const parsed = JSON.parse(localRaw) as T;
            localValue =
              typeof parsed === 'object' && parsed !== null && typeof defaultValue === 'object' && defaultValue !== null
                ? ({ ...defaultValue, ...parsed } as T)
                : parsed;
          } catch {
            localValue = null;
          }
        }

        const localSerialized = localValue == null ? undefined : safeSerialize(localValue);
        const cloudSerialized = safeSerialize(cloudValue);

        const localChangedSinceLastCloud =
          !!localSerialized && !!lastCloudValue
            ? localSerialized !== lastCloudValue
            : localUpdatedAt > lastCloudUpdatedAt;

        const cloudChangedSinceLastCloud =
          !!cloudSerialized && !!lastCloudValue
            ? cloudSerialized !== lastCloudValue
            : cloudUpdatedAt > lastCloudUpdatedAt;

        const adoptCloud = () => {
          const now = Date.now();
          localStorage.setItem(localStorageKey, JSON.stringify(cloudValue));
          writeLocalMeta({
            updatedAt: now,
            lastCloudUpdatedAt: now,
            lastCloudValue: cloudSerialized,
          });
          setSyncState({
            data: cloudValue,
            status: 'synced',
            lastSynced: now,
          });
        };

        if (!localRaw) {
          adoptCloud();
          return;
        }

        if (localSerialized && cloudSerialized && localSerialized === cloudSerialized) {
          const now = Date.now();
          writeLocalMeta({
            lastCloudUpdatedAt: now,
            lastCloudValue: cloudSerialized,
          });
          return;
        }

        if (localChangedSinceLastCloud && !cloudChangedSinceLastCloud) {
          if (localValue != null) {
            saveToCloud(localValue);
          }
          return;
        }

        if (cloudChangedSinceLastCloud && !localChangedSinceLastCloud) {
          adoptCloud();
          return;
        }

        // Both sides changed or we cannot determine safely: fallback to timestamp tiebreaker.
        if (localUpdatedAt > cloudUpdatedAt && localValue != null) {
          saveToCloud(localValue);
        } else {
          adoptCloud();
        }
      } catch (error) {
        console.error('Failed to load from cloud:', error);
      }
    };

    loadFromCloud();
  }, [
    userId,
    tableName,
    column,
    syncToCloud,
    localStorageKey,
    defaultValue,
    readLocalMeta,
    writeLocalMeta,
    safeSerialize,
    saveToCloud,
  ]);

  // Update data
  const setData = useCallback((newData: T | ((prev: T) => T)) => {
    setSyncState((prev) => {
      const updated = typeof newData === 'function' ? (newData as (prev: T) => T)(prev.data) : newData;

      // Save to localStorage immediately
      saveToLocalStorage(updated);

      // Debounce cloud save
      if (syncToCloud && userId && isOnlineRef.current) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          saveToCloud(updated);
        }, debounceMs);
      }

      return { ...prev, data: updated };
    });
  }, [saveToLocalStorage, syncToCloud, userId, debounceMs, saveToCloud]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      setSyncState((prev) => ({ ...prev, status: 'synced' }));

      if (syncQueueRef.current) {
        saveToCloud(syncQueueRef.current);
        syncQueueRef.current = null;
      }
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
      setSyncState((prev) => ({ ...prev, status: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [saveToCloud]);

  const syncNow = useCallback(async () => {
    if (syncToCloud && userId) {
      await saveToCloud(syncState.data);
    }
  }, [syncToCloud, userId, saveToCloud, syncState.data]);

  return {
    data: syncState.data,
    setData,
    status: syncState.status,
    lastSynced: syncState.lastSynced,
    syncNow,
  };
}
