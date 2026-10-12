/**
 * A part of a screen folded down to its title line - the one fold in the
 * gabbai's area.
 *
 * There were three: "מתקדם" in the minyan form (the browser's own fold), the
 * coordinates under the synagogue's place (the browser's fold again, drawn
 * differently) and "שינוי ליום אחד" (a button of its own that remembered how
 * it was left). Now one, the same look everywhere: a title, a short line
 * saying what is set inside while it is closed (so nothing hidden is also
 * forgotten), and - when `rememberKey` is given - it stays as it was left.
 */
import { useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Collapsible({
  title,
  summary,
  icon: Icon,
  defaultOpen = false,
  rememberKey,
  className,
  children,
  testId,
  headingLevel = "h3",
}: {
  title: ReactNode;
  /** Shown beside the title while closed: what is set inside. */
  summary?: ReactNode;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  /** Kept in this browser: open or closed, as it was left. */
  rememberKey?: string;
  className?: string;
  children: ReactNode;
  testId?: string;
  headingLevel?: "h3" | "h4";
}) {
  const [open, setOpen] = useState(() => {
    if (!rememberKey) return defaultOpen;
    try {
      const kept = localStorage.getItem(rememberKey);
      return kept === null ? defaultOpen : kept !== "0";
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () =>
    setOpen((was) => {
      if (rememberKey) {
        try {
          localStorage.setItem(rememberKey, was ? "0" : "1");
        } catch {
          /* private mode: it simply is not remembered */
        }
      }
      return !was;
    });
  const Heading = headingLevel;

  return (
    <section className={cn("rounded-xl border border-border bg-card", className)} data-testid={testId} data-open={open}>
      <Heading className="m-0">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-right text-sm font-semibold"
        >
          {Icon && <Icon className="size-4 shrink-0 text-primary" aria-hidden />}
          <span>{title}</span>
          {!open && summary && <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">· {summary}</span>}
          <span className="ms-auto flex shrink-0 items-center gap-1 text-xs font-normal text-muted-foreground">
            {open ? "סגירה" : "פתיחה"}
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
          </span>
        </button>
      </Heading>
      {open && <div className="space-y-3 border-t border-border p-4">{children}</div>}
    </section>
  );
}
