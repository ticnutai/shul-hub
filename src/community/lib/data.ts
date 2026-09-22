import { useQuery } from "@tanstack/react-query";
import { supabase } from "@community/integrations/supabase/client";
import type { Tables } from "@community/integrations/supabase/types";
import { communityId, useCommunityId } from "@/community/lib/community";

export type Settings = Tables<"settings">;
export type Minyan = Tables<"minyanim">;
export type MinyanCategory = Tables<"minyan_categories">;
export type MinyanSubcategory = { id: string; label: string };
export type Announcement = Tables<"announcements">;
export type Shiur = Tables<"shiurim">;
export type ShiurCategory = Tables<"shiur_categories">;
export type Chavruta = Tables<"chavrutot">;
export type ChavrutaRequest = Tables<"chavruta_requests">;
export type ApprovedChavrutaRequest = Omit<ChavrutaRequest, "share_contact" | "status">;
export type AdminMessage = Tables<"admin_messages">;

export const DAY_TYPES = [
  { id: "weekday", label: "ימות החול" },
  { id: "friday", label: "יום שישי" },
] as const;

export const PRAYERS = [
  { id: "shacharit", label: "שחרית" },
  { id: "mincha", label: "מנחה" },
  { id: "arvit", label: "ערבית" },
  { id: "other", label: "אחר" },
] as const;

export function minyanSubcategories(category?: MinyanCategory | null): MinyanSubcategory[] {
  if (!category || !Array.isArray(category.subcategories)) return [];
  return category.subcategories.filter(
    (item): item is MinyanSubcategory =>
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "label" in item &&
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      item.id.trim().length > 0 &&
      item.label.trim().length > 0,
  );
}

/**
 * Hebrew label for a minyan's prayer.
 *
 * A category's own subcategories take priority, since an admin may rename a
 * prayer for that category. When the category does not list the prayer — a
 * "סליחות" row stored as `other` under the Friday category, for instance —
 * the built-in PRAYERS labels are used, so the raw id ("other", "shacharit")
 * never reaches the page.
 */
export function prayerLabel(subcategories: MinyanSubcategory[], prayer: string): string {
  return (
    subcategories.find((item) => item.id === prayer)?.label ??
    PRAYERS.find((item) => item.id === prayer)?.label ??
    prayer
  );
}

export const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function useSettings() {
  const community = useCommunityId();
  return useQuery({
    queryKey: ["settings", community],
    enabled: Boolean(community),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("community_id", communityId())
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMinyanim() {
  const community = useCommunityId();
  return useQuery({
    queryKey: ["minyanim", community],
    enabled: Boolean(community),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("minyanim")
        .select("*")
        .eq("community_id", communityId())
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMinyanCategories() {
  const community = useCommunityId();
  return useQuery({
    queryKey: ["minyan_categories", community],
    enabled: Boolean(community),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("minyan_categories")
        .select("*")
        .eq("community_id", communityId())
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAnnouncements() {
  const community = useCommunityId();
  return useQuery({
    queryKey: ["announcements", community],
    enabled: Boolean(community),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("community_id", communityId())
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useShiurim() {
  const community = useCommunityId();
  return useQuery({
    queryKey: ["shiurim", community],
    enabled: Boolean(community),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shiurim")
        .select("*")
        .eq("community_id", communityId())
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useShiurCategories() {
  const community = useCommunityId();
  return useQuery({
    queryKey: ["shiur_categories", community],
    enabled: Boolean(community),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shiur_categories")
        .select("*")
        .eq("community_id", communityId())
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useChavrutot() {
  const community = useCommunityId();
  return useQuery({
    queryKey: ["chavrutot", community],
    enabled: Boolean(community),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chavrutot")
        .select("*")
        .eq("community_id", communityId())
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useApprovedChavrutaRequests() {
  const community = useCommunityId();
  return useQuery({
    queryKey: ["approved_chavruta_requests", community],
    enabled: Boolean(community),
    queryFn: async () => {
      // The one public read a policy cannot scope: the table is closed to
      // the public and this function hands out the approved rows past it,
      // so it has to be told which synagogue is being asked about.
      const { data, error } = await supabase.rpc("list_approved_chavruta_requests", {
        p_community: communityId(),
      });
      if (error) throw error;
      return (data ?? []) as ApprovedChavrutaRequest[];
    },
  });
}

export function useAdminChavrutaRequests() {
  const community = useCommunityId();
  return useQuery({
    queryKey: ["admin_chavruta_requests", community],
    enabled: Boolean(community),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chavruta_requests")
        .select("*")
        .eq("community_id", communityId())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminMessages() {
  const community = useCommunityId();
  return useQuery({
    queryKey: ["admin_messages", community],
    enabled: Boolean(community),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_messages")
        .select("*")
        .eq("community_id", communityId())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type HomeWidget = Tables<"home_widgets">;

export function useHomeWidgets() {
  const community = useCommunityId();
  return useQuery({
    queryKey: ["home_widgets", community],
    enabled: Boolean(community),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_widgets")
        .select("*")
        .eq("community_id", communityId())
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}
