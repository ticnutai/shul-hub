import type { ReactNode } from "react";

/**
 * What a list hid, at its foot, each with its way back: hiding a ready
 * design, theme, background, frame or box loses nothing (readyItems.ts), and
 * neither does hiding a frame of a board of parts or a text of the board. One
 * shelf for all of them - the frames and the board's texts had lists of their
 * own, one of rows and one of round chips.
 */
export function HiddenShelf({
  items,
  onRestore,
  testId,
  title = "מוכנים שהוסתרו",
  restoreLabel = "החזרה",
  restoreAria = (name) => `החזרת ${name}`,
  defaultOpen = false,
}: {
  items: Array<{ key: string; name: string; preview?: ReactNode }>;
  onRestore: (key: string) => void;
  testId?: string;
  /** What the shelf holds ("מסגרות מוסתרות"). */
  title?: string;
  /** The way back, in a word ("הצגה"). */
  restoreLabel?: string;
  restoreAria?: (name: string) => string;
  /** Open from the start, where the hidden are what one comes for. */
  defaultOpen?: boolean;
}) {
  if (!items.length) return null;
  return (
    <details className="rounded-md border border-dashed p-2 text-xs" data-testid={testId} open={defaultOpen || undefined}>
      <summary className="cursor-pointer text-muted-foreground">{title} ({items.length}) - אפשר להחזיר</summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span key={it.key} className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-1.5 py-1">
            {it.preview}
            <span>{it.name}</span>
            <button
              type="button"
              className="rounded border px-1.5 text-primary hover:bg-primary hover:text-primary-foreground"
              aria-label={restoreAria(it.name)}
              onClick={() => onRestore(it.key)}
            >
              {restoreLabel}
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
      className="absolute -end-1 -top-1 z-[1] flex size-5 items-center justify-center rounded-full border bg-background text-[11px] opacity-0 shadow transition hover:bg-destructive hover:text-destructive-foreground focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
    >
      ✕
    </button>
  );
}

/**
 * The small ✕ inside a chip or beside a row (an occasion added by hand, a
 * picture of one's own, a content taking turns): the same round button as
 * the tile's, standing in the line rather than on a corner.
 */
export function ChipRemove({ label, title, onClick }: { label: string; title?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex size-5 shrink-0 items-center justify-center rounded-full border bg-background text-[11px] text-muted-foreground shadow-sm transition hover:bg-destructive hover:text-destructive-foreground"
    >
      ✕
    </button>
  );
}
