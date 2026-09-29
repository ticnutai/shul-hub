import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarRange,
  ChevronLeft,
  GripVertical,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
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
  minyanSubcategories,
  useMinyanCategories,
  useMinyanim,
  useSettings,
  type Minyan,
  type MinyanCategory,
  type MinyanSubcategory,
} from "@community/lib/data";
import { useDeleteRow, useSaveRow } from "@community/lib/admin";
import { RELATIVE_LABELS, heldOn, resolveMinyan, zmanimFor } from "@community/lib/minyan-time";
import { RELATIVE_OPTIONS } from "@community/lib/zmanim";
import { InlineEdit } from "@community/components/InlineEdit";
import {
  normalizePrayerLayout,
  PrayerLayoutPicker,
} from "@community/components/PrayerLayoutPicker";
import { supabase } from "@community/integrations/supabase/client";
import { communityId } from "@/community/lib/community";
import { isEventCategory } from "@community/lib/specialDays";

type Draft = Partial<Minyan> & { day_type: string; category_id: string | null };
type CategoryDraft = Pick<
  MinyanCategory,
  "name" | "active" | "sort_order" | "visible_from" | "visible_until" | "display_mode"
> & { id?: string; subcategories: MinyanSubcategory[] };

/** "עד 11.10" / "מ-12.10" / "12.10–11.4": a minyan's season, short. */
const dm = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}`;
function seasonLabel(from: string | null, until: string | null): string {
  if (from && until) return `${dm(from)}–${dm(until)}`;
  return from ? `מ-${dm(from)}` : `עד ${dm(until!)}`;
}

const emptyDraft = (category: MinyanCategory): Draft => ({
  day_type: category.system_key ?? "custom",
  category_id: category.id,
  prayer: minyanSubcategories(category)[0]?.id ?? "other",
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
  const removeCategory = useDeleteRow("minyan_categories", "minyan_categories");
  const [categoryId, setCategoryId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("cat"));
  // A special day's own timetable is opened from "תצוגות → מועדים ואירועים"
  // with ?cat=<its tab>; "back" returns there.
  const [searchParams, setSearchParams] = useSearchParams();
  const openSpecialDays = () => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "tv");
    next.set("tvTab", "events");
    next.delete("cat");
    setSearchParams(next);
  };
  const [prayer, setPrayer] = useState<string>("shacharit");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [draggedMinyanId, setDraggedMinyanId] = useState<string | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [draggedSubcategoryId, setDraggedSubcategoryId] = useState<string | null>(null);

  /** Sub-categories are ordered by dragging, in the draft, until "שמירת קטגוריה". */
  function moveSubcategory(draggedId: string, targetId: string) {
    setCategoryDraft((current) => {
      if (!current) return current;
      const list = [...current.subcategories];
      const from = list.findIndex((item) => item.id === draggedId);
      const to = list.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0 || from === to) return current;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved!);
      return { ...current, subcategories: list };
    });
  }
  const draggedMinyanRef = useRef<string | null>(null);
  const draggedCategoryRef = useRef<string | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // The ordinary tabs. A special day's tab (system_key "event:…") is reached
  // from "מועדים ואירועים", not from this row.
  const regularCategories = useMemo(() => categories.filter((c) => !isEventCategory(c)), [categories]);
  const selectedCategory =
    categories.find((category) => category.id === categoryId) ?? regularCategories[0];
  const selectedIsEvent = Boolean(selectedCategory && isEventCategory(selectedCategory));
  const hasShabbatTab = categories.some((c) => c.system_key === "shabbat");

  async function createShabbatTab() {
    const friday = categories.find((c) => c.system_key === "friday");
    const { data, error } = await supabase
      .from("minyan_categories")
      .insert({
        community_id: communityId(),
        name: "שבת",
        system_key: "shabbat",
        active: true,
        display_mode: "tabs",
        sort_order: (friday?.sort_order ?? 20) + 1,
      } as never)
      .select("id")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "יצירת הטאב נכשלה");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["minyan_categories"] });
    setCategoryId((data as { id: string }).id);
  }
  const selectedCategoryId = selectedCategory?.id ?? null;
  const zmanim = zmanimFor(new Date(), settings);
  const prayerTabs = useMemo(() => minyanSubcategories(selectedCategory), [selectedCategory]);
  const hasSubcategories = prayerTabs.length > 0;
  const rows = minyanim.filter(
    (m) =>
      (m.category_id === selectedCategoryId ||
        (!m.category_id && m.day_type === selectedCategory?.system_key)) &&
      (!hasSubcategories || m.prayer === prayer),
  );

  useEffect(() => {
    if (prayerTabs.length > 0 && !prayerTabs.some((item) => item.id === prayer)) {
      setPrayer(prayerTabs[0]!.id);
    }
  }, [prayer, prayerTabs]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const row: Record<string, unknown> = { ...draft };
    if (draft.time_mode === "fixed") row["relative_to"] = null;
    else row["fixed_time"] = null;
    row["active_from"] = draft.active_from || null;
    row["active_until"] = draft.active_until || null;
    if (row["active_from"] && row["active_until"] && String(row["active_from"]) > String(row["active_until"])) {
      toast.error("תאריך ההתחלה אחרי תאריך הסיום");
      return;
    }
    save.mutate(row, { onSuccess: () => setDraft(null) });
  }

  async function submitCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryDraft?.name.trim()) return;
    const previous = categories.find((category) => category.id === categoryDraft.id);
    const previousIds = minyanSubcategories(previous).map((item) => item.id);
    const nextIds = new Set(categoryDraft.subcategories.map((item) => item.id));
    const removedIds = previousIds.filter((id) => !nextIds.has(id));
    if (categoryDraft.id && removedIds.length > 0) {
      const replacement = categoryDraft.subcategories[0]?.id ?? "other";
      const { error } = await supabase
        .from("minyanim")
        .update({ prayer: replacement })
        .eq("community_id", communityId())
        .eq("category_id", categoryDraft.id)
        .in("prayer", removedIds);
      if (error) {
        toast.error(error.message || "עדכון המניינים בתת־הקטגוריה שנמחקה נכשל");
        return;
      }
    }
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

  async function deleteCategory(category: MinyanCategory) {
    const count = minyanim.filter((item) => item.category_id === category.id).length;
    const detail = count > 0 ? ` וכל ${count} המניינים שבתוכה` : "";
    if (!window.confirm(`למחוק את הקטגוריה „${category.name}”${detail}?`)) return;
    removeCategory.mutate(category.id, {
      onSuccess: () => {
        setCategoryId(null);
        setCategoryDraft(null);
        void queryClient.invalidateQueries({ queryKey: ["minyanim"] });
      },
    });
  }

  function addSubcategory() {
    if (!categoryDraft || !newSubcategoryName.trim()) return;
    const id = `custom-${crypto.randomUUID()}`;
    setCategoryDraft({
      ...categoryDraft,
      subcategories: [...categoryDraft.subcategories, { id, label: newSubcategoryName.trim() }],
    });
    setNewSubcategoryName("");
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
          {regularCategories.map((category) => (
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
                                const first = minyanSubcategories(category)[0];
                  if (first) setPrayer(first.id);
                }}
              >
                {category.name}
                {!category.active && <span className="mr-1 text-xs">(מוסתר)</span>}
              </button>
              <PrayerLayoutPicker
                value={normalizePrayerLayout(category.display_mode)}
                disabled={saveCategory.isPending}
                label={`שינוי תצוגת ${category.name}`}
                onChange={(displayMode) =>
                  saveCategory.mutate({ id: category.id, display_mode: displayMode })
                }
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setCategoryDraft({
                name: "",
                active: true,
                display_mode: "tabs",
                sort_order: (categories.at(-1)?.sort_order ?? 0) + 10,
                visible_from: null,
                visible_until: null,
                subcategories: [],
              })
            }
            className="rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-card"
          >
            <Plus className="ml-1 inline size-3.5" /> קטגוריה חדשה
          </button>
          {!hasShabbatTab && (
            <button
              type="button"
              onClick={() => void createShabbatTab()}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-card"
            >
              <Plus className="ml-1 inline size-3.5" /> טאב שבת
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {selectedCategory && (
            <Button
              variant="outline"
              onClick={() =>
                setCategoryDraft({
                  ...selectedCategory,
                  subcategories: minyanSubcategories(selectedCategory),
                })
              }
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

      {selectedIsEvent && selectedCategory && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <span>
            זמני התפילות של <b>{selectedCategory.name}</b> — ביום עצמו הם מחליפים באתר ובלוח את הזמנים הרגילים.
          </span>
          <Button size="sm" variant="ghost" onClick={() => openSpecialDays()}>
            ← חזרה למועדים ואירועים
          </Button>
        </div>
      )}

      {categoryDraft && (
        <form onSubmit={submitCategory} className="card-elev space-y-4 p-5">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">
              {categoryDraft.id ? "עריכת קטגוריית מניינים" : "קטגוריית מניינים חדשה"}
            </h3>
          </div>
          {/* The place of a tab is set by dragging it in the bar above, not
              by typing a number; the order field is gone from here. */}
          <div className="space-y-2 sm:max-w-md">
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
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div>
              <h4 className="font-medium">תתי־קטגוריות (רשות)</h4>
              <p className="text-xs text-muted-foreground">
                אפשר להשאיר ריק ולהוסיף מניינים ישירות לקטגוריה, או ליצור שמות חופשיים כגון שחרית,
                מנחה, ערבית או סליחות א׳.
              </p>
            </div>
            <div className="space-y-2" data-testid="minyan-subcategory-editor">
              {categoryDraft.subcategories.map((subcategory, index) => (
                <div
                  key={subcategory.id}
                  data-reorder-id={subcategory.id}
                  data-reorder-kind="subcategory"
                  className={
                    "flex items-center gap-2" + (draggedSubcategoryId === subcategory.id ? " opacity-50" : "")
                  }
                >
                  <button
                    type="button"
                    aria-label={`גרירת ${subcategory.label || `תת־קטגוריה ${index + 1}`}`}
                    title="גרור לשינוי הסדר"
                    className="cursor-grab touch-none p-1.5 text-muted-foreground active:cursor-grabbing"
                    onPointerDown={(event) =>
                      beginPointerDrag(
                        event,
                        subcategory.id,
                        '[data-reorder-kind="subcategory"]',
                        async (targetId) => moveSubcategory(subcategory.id, targetId),
                        () => setDraggedSubcategoryId(subcategory.id),
                        () => setDraggedSubcategoryId(null),
                      )
                    }
                  >
                    <GripVertical className="size-4" />
                  </button>
                  <Input
                    aria-label={`שם תת־קטגוריה ${index + 1}`}
                    value={subcategory.label}
                    onChange={(event) => {
                      const next = [...categoryDraft.subcategories];
                      next[index] = { ...subcategory, label: event.target.value };
                      setCategoryDraft({ ...categoryDraft, subcategories: next });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`מחיקת תת־קטגוריה ${subcategory.label}`}
                    onClick={() =>
                      setCategoryDraft({
                        ...categoryDraft,
                        subcategories: categoryDraft.subcategories.filter(
                          (item) => item.id !== subcategory.id,
                        ),
                      })
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="שם תת־קטגוריה חדשה"
                value={newSubcategoryName}
                onChange={(event) => setNewSubcategoryName(event.target.value)}
                placeholder="שם תת־קטגוריה חדשה"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addSubcategory();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addSubcategory}
                disabled={!newSubcategoryName.trim()}
              >
                <Plus className="size-4" /> הוספת תת־קטגוריה
              </Button>
            </div>
          </div>
          <Advanced
            summary={
              categoryDraft.visible_from || categoryDraft.visible_until
                ? `מוצג ${categoryDraft.visible_from ? `מ-${formatDay(categoryDraft.visible_from)}` : ""}${
                    categoryDraft.visible_until ? ` עד ${formatDay(categoryDraft.visible_until)}` : ""
                  }`
                : undefined
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minyan-category-from">הצגה מתאריך</Label>
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
                <Label htmlFor="minyan-category-until">עד תאריך</Label>
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
            <p className="text-xs text-muted-foreground">
              בלי תאריכים הטאב מוצג תמיד. עם תאריכים — רק בתקופה הזו, למשל סליחות.
            </p>
          </Advanced>
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
              {categoryDraft.id && selectedCategory && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void deleteCategory(selectedCategory)}
                  disabled={removeCategory.isPending}
                >
                  <Trash2 className="size-4" /> מחיקת הקטגוריה
                </Button>
              )}
            </div>
          </div>
        </form>
      )}

      {hasSubcategories && (
        <div
          role="group"
          dir="rtl"
          className="flex gap-1 rounded-lg bg-secondary p-1 text-right"
          aria-label="תתי קטגוריות מניינים"
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
      )}

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
                  {(m.active_from || m.active_until) && (
                    <span
                      className={
                        "mr-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] " +
                        (heldOn(m, new Date()) ? "bg-amber-500/15 text-amber-700" : "bg-muted text-muted-foreground")
                      }
                      data-testid={`minyan-season-${m.id}`}
                    >
                      {seasonLabel(m.active_from, m.active_until)}
                      {!heldOn(m, new Date()) && " · לא היום"}
                    </span>
                  )}
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
            {hasSubcategories && (
              <div className="space-y-2">
                <Label>תת־קטגוריה</Label>
                <Select
                  value={draft.prayer ?? "shacharit"}
                  onValueChange={(v) => setDraft({ ...draft, prayer: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {prayerTabs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>קטגוריית מניינים</Label>
              <Select
                value={draft.category_id ?? ""}
                onValueChange={(value) => {
                  const category = categories.find((item) => item.id === value);
                  const firstSubcategory = minyanSubcategories(category)[0];
                  setDraft({
                    ...draft,
                    category_id: value,
                    day_type: category?.system_key ?? "custom",
                    prayer: firstSubcategory?.id ?? "other",
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
            <div className="flex items-center gap-3 sm:pt-6">
              <Switch
                checked={draft.active ?? true}
                onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                id="active"
              />
              <Label htmlFor="active">מוצג באתר</Label>
            </div>
          </div>

          {/* The order of the minyanim is set by dragging them in the list. */}
          <Advanced
            summary={
              [
                draft.active_from || draft.active_until
                  ? `מתקיים ${draft.active_from ? `מ-${formatDay(draft.active_from)}` : ""}${
                      draft.active_until ? ` עד ${formatDay(draft.active_until)}` : ""
                    }`
                  : "",
                draft.notification_enabled ? `תזכורת ${draft.reminder_minutes ?? 15} דק׳ לפני` : "",
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {/* A minyan for a season (בין הזמנים, שעון קיץ): it leaves the site
                  and the board by itself after its last day. */}
              <div className="space-y-2">
                <Label>מתקיים מתאריך</Label>
                <Input
                  type="date"
                  dir="ltr"
                  value={draft.active_from ?? ""}
                  onChange={(e) => setDraft({ ...draft, active_from: e.target.value || null })}
                  data-testid="minyan-active-from"
                />
              </div>
              <div className="space-y-2">
                <Label>מתקיים עד תאריך (כולל)</Label>
                <Input
                  type="date"
                  dir="ltr"
                  value={draft.active_until ?? ""}
                  onChange={(e) => setDraft({ ...draft, active_until: e.target.value || null })}
                  data-testid="minyan-active-until"
                />
              </div>
              <div className="flex items-center gap-3 sm:pt-6">
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
          </Advanced>

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

/** 2026-09-01 -> 1.9.2026, for the line that says what is set under "מתקדם". */
function formatDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

/**
 * What a gabbai needs to build a minyan is its name, its time and its place.
 * Everything else - a season, a reminder, a tab shown only for a while - is
 * folded away here, closed by default, with a line saying what is set in it
 * so nothing hidden is also forgotten.
 */
function Advanced({ summary, children }: { summary?: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronLeft className="size-4 transition-transform group-open:-rotate-90" />
        מתקדם
        {summary && <span className="truncate text-xs font-normal text-muted-foreground">· {summary}</span>}
      </summary>
      <div className="space-y-3 border-t border-border p-4">{children}</div>
    </details>
  );
}
