import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAY_TYPES, PRAYERS, useMinyanim, useSettings, type Minyan } from "@/lib/data";
import { useDeleteRow, useSaveRow } from "@/lib/admin";
import { RELATIVE_LABELS, resolveMinyan, zmanimFor } from "@/lib/minyan-time";
import { RELATIVE_OPTIONS } from "@/lib/zmanim";

type Draft = Partial<Minyan> & { day_type: string };

const emptyDraft = (day_type: string): Draft => ({
  day_type,
  prayer: "shacharit",
  label: "",
  time_mode: "fixed",
  fixed_time: "07:00",
  relative_to: "sunset",
  offset_minutes: 0,
  room: "",
  note: "",
  sort_order: 100,
  active: true,
});

export function MinyanimAdmin() {
  const { data: minyanim = [] } = useMinyanim();
  const { data: settings } = useSettings();
  const save = useSaveRow("minyanim", "minyanim");
  const remove = useDeleteRow("minyanim", "minyanim");
  const [dayType, setDayType] = useState<string>("weekday");
  const [draft, setDraft] = useState<Draft | null>(null);

  const zmanim = zmanimFor(new Date(), settings);
  const rows = minyanim.filter((m) => m.day_type === dayType);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const row: Record<string, unknown> = { ...draft };
    if (draft.time_mode === "fixed") row["relative_to"] = null;
    else row["fixed_time"] = null;
    save.mutate(row, { onSuccess: () => setDraft(null) });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {DAY_TYPES.map((d) => (
            <button
              key={d.id}
              onClick={() => setDayType(d.id)}
              className={
                "rounded-md px-3 py-1.5 text-sm " +
                (dayType === d.id
                  ? "bg-card font-medium shadow-soft"
                  : "text-muted-foreground")
              }
            >
              {d.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setDraft(emptyDraft(dayType))}>
          <Plus className="size-4" /> מניין חדש
        </Button>
      </div>

      <div className="card-elev divide-y divide-border">
        {rows.length === 0 && (
          <p className="p-6 text-center text-muted-foreground">אין מניינים ליום זה.</p>
        )}
        {rows.map((m) => {
          const resolved = resolveMinyan(m, zmanim);
          return (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {m.label}
                  {!m.active && (
                    <span className="mr-2 text-xs text-muted-foreground">(מוסתר)</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {resolved?.source} {m.room ? `· ${m.room}` : ""}
                </p>
              </div>
              <span className="font-display text-lg tabular-nums text-primary">
                {resolved?.time ?? "—"}
              </span>
              <Button size="icon" variant="ghost" onClick={() => setDraft(m)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove.mutate(m.id)}
                aria-label="מחיקה"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>

      {draft && (
        <form onSubmit={submit} className="card-elev space-y-4 p-5">
          <h3 className="text-lg font-semibold">
            {draft.id ? "עריכת מניין" : "מניין חדש"}
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>שם המניין</Label>
              <Input
                value={draft.label ?? ""}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="שחרית א׳"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>סוג תפילה</Label>
              <Select
                value={draft.prayer ?? "shacharit"}
                onValueChange={(v) => setDraft({ ...draft, prayer: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRAYERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>סוג יום</Label>
              <Select
                value={draft.day_type}
                onValueChange={(v) => setDraft({ ...draft, day_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_TYPES.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>אופן קביעת השעה</Label>
              <Select
                value={draft.time_mode ?? "fixed"}
                onValueChange={(v) => setDraft({ ...draft, time_mode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">שעה קבועה</SelectItem>
                  <SelectItem value="relative">יחסית לזמן הלכתי</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {draft.time_mode === "fixed" ? (
              <div className="space-y-2">
                <Label>שעה</Label>
                <Input
                  type="time"
                  dir="ltr"
                  value={(draft.fixed_time ?? "07:00").slice(0, 5)}
                  onChange={(e) => setDraft({ ...draft, fixed_time: e.target.value })}
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>ביחס ל…</Label>
                  <Select
                    value={draft.relative_to ?? "sunset"}
                    onValueChange={(v) => setDraft({ ...draft, relative_to: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIVE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {RELATIVE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>הפרש בדקות (מינוס = לפני)</Label>
                  <Input
                    type="number"
                    dir="ltr"
                    value={draft.offset_minutes ?? 0}
                    onChange={(e) =>
                      setDraft({ ...draft, offset_minutes: Number(e.target.value) })
                    }
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>אולם / מיקום</Label>
              <Input
                value={draft.room ?? ""}
                onChange={(e) => setDraft({ ...draft, room: e.target.value })}
                placeholder="אולם מרכזי"
              />
            </div>
            <div className="space-y-2">
              <Label>הערה</Label>
              <Input
                value={draft.note ?? ""}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder="לדוגמה: רק בימי שני וחמישי"
              />
            </div>
            <div className="space-y-2">
              <Label>סדר תצוגה</Label>
              <Input
                type="number"
                dir="ltr"
                value={draft.sort_order ?? 0}
                onChange={(e) =>
                  setDraft({ ...draft, sort_order: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={draft.active ?? true}
                onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                id="active"
              />
              <Label htmlFor="active">מוצג באתר</Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              שמירה
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              ביטול
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
