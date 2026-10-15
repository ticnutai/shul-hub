/**
 * The library shared by every board (tv_library_items) and the gabbai's own
 * order of it (tv_library_order) - the migration 20261015120000_tv_library.
 *
 * Items: kits and parts kept once, worn by any board (a board keeps its own
 * copy of what it wears, so a TV never reads this). The order - folders,
 * places, tags, favourites - is the gabbai's, the same on every board they
 * edit; until they have one, the board's own (config.library) is read, and
 * the first change writes it as theirs. Both are written at once, not with
 * the board's "שמור ושדר".
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { normalizeLibrary, type Library } from "@/tv/library";

export interface TvLibraryItem {
  id: string;
  kind: "kit" | "part";
  name: string;
  data: unknown;
  created_by: string | null;
}

// The tables are newer than the generated types; their rows are read as above.
const items = () => supabase.from("tv_library_items" as never);
const order = () => supabase.from("tv_library_order" as never);
const ITEMS = ["tv_library_items"];
const ORDER = ["tv_library_order"];

/** An item of the shared library, as the boards' libraries call it. */
export const sharedId = (id: string) => `lib:${id}`;

export function useTvLibraryItems() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ITEMS,
    queryFn: async () => {
      const { data, error } = await items().select("id,kind,name,data,created_by").order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as TvLibraryItem[];
    },
    staleTime: 60_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ITEMS });

  /** Kept for every board: a copy of the kit or the parts, under a name. */
  const add = async (kind: TvLibraryItem["kind"], name: string, data: unknown): Promise<boolean> => {
    const { error } = await items().insert({ kind, name: name.trim().slice(0, 80), data } as never).select("id");
    if (error) return toast.error(`לא נשמר בספרייה המשותפת: ${error.message}`), false;
    await refresh();
    toast.success(`"${name}" נשמר בספרייה המשותפת - זמין עכשיו בכל הלוחות.`);
    return true;
  };

  /** Taken out of the library: boards that wear it keep their own copy. Only its keeper (or the platform's admin) may. */
  const remove = async (item: TvLibraryItem): Promise<boolean> => {
    const { data, error } = await items().delete().eq("id", item.id).select("id");
    if (error || !(data as unknown[] | null)?.length) return toast.error(error?.message ?? "רק מי ששמר את הפריט יכול למחוק אותו"), false;
    await refresh();
    return true;
  };

  /** Kept again with what is given now (a kit updated to the board), or renamed. */
  const update = async (item: TvLibraryItem, patch: { name?: string; data?: unknown }): Promise<boolean> => {
    const { data, error } = await items().update(patch as never).eq("id", item.id).select("id");
    if (error || !(data as unknown[] | null)?.length) return toast.error(error?.message ?? "רק מי ששמר את הפריט יכול לשנות אותו"), false;
    await refresh();
    return true;
  };

  return { items: query.data ?? [], ready: query.isSuccess, add, remove, update };
}

/**
 * The gabbai's order of the library: theirs when they have one; until then
 * null, and the board's own is read. `save` writes it at once (and shows it
 * at once, before the database answers).
 */
export function useTvLibraryOrder() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ORDER,
    queryFn: async () => {
      const { data, error } = await order().select("library").limit(1);
      if (error) throw error;
      const row = (data as unknown as Array<{ library: unknown }> | null)?.[0];
      return row ? normalizeLibrary(row.library) : null;
    },
    staleTime: Infinity,
  });
  const save = async (next: Library) => {
    queryClient.setQueryData(ORDER, next);
    const { data: session } = await supabase.auth.getSession();
    const user = session.session?.user.id;
    const { error } = await order().upsert({ ...(user ? { user_id: user } : {}), library: next } as never, { onConflict: "user_id" });
    if (error) toast.error(`סדר הספרייה לא נשמר: ${error.message}`);
  };
  /** What it is this moment (a change made a moment ago included). */
  const current = () => queryClient.getQueryData<Library | null>(ORDER) ?? null;
  return { order: query.data ?? null, ready: query.isSuccess, save, current };
}
