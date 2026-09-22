/**
 * Every synagogue on the system, for whoever runs the system.
 *
 * The switcher at the top of the page answers "which one am I editing?". This
 * answers the questions above it: which synagogues exist, which of them the
 * public can see, and whether each actually has anything in it.
 *
 * That last column is the point. "Switched on with no minyanim" is a real
 * state, it is the state that puts an empty board on a wall, and nothing else
 * in the system will ever mention it - the board says "לא הוגדרו מניינים
 * להיום", which is true, and nobody sees it until they walk into that shul.
 * Here it is a number next to the switch that would open it.
 *
 * Opening one is deliberate on purpose. While a single synagogue is live the
 * public site is that synagogue; the moment a second one is, every visitor is
 * asked which they came for. That is a change to what everybody sees, made by
 * flicking one switch, so the switch says so before it is flicked.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Eye, EyeOff, Loader2, MonitorSmartphone, Plus, ScrollText } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  setCommunity,
  useCommunityId,
  writeCommunityToUrl,
} from "@/community/lib/community";

interface Overview {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  screens: number;
  minyanim: number;
  announcements: number;
}

export function CommunitiesAdmin() {
  const queryClient = useQueryClient();
  const currentId = useCommunityId();
  const [newName, setNewName] = useState("");
  const [about, setAbout] = useState<Overview | null>(null);

  const { data: all = [], isLoading } = useQuery({
    queryKey: ["communities-overview"],
    queryFn: async (): Promise<Overview[]> => {
      const { data, error } = await supabase.rpc("communities_overview");
      if (error) throw error;
      return (data ?? []) as Overview[];
    },
  });

  const { data: isPlatformAdmin = false } = useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_platform_admin");
      return Boolean(data);
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["communities-overview"] });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.rpc("create_community", { p_name: name });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("בית הכנסת נוסף - כבוי, כדי שאפשר יהיה להכין אותו לפני שפותחים");
      setNewName("");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("communities").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, { active }) => {
      toast.success(active ? "בית הכנסת נפתח לציבור" : "בית הכנסת נסגר לציבור");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const live = all.filter((c) => c.active).length;

  const manage = (c: Overview) => {
    if (c.id === currentId) return;
    setCommunity({ id: c.id, slug: c.slug, name: c.name, active: c.active });
    writeCommunityToUrl(c.slug);
    queryClient.clear();
    toast.success(`עכשיו עורכים את ${c.name}`);
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold">בתי הכנסת</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {live === 1
            ? "בית כנסת אחד פתוח לציבור, ולכן האתר הוא בית הכנסת הזה. ברגע שייפתח שני, כל מבקר יישאל לאיזה בית כנסת הוא הגיע."
            : `${live} בתי כנסת פתוחים לציבור, ולכן האתר מציג בחירה לכל מבקר.`}
        </p>
      </header>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> טוען…
        </p>
      ) : (
        <ul className="space-y-2">
          {all.map((c) => {
            const here = c.id === currentId;
            const emptyButOpen = c.active && c.minyanim === 0;
            return (
              <li
                key={c.id}
                className={`card-elev flex flex-wrap items-center gap-3 p-3 sm:p-4 ${
                  here ? "ring-2 ring-primary" : ""
                }`}
              >
                <Building2 className="size-5 shrink-0 text-muted-foreground" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{c.name}</span>
                    {here && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        בעריכה עכשיו
                      </span>
                    )}
                    {c.active ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                        <Eye className="size-3" /> פתוח לציבור
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <EyeOff className="size-3" /> כבוי
                      </span>
                    )}
                  </div>

                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>{c.slug}</span>
                    <span className="flex items-center gap-1">
                      <MonitorSmartphone className="size-3" /> {c.screens} מסכים
                    </span>
                    <span className="flex items-center gap-1">
                      <ScrollText className="size-3" /> {c.minyanim} מניינים
                    </span>
                  </div>

                  {emptyButOpen && (
                    <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                      פתוח לציבור ואין בו מניינים - הלוח שלו יראה ״לא הוגדרו מניינים להיום״.
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" variant={here ? "secondary" : "outline"} disabled={here} onClick={() => manage(c)}>
                    {here ? "נערך כאן" : "לערוך את זה"}
                  </Button>
                  {isPlatformAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => (c.active ? setActive.mutate({ id: c.id, active: false }) : setAbout(c))}
                    >
                      {c.active ? "לסגור" : "לפתוח לציבור"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isPlatformAdmin && (
        <form
          className="card-elev flex flex-wrap items-end gap-3 p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) create.mutate(newName.trim());
          }}
        >
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor="new-community" className="text-sm">
              בית כנסת חדש
            </Label>
            <Input
              id="new-community"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="שם בית הכנסת"
              className="mt-1"
            />
          </div>
          <Button type="submit" disabled={!newName.trim() || create.isPending}>
            <Plus className="size-4" /> הוספה
          </Button>
          <p className="w-full text-[11px] text-muted-foreground">
            נוצר כבוי. אפשר להכין אותו, לצמד לו מסך ולראות אותו על הקיר - ורק אז לפתוח לציבור.
          </p>
        </form>
      )}

      <AlertDialog open={Boolean(about)} onOpenChange={(o) => !o && setAbout(null)}>
        <AlertDialogContent dir="rtl" className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>לפתוח את {about?.name} לציבור?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {live === 1
                  ? "מהרגע שיהיו שני בתי כנסת פתוחים, האתר הציבורי יפסיק להיות בית כנסת אחד ויתחיל לשאול כל מבקר לאן הוא הגיע."
                  : "בית הכנסת יתווסף לרשימה שכל מבקר רואה."}
              </span>
              {about?.minyanim === 0 && (
                <span className="block font-medium text-amber-700 dark:text-amber-400">
                  אין בו מניינים, אז הלוח שלו יהיה ריק.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (about) setActive.mutate({ id: about.id, active: true });
                setAbout(null);
              }}
            >
              לפתוח לציבור
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
