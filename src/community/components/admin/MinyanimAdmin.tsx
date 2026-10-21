import { Hint } from "@/components/InfoTip";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarRange, MonitorSmartphone, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
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
import { confirmDelete, useDeleteRow, useSaveRow } from "@community/lib/admin";
import { RELATIVE_LABELS, heldOn, resolveMinyan, zmanimFor } from "@community/lib/minyan-time";
import { RELATIVE_OPTIONS } from "@community/lib/zmanim";
import { InlineEdit } from "@community/components/InlineEdit";
import { PrayerDisplaySettings } from "@community/components/admin/PrayerDisplaySettings";
import { supabase } from "@community/integrations/supabase/client";
import { communityId } from "@/community/lib/community";
import { isEventCategory } from "@community/lib/specialDays";
import { hebrewError } from "@community/lib/hebrewError";
import { DragGrip, nextSortOrder, useReorder } from "@community/lib/useReorder";
import { newMinyan } from "@community/lib/createContent";
import { useDraftGuard } from "@community/lib/unsavedChanges";
import { Collapsible } from "./Collapsible";
import { AdminError, ChoiceCard, ChoiceGroup, SaveButton } from "./adminUi";

type Draft = Partial<Minyan> & { day_type: string; category_id: string | null };
type CategoryDraft = Pick<
  MinyanCategory,
  "name" | "active" | "sort_order" | "visible_from" | "visible_until" | "display_mode"
> & { id?: string; system_key?: string | null; subcategories: MinyanSubcategory[] };

