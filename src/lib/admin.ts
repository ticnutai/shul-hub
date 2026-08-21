import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type TableName =
  | "minyanim"
  | "minyan_categories"
  | "announcements"
  | "shiurim"
  | "shiur_categories"
  | "chavrutot"
  | "settings";

export function useSaveRow(table: TableName, queryKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const { error } = row["id"]
        ? await supabase
            .from(table)
            .update(row as never)
            .eq("id", row["id"] as string)
        : await supabase.from(table).insert(row as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success("נשמר בהצלחה");
    },
    onError: (e: Error) => toast.error(e.message || "השמירה נכשלה"),
  });
}

export function useDeleteRow(table: TableName, queryKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success("נמחק");
    },
    onError: (e: Error) => toast.error(e.message || "המחיקה נכשלה"),
  });
}
