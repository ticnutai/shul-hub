import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@community/integrations/supabase/client";

/**
 * Live synchronisation for community data.
 *
 * Until now every screen read its data once, when it mounted. That is fine for
 * a phone that gets reopened, but it is wrong for the synagogue TV, which stays
 * on the same page for weeks: a gabbai changing a prayer time would never reach
 * the wall. This subscribes to the Postgres change feed and lets React Query
 * refetch the affected list.
 */

/** Table -> the React Query key that caches it (see `data.ts`). */
const TABLE_QUERY_KEYS = {
  settings: "settings",
  minyanim: "minyanim",
  minyan_categories: "minyan_categories",
  announcements: "announcements",
  shiurim: "shiurim",
  shiur_categories: "shiur_categories",
  chavrutot: "chavrutot",
  home_widgets: "home_widgets",
  // One-day exceptions (data.ts caches them as "minyan-overrides").
  minyan_overrides: "minyan-overrides",
} as const;

export type SyncedTable = keyof typeof TABLE_QUERY_KEYS;

export const ALL_SYNCED_TABLES = Object.keys(TABLE_QUERY_KEYS) as SyncedTable[];

export type SyncStatus =
  /** Opening the socket, or reopening it after it dropped. */
  | "connecting"
  /** Subscribed. Edits made anywhere reach this screen within a second. */
  | "live"
  /** No change feed. Cached data is still shown; a retry is scheduled. */
  | "offline";

export interface RealtimeSyncState {
  status: SyncStatus;
  /** When data last arrived from the server, or null before the first load. */
  lastSyncedAt: Date | null;
}

/**
 * A missed change event would otherwise persist until the page is reloaded,
 * which on a wall-mounted screen may be never. Refetch periodically regardless
 * of the socket so the display is self-healing.
 */
const SAFETY_REFETCH_MS = 5 * 60 * 1000;

/** Reconnect backoff, capped so a long outage still retries every 30s. */
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30_000;

export function useRealtimeSync(tables: SyncedTable[] = ALL_SYNCED_TABLES): RealtimeSyncState {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Keep the table list stable across renders so callers can pass an inline
  // array without tearing down the subscription on every render.
  const tableKey = tables.join(",");

  useEffect(() => {
    const watched = tableKey.split(",").filter(Boolean) as SyncedTable[];
    if (watched.length === 0) return;

    let channel: RealtimeChannel | null = null;
    let retryTimer: number | undefined;
    let attempt = 0;
    let disposed = false;

    const refetch = (table: SyncedTable) => {
      void queryClient.invalidateQueries({ queryKey: [TABLE_QUERY_KEYS[table]] });
      setLastSyncedAt(new Date());
    };

    const refetchAll = () => {
      for (const table of watched) {
        void queryClient.invalidateQueries({ queryKey: [TABLE_QUERY_KEYS[table]] });
      }
      setLastSyncedAt(new Date());
    };

    const scheduleRetry = () => {
      if (disposed || retryTimer !== undefined) return;
      const delay = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
      attempt += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        connect();
      }, delay);
    };

    const connect = () => {
      if (disposed) return;
      setStatus("connecting");

      // A fresh channel name per attempt avoids reusing a socket that the
      // server already considers dead after a network drop.
      const next = supabase.channel(`community-sync-${Date.now()}`);

      for (const table of watched) {
        next.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => refetch(table),
        );
      }

      next.subscribe((state) => {
        // Ignore reports from a channel that has since been replaced: a
        // channel removed on purpose (see onOnline) still reports CLOSED, and
        // acting on it flashed "offline" and opened a second connection.
        if (disposed || next !== channel) return;
        if (state === "SUBSCRIBED") {
          attempt = 0;
          setStatus("live");
          // The socket may have been down long enough to miss edits, so treat
          // every (re)connection as a reason to reread everything.
          refetchAll();
          return;
        }
        if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          channel = null;
          setStatus("offline");
          void supabase.removeChannel(next);
          scheduleRetry();
        }
      });

      channel = next;
    };

    connect();

    const safety = window.setInterval(refetchAll, SAFETY_REFETCH_MS);

    // Coming back from a dropped Wi-Fi link should not wait out the backoff.
    const onOnline = () => {
      attempt = 0;
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      const old = channel;
      channel = null; // detach first, so its CLOSED report is ignored
      if (old) void supabase.removeChannel(old);
      connect();
    };
    window.addEventListener("online", onOnline);

    return () => {
      disposed = true;
      window.removeEventListener("online", onOnline);
      window.clearInterval(safety);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient, tableKey]);

  return { status, lastSyncedAt };
}

/** Keeps a `Date` ticking so "updated N minutes ago" stays honest on a TV. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  const ref = useRef(intervalMs);
  ref.current = intervalMs;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ref.current);
    return () => window.clearInterval(id);
  }, []);

  return now;
}