/** "עד 11.10" / "מ-12.10" / "12.10 עד 11.4": a minyan's season, short. */
const dm = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}`;
function seasonLabel(from: string | null, until: string | null): string {
  if (from && until) return `${dm(from)} עד ${dm(until)}`;
  return from ? `מ-${dm(from)}` : `עד ${dm(until!)}`;
}

/**
 * The tab of Shabbat, as a template of the new-tab form: its name, its own
 * key (the site and the board know it by it) and its three prayers - what
 * the one-click "לשונית שבת" button used to make, now one of the choices of
 * "לשונית חדשה", so there is one way to add a tab.
 */
const SHABBAT_PRAYERS: MinyanSubcategory[] = [
  { id: "shacharit", label: "שחרית" },
  { id: "mincha", label: "מנחה" },
  { id: "arvit", label: "ערבית" },
];

/**
 * `chosen`: opened from the tiles (AdminTiles.tsx), which already chose the
 * category and the prayer - its own rows of tabs are not drawn then, the
 * tiles stand in their place. Without it, the tabs as always.
 *
 * `manageOnly`: the tiles' "ימים, תפילות ותצוגה" - the tabs themselves (adding,
 * ordering, editing them) and how the times are shown, without the list of
 * minyanim again: the days' own tiles open that.
 */
export function MinyanimAdmin({
  chosen,
  manageOnly = false,
}: { chosen?: { categoryId: string; prayer?: string }; manageOnly?: boolean } = {}) {
  const { data: minyanim = [], isLoading: minyanimLoading, isError: minyanimError, refetch } = useMinyanim();
  const { data: categories = [] } = useMinyanCategories();
  const { data: settings } = useSettings();
  const save = useSaveRow("minyanim", "minyanim");
  const remove = useDeleteRow("minyanim", "minyanim");
  const saveCategory = useSaveRow("minyan_categories", "minyan_categories");
  const removeCategory = useDeleteRow("minyan_categories", ["minyan_categories", "minyanim"]);
  const [ownCategoryId, setCategoryId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("cat"));
  const categoryId = chosen?.categoryId ?? ownCategoryId;
  // A special day's own timetable is opened from the board editor's "מועדים"
  // with ?cat=<its tab>; "back" returns there.
  const [searchParams, setSearchParams] = useSearchParams();
  const openSpecialDays = () => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "tv");
    next.set("tvTab", "design");
    next.set("panel", "occasions");
    next.delete("cat");
    setSearchParams(next);
  };
  const [ownPrayer, setPrayer] = useState<string>("shacharit");
  const prayer = chosen?.prayer ?? ownPrayer;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  // Half-filled forms ask before the gabbai moves elsewhere (unsavedChanges.ts).
  useDraftGuard(draft as { id?: string } | null);
  useDraftGuard(categoryDraft);

  // The ordinary tabs. A special day's tab (system_key "event:…") is reached
  // from the board editor's "מועדים", not from this row.
  const regularCategories = useMemo(() => categories.filter((c) => !isEventCategory(c)), [categories]);
  const selectedCategory =
    categories.find((category) => category.id === categoryId) ?? regularCategories[0];
  const selectedIsEvent = Boolean(selectedCategory && isEventCategory(selectedCategory));
  const hasShabbatTab = categories.some((c) => c.system_key === "shabbat");

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

  // Every list here is dragged the one way (useReorder.ts): the tabs and the
  // minyanim are saved when let go, the prayers of a tab with the tab's form.
  const tabOrder = useReorder(regularCategories, { save: { table: "minyan_categories", queryKey: "minyan_categories" } });
  const minyanOrder = useReorder(rows, { save: { table: "minyanim", queryKey: "minyanim" } });
  const prayerOrder = useReorder(categoryDraft?.subcategories ?? [], {
    onReorder: (subcategories) => setCategoryDraft((current) => (current ? { ...current, subcategories } : current)),
  });

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
        toast.error(hebrewError(error, "עדכון המניינים בתפילה שנמחקה נכשל"));
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

  async function deleteMinyan(minyan: { id: string; label: string }) {
    if (!(await confirmDelete("המניין", minyan.label))) return;
    remove.mutate(minyan.id);
  }

  async function deleteCategory(category: MinyanCategory) {
    const count = minyanim.filter((item) => item.category_id === category.id).length;
    const ok = await confirmDelete(
      "הלשונית",
      category.name,
      count > 0 ? `וכל ${count} המניינים שבתוכה. אי אפשר לבטל את זה.` : undefined,
    );
    if (!ok) return;
    removeCategory.mutate(category.id, {
      onSuccess: () => {
        setCategoryId(null);
        setCategoryDraft(null);
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

  /** A new tab: empty, at the end of the row. */
  const emptyTab = (): CategoryDraft => ({
    name: "",
    active: true,
    display_mode: "tabs",
    sort_order: nextSortOrder(categories),
    visible_from: null,
    visible_until: null,
    system_key: null,
    subcategories: [],
  });
  /** The Shabbat template: after Friday's tab, with its three prayers. */
  const shabbatTab = (): CategoryDraft => ({
    ...emptyTab(),
    name: "שבת",
    system_key: "shabbat",
    sort_order: (categories.find((c) => c.system_key === "friday")?.sort_order ?? 20) + 1,
    subcategories: SHABBAT_PRAYERS,
  });
  const usingShabbat = !categoryDraft?.id && categoryDraft?.system_key === "shabbat";

  // From the tiles' days, the list comes alone: how the times are shown is
  // under "ימים, תפילות ותצוגה". On the tabs, it is folded under the list.
  const showList = !manageOnly;
  const showTabBar = !chosen;
  const prayerDisplay = <PrayerDisplaySettings settings={settings} categories={categories} showTitle={manageOnly} />;

  return (
    <div dir="rtl" className="space-y-4 text-right">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showTabBar && (
        <div
          role="group"
          dir="rtl"
          className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
          aria-label="לשוניות מניינים"
        >
          {tabOrder.ordered.map((category) => (
            <div
              key={category.id}
              {...tabOrder.rowProps(category.id)}
              data-testid={`minyan-category-${category.id}`}
              className={
                "flex items-center rounded-md text-sm " +
                (selectedCategoryId === category.id
                  ? "bg-card font-medium shadow-soft"
                  : "text-muted-foreground") +
                (tabOrder.draggedId === category.id ? " opacity-50" : "")
              }
            >
              <DragGrip small label={`גרירת הלשונית ${category.name}`} {...tabOrder.gripProps(category.id)} />
              <button
                type="button"
                className="px-2 py-1.5"
                aria-pressed={selectedCategoryId === category.id}
                onClick={() => {
                  setCategoryId(category.id);
                  const first = minyanSubcategories(category)[0];
                  if (first) setPrayer(first.id);
                }}
              >
                {category.name}
                {!category.active && <span className="mr-1 text-xs">(מוסתר)</span>}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setCategoryDraft(emptyTab())}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-card"
          >
            <Plus className="ml-1 inline size-3.5" /> לשונית חדשה
          </button>
        </div>
        )}
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
              aria-label={`ניהול הלשונית ${selectedCategory.name}`}
            >
              <Settings2 className="size-4" /> ניהול הלשונית
            </Button>
          )}
        </div>
      </div>

      {selectedIsEvent && selectedCategory && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <span>
            זמני התפילות של <b>{selectedCategory.name}</b> - ביום עצמו הם מחליפים באתר ובלוח את הזמנים הרגילים.
          </span>
          <Button size="sm" variant="ghost" onClick={() => openSpecialDays()}>
            → חזרה למועדים
          </Button>
        </div>
      )}

      {categoryDraft && (
        <form onSubmit={submitCategory} className="card-elev space-y-4 p-5" data-testid="minyan-category-form">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">
              {categoryDraft.id ? "עריכת לשונית" : "לשונית חדשה"}
            </h3>
          </div>
          {/* A new tab starts empty, or as the Shabbat tab with its three prayers. */}
          {!categoryDraft.id && !hasShabbatTab && (
            <ChoiceGroup className="grid gap-2 sm:grid-cols-2" label="תבנית ללשונית החדשה" testId="minyan-tab-template">
              <ChoiceCard
                selected={!usingShabbat}
                onSelect={() => setCategoryDraft(emptyTab())}
                title="לשונית ריקה"
                description="שם משלכם, ותפילות אם רוצים"
              />
              <ChoiceCard
                selected={usingShabbat}
                onSelect={() => setCategoryDraft(shabbatTab())}
                title="שבת"
                description="מוכנה, עם שחרית, מנחה וערבית"
              />
            </ChoiceGroup>
          )}
          {/* The place of a tab is set by dragging it in the bar above, not
              by typing a number; the order field is gone from here. */}
          <div className="space-y-2 sm:max-w-md">
            <Label htmlFor="minyan-category-name">שם הלשונית</Label>
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
              <h4 className="font-medium">תפילות בלשונית (רשות)</h4>
              <Hint>
                אפשר להשאיר ריק ולהוסיף מניינים ישירות ללשונית, או ליצור שמות חופשיים כגון שחרית,
                מנחה, ערבית או סליחות א׳.
              </Hint>
            </div>
            <div className="space-y-2" data-testid="minyan-subcategory-editor">
              {prayerOrder.ordered.map((subcategory, index) => (
                <div
                  key={subcategory.id}
                  {...prayerOrder.rowProps(subcategory.id)}
                  className={
                    "flex items-center gap-2" + (prayerOrder.draggedId === subcategory.id ? " opacity-50" : "")
                  }
                >
                  <DragGrip small label={`גרירת ${subcategory.label || `תפילה ${index + 1}`}`} {...prayerOrder.gripProps(subcategory.id)} />
                  <Input
                    aria-label={`שם תפילה ${index + 1}`}
                    value={subcategory.label}
                    onChange={(event) =>
                      setCategoryDraft({
                        ...categoryDraft,
                        subcategories: categoryDraft.subcategories.map((item) =>
                          item.id === subcategory.id ? { ...item, label: event.target.value } : item,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`מחיקת תפילה ${subcategory.label}`}
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
                aria-label="שם תפילה חדשה"
                value={newSubcategoryName}
                onChange={(event) => setNewSubcategoryName(event.target.value)}
                placeholder="שם תפילה חדשה"
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
                <Plus className="size-4" /> הוספת תפילה
              </Button>
            </div>
          </div>
          <Collapsible
            title="מתקדם"
            headingLevel="h4"
            summary={
              categoryDraft.visible_from || categoryDraft.visible_until
                ? `מוצגת ${categoryDraft.visible_from ? `מ-${formatDay(categoryDraft.visible_from)}` : ""}${
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
            <Hint>
              בלי תאריכים הלשונית מוצגת תמיד. עם תאריכים - רק בתקופה הזו, למשל סליחות.
            </Hint>
          </Collapsible>
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              id="minyan-category-active"
              checked={categoryDraft.active}
              onCheckedChange={(active) => setCategoryDraft({ ...categoryDraft, active })}
            />
            <Label htmlFor="minyan-category-active">הלשונית מוצגת באתר</Label>
            <div className="mr-auto flex gap-2">
              <SaveButton pending={saveCategory.isPending} />
              <Button type="button" variant="ghost" onClick={() => setCategoryDraft(null)}>
                ביטול
              </Button>
              {categoryDraft.id && categories.some((c) => c.id === categoryDraft.id) && (
                <Button
                  type="button"
                  variant="destructive"
                  // The category open in this form - not the tab clicked while it stood open.
                  onClick={() => void deleteCategory(categories.find((c) => c.id === categoryDraft.id)!)}
                  disabled={removeCategory.isPending}
                >
                  <Trash2 className="size-4" /> מחיקת הלשונית
                </Button>
              )}
            </div>
          </div>
        </form>
      )}

      {/* "ימים, תפילות ותצוגה" from the tiles: how the times are shown, open, in place of the list. */}
      {manageOnly && prayerDisplay}

      {showList && hasSubcategories && !chosen && (
        <div
          role="group"
          dir="rtl"
          className="flex gap-1 rounded-lg bg-secondary p-1 text-right"
          aria-label="תפילות"
        >
          {prayerTabs.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setPrayer(item.id)}
              aria-pressed={prayer === item.id}
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

      {showList && (
        <>
      {/* Under the tabs and the prayers, over the list it adds to: a new
          minyan goes into what is chosen above it, at the end of its list. */}
      <div className="flex justify-end">
        <Button
          disabled={!selectedCategory}
          onClick={() =>
            selectedCategory &&
            openDraft({
              ...newMinyan(selectedCategory),
              prayer: hasSubcategories ? prayer : "other",
              sort_order: nextSortOrder(minyanim),
            })
          }
        >
          <Plus className="size-4" /> מניין חדש
        </Button>
      </div>

      <div className="card-elev divide-y divide-border">
        {minyanimError && <AdminError what="המניינים" onRetry={() => void refetch()} />}
        {minyanimLoading && <p className="p-6 text-center text-muted-foreground">טוען…</p>}
        {!minyanimLoading && !minyanimError && rows.length === 0 && (
          <p className="p-6 text-center text-muted-foreground">אין מניינים כאן עדיין.</p>
        )}
        {minyanOrder.ordered.map((m) => {
          const resolved = resolveMinyan(m, zmanim);
          return (
            <div
              key={m.id}
              {...minyanOrder.rowProps(m.id)}
              data-testid={`minyan-row-${m.id}`}
              className={
                "flex flex-wrap items-center gap-2 px-3 py-3 sm:flex-nowrap sm:gap-3 sm:px-4 " +
                (minyanOrder.draggedId === m.id ? "opacity-50" : "")
              }
            >
              <DragGrip label={`גרירת המניין ${m.label}`} {...minyanOrder.gripProps(m.id)} />
              <div className="min-w-0 basis-[calc(100%-4rem)] sm:basis-auto sm:flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2 font-medium">
                  <InlineEdit
                    table="minyanim"
                    id={m.id}
                    field="label"
                    value={m.label}
                    queryKey="minyanim"
                    alwaysEditable
                    ariaLabel={`עריכת שם המניין ${m.label}`}
                    className="min-w-0"
                    inputClassName="w-full min-w-0 sm:min-w-40"
                    display={<span className="break-words sm:truncate">{m.label}</span>}
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
                    placeholder="הוספת מיקום"
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
                    placeholder="הוספת הערה"
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
                  display={resolved?.time ?? "-"}
                />
              ) : (
                <button
                  type="button"
                  className="rounded-md px-1 font-display text-lg tabular-nums text-primary ring-1 ring-dashed ring-primary/40 hover:bg-primary/5"
                  onClick={() => openDraft(m)}
                  aria-label={`עריכת זמן יחסי ${m.label}`}
                  title="הזמן מחושב - לחצו לעריכת הכלל"
                >
                  {resolved?.time ?? "-"}
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
                onClick={() => void deleteMinyan(m)}
                aria-label={`מחיקת ${m.label}`}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>
        </>
      )}

      {showList && draft && (
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
                <Label>תפילה (שחרית, מנחה…)</Label>
                <Select
                  value={draft.prayer ?? "shacharit"}
                  onValueChange={(v) => setDraft({ ...draft, prayer: v })}
                >
                  <SelectTrigger aria-label="תפילה">
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
              <Label>לשונית</Label>
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

          {/* The order of the minyanim is set by dragging them in the list.
              What a gabbai needs to build a minyan is its name, its time and
              its place; a season and a reminder are folded away here, with a
              line saying what is set in it so nothing hidden is also forgotten. */}
          <Collapsible
            title="מתקדם"
            headingLevel="h4"
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
                <Label htmlFor="minyan-notification">לאפשר תזכורת לטלפון (למי שבחר לקבל מניינים)</Label>
              </div>
              <div className="space-y-2">
                <Label>תזכורת לטלפון - כמה דקות לפני המניין</Label>
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
          </Collapsible>

          <div className="flex gap-2">
            <SaveButton pending={save.isPending} />
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              ביטול
            </Button>
          </div>
        </form>
      )}

      {/* On the tabs, the list comes first; how the times are shown is folded
          under it, closed, and opened when a link asked for it (#prayer-display). */}
      {!chosen && !manageOnly && (
        <Collapsible
          title="איך יראו זמני התפילות"
          icon={MonitorSmartphone}
          defaultOpen={typeof window !== "undefined" && window.location.hash === "#prayer-display"}
          testId="prayer-display-fold"
        >
          {prayerDisplay}
        </Collapsible>
      )}
    </div>
  );
}

/** 2026-09-01 -> 1.9.2026, for the line that says what is set under "מתקדם". */
function formatDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? `${d}.${m}.${y}` : iso;
}
