import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { supabase as typedClient } from "@/integrations/supabase/client";
import { normalizeTvConfig, type TvConfig } from "./config";
import { DeviceLink, type DeviceStatus } from "./device";
import { useOfflineSnapshot } from "./useOfflineSnapshot";

/**
 * Binds the TV to the control center: pairing status, the admin's board
 * config (live), and remote commands.
 *
 * The tv_* tables are newer than the generated Supabase types, which Lovable
 * regenerates on its own; an untyped client avoids hand-editing that file.
 */
const db = typedClient as unknown as SupabaseClient;

export interface TvCommand {
  id: number;
  device_id: string | null;
  command: "pause" | "resume" | "next" | "prev" | "goto" | "reload" | "theme" | "snapshot" | "message" | "identify";
  payload: Record<string, unknown>;
  created_at: string;
}

/** Commands older than this when they arrive (e.g. replayed after a reconnect) are ignored. */
const COMMAND_MAX_AGE_MS = 90_000;

const SEEN_KEY = "shul-tv-seen-commands";

function loadSeen(): Set<number> {
  try {
    const ids = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return new Set(Array.isArray(ids) ? ids.filter((n): n is number => typeof n === "number") : []);
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<number>) {
  try {
    // Ids only grow; the newest 100 cover far more than the 90 s replay window.
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].sort((a, b) => b - a).slice(0, 100)));
  } catch {
    /* no storage: the boot-time guard still stops the reload loop */
  }
}

export function useDeviceLink({
  getState,
  onCommand,
  device = true,
}: {
  getState: () => Record<string, unknown>;
  onCommand: (command: TvCommand, link: DeviceLink) => void;
  /**
   * false: follow the admin's config only, without registering as a screen.
   * Used by the board opened in a browser (/admin/tv-board), which must not
   * show up as an unpaired TV or count in the uptime reports.
   */
  device?: boolean;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const linkRef = useRef<DeviceLink | null>(null);

  // Latest callbacks without re-creating the link or the subscription.
  const getStateRef = useRef(getState);
  getStateRef.current = getState;
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;
  const approvedRef = useRef(false);
  approvedRef.current = Boolean(status?.approved);

  useEffect(() => {
    if (!device) return;
    const link = new DeviceLink(
      () => getStateRef.current(),
      (s) => setStatus(s),
      {
        version: __APP_VERSION__,
        userAgent: navigator.userAgent.slice(0, 200),
        screen: `${screen.width}x${screen.height}@${devicePixelRatio}`,
        language: navigator.language,
      },
    );
    linkRef.current = link;
    link.start();
    return () => {
      link.stop();
      linkRef.current = null;
    };
  }, [device]);

  // ------------------------------------------------------------- config --
  const configQuery = useQuery({
    queryKey: ["tv_config"],
    queryFn: async () => {
      const { data, error } = await db.from("tv_config").select("config, updated_at").eq("id", "default").maybeSingle();
      if (error) throw error;
      return (data ?? null) as { config: unknown; updated_at: string } | null;
    },
  });
  // Kept on the device like the rest of the board's data, so a TV that boots
  // without internet still comes up in the admin's chosen design.
  const configSnap = useOfflineSnapshot("tv_config", configQuery.data ?? undefined);
  const config = useMemo<TvConfig>(() => normalizeTvConfig(configSnap.data?.config), [configSnap.data]);
  const configUpdatedAt = configSnap.data?.updated_at ?? null;

  // ---------------------------------------- realtime: config + commands --
  useEffect(() => {
    // Commands already run, kept across restarts. On reconnect the last 90 s
    // of commands are fetched again; without this a "reload" re-ran after
    // every reload (a loop for 90 s), and messages / snapshots repeated.
    const seen = loadSeen();
    const bootAt = Date.now();
    let channel: RealtimeChannel | null = null;
    let retry: number | undefined;
    let disposed = false;

    const handle = (row: TvCommand, retried = false) => {
      const link = linkRef.current;
      if (!link || seen.has(row.id)) return;
      seen.add(row.id);
      saveSeen(seen);
      if (row.device_id && row.device_id !== link.id) return;
      const createdAt = new Date(row.created_at).getTime();
      if (Date.now() - createdAt > COMMAND_MAX_AGE_MS) return;
      // A reload sent before this start is the one that caused it (belt and
      // braces, for when the storage write above was lost with the process).
      if (row.command === "reload" && createdAt < bootAt) return;
      if (!approvedRef.current) {
        // A command addressed to this very screen while it still believes it
        // is unpaired means the admin has just paired it. Without this the TV
        // kept showing the pairing code for up to a minute (next heartbeat).
        // Report in now, learn the approval, then run the command once.
        if (row.device_id === link.id && !retried) {
          link.reportNow();
          window.setTimeout(() => {
            seen.delete(row.id);
            handle(row, true);
          }, 2500);
        }
        return;
      }
      onCommandRef.current(row, link);
    };

    const connect = () => {
      if (disposed) return;
      const next = db.channel(`tv-device-${Date.now()}`);
      next
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "tv_commands" }, (p) =>
          handle(p.new as TvCommand),
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "tv_config" }, () =>
          void queryClient.invalidateQueries({ queryKey: ["tv_config"] }),
        )
        .subscribe(async (state) => {
          // Only the current channel may act. A channel we removed on purpose
          // still reports CLOSED, and treating that as a failure scheduled a
          // second connection - channels multiplied with every reconnect.
          if (disposed || next !== channel) return;
          if (state === "SUBSCRIBED") {
            // Catch up on anything sent while the socket was down.
            void queryClient.invalidateQueries({ queryKey: ["tv_config"] });
            const since = new Date(Date.now() - COMMAND_MAX_AGE_MS).toISOString();
            const { data } = await db.from("tv_commands").select("*").gte("created_at", since).order("id");
            for (const row of (data ?? []) as TvCommand[]) handle(row);
          } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
            channel = null;
            void db.removeChannel(next);
            window.clearTimeout(retry);
            retry = window.setTimeout(connect, 5000);
          }
        });
      channel = next;
    };
    connect();

    const onOnline = () => {
      window.clearTimeout(retry);
      const old = channel;
      channel = null; // detach first, so its CLOSED report is ignored
      if (old) void db.removeChannel(old);
      connect();
    };
    window.addEventListener("online", onOnline);
    return () => {
      disposed = true;
      window.removeEventListener("online", onOnline);
      window.clearTimeout(retry);
      if (channel) void db.removeChannel(channel);
    };
  }, [queryClient]);

  return { status, link: linkRef, config, configUpdatedAt };
}
