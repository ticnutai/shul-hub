import { useEffect, useRef, useState } from "react";

/**
 * Keeps the last server response on disk so the display survives a reboot.
 *
 * React Query caches in memory only. A synagogue TV loses power, comes back
 * before the router does, and would otherwise show an empty screen for as long
 * as the network stays down — exactly when nobody is around to fix it. Writing
 * each successful response to localStorage lets the next boot paint real
 * times immediately and then correct itself once the network returns.
 */

const PREFIX = "shul-tv-snapshot:";

interface Stored<T> {
  savedAt: number;
  data: T;
}

export interface Snapshot<T> {
  /** Live data when available, otherwise the last persisted copy. */
  data: T | null;
  /** True when `data` came from disk and has not been confirmed this session. */
  isStale: boolean;
  /** When the shown data was fetched, live or persisted. */
  savedAt: Date | null;
}

function read<T>(key: string): Stored<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    if (typeof parsed?.savedAt !== "number") return null;
    return parsed;
  } catch {
    // Private mode, cleared site data, or a quota error. The display works
    // without persistence; it just starts empty after a reboot.
    return null;
  }
}

function write<T>(key: string, data: T): number | null {
  const savedAt = Date.now();
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt, data }));
    return savedAt;
  } catch {
    return null;
  }
}

/**
 * `enabled: false` is for the admin preview: it shows live data only and must
 * not read or overwrite the TV's persisted copy (they share an origin in dev).
 */
export function useOfflineSnapshot<T>(key: string, live: T | undefined, enabled = true): Snapshot<T> {
  const [fallback, setFallback] = useState(() => (enabled ? read<T>(key) : null));
  const [savedAt, setSavedAt] = useState<number | null>(fallback?.savedAt ?? null);

  /**
   * The key can change after the first render, and when it does the copy on
   * disk has to be looked up again.
   *
   * The board's own settings are stored per synagogue, and which synagogue a
   * screen belongs to is known one render later than the first paint. Reading
   * the disk only once meant that on a boot with no internet the board asked
   * for "the settings of no synagogue", found nothing, and came up in the
   * default colours and layout with the gabbai's whole design still sitting
   * on the disk unread - at precisely the moment nobody is there to fix it.
   */
  const lastKey = useRef(key);
  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    const next = enabled ? read<T>(key) : null;
    setFallback(next);
    setSavedAt(next?.savedAt ?? null);
  }, [key, enabled]);

  // Avoid rewriting an identical payload on every render; realtime refetches
  // are frequent and localStorage writes are synchronous.
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || live === undefined) return;
    const serialised = JSON.stringify(live);
    if (serialised === lastWritten.current) return;
    lastWritten.current = serialised;
    const at = write(key, live);
    setSavedAt(at ?? Date.now());
  }, [key, live, enabled]);

  if (live !== undefined) {
    return { data: live, isStale: false, savedAt: savedAt ? new Date(savedAt) : new Date() };
  }

  return {
    data: fallback?.data ?? null,
    isStale: fallback != null,
    savedAt: fallback ? new Date(fallback.savedAt) : null,
  };
}
