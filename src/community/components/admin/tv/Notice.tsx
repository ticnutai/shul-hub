/**
 * One look for every note in the board editor: what is being edited (an
 * occasion, one kind of screen), what the preview shows instead of the draft,
 * a warning about the board, an import waiting for a choice, screens that
 * went silent. They were seven boxes with seven paddings, emoji for icons and
 * three shades of amber; now a note is a Notice, and its kind says how loud.
 *
 *   info    - what is going on (primary tint)
 *   neutral - the quiet default ("editing all screens")
 *   warning - look at this (amber)
 *   error   - something is wrong (red)
 *
 * Also the one chip used for choosing among items in a row (the board's
 * pages, the occasions beside them, the slides under the preview).
 */
import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle, Info, XCircle, type LucideIcon } from "lucide-react";

export type NoticeVariant = "info" | "neutral" | "warning" | "error";

const VARIANTS: Record<NoticeVariant, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: "border-primary/40 bg-primary/5", icon: "text-primary", Icon: Info },
  neutral: { box: "border-border bg-muted/40", icon: "text-muted-foreground", Icon: Info },
  warning: {
    box: "border-amber-400/70 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100",
    icon: "text-amber-700 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  error: {
    box: "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
    icon: "text-red-600 dark:text-red-400",
    Icon: XCircle,
  },
};

/** The classes of a note's box, for a note that is itself a button (TvAdmin's offline line). */
export const noticeClass = (variant: NoticeVariant = "info") => `rounded-lg border text-sm ${VARIANTS[variant].box}`;

export function Notice({
  variant = "info",
  icon,
  actions,
  children,
  className = "",
  ...rest
}: {
  variant?: NoticeVariant;
  /** Another icon for this note; null for none. */
  icon?: LucideIcon | null;
  /** Buttons at the end of the note. */
  actions?: ReactNode;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">) {
  const v = VARIANTS[variant];
  const Icon = icon === undefined ? v.Icon : icon;
  return (
    <div className={`flex flex-wrap items-start gap-2 p-3 ${noticeClass(variant)} ${className}`} {...rest}>
      {Icon && <Icon className={`mt-0.5 size-4 shrink-0 ${v.icon}`} aria-hidden />}
      <div className="min-w-0 flex-1">{children}</div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** One chip for choosing among items in a row: rounded, the chosen one ringed. */
export const choiceChipClass = (selected: boolean, extra = "") =>
  `inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition ${
    selected ? "border-primary bg-primary/10 font-medium ring-2 ring-primary" : "bg-background hover:border-primary/50"
  } ${extra}`;

/** The number in front of a chip's name, the same everywhere: "1." */
export function ChipNumber({ n }: { n: number }) {
  return <span className="tabular-nums text-muted-foreground">{n}.</span>;
}
