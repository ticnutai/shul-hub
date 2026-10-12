/**
 * Drag-to-reorder by a grip, the one way for every list in the gabbai's area.
 *
 * There were three: the minyanim's (a copy of the row under the pointer, a bar
 * where it would land, saved on letting go), the content lists' (the rows move
 * aside while dragging, saved on letting go) and the home page's sections (the
 * same, but kept until "שמירה"). Now there is this one, and every list keeps
 * its own way of being saved:
 *
 *   save   - the order is written the moment the row is let go (minyanim,
 *            their tabs, announcements, shiurim, chavrutot, shiur categories);
 *   onReorder - the new order goes back to the form, which keeps it with its
 *            other changes until "שמירה" (the home page's sections, the
 *            prayers inside a tab being edited).
 *
 * Pointer events work for a finger and a mouse alike. While dragging, the rows
 * move aside under the pointer, so where the row will land is always in sight;
 * the page scrolls near the top or bottom of the window; Escape puts it back.
 * The grip also answers the arrow keys, a step at a time.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@community/integrations/supabase/client";
import { communityId } from "@/community/lib/community";
import { hebrewError } from "@community/lib/hebrewError";
import { cn } from "@/lib/utils";

/** The tables whose rows carry a sort_order the gabbai sets by dragging. */
export type OrderedTable =
  | "minyanim"
  | "minyan_categories"
  | "announcements"
  | "shiurim"
  | "shiur_categories"
  | "chavrutot";

/** A list with one item moved from one place to another. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** A new row's place: after the last one (the largest sort_order, plus ten). */
export function nextSortOrder(items: { sort_order?: number | null }[]): number {
  return items.reduce((max, item) => Math.max(max, Number(item.sort_order) || 0), 0) + 10;
}

/**
 * The order, written: 10, 20, 30… in the order given. Only rows of the
 * synagogue being edited - an id from another one changes nothing.
 */
export async function saveSortOrder(table: OrderedTable, ids: string[]): Promise<void> {
  const community = communityId();
  const results = await Promise.all(
    ids.map((id, index) =>
      supabase
        .from(table)
        .update({ sort_order: (index + 1) * 10 } as never)
        .eq("community_id", community)
        .eq("id", id),
    ),
  );
  const failure = results.find((result) => result.error)?.error;
  if (failure) throw failure;
}

let groups = 0;

