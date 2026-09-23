/**
 * "היום מנחה ב-13:00" - said once, for one day, without touching the timetable.
 *
 * The timetable is the regular week and should stay that way. Until now the
 * only way to move a minyan for a single day was to edit the minyan itself,
 * which changes every other day too, and then to remember to change it back.
 * Nobody remembers to change it back: a board quietly carries last week's
 * exception for a month, and the people who rely on it stop believing it.
 *
 * So an exception is a dated row. It expires by being about a date, it shows
 * on the board as an exception rather than as the new normal, and a
 * synagogue that never uses this never sees any difference.
 *
 * Nothing here is required. No rows is the ordinary state of this panel.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@community/integrations/supabase/client";
import { communityId, useCommunityId } from "@/community/lib/community";
import { useMinyanim, type MinyanOverrideRow } from "@community/lib/data";
import { DAY_TYPE_LABEL, jerusalemDateKey } from "@community/lib/minyan-time";

/** Today and the next fortnight: far enough to plan, near enough to mean it. */
const HORIZON_DAYS = 14;

function addDays(key: string, days: number): string {
  const d = new Date(key + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function hebrewDay(key: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(key + "T12:00:00Z"));
}

export function MinyanOverridesAdmin() {
  const community = useCommunityId();
  const queryClient = useQueryClient();
  const { data: minyanim = [] } = useMinyanim();
  const today = jerusalemDateKey(new Date());

  const [minyanId, setMinyanId] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const [note, setNote] = useState("");

  const { data: overrides = [], isLoading } = useQuery({
    queryKey: ["minyan-overrides-admin", community],
    enabled: Boolean(community),
    queryFn: async (): Promise<MinyanOverrideRow[]> => {
      const { data, error } = await supabase
        .from("minyan_overrides")
        .select("id, minyan_id, on_date, at_time, cancelled, note")
        .eq("community_id", communityId())
        .gte("on_date", today)
        .order("on_date");
      if (error) throw error;
      return (data ?? []) as unknown as MinyanOverrideRow[];
    },
  });

  const byId = useMemo(() => new Map(minyanim.map((m) => [m.id, m])), [minyanim]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["minyan-overrides-admin", community] });
    // The board and the website read their own copy.
    void queryClient.invalidateQueries({ queryKey: ["minyan-overrides", community] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("minyan_overrides")
        // One row per minyan per day: saying it twice replaces it rather than
        // leaving the board with two answers.
        .upsert(
          {
            community_id: communityId(),
            minyan_id: minyanId,
            on_date: date,
            at_time: time ? `${time}:00` : null,
            cancelled,
            note: note.trim(),
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "minyan_id,on_date" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("השינוי נשמר ליום הזה בלבד");
      setTime("");
      setCancelled(false);
      setNote("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("minyan_overrides").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("השינוי בוטל - המניין חוזר ללוח הרגיל");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // A row that changes nothing is a row somebody will later read as meaning
  // something; the database refuses it too.
  const saysSomething = cancelled || Boolean(time) || note.trim().length > 0;
  const canSave = Boolean(minyanId) && Boolean(date) && saysSomething && !save.isPending;

  return (
    <section className="card-elev space-y-4 p-4 sm:p-5" data-testid="minyan-overrides">
      <header>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="size-4" /> שינוי ליום אחד
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          להזיז או לבטל מניין ביום מסוים, בלי לשנות את הלוח הקבוע. אחרי אותו יום הכול חוזר מעצמו.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Label className="text-sm">המניין</Label>
          <Select value={minyanId} onValueChange={setMinyanId}>
            <SelectTrigger className="mt-1" aria-label="בחירת מניין">
              <SelectValue placeholder="בחירת מניין" />
            </SelectTrigger>
            <SelectContent>
              {minyanim
                .filter((m) => m.active)
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                    <span className="text-muted-foreground">
                      {" · "}
                      {DAY_TYPE_LABEL[m.day_type as "weekday" | "friday"] ?? m.day_type}
                      {m.fixed_time ? ` · ${m.fixed_time.slice(0, 5)}` : ""}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="ov-date" className="text-sm">התאריך</Label>
          <Input
            id="ov-date"
            type="date"
            className="mt-1"
            value={date}
            min={today}
            max={addDays(today, HORIZON_DAYS * 6)}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="ov-time" className="text-sm">
            השעה ביום הזה
          </Label>
          <Input
            id="ov-time"
            type="time"
            className="mt-1"
            value={time}
            disabled={cancelled && !time}
            onChange={(e) => setTime(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">ריק = נשארת השעה הרגילה</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={cancelled} onCheckedChange={(v) => setCancelled(v === true)} />
          אין מניין ביום הזה
        </label>
        <div>
          <Label htmlFor="ov-note" className="text-sm">הערה (לא חובה)</Label>
          <Input
            id="ov-note"
            className="mt-1"
            value={note}
            maxLength={80}
            placeholder="למשל: היום בבית מדרש"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!canSave} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          שמירת השינוי
        </Button>
        {minyanId && !saysSomething && (
          <p className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
            <TriangleAlert className="size-3.5" />
            צריך לומר משהו: שעה אחרת, ביטול, או הערה.
          </p>
        )}
      </div>

      <div className="border-t pt-3">
        <h4 className="text-sm font-medium">שינויים קרובים</h4>
        {isLoading ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> טוען…
          </p>
        ) : overrides.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            אין שינויים. הלוח הרגיל תקף בכל יום.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {overrides.map((o) => {
              const m = byId.get(o.minyan_id);
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{m?.label ?? "מניין שנמחק"}</span>
                  <span className="text-muted-foreground">{hebrewDay(o.on_date)}</span>
                  {o.cancelled ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      אין מניין
                    </span>
                  ) : o.at_time ? (
                    <span className="font-semibold">{o.at_time.slice(0, 5)}</span>
                  ) : null}
                  {o.note && <span className="text-muted-foreground">״{o.note}״</span>}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ms-auto"
                    aria-label="ביטול השינוי"
                    title="ביטול השינוי - חזרה ללוח הרגיל"
                    onClick={() => remove.mutate(o.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
