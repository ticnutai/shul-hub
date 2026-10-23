import { InfoTip } from "@/components/InfoTip";
import type { ReactNode } from "react";

/**
 * The one way a part of a design section is laid out, in every section:
 * a title over a line, a line of explanation when it needs one, then its
 * controls. Before this each section had its own - a bordered card here, a
 * bold label there, nothing at all in a third - and the same kind of thing
 * looked different depending on where it stood.
 */
export function SubPart({
  title,
  hint,
  children,
  testId,
  bare = false,
  aside,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  testId?: string;
  /** Inside another part: its controls only, without a second title. */
  bare?: boolean;
  /** A short word on the title's own line - a state, not a line of its own under it. */
  aside?: ReactNode;
}) {
  if (bare) return <div className="space-y-2" data-testid={testId}>{children}</div>;
  return (
    <section className="space-y-2" data-testid={testId}>
      {/* The explanation behind an ⓘ beside the title: a line of the page less. */}
      <div className="flex items-center gap-1.5 border-b pb-1">
        <h4 className="text-sm font-semibold">{title}</h4>
        {hint && <InfoTip>{hint}</InfoTip>}
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * A group of controls inside a part (the background being built, its
 * sliders, a frame's place and size): a light card with a small label - the
 * same card wherever there is one.
 */
export function InnerCard({ label, children, testId }: { label?: string; children: ReactNode; testId?: string }) {
  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid={testId}>
      {label && <div className="text-xs font-medium text-muted-foreground">{label}</div>}
      {children}
    </div>
  );
}

/** Something rarely needed, folded away the same way everywhere (the base colours). */
export function Folded({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <details className="rounded-lg border p-3" data-testid={testId}>
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{label}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
