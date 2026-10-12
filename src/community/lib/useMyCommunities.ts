/**
 * Two questions the gabbai's area asks in several places - which synagogues
 * this account runs, and whether it runs the whole system - asked once each,
 * under one cache key, instead of a copy of the query in every screen.
 *
 * Kept apart from community.ts on purpose: these are hooks over its plain
 * functions, and the functions are what the tests replace.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listMyCommunities } from "@/community/lib/community";

export function useMyCommunities() {
  return useQuery({ queryKey: ["my-communities"], queryFn: () => listMyCommunities() });
}

export function useIsPlatformAdmin(): boolean {
  const { data = false } = useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: async () => Boolean((await supabase.rpc("is_platform_admin")).data),
  });
  return data;
}
