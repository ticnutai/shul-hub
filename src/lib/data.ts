import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Settings = Tables<"settings">;
export type Minyan = Tables<"minyanim">;
export type Announcement = Tables<"announcements">;
export type Shiur = Tables<"shiurim">;
export type ShiurCategory = Tables<"shiur_categories">;
export type Chavruta = Tables<"chavrutot">;
export type AdminMessage = Tables<"admin_messages">;

export const DAY_TYPES = [
  { id: "weekday", label: "ימות החול" },
  { id: "friday", label: "ערב שבת" },
  { id: "shabbat", label: "שבת" },
] as const;

export const PRAYERS = [
  { id: "shacharit", label: "שחרית" },
  { id: "mincha", label: "מנחה" },
  { id: "arvit", label: "ערבית" },
  { id: "other", label: "אחר" },
] as const;

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
