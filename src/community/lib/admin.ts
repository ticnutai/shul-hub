import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@community/integrations/supabase/client";
import { communityId } from "@/community/lib/community";
import { hebrewError } from "@community/lib/hebrewError";
import { confirmAction } from "@/components/ConfirmDialog";

type TableName =
  | "minyanim"
  | "minyan_categories"
  | "announcements"
  | "shiurim"
  | "shiur_categories"
  | "chavrutot"
  | "settings";

/** What can be deleted from a list in the gabbai's area. */
type DeletableTable =
  | Exclude<TableName, "settings">
  | "admin_messages"
  | "chavruta_requests"
  | "minyan_overrides";

export function useSaveRow(table: TableName, queryKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const { error } = row["id"]
        ? // Only a row of the synagogue being edited: an id from another one changes nothing.
          await supabase
            .from(table)
            .update(row as never)
            .eq("community_id", communityId())
            .eq("id", row["id"] as string)
        : // A new row belongs to the synagogue being edited. Without this
          // the column's default (the only active synagogue) put rows made in
          // another synagogue's admin into the main one.
          await supabase.from(table).insert({ community_id: communityId(), ...row } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success("נשמר");
    },
    onError: (e: Error) => toast.error(hebrewError(e, "השמירה נכשלה")),
  });
}

/**
 * Deleting a row from a list, one way for every list: only from the synagogue
 * being edited, the lists that show it refreshed, and "נמחק" said the same.
 * `queryKeys`: every cache that shows the row (a request is shown to the
 * gabbai and, once approved, on the site).
 */
export function useDeleteRow(
  table: DeletableTable,
  queryKeys: string | string[],
  options: { description?: string } = {},
) {
  const qc = useQueryClient();
  const keys = Array.isArray(queryKeys) ? queryKeys : [queryKeys];
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("community_id", communityId()).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all(keys.map((key) => qc.invalidateQueries({ queryKey: [key] })));
      toast.success("נמחק", options.description ? { description: options.description } : undefined);
    },
    onError: (e: Error) => toast.error(hebrewError(e, "המחיקה נכשלה")),
  });
}

/**
 * "למחוק את המודעה „…”?" - the one question before every delete in the
 * gabbai's area, worded the same everywhere: `noun` with its article
 * ("המודעה", "השיעור"), the row's own name, and that it cannot be undone
 * unless `description` says otherwise.
 */
export function confirmDelete(noun: string, name: string, description = "אי אפשר לבטל את זה."): Promise<boolean> {
  return confirmAction({
    title: `למחוק את ${noun} „${name}”?`,
    description,
    confirmLabel: "מחיקה",
  });
}
