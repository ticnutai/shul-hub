/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ReadingState {
  corpusMode?: string;
  selectedSefer?: number | null;
  selectedParsha?: number | string | null;
  selectedPerek?: number | null;
  selectedPasuk?: number | null;
  singlePasukMode?: boolean;
  timestamp?: number;
}

/**
 * Syncs the user's reading position between localStorage and Supabase.
 *
 * Strategy — last writer wins:
 *   • On login: compare localStorage.timestamp vs cloud row timestamp.
 *     The newer one wins; the older one is updated to match.
 *   • On position change: debounced push to cloud (2 s after last change).
 *
 * The hook exposes:
 *   - syncDone      : true once the initial cloud comparison has completed
 *   - resolvedState : the winning ReadingState after comparison (null if no saved state)
 *   - savePosition  : call this whenever the reading position changes
 */
export function useReadingPositionSync() {
  const { user } = useAuth();
  const [syncDone, setSyncDone] = useState(false);
  const [resolvedState, setResolvedState] = useState<ReadingState | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | null>(null);

  // On user login: resolve local vs cloud
  useEffect(() => {
    if (!user) {
      setSyncDone(true);
      return;
    }

    userIdRef.current = user.id;
    setSyncDone(false);

    (async () => {
      try {
        const { data } = await supabase
          .from('user_reading_position')
          .select('state,updated_at')
          .eq('user_id', user.id)
          .maybeSingle() as { data: { state: ReadingState; updated_at: string } | null };

        const localRaw = localStorage.getItem('lastReadingState');
        const localState: ReadingState | null = localRaw ? JSON.parse(localRaw) : null;
        const localTs = localState?.timestamp ?? 0;

        // Cloud timestamp: prefer the timestamp embedded in the state,
        // fall back to the row's updated_at column
        const cloudState = data?.state as ReadingState | null ?? null;
        const cloudTs = cloudState?.timestamp
          ?? (data?.updated_at ? new Date(data.updated_at).getTime() : 0);

        if (localTs > cloudTs) {
          // Local is newer (e.g. user read while offline) → push local to cloud
          if (localState) {
            await supabase
              .from('user_reading_position')
              .upsert({ user_id: user.id, state: localState as any, updated_at: new Date().toISOString() } as any);
          }
          setResolvedState(localState);
        } else if (cloudTs > localTs && cloudState) {
          // Cloud is newer → update localStorage and use cloud state
          const withTs = { ...cloudState, timestamp: cloudTs };
          localStorage.setItem('lastReadingState', JSON.stringify(withTs));
          setResolvedState(withTs);
        } else {
          // Equal or no cloud data → keep local as-is
          setResolvedState(localState);
        }
      } catch {
        // Network error → just use whatever is in localStorage
        const localRaw = localStorage.getItem('lastReadingState');
        setResolvedState(localRaw ? JSON.parse(localRaw) : null);
      }

      setSyncDone(true);
    })();
  }, [user?.id]);

  /**
   * Call this whenever the reading position changes.
   * Saves to localStorage immediately and debounces the cloud push.
   */
  const savePosition = useCallback((state: ReadingState) => {
    const withTs = { ...state, timestamp: Date.now() };
    localStorage.setItem('lastReadingState', JSON.stringify(withTs));

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const uid = userIdRef.current;
      if (!uid) return;
      try {
        await supabase
          .from('user_reading_position')
          .upsert({ user_id: uid, state: withTs, updated_at: new Date().toISOString() });
      } catch { /* silent */ }
    }, 2000);
  }, []);

  return { syncDone, resolvedState, savePosition };
}
