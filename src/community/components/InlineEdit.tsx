import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@community/integrations/supabase/client";
import { useEditMode } from "@community/lib/edit-mode";
import { cn } from "@/lib/utils";

/** Tables whose rows may be edited inline directly on the public pages. */
export type EditableTable =
  "settings" | "minyanim" | "announcements" | "shiurim" | "shiur_categories" | "chavrutot";

type InlineEditProps = {
  table: EditableTable;
  id: string;
  field: string;
  /** The raw current value that will be edited. */
  value: string | number | null;
  /** react-query key(s) to invalidate after saving. */
  queryKey: string | string[];
  as?: "text" | "textarea" | "time" | "number";
  /** What to render when NOT editing (defaults to the raw value). */
  display?: ReactNode;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Enable direct editing even when the public-site edit mode is off (for admin lists). */
  alwaysEditable?: boolean;
  ariaLabel?: string;
};

/**
 * Inline, click-to-edit value. Renders plain text for everyone; for an admin
 * with edit mode on, it becomes a clickable field that saves straight to
 * Supabase (admin RLS policies already allow the write).
 */
export function InlineEdit({
  table,
  id,
  field,
  value,
  queryKey,
  as = "text",
  display,
  placeholder = "לחץ להוספה",
  className,
  inputClassName,
  alwaysEditable = false,
  ariaLabel,
}: InlineEditProps) {
  const { editMode } = useEditMode();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      if (ref.current && "select" in ref.current) ref.current.select();
    }
  }, [editing]);

  const shown: ReactNode = display ?? (value === null || value === "" ? null : String(value));

  if (!editMode && !alwaysEditable) return <>{shown}</>;

  function begin() {
    setDraft(value === null || value === undefined ? "" : String(value));
    setEditing(true);
  }

  async function commit() {
    setEditing(false);
    const raw = draft.trim();
    const next: string | number | null = as === "number" ? (raw === "" ? null : Number(raw)) : raw;
    if (String(next ?? "") === String(value ?? "")) return; // unchanged
    setSaving(true);
    const { error } = await supabase
      .from(table)
      .update({ [field]: next } as never)
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error(error.message || "השמירה נכשלה");
      return;
    }
    qc.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });
    toast.success("נשמר");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setEditing(false);
    else if (e.key === "Enter" && as !== "textarea") {
      e.preventDefault();
      commit();
    }
  }

  if (editing) {
    const shared = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
      onKeyDown,
      className: cn(
        "rounded-md border border-primary bg-background px-2 py-1 font-normal text-foreground outline-none ring-2 ring-primary/30",
        inputClassName,
      ),
    };
    if (as === "textarea") {
      return (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          rows={3}
          {...shared}
          className={cn(shared.className, "block w-full")}
        />
      );
    }
    return (
      <input
        ref={ref as React.RefObject<HTMLInputElement>}
        type={as === "time" ? "time" : as === "number" ? "number" : "text"}
        aria-label={ariaLabel}
        {...shared}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={begin}
      disabled={saving}
      aria-label={ariaLabel}
      title="לחץ לעריכה"
      className={cn(
        "group/inline inline-flex max-w-full items-center gap-1 rounded-md -mx-1 px-1 text-start align-baseline ring-1 ring-dashed ring-primary/40 transition-colors hover:bg-primary/5 hover:ring-primary",
        className,
      )}
    >
      <span className={cn(shown === null && "italic text-muted-foreground")}>
        {shown ?? placeholder}
      </span>
      <Pencil className="size-3 shrink-0 opacity-40 transition-opacity group-hover/inline:opacity-100" />
    </button>
  );
}

/** Floating toggle button — visible only to admins; flips edit mode on/off. */
export function EditModeToggle() {
  const { editMode, setEditMode, canEdit } = useEditMode();
  if (!canEdit) return null;
  return (
    <>
      {editMode && (
        <div className="fixed inset-x-0 top-0 z-50 bg-primary/90 py-1 text-center text-xs font-medium text-primary-foreground shadow">
          מצב עריכה פעיל — לחץ על טקסט כדי לערוך ישירות
        </div>
      )}
      <button
        type="button"
        onClick={() => setEditMode(!editMode)}
        aria-label={editMode ? "יציאה ממצב עריכה" : "מצב עריכה"}
        title={editMode ? "יציאה ממצב עריכה" : "מצב עריכה"}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-colors md:bottom-8 md:right-8",
          editMode
            ? "bg-primary text-primary-foreground ring-4 ring-primary/30"
            : "border border-border bg-card text-foreground hover:bg-accent",
        )}
      >
        {editMode ? <Check className="size-6" /> : <Pencil className="size-6" />}
      </button>
    </>
  );
}
