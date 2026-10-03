import type { ReactNode } from "react";

/**
 * The ready-made items a list hid, at its foot, each with "החזרה": hiding a
 * ready design, theme, background, frame or box loses nothing (readyItems.ts).
 */
export function HiddenShelf({
  items,
  onRestore,
  testId,
}: {
  items: Array<{ key: string; name: string; preview?: ReactNode }>;
  onRestore: (key: string) => void;
  testId?: string;
}) {
  if (!items.length) return null;
  return (
    <details className="rounded-md border border-dashed p-2 text-xs" data-testid={testId}>
      <summary className="cursor-pointer text-muted-foreground">מוכנים שהוסתרו ({items.length}) - אפשר להחזיר</summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span key={it.key} className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-1.5 py-1">
            {it.preview}
            <span>{it.name}</span>
            <button
              type="button"
              className="rounded border px-1.5 text-primary hover:bg-primary hover:text-primary-foreground"
              aria-label={`החזרת ${it.name}`}
              onClick={() => onRestore(it.key)}
            >
              החזרה
            </button>
          </span>
        ))}
      </div>
    </details>
  );
}

/** The small ✕ on a tile: deletes one of the shul's own, hides a ready one. */
export function TileRemove({ name, ready, onClick }: { name: string; ready: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={ready ? `הסתרת ${name}` : `מחיקת ${name}`}
      title={ready ? "הסתרה מהרשימה (אפשר להחזיר למטה)" : "מחיקה (לוח שמשתמש בו לא ישתנה)"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute -left-1 -top-1 z-10 flex size-5 items-center justify-center rounded-full border bg-background text-[11px] opacity-0 shadow transition hover:bg-destructive hover:text-destructive-foreground focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
    >
      ✕
    </button>
  );
}
