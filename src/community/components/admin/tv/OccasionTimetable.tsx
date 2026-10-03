import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Clock, Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@community/integrations/supabase/client";
import { communityId } from "@/community/lib/community";
import { useMinyanCategories, useMinyanim, type MinyanCategory } from "@community/lib/data";
import { SPECIAL_DAYS, eventSystemKey, isEventCategory, type SpecialDayDef } from "@community/lib/specialDays";

/**
 * A special day's own prayer timetable, from its line among the board's
 * occasions.
 *
 * This was a tab of its own, "תצוגות ← מועדים ואירועים" - the same days of the
 * year listed a second time, a few clicks from the board's "מועדים", one list
 * for the day's times and one for its screen. Now each day is one line: its
 * screen and its times together. Switching its times on creates its minyan tab
 * (system_key "event:<key>"); on the day that tab stands in for ימות החול /
 * שבת on the website and the board, every year again - the dates come from the
 * calendar, never from here.
 */
function useTimetable(def: SpecialDayDef) {
  const qc = useQueryClient();
  const { data: categories = [] } = useMinyanCategories();
  const { data: minyanim = [] } = useMinyanim();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const cat = categories.find((c) => c.system_key === eventSystemKey(def.key));
  const count = cat ? minyanim.filter((m) => m.category_id === cat.id).length : 0;
  const ordinary = categories.filter((c) => !isEventCategory(c));

  /**
   * Its minyanim, in "מניינים"; "back" there returns to the board's occasions.
   * That leaves the board editor, and with it a draft not yet sent - so with
   * one open it asks first (the editor raises __appHasUnsavedWork).
   */
  const open = (id: string) => {
    const go = () => {
      const next = new URLSearchParams(params);
      next.set("tab", "minyanim");
      next.set("cat", id);
      next.delete("tvTab");
      next.delete("panel");
      setParams(next);
    };
    if (!(window as { __appHasUnsavedWork?: boolean }).__appHasUnsavedWork) return go();
    toast.warning("יש בלוח שינויים שעוד לא נשמרו", {
      description: 'כדי לא לאבד אותם: "שמור ושדר למסכים" קודם, ואז זמני התפילה.',
      action: { label: "להמשיך בלי לשמור", onClick: go },
    });
  };

  const create = async () => {
    setBusy(true);
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
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "היצירה נכשלה");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["minyan_categories"] });
    toast.success(`נוצר: ${def.name}. עכשיו מוסיפים לו מניינים.`);
    open((data as { id: string }).id);
  };

  const setActive = async (c: MinyanCategory, active: boolean) => {
    setBusy(true);
    const { error } = await supabase
      .from("minyan_categories")
      .update({ active } as never)
      .eq("id", c.id)
      .eq("community_id", communityId());
    setBusy(false);
    if (error) toast.error(error.message);
    else await qc.invalidateQueries({ queryKey: ["minyan_categories"] });
  };

  const copyFrom = async (target: MinyanCategory, sourceId: string) => {
    const rows = minyanim.filter((m) => m.category_id === sourceId);
    if (rows.length === 0) {
      toast.error("אין מניינים בטאב הזה");
      return;
    }
    setBusy(true);
    const copies = rows.map(({ id: _id, created_at: _c, updated_at: _u, ...m }) => ({
      ...m,
      community_id: communityId(),
      category_id: target.id,
      day_type: "custom",
    }));
    const { error } = await supabase
      .from("minyanim")
      .insert(copies.map((c) => ({ ...c, community_id: communityId() })) as never);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      await qc.invalidateQueries({ queryKey: ["minyanim"] });
      toast.success(`הועתקו ${copies.length} מניינים ל${target.name}`);
    }
  };

  return { cat, count, ordinary, busy, open, create, setActive, copyFrom };
}

/** On the day's line: its times, or a way to give it some. */
export function TimetableButton({ def }: { def: SpecialDayDef }) {
  const t = useTimetable(def);
  if (!t.cat)
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs"
        disabled={t.busy}
        onClick={() => void t.create()}
        title="זמני תפילה משלו, שמחליפים ביום עצמו את הזמנים הרגילים באתר ובלוח"
        data-testid={`timetable-create-${def.key}`}
      >
        <Plus className="size-3.5" /> זמני תפילה
      </Button>
    );
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={`h-7 px-2 text-xs${t.cat.active ? "" : " opacity-60"}`}
      onClick={() => t.open(t.cat!.id)}
      title={t.cat.active ? "זמני התפילה של המועד" : "זמני התפילה של המועד - כבויים"}
      data-testid={`timetable-open-${def.key}`}
    >
      <Clock className="size-3.5" /> זמני תפילה ({t.count}){t.cat.active ? "" : " · כבוי"}
    </Button>
  );
}

/** In the day's dialog: everything about its times. */
export function TimetableSection({ def }: { def: SpecialDayDef }) {
  const t = useTimetable(def);
  return (
    <section className="space-y-2" data-testid={`timetable-${def.key}`}>
      <h3 className="font-medium">זמני תפילה</h3>
      <p className="text-xs text-muted-foreground">
        זמני תפילות משלו: ביום עצמו הם מחליפים באתר ובלוח את זמני ימות החול או השבת. התאריכים מחושבים מהלוח העברי, כך שמה
        שמגדירים השנה חוזר בשנה הבאה. נשמר מיד, בלי "שמור ושדר".
        {def.national && " ימים לאומיים לא מוצגים באתר ובלוח; אפשר להכין זמנים מראש."}
      </p>
      {t.cat ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={t.cat.active}
              disabled={t.busy}
              onCheckedChange={(v) => void t.setActive(t.cat!, v)}
              aria-label={`זמני התפילה של ${def.name} פעילים`}
            />
            {t.cat.active ? "פעילים" : "כבויים"}
          </label>
          <Button type="button" size="sm" variant="outline" onClick={() => t.open(t.cat!.id)}>
            מניינים ({t.count}) <ChevronLeft className="size-4" />
          </Button>
          {t.count === 0 && t.ordinary.length > 0 && (
            <label className="flex items-center gap-1 text-xs">
              <Copy className="size-3.5" />
              <select
                aria-label={`העתקת מניינים ל${def.name}`}
                value=""
                disabled={t.busy}
                onChange={(e) => e.target.value && void t.copyFrom(t.cat!, e.target.value)}
                className="h-8 rounded-md border bg-background px-1 text-xs"
              >
                <option value="">העתקה מ…</option>
                {t.ordinary.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" disabled={t.busy} onClick={() => void t.create()}>
          <Plus className="size-4" /> הגדרת זמנים
        </Button>
      )}
    </section>
  );
}
