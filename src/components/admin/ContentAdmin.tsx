import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ANNOUNCEMENT_KINDS } from "@/components/AnnouncementCard";
import {
  DAYS_HE,
  useAnnouncements,
  useChavrutot,
  useShiurim,
  type Announcement,
  type Chavruta,
  type Shiur,
} from "@/lib/data";
import { useDeleteRow, useSaveRow } from "@/lib/admin";

function RowShell({
  title,
  subtitle,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <Button size="icon" variant="ghost" onClick={onEdit} aria-label="עריכה">
        <Pencil className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onDelete} aria-label="מחיקה">
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}

/* ---------------- מודעות ---------------- */

export function AnnouncementsAdmin() {
  const { data = [] } = useAnnouncements();
  const save = useSaveRow("announcements", "announcements");
  const remove = useDeleteRow("announcements", "announcements");
  const [draft, setDraft] = useState<Partial<Announcement> | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() =>
            setDraft({ kind: "mazal_tov", title: "", body: "", pinned: false })
          }
        >
          <Plus className="size-4" /> מודעה חדשה
        </Button>
      </div>

      <div className="card-elev divide-y divide-border">
        {data.length === 0 && (
          <p className="p-6 text-center text-muted-foreground">אין מודעות.</p>
        )}
        {data.map((a) => (
          <RowShell
            key={a.id}
            title={a.title}
            subtitle={`${ANNOUNCEMENT_KINDS.find((k) => k.id === a.kind)?.label ?? ""}${
              a.expires_at ? ` · בתוקף עד ${a.expires_at}` : ""
            }`}
            onEdit={() => setDraft(a)}
            onDelete={() => remove.mutate(a.id)}
          />
        ))}
      </div>

      {draft && (
        <form
          className="card-elev space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              { ...draft, expires_at: draft.expires_at || null },
              { onSuccess: () => setDraft(null) },
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>סוג מודעה</Label>
              <Select
                value={draft.kind ?? "general"}
                onValueChange={(v) => setDraft({ ...draft, kind: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_KINDS.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>בתוקף עד (לא חובה)</Label>
              <Input
                type="date"
                dir="ltr"
                value={draft.expires_at ?? ""}
                onChange={(e) => setDraft({ ...draft, expires_at: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>כותרת</Label>
            <Input
              required
              value={draft.title ?? ""}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="מזל טוב למשפחת…"
            />
          </div>
          <div className="space-y-2">
            <Label>תוכן</Label>
            <Textarea
              rows={4}
              value={draft.body ?? ""}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="pinned"
              checked={draft.pinned ?? false}
              onCheckedChange={(v) => setDraft({ ...draft, pinned: v })}
            />
            <Label htmlFor="pinned">להצמיד לראש הרשימה</Label>
          </div>
          <div className="flex gap-2">
            <Button type="submit">שמירה</Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              ביטול
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ---------------- שיעורים ---------------- */

export function ShiurimAdmin() {
  const { data = [] } = useShiurim();
  const save = useSaveRow("shiurim", "shiurim");
  const remove = useDeleteRow("shiurim", "shiurim");
  const [draft, setDraft] = useState<Partial<Shiur> | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() =>
            setDraft({
              title: "",
              teacher: "",
              day_of_week: 0,
              time_text: "",
              location: "",
              description: "",
              sort_order: 100,
              active: true,
            })
          }
        >
          <Plus className="size-4" /> שיעור חדש
        </Button>
      </div>

      <div className="card-elev divide-y divide-border">
        {data.length === 0 && (
          <p className="p-6 text-center text-muted-foreground">אין שיעורים.</p>
        )}
        {data.map((s) => (
          <RowShell
            key={s.id}
            title={s.title}
            subtitle={`יום ${DAYS_HE[s.day_of_week]} · ${s.time_text} · ${s.teacher}`}
            onEdit={() => setDraft(s)}
            onDelete={() => remove.mutate(s.id)}
          />
        ))}
      </div>

      {draft && (
        <form
          className="card-elev space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ ...draft }, { onSuccess: () => setDraft(null) });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>נושא השיעור</Label>
              <Input
                required
                value={draft.title ?? ""}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>מגיד השיעור</Label>
              <Input
                value={draft.teacher ?? ""}
                onChange={(e) => setDraft({ ...draft, teacher: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>יום</Label>
              <Select
                value={String(draft.day_of_week ?? 0)}
                onValueChange={(v) => setDraft({ ...draft, day_of_week: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_HE.map((d, i) => (
                    <SelectItem key={d} value={String(i)}>
                      יום {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>שעה (טקסט חופשי)</Label>
              <Input
                value={draft.time_text ?? ""}
                onChange={(e) => setDraft({ ...draft, time_text: e.target.value })}
                placeholder="20:30 / אחרי מנחה"
              />
            </div>
            <div className="space-y-2">
              <Label>מיקום</Label>
              <Input
                value={draft.location ?? ""}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
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
          </div>
          <div className="space-y-2">
            <Label>תיאור</Label>
            <Textarea
              rows={3}
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="shiur-active"
              checked={draft.active ?? true}
              onCheckedChange={(v) => setDraft({ ...draft, active: v })}
            />
            <Label htmlFor="shiur-active">מוצג באתר</Label>
          </div>
          <div className="flex gap-2">
            <Button type="submit">שמירה</Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              ביטול
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ---------------- חברותות ---------------- */

export function ChavrutotAdmin() {
  const { data = [] } = useChavrutot();
  const save = useSaveRow("chavrutot", "chavrutot");
  const remove = useDeleteRow("chavrutot", "chavrutot");
  const [draft, setDraft] = useState<Partial<Chavruta> | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() =>
            setDraft({
              topic: "",
              partners: "",
              time_text: "",
              contact: "",
              looking_for_partner: false,
              sort_order: 100,
              active: true,
            })
          }
        >
          <Plus className="size-4" /> חברותא חדשה
        </Button>
      </div>

      <div className="card-elev divide-y divide-border">
        {data.length === 0 && (
          <p className="p-6 text-center text-muted-foreground">אין חברותות.</p>
        )}
        {data.map((c) => (
          <RowShell
            key={c.id}
            title={c.topic}
            subtitle={`${c.partners} · ${c.time_text}${
              c.looking_for_partner ? " · מחפשים חברותא" : ""
            }`}
            onEdit={() => setDraft(c)}
            onDelete={() => remove.mutate(c.id)}
          />
        ))}
      </div>

      {draft && (
        <form
          className="card-elev space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ ...draft }, { onSuccess: () => setDraft(null) });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>נושא הלימוד</Label>
              <Input
                required
                value={draft.topic ?? ""}
                onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>שמות הלומדים</Label>
              <Input
                value={draft.partners ?? ""}
                onChange={(e) => setDraft({ ...draft, partners: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>זמן הלימוד</Label>
              <Input
                value={draft.time_text ?? ""}
                onChange={(e) => setDraft({ ...draft, time_text: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>איש קשר</Label>
              <Input
                value={draft.contact ?? ""}
                onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <Switch
                id="looking"
                checked={draft.looking_for_partner ?? false}
                onCheckedChange={(v) => setDraft({ ...draft, looking_for_partner: v })}
              />
              <Label htmlFor="looking">מחפשים חברותא</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="chav-active"
                checked={draft.active ?? true}
                onCheckedChange={(v) => setDraft({ ...draft, active: v })}
              />
              <Label htmlFor="chav-active">מוצג באתר</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit">שמירה</Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              ביטול
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
