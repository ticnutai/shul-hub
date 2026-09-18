import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as typedClient } from "@community/integrations/supabase/client";
import { normalizeTvConfig, type TvConfig } from "@/tv/config";
import type { OutageReason } from "@/tv/device";
import { prepareTvImage } from "./tvImage";

/**
 * Admin-side access to the TV control center (tables from
 * 20260918160000_tv_control_center.sql). The tv_* tables are newer than the
 * generated Supabase types, which Lovable regenerates itself; an untyped
 * client keeps that file untouched.
 */
export const tvDb = typedClient as unknown as SupabaseClient;

/** 2.5 missed heartbeats (every 60 s) before a screen counts as disconnected. */
export const OFFLINE_AFTER_MS = 150_000;

export interface TvDeviceState {
  slideId?: string | null;
  slideKind?: string | null;
  slideIndex?: number;
  slideCount?: number;
  slideSeconds?: number;
  slideStartedAt?: number | null;
  elapsedMs?: number;
  slideIds?: string[];
  paused?: boolean;
  theme?: string;
  themeOverride?: string | null;
  cycle?: number;
  configUpdatedAt?: string | null;
  realtime?: string;
  stale?: boolean;
  version?: string;
  uptimeSec?: number;
  screen?: string;
}

export interface TvDevice {
  id: string;
  name: string;
  approved: boolean;
  approved_at: string | null;
  created_at: string;
  last_seen_at: string | null;
  last_boot_at: string | null;
  app_version: string | null;
  info: Record<string, unknown>;
  state: TvDeviceState;
}

export interface TvEvent {
  id: number;
  device_id: string;
  occurred_at: string;
  received_at: string;
  level: "info" | "warn" | "error";
  kind: string;
  message: string;
  details: {
    reasons?: OutageReason[];
    durationMs?: number;
    from?: string;
    to?: string;
    attempts?: number;
    [key: string]: unknown;
  };
}

export function deviceHealth(device: TvDevice, now: number) {
  const seen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
  const online = seen > 0 && now - seen < OFFLINE_AFTER_MS;
  return { online, lastSeen: seen ? new Date(seen) : null, silentMs: seen ? now - seen : null };
}

/* -------------------------------------------------------------- devices -- */

