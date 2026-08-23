import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarRange, GripVertical, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  PRAYERS,
  useMinyanCategories,
  useMinyanim,
  useSettings,
  type Minyan,
  type MinyanCategory,
} from "@/lib/data";
import { useDeleteRow, useSaveRow } from "@/lib/admin";
import { RELATIVE_LABELS, resolveMinyan, zmanimFor } from "@/lib/minyan-time";
import { RELATIVE_OPTIONS } from "@/lib/zmanim";
import { InlineEdit } from "@/components/InlineEdit";
import { supabase } from "@/integrations/supabase/client";

type Draft = Partial<Minyan> & { day_type: string; category_id: string | null };
type CategoryDraft = Pick<
  MinyanCategory,
  "name" | "active" | "sort_order" | "visible_from" | "visible_until"
> & { id?: string };

const emptyDraft = (category: MinyanCategory): Draft => ({
  day_type: category.system_key ?? "custom",
  category_id: category.id,
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
  notification_enabled: false,
  reminder_minutes: 15,
});

export function MinyanimAdmin() {
  const { data: minyanim = [] } = useMinyanim();
  const { data: categories = [] } = useMinyanCategories();
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();
  const save = useSaveRow("minyanim", "minyanim");
  const remove = useDeleteRow("minyanim", "minyanim");
  const saveCategory = useSaveRow("minyan_categories", "minyan_categories");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [prayer, setPrayer] = useState<string>("shacharit");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [draggedMinyanId, setDraggedMinyanId] = useState<string | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const draggedMinyanRef = useRef<string | null>(null);
  const draggedCategoryRef = useRef<string | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const selectedCategory =
    categories.find((category) => category.id === categoryId) ?? categories[0];
  const selectedCategoryId = selectedCategory?.id ?? null;
  const zmanim = zmanimFor(new Date(), settings);
  const prayerTabs =
    selectedCategory?.system_key === "friday"
      ? PRAYERS.filter((item) => item.id === "shacharit")
      : PRAYERS.filter((item) => item.id !== "other");
  const rows = minyanim.filter(
    (m) =>
      (m.category_id === selectedCategoryId ||
        (!m.category_id && m.day_type === selectedCategory?.system_key)) &&
      m.prayer === prayer,
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const row: Record<string, unknown> = { ...draft };
    if (draft.time_mode === "fixed") row["relative_to"] = null;
    else row["fixed_time"] = null;
    save.mutate(row, { onSuccess: () => setDraft(null) });
  }

  function submitCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryDraft?.name.trim()) return;
    saveCategory.mutate(
      {
        ...categoryDraft,
        name: categoryDraft.name.trim(),
        visible_from: categoryDraft.visible_from || null,
        visible_until: categoryDraft.visible_until || null,
      },
      {
        onSuccess: () => {
          setCategoryDraft(null);
        },
      },
    );
  }

  function openDraft(nextDraft: Draft) {
    setDraft(nextDraft);
    requestAnimationFrame(() => {
      requestAnimationFrame(() =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    });
  }

  async function persistOrder(
    table: "minyanim" | "minyan_categories",
    queryKey: "minyanim" | "minyan_categories",
    items: { id: string }[],
    draggedId: string | null,
    targetId: string,
    successMessage: string,
  ) {
    if (!draggedId || draggedId === targetId) return;
    const ordered = [...items];
    const from = ordered.findIndex((item) => item.id === draggedId);
    const to = ordered.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved!);
    const results = await Promise.all(
      ordered.map((item, index) =>
        supabase
          .from(table)
          .update({ sort_order: (index + 1) * 10 })
          .eq("id", item.id),
      ),
    );
    const failure = results.find((result) => result.error)?.error;
    if (failure) toast.error("שמירת סדר התצוגה נכשלה");
    else {
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(successMessage);
    }
  }

  const moveMinyan = (targetId: string) =>
    persistOrder(
      "minyanim",
      "minyanim",
      rows,
      draggedMinyanRef.current,
      targetId,
      "סדר המניינים נשמר",
    );

  const moveCategory = (targetId: string) =>
    persistOrder(
      "minyan_categories",
      "minyan_categories",
      categories,
      draggedCategoryRef.current,
      targetId,
      "סדר הטאבים נשמר",
    );

  useEffect(() => () => dragCleanupRef.current?.(), []);

  function beginPointerDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    draggedId: string,
    selector: string,
    move: (targetId: string) => Promise<void>,
    start: () => void,
    clear: () => void,
  ) {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    dragCleanupRef.current?.();
    start();

    const ownerDocument = event.currentTarget.ownerDocument;
    const pointerId = event.pointerId;
    const finish = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      const target = ownerDocument
        .elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)
        ?.closest<HTMLElement>(selector);
      if (target?.dataset["reorderId"] && target.dataset["reorderId"] !== draggedId) {
        void move(target.dataset["reorderId"]);
      }
      cleanup();
    };
    const cancel = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId === pointerId) cleanup();
    };
    const cleanup = () => {
      ownerDocument.removeEventListener("pointerup", finish, true);
      ownerDocument.removeEventListener("pointercancel", cancel, true);
      dragCleanupRef.current = null;
      clear();
    };

    ownerDocument.addEventListener("pointerup", finish, true);
    ownerDocument.addEventListener("pointercancel", cancel, true);
    dragCleanupRef.current = cleanup;
  }

  return (
    <div dir="rtl" className="space-y-4 text-right">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          dir="rtl"
          className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
          aria-label="קטגוריות מניינים"
        >
          {categories.map((category) => (
            <div
              key={category.id}
              data-reorder-id={category.id}
              data-reorder-kind="category"
              data-testid={`minyan-category-${category.id}`}
              className={
                "flex items-center rounded-md text-sm " +
                (selectedCategoryId === category.id
                  ? "bg-card font-medium shadow-soft"
                  : "text-muted-foreground") +
                (draggedCategoryId === category.id ? " opacity-50" : "")
              }
            >
              <button
                type="button"
                aria-label={`גרירת הטאב ${category.name}`}
                title="גרור לשינוי סדר הטאבים"
                className="cursor-grab touch-none p-1.5 active:cursor-grabbing"
                onPointerDown={(event) => {
                  beginPointerDrag(
                    event,
                    category.id,
                    '[data-reorder-kind="category"]',
                    moveCategory,
                    () => {
                      draggedCategoryRef.current = category.id;
                      setDraggedCategoryId(category.id);
                    },
                    () => {
                      draggedCategoryRef.current = null;
                      setDraggedCategoryId(null);
                    },
                  );
                }}
              >
                <GripVertical className="size-4" />
              </button>
              <button
                type="button"
                className="px-2 py-1.5"
                onClick={() => {
                  setCategoryId(category.id);
                  if (category.system_key === "friday") setPrayer("shacharit");
                }}
              >
                {category.name}
                {!category.active && <span className="mr-1 text-xs">(מוסתר)</span>}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setCategoryDraft({
                name: "",
                active: true,
                sort_order: (categories.at(-1)?.sort_order ?? 0) + 10,
                visible_from: null,
                visible_until: null,
              })
            }
            className="rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-card"
          >
            <Plus className="ml-1 inline size-3.5" /> קטגוריה חדשה
          </button>
        </div>
        <div className="flex gap-2">
          {selectedCategory && (
            <Button
              variant="outline"
              onClick={() => setCategoryDraft({ ...selectedCategory })}
              aria-label={`ניהול הקטגוריה ${selectedCategory.name}`}
            >
              <Settings2 className="size-4" /> ניהול הטאב
            </Button>
          )}
          <Button
            disabled={!selectedCategory}
            onClick={() => selectedCategory && openDraft(emptyDraft(selectedCategory))}
          >
            <Plus className="size-4" /> מניין חדש
          </Button>
        </div>
      </div>

      {categoryDraft && (
        <form onSubmit={submitCategory} className="card-elev space-y-4 p-5">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">
              {categoryDraft.id ? "עריכת קטגוריית מניינים" : "קטגוריית מניינים חדשה"}
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="minyan-category-name">שם הטאב</Label>
              <Input
                id="minyan-category-name"
                value={categoryDraft.name}
                onChange={(event) =>
                  setCategoryDraft({ ...categoryDraft, name: event.target.value })
                }
                placeholder="לדוגמה: סליחות"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minyan-category-order">סדר תצוגה (מתקדם)</Label>
              <Input
                id="minyan-category-order"
                type="number"
                dir="ltr"
                value={categoryDraft.sort_order}
                onChange={(event) =>
                  setCategoryDraft({ ...categoryDraft, sort_order: Number(event.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                מספר קטן מופיע קודם. בדרך כלל פשוט גוררים את הטאבים למיקום הרצוי.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minyan-category-from">הצגה מתאריך (רשות)</Label>
              <Input
                id="minyan-category-from"
                type="date"
                dir="ltr"
                value={categoryDraft.visible_from ?? ""}
                onChange={(event) =>
                  setCategoryDraft({ ...categoryDraft, visible_from: event.target.value || null })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minyan-category-until">עד תאריך (רשות)</Label>
              <Input
                id="minyan-category-until"
                type="date"
                dir="ltr"
                value={categoryDraft.visible_until ?? ""}
                onChange={(event) =>
                  setCategoryDraft({ ...categoryDraft, visible_until: event.target.value || null })
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              id="minyan-category-active"
              checked={categoryDraft.active}
              onCheckedChange={(active) => setCategoryDraft({ ...categoryDraft, active })}
            />
            <Label htmlFor="minyan-category-active">הטאב מוצג באתר</Label>
            <div className="mr-auto flex gap-2">
              <Button type="submit" disabled={saveCategory.isPending}>
                שמירת קטגוריה
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCategoryDraft(null)}>
                ביטול
              </Button>
            </div>
          </div>
        </form>
      )}

      <div
        role="group"
        dir="rtl"
        className="flex gap-1 rounded-lg bg-secondary p-1 text-right"
        aria-label="סוג תפילה"
      >
        {prayerTabs.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setPrayer(item.id)}
            className={
              "flex-1 rounded-md px-3 py-2 text-sm " +
              (prayer === item.id
                ? "bg-primary font-medium text-primary-foreground shadow-soft"
                : "text-muted-foreground")
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="card-elev divide-y divide-border">
        {rows.length === 0 && (
          <p className="p-6 text-center text-muted-foreground">אין מניינים ליום זה.</p>
        )}
        {rows.map((m) => {
          const resolved = resolveMinyan(m, zmanim);
          return (
            <div
              key={m.id}
              data-reorder-id={m.id}
              data-reorder-kind="minyan"
              data-testid={`minyan-row-${m.id}`}
              className={
                "flex items-center gap-3 px-4 py-3 " +
                (draggedMinyanId === m.id ? "opacity-50" : "")
              }
            >
              <button
                type="button"
                aria-label={`גרירת המניין ${m.label}`}
                title="גרור לשינוי סדר המניינים"
                className="cursor-grab touch-none p-2 text-muted-foreground active:cursor-grabbing"
                onPointerDown={(event) => {
                  beginPointerDrag(
                    event,
                    m.id,
                    '[data-reorder-kind="minyan"]',
                    moveMinyan,
                    () => {
                      draggedMinyanRef.current = m.id;
                      setDraggedMinyanId(m.id);
                    },
                    () => {
                      draggedMinyanRef.current = null;
                      setDraggedMinyanId(null);
                    },
                  );
                }}
              >
                <GripVertical className="size-5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2 font-medium">
                  <InlineEdit
                    table="minyanim"
                    id={m.id}
                    field="label"
                    value={m.label}
                    queryKey="minyanim"
                    alwaysEditable
                    ariaLabel={`עריכת שם המניין ${m.label}`}
                    className="min-w-0"
                    inputClassName="w-full min-w-40"
                    display={<span className="truncate">{m.label}</span>}
                  />
                  {!m.active && <span className="mr-2 text-xs text-muted-foreground">(מוסתר)</span>}
                </div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  <span>{resolved?.source}</span>
                  <span aria-hidden="true">·</span>
                  <InlineEdit
                    table="minyanim"
                    id={m.id}
                    field="room"
                    value={m.room}
                    queryKey="minyanim"
                    alwaysEditable
                    ariaLabel={`עריכת מיקום ${m.label}`}
                    placeholder="הוסף מיקום"
                    className="min-w-0"
                    inputClassName="w-36"
                  />
                  <span aria-hidden="true">·</span>
                  <InlineEdit
                    table="minyanim"
                    id={m.id}
                    field="note"
                    value={m.note}
                    queryKey="minyanim"
                    alwaysEditable
                    ariaLabel={`עריכת הערה ${m.label}`}
                    placeholder="הוסף הערה"
                    className="min-w-0"
                    inputClassName="w-44"
                  />
                </div>
              </div>
              {m.time_mode === "fixed" ? (
                <InlineEdit
                  table="minyanim"
                  id={m.id}
                  field="fixed_time"
                  value={m.fixed_time ? m.fixed_time.slice(0, 5) : ""}
                  queryKey="minyanim"
                  as="time"
                  alwaysEditable
                  ariaLabel={`עריכת שעה ${m.label}`}
                  className="font-display text-lg tabular-nums text-primary"
                  inputClassName="w-28"
                  display={resolved?.time ?? "—"}
                />
              ) : (
                <button
                  type="button"
                  className="rounded-md px-1 font-display text-lg tabular-nums text-primary ring-1 ring-dashed ring-primary/40 hover:bg-primary/5"
                  onClick={() => openDraft(m)}
                  aria-label={`עריכת זמן יחסי ${m.label}`}
                  title="הזמן מחושב — לחץ לעריכת הכלל"
                >
                  {resolved?.time ?? "—"}
                </button>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label={`פתיחת עריכת ${m.label}`}
                onClick={() => openDraft(m)}
              >
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
        <form ref={formRef} onSubmit={submit} className="card-elev scroll-mt-24 space-y-4 p-5">
          <h3 className="text-lg font-semibold">{draft.id ? "עריכת מניין" : "מניין חדש"}</h3>

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
              <Label>קטגוריית מניינים</Label>
              <Select
                value={draft.category_id ?? ""}
                onValueChange={(value) => {
                  const category = categories.find((item) => item.id === value);
                  setDraft({
                    ...draft,
                    category_id: value,
                    day_type: category?.system_key ?? "custom",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
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
                    onChange={(e) => setDraft({ ...draft, offset_minutes: Number(e.target.value) })}
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
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
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
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={draft.notification_enabled ?? false}
                onCheckedChange={(value) => setDraft({ ...draft, notification_enabled: value })}
                id="minyan-notification"
              />
              <Label htmlFor="minyan-notification">לאפשר תזכורת למניין</Label>
            </div>
            <div className="space-y-2">
              <Label>כמה דקות לפני</Label>
              <Input
                type="number"
                dir="ltr"
                min={0}
                max={10080}
                disabled={!draft.notification_enabled}
                value={draft.reminder_minutes ?? 15}
                onChange={(event) =>
                  setDraft({ ...draft, reminder_minutes: Number(event.target.value) })
                }
              />
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
