import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@community/integrations/supabase/client";
import { communityId } from "@/community/lib/community";
import type { Minyan, MinyanCategory } from "@community/lib/data";
import {
  GROUP_LABELS,
  SPECIAL_DAYS,
  eventSystemKey,
  isEventCategory,
  nextDatesAll,
  type SpecialDayDef,
  type SpecialGroup,
} from "@community/lib/specialDays";

/**
 * "מועדים ואירועים": the special days of the Jewish year, each of which can
 * have a timetable of its own. Switching one on creates its minyan tab
 * (system_key "event:<key>"); on the day that tab replaces ימות החול / שבת on
 * the website and the board, every year again - the dates come from the
 * calendar, never from here.
 */

const GROUP_ORDER: SpecialGroup[] = ["noraim", "sukkot", "chanukah_purim", "pesach_shavuot", "fasts", "shabbatot", "other", "national"];

function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!, 12);
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

function whenText(key: string, now: Date, soon = false): string {
  const n = daysUntil(key, now);
  if (n === 0) return "היום";
  if (n === 1) return "מחר";
  return soon ? `עוד ${n} ימים` : `בעוד ${n} ימים`;
}

function daysUntil(key: string, now: Date): number {
  const [y, m, d] = key.split("-").map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y!, m! - 1, d!).getTime() - today.getTime()) / 86_400_000);
}

export function SpecialDaysAdmin({
  categories,
  minyanim,
  onOpen,
}: {
  categories: MinyanCategory[];
  minyanim: Minyan[];
  onOpen: (categoryId: string) => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);
  const next = useMemo(() => nextDatesAll(now), [now]);
  const upcoming = useMemo(
    () =>
      SPECIAL_DAYS.filter((d) => !d.national && next[d.key])
        .sort((a, b) => (next[a.key]! < next[b.key]! ? -1 : 1))
        .slice(0, 6),
    [next],
  );
  const own = (def: SpecialDayDef) => categories.find((c) => c.system_key === eventSystemKey(def.key));
  const ordinary = categories.filter((c) => !isEventCategory(c));

  const refresh = () => qc.invalidateQueries({ queryKey: ["minyan_categories"] });

  const create = async (def: SpecialDayDef) => {
    setBusy(def.key);
    const { data, error } = await supabase
      .from("minyan_categories")
      .insert({
        community_id: communityId(),
        name: def.name,
        system_key: eventSystemKey(def.key),
        active: true,
        display_mode: "tabs",
        sort_order: 500 + SPECIAL_DAYS.indexOf(def),
      } as never)
      .select("id")
      .single();
    setBusy(null);
    if (error || !data) {
      toast.error(error?.message ?? "היצירה נכשלה");
      return;
    }
    await refresh();
    toast.success(`נוצר: ${def.name}. עכשיו מוסיפים לו מניינים.`);
    onOpen((data as { id: string }).id);
  };

  const setActive = async (cat: MinyanCategory, active: boolean) => {
    setBusy(cat.id);
    const { error } = await supabase
      .from("minyan_categories")
      .update({ active } as never)
      .eq("id", cat.id)
      .eq("community_id", communityId());
    setBusy(null);
    if (error) toast.error(error.message);
    else await refresh();
  };

  const copyFrom = async (target: MinyanCategory, sourceId: string) => {
    const rows = minyanim.filter((m) => m.category_id === sourceId);
    if (rows.length === 0) {
      toast.error("אין מניינים בטאב הזה");
      return;
    }
    setBusy(target.id);
    const copies = rows.map(({ id: _id, created_at: _c, updated_at: _u, ...m }) => ({
      ...m,
      community_id: communityId(),
      category_id: target.id,
      day_type: "custom",
    }));
    const { error } = await supabase
      .from("minyanim")
      .insert(copies.map((c) => ({ ...c, community_id: communityId() })) as never);
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      await qc.invalidateQueries({ queryKey: ["minyanim"] });
      toast.success(`הועתקו ${copies.length} מניינים ל${target.name}`);
    }
  };

  const card = (def: SpecialDayDef) => {
    const cat = own(def);
    const count = cat ? minyanim.filter((m) => m.category_id === cat.id).length : 0;
    const date = next[def.key];
    return (
      <div key={def.key} className={`rounded-lg border p-3 ${cat?.active ? "border-primary/50 bg-primary/5" : ""}`} data-testid={`special-${def.key}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold">{def.name}</div>
            <div className="text-xs text-muted-foreground">
              {date ? `${formatDay(date)} · ${whenText(date, now)}` : "—"}
            </div>
          </div>
          {cat && (
            <Switch
              checked={cat.active}
              disabled={busy === cat.id}
              onCheckedChange={(v) => void setActive(cat, v)}
              aria-label={`${def.name} פעיל`}
            />
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {cat ? (
            <>
              <Button size="sm" variant="outline" onClick={() => onOpen(cat.id)}>
                מניינים ({count}) <ChevronLeft className="size-4" />
              </Button>
              {count === 0 && ordinary.length > 0 && (
                <label className="flex items-center gap-1 text-xs">
                  <Copy className="size-3.5" />
                  <select
                    aria-label={`העתקת מניינים ל${def.name}`}
                    value=""
                    disabled={busy === cat.id}
                    onChange={(e) => e.target.value && void copyFrom(cat, e.target.value)}
                    className="h-8 rounded-md border bg-background px-1 text-xs"
                  >
                    <option value="">העתקה מ…</option>
                    {ordinary.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy === def.key} onClick={() => void create(def)}>
              <Plus className="size-4" /> הגדרת זמנים
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="card-elev space-y-2 p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" />
          <h3 className="text-lg font-semibold">מועדים ואירועים</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          לכל מועד אפשר להגדיר זמני תפילות משלו. ביום עצמו הם מחליפים באתר ובלוח את זמני ימות החול או השבת, וזמני
          המועד (תחילת הצום וסופו, הדלקת נרות, צאת החג) מוצגים לצד זמני היום. התאריכים מחושבים לבד מהלוח העברי, כך
          שמה שמגדירים השנה חוזר בשנה הבאה.
        </p>
        {upcoming.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-xs font-medium">בקרוב:</span>
            {upcoming.map((d) => (
              <span key={d.key} className={`rounded-full px-2 py-0.5 text-xs ${own(d)?.active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {d.name} · {whenText(next[d.key]!, now, true)}
              </span>
            ))}
          </div>
        )}
      </div>

      {GROUP_ORDER.map((group) => {
        const defs = SPECIAL_DAYS.filter((d) => d.group === group);
        const body = <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{defs.map(card)}</div>;
        if (group === "national") {
          return (
            <details key={group} className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">{GROUP_LABELS[group]}</summary>
              <p className="my-2 text-xs text-muted-foreground">אפשר להכין כאן זמנים; בינתיים הם לא מוצגים באתר ובלוח.</p>
              {body}
            </details>
          );
        }
        return (
          <section key={group} className="space-y-2">
            <h4 className="font-semibold">{GROUP_LABELS[group]}</h4>
            {body}
          </section>
        );
      })}
    </div>
  );
}
