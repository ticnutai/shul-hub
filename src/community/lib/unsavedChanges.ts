/**
 * Changes that were not saved yet, and what happens when the gabbai leaves them.
 *
 * Closing the tab or reloading always asked (the browser's own question).
 * Moving to another section, tile or step inside the gabbai's area did not:
 * the screen with the half-filled form simply went away, and the changes with
 * it. Now every form that keeps changes until "שמירה" says so here while it
 * has some, and every move inside the area asks first - the same window as
 * every other "בטוח?" on the site.
 */
import { useEffect, useId, useRef } from "react";
import { confirmAction } from "@/components/ConfirmDialog";

/** The forms that have changes right now (by their own id). */
const dirtyForms = new Set<string>();

export function hasUnsavedChanges(): boolean {
  return dirtyForms.size > 0;
}

/**
 * While `dirty`: leaving the page asks (the browser's question), and so does
 * moving elsewhere inside the gabbai's area (confirmLeave, below).
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const id = useId();
  useEffect(() => {
    if (!dirty) return;
    dirtyForms.add(id);
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers show the box only when this is set.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      dirtyForms.delete(id);
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty, id]);
}

/**
 * Before moving to another section, tile or step: true when there is nothing
 * unsaved, or the gabbai chose to leave it.
 */
export async function confirmLeave(): Promise<boolean> {
  if (!hasUnsavedChanges()) return true;
  const ok = await confirmAction({
    title: "לצאת בלי לשמור?",
    description: "יש כאן שינויים שלא נשמרו. אם יוצאים עכשיו, הם לא יישמרו.",
    confirmLabel: "יציאה בלי שמירה",
  });
  // The forms left behind are about to close; until they do, they do not ask again.
  if (ok) dirtyForms.clear();
  return ok;
}

/**
 * A form opened from a list (a new minyan, an announcement being edited) has
 * changes once what is in it differs from what it opened with. Keyed by the
 * row (`id`, or a new one), so opening another row starts afresh.
 */
export function useDraftGuard<T extends { id?: string } | null>(draft: T) {
  const base = useRef<{ key: string; json: string } | null>(null);
  const key = draft ? (draft.id ?? "new") : null;
  if (!draft || key === null) base.current = null;
  else if (!base.current || base.current.key !== key) base.current = { key, json: JSON.stringify(draft) };
  const dirty = Boolean(draft) && JSON.stringify(draft) !== base.current?.json;
  useUnsavedChangesGuard(dirty);
  return dirty;
}
