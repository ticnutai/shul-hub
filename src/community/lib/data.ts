import { useQuery } from "@tanstack/react-query";
import { supabase } from "@community/integrations/supabase/client";
import type { Tables } from "@community/integrations/supabase/types";

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

export const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMinyanim() {
  return useQuery({
    queryKey: ["minyanim"],
    queryFn: async () => {
      const { data, error } = await supabase.from("minyanim").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMinyanCategories() {
  return useQuery({
    queryKey: ["minyan_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("minyan_categories")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useShiurim() {
  return useQuery({
    queryKey: ["shiurim"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shiurim").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useShiurCategories() {
  return useQuery({
    queryKey: ["shiur_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shiur_categories")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useChavrutot() {
  return useQuery({
    queryKey: ["chavrutot"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chavrutot").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useApprovedChavrutaRequests() {
  return useQuery({
    queryKey: ["approved_chavruta_requests"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_approved_chavruta_requests");
      if (error) throw error;
      return (data ?? []) as ApprovedChavrutaRequest[];
    },
  });
}

export function useAdminChavrutaRequests() {
  return useQuery({
    queryKey: ["admin_chavruta_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chavruta_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminMessages() {
  return useQuery({
    queryKey: ["admin_messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type HomeWidget = Tables<"home_widgets">;

export function useHomeWidgets() {
  return useQuery({
    queryKey: ["home_widgets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("home_widgets").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}
