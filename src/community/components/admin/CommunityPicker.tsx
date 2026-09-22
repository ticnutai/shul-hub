/**
 * Which synagogue this admin is editing, when they run more than one.
 *
 * A gabbai of one synagogue never sees this - there is nothing to choose,
 * and a control that always says the same thing is a control that gets
 * clicked by accident. It appears only for someone who administers
 * several, and then it is the most important thing on the page: every
 * edit below it lands in whichever one this says.
 *
 * Changing it empties the cache rather than filtering it. A list of
 * minyanim left over from the previous synagogue, shown for the half
 * second before the new one arrives, is exactly the confusion this whole
 * design exists to prevent.
 */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { type Community, setCommunity, useCommunityId } from "@/community/lib/community";

export function CommunityPicker() {
  const queryClient = useQueryClient();
  const current = useCommunityId();
  const [mine, setMine] = useState<Community[]>([]);

  useEffect(() => {
    let alive = true;
    // The server decides what this account may administer; a list built in
    // the browser would only be a suggestion.
    void supabase
      .rpc("my_communities")
      .then(({ data }) => alive && setMine((data ?? []) as Community[]));
    return () => {
      alive = false;
    };
  }, []);

  if (mine.length < 2) return null;

  return (
    <div className="flex items-center gap-2">
      <Building2 className="size-4 shrink-0 text-muted-foreground" />
      <Select
        value={current ?? undefined}
        onValueChange={(id) => {
          const next = mine.find((c) => c.id === id);
          if (!next) return;
          setCommunity(next);
          queryClient.clear();
        }}
      >
        <SelectTrigger className="h-9 w-56" aria-label="בית הכנסת שבעריכה">
          <SelectValue placeholder="בחירת בית כנסת" />
        </SelectTrigger>
        <SelectContent>
          {mine.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