export function useTvDevices() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["tv_devices"],
    queryFn: async () => {
      const { data, error } = await tvDb
        .from("tv_devices")
        .select("id,name,approved,approved_at,created_at,last_seen_at,last_boot_at,app_version,info,state")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as TvDevice[];
    },
  });

  // Heartbeats and state reports arrive as UPDATEs; patch the cached row in
  // place so the live mirror follows the TV without refetching the list.
  useEffect(() => {
    const channel = tvDb
      .channel(`tv-admin-devices-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tv_devices" }, (p) => {
        if (p.eventType === "UPDATE") {
          queryClient.setQueryData<TvDevice[]>(["tv_devices"], (old) =>
            old?.map((d) => (d.id === (p.new as TvDevice).id ? { ...d, ...(p.new as TvDevice) } : d)),
          );
        } else {
          void queryClient.invalidateQueries({ queryKey: ["tv_devices"] });
        }
      })
      .subscribe();
    return () => {
      void tvDb.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useClaimDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, name }: { code: string; name: string }) => {
      const { data, error } = await tvDb.rpc("tv_claim", { p_code: code, p_name: name });
      if (error) throw error;
      const claimed = data as { id: string; name: string };
      // The TV still believes it is unpaired until its next report; a command
      // addressed to it makes it report now and show its new name.
      await sendCommand(claimed.id, "identify");
      return claimed;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tv_devices"] }),
  });
}

export async function renameDevice(id: string, name: string) {
  const { error } = await tvDb.from("tv_devices").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteDevice(id: string) {
  const { error } = await tvDb.from("tv_devices").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------- commands -- */

export type TvCommandName =
  | "pause"
  | "resume"
  | "next"
  | "prev"
  | "goto"
  | "reload"
  | "theme"
  | "snapshot"
  | "message"
  | "identify";

export async function sendCommand(deviceId: string | null, command: TvCommandName, payload: Record<string, unknown> = {}) {
  const { data: auth } = await tvDb.auth.getUser();
  const { error } = await tvDb
    .from("tv_commands")
    .insert({ device_id: deviceId, command, payload, created_by: auth.user?.id ?? null });
  if (error) throw error;
}

/**
 * Asks a TV for a real screenshot and waits for it. Snapshots are not on the
 * realtime feed (too large for a change event), so the row is polled.
 */
export async function requestSnapshot(deviceId: string, timeoutMs = 25_000): Promise<{ image: string; capturedAt: string }> {
  const askedAt = Date.now();
  await sendCommand(deviceId, "snapshot");
  while (Date.now() - askedAt < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500));
    const { data } = await tvDb
      .from("tv_snapshots")
      .select("image, captured_at")
      .eq("device_id", deviceId)
      .maybeSingle();
    // Allow for clock skew between this browser and the database.
    if (data && new Date(data.captured_at).getTime() > askedAt - 5000) {
      return { image: data.image as string, capturedAt: data.captured_at as string };
    }
  }
  throw new Error("המסך לא החזיר צילום בזמן. ייתכן שהוא מנותק.");
}

/* --------------------------------------------------------------- config -- */

export function useTvConfig() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["tv_config_admin"],
    queryFn: async () => {
      const { data, error } = await tvDb.from("tv_config").select("config, updated_at").eq("id", "default").maybeSingle();
      if (error) throw error;
      return { config: normalizeTvConfig(data?.config), updatedAt: (data?.updated_at as string) ?? null };
    },
  });
  const save = useMutation({
    mutationFn: async (config: TvConfig) => {
      const { data: auth } = await tvDb.auth.getUser();
      const { error } = await tvDb
        .from("tv_config")
        .update({ config, updated_at: new Date().toISOString(), updated_by: auth.user?.id ?? null })
        .eq("id", "default");
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tv_config_admin"] }),
  });
  return { ...query, save };
}

/* --------------------------------------------------------------- events -- */

export function useTvEvents(days: number) {
  const queryClient = useQueryClient();
  const since = useMemo(() => new Date(Date.now() - days * 86_400_000).toISOString(), [days]);
  const query = useQuery({
    queryKey: ["tv_events", days],
    queryFn: async () => {
      const { data, error } = await tvDb
        .from("tv_events")
        .select("*")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as TvEvent[];
    },
  });
  useEffect(() => {
    const channel = tvDb
      .channel(`tv-admin-events-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tv_events" }, () =>
        void queryClient.invalidateQueries({ queryKey: ["tv_events"] }),
      )
      .subscribe();
    return () => {
      void tvDb.removeChannel(channel);
    };
  }, [queryClient]);
  return query;
}

export interface UploadedTvImage {
  url: string;
  /** Set when the picture is too small to be sharp on the TV. */
  lowRes: { width: number; height: number } | null;
}

/**
 * Uploads an image for the board (slideshow / background) to the public media
 * bucket, first resampled for the TV (see tvImage.ts).
 */
export async function uploadTvImage(file: File): Promise<UploadedTvImage> {
  const image = await prepareTvImage(file);
  const path = `tv/${crypto.randomUUID()}.${image.extension}`;
  const { error } = await tvDb.storage
    .from("community-media")
    .upload(path, image.blob, { cacheControl: "31536000", upsert: false, contentType: image.blob.type || file.type });
  if (error) throw new Error(error.message || "העלאת התמונה נכשלה");
  return {
    url: tvDb.storage.from("community-media").getPublicUrl(path).data.publicUrl,
    lowRes: image.lowRes ? { width: image.sourceWidth, height: image.sourceHeight } : null,
  };
}