export function useReorder<T extends { id: string }>(
  items: T[],
  options: {
    /** Written at once when the row is let go: the table, and the cache to refresh. */
    save?: { table: OrderedTable; queryKey: string };
    /** Or handed back, to be kept with the form's other changes. */
    onReorder?: (ordered: T[]) => void;
    disabled?: boolean;
  },
) {
  const qc = useQueryClient();
  const [group] = useState(() => `reorder-${++groups}`);
  /** The ids in their new order: while dragging, and until the saved order has come back. */
  const [order, setOrder] = useState<string[] | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const orderRef = useRef<string[] | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => () => cleanupRef.current?.(), []);

  const ordered = useMemo(() => {
    if (!order) return items;
    const byId = new Map(items.map((item) => [item.id, item]));
    const placed = order.map((id) => byId.get(id)).filter((item): item is T => Boolean(item));
    // A row that arrived meanwhile stays where the list put it, at its end.
    return [...placed, ...items.filter((item) => !order.includes(item.id))];
  }, [items, order]);

  async function commit(ids: string[]) {
    const { save, onReorder } = optionsRef.current;
    const byId = new Map(itemsRef.current.map((item) => [item.id, item]));
    const next = ids.map((id) => byId.get(id)).filter((item): item is T => Boolean(item));
    if (!save) {
      orderRef.current = null;
      setOrder(null);
      onReorder?.(next);
      return;
    }
    setSaving(true);
    try {
      await saveSortOrder(save.table, ids);
      await qc.invalidateQueries({ queryKey: [save.queryKey] });
      toast.success("נשמר");
    } catch (error) {
      toast.error(hebrewError(error, "שמירת הסדר נכשלה"));
      await qc.invalidateQueries({ queryKey: [save.queryKey] });
    } finally {
      setSaving(false);
      orderRef.current = null;
      setOrder(null);
    }
  }

  function begin(event: ReactPointerEvent<HTMLElement>, id: string) {
    if (optionsRef.current.disabled || saving || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    cleanupRef.current?.();
    const doc = event.currentTarget.ownerDocument;
    const pointerId = event.pointerId;
    const initial = itemsRef.current.map((item) => item.id);
    orderRef.current = initial;
    setOrder(initial);
    setDraggedId(id);
    const previousCursor = doc.body.style.cursor;
    doc.body.style.cursor = "grabbing";

    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      const view = doc.defaultView;
      // Near the top or bottom of the window, the page moves with the drag.
      if (view) {
        const edge = 70;
        if (e.clientY < edge) view.scrollBy(0, -14);
        else if (e.clientY > view.innerHeight - edge) view.scrollBy(0, 14);
      }
      const target = doc
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>(`[data-reorder-group="${group}"]`);
      const targetId = target?.dataset["reorderId"];
      const current = orderRef.current;
      if (!targetId || !current || targetId === id) return;
      const next = moveItem(current, current.indexOf(id), current.indexOf(targetId));
      if (next === current) return;
      orderRef.current = next;
      setOrder(next);
    };
    const finish = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const final = orderRef.current;
      cleanup();
      if (final && final.join(",") !== initial.join(",")) void commit(final);
      else {
        orderRef.current = null;
        setOrder(null);
      }
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId === pointerId) abort();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") abort();
    };
    const abort = () => {
      cleanup();
      orderRef.current = null;
      setOrder(null);
    };
    const cleanup = () => {
      doc.removeEventListener("pointermove", move, true);
      doc.removeEventListener("pointerup", finish, true);
      doc.removeEventListener("pointercancel", cancel, true);
      doc.removeEventListener("keydown", onKey, true);
      doc.body.style.cursor = previousCursor;
      cleanupRef.current = null;
      setDraggedId(null);
    };
    doc.addEventListener("pointermove", move, true);
    doc.addEventListener("pointerup", finish, true);
    doc.addEventListener("pointercancel", cancel, true);
    doc.addEventListener("keydown", onKey, true);
    cleanupRef.current = cleanup;
  }

  /** The arrow keys on the grip: a step earlier (up, or right in a row) or later. */
  function step(event: ReactKeyboardEvent<HTMLElement>, id: string) {
    const earlier = event.key === "ArrowUp" || event.key === "ArrowRight";
    const later = event.key === "ArrowDown" || event.key === "ArrowLeft";
    if ((!earlier && !later) || optionsRef.current.disabled || saving) return;
    event.preventDefault();
    const ids = ordered.map((item) => item.id);
    const from = ids.indexOf(id);
    const next = moveItem(ids, from, earlier ? from - 1 : from + 1);
    if (next === ids) return;
    setOrder(next);
    void commit(next);
  }

  /** On the row: which list it is in and which row it is. */
  const rowProps = (id: string) => ({ "data-reorder-group": group, "data-reorder-id": id });
  /** On the grip. */
  const gripProps = (id: string) => ({
    disabled: Boolean(options.disabled) || saving,
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => begin(event, id),
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => step(event, id),
  });

  return { ordered, draggedId, saving, rowProps, gripProps };
}

/** The grip a row is dragged by - the same look in every list. */
export function DragGrip({
  label,
  testId,
  small,
  className,
  ...props
}: {
  label: string;
  testId?: string;
  /** A row of tabs is a tighter place than a list. */
  small?: boolean;
  className?: string;
} & ReturnType<ReturnType<typeof useReorder>["gripProps"]>) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      title="גררו לשינוי הסדר, או השתמשו בחצים"
      className={cn(
        "shrink-0 cursor-grab touch-none rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-wait disabled:opacity-60",
        small ? "p-1.5" : "p-2",
        className,
      )}
      {...props}
    >
      <GripVertical className={small ? "size-4" : "size-5"} aria-hidden />
    </button>
  );
}
