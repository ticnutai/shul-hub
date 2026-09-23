import { useMemo } from "react";
import { InlineEdit } from "@community/components/InlineEdit";
import { formatTime } from "@community/lib/zmanim";
import { useNow } from "@community/lib/realtime";
import type { ResolvedMinyan } from "@community/lib/minyan-time";
import { prayerLabel, type MinyanSubcategory } from "@community/lib/data";

/**
 * The two richer schedule layouts an admin can pick per category, alongside
 * tabs / list / table in CommunityHome.
 *
 * Both show every minyan of the category at once, like the table does, rather
 * than one prayer tab at a time. Both keep InlineEdit on the minyan label so an
 * admin can still correct a name in place whichever layout is active.
 */

interface LayoutProps {
  rows: ResolvedMinyan[];
  prayerTabs: MinyanSubcategory[];
}

/** Minutes past midnight in Jerusalem, matching how `resolveMinyan` counts. */
function jerusalemMinutes(date: Date): number {
  const [h, m] = formatTime(date).split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * Index of the first minyan that has not started yet, or -1 once the day's
 * last one has passed. Rows arrive sorted by `minutes`.
 */
function useNextIndex(rows: ResolvedMinyan[]): number {
  // Half a minute is plenty: the highlight moves at most once per minyan, and
  // a one-second tick would re-render the whole schedule for nothing.
  const now = useNow(30_000);
  const nowMinutes = jerusalemMinutes(now);
  // A minyan called off today is not the next minyan - the same rule the
  // board uses, so the phone and the wall never disagree about which one it is.
  return useMemo(
    () => rows.findIndex((row) => row.minutes >= nowMinutes && !row.cancelled),
    [rows, nowMinutes],
  );
}

export function details(row: ResolvedMinyan): string {
  // row.note is the one-day exception's own word ("היום בבית מדרש"); it goes
  // first, because on the day it exists it is the thing that changed.
  return [row.note, row.minyan.room, row.minyan.note, row.source].filter(Boolean).join(" · ");
}

/* ------------------------------------------------------------------------- */

/**
 * Chronological list with the upcoming minyan called out.
 *
 * Answers the one question most people have on opening the page — "what is
 * the next minyan?" — without making them scan. Minyanim that have already
 * started are dimmed rather than hidden, since latecomers still look them up.
 */
export function TimelineLayout({ rows, prayerTabs }: LayoutProps) {
  const nextIndex = useNextIndex(rows);

  return (
    <ol className="relative px-4 py-3" data-testid="prayer-timeline">
      {/* The rail. Positioned under the dots, on the right for RTL. */}
      <span
        aria-hidden
        className="absolute bottom-6 right-[1.6rem] top-6 w-px bg-border"
      />
      {rows.map((row, index) => {
        const isNext = index === nextIndex;
        const isPast = nextIndex === -1 || index < nextIndex;
        return (
          <li
            key={row.minyan.id}
            className={`relative flex items-center gap-4 py-2.5 ${isPast ? "opacity-55" : ""}`}
          >
            <span
              aria-hidden
              className={`relative z-10 size-3 shrink-0 rounded-full border-2 ${
                isNext
                  ? "border-primary bg-primary ring-4 ring-primary/20"
                  : isPast
                    ? "border-muted-foreground/40 bg-background"
                    : "border-primary/60 bg-background"
              }`}
            />
            <span
              className={`w-16 shrink-0 font-display text-xl font-semibold tabular-nums ${
                isNext ? "text-primary" : ""
              }`}
            >
              {row.time}
            </span>
            <div
              className={`min-w-0 flex-1 rounded-lg px-3 py-2 ${
                isNext ? "bg-primary/10 ring-1 ring-primary/30" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary">
                  {prayerLabel(prayerTabs, row.minyan.prayer)}
                </span>
                {isNext && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-bold text-primary-foreground">
                    הבא
                  </span>
                )}
              </div>
              <p className="truncate font-medium">
                <InlineEdit
                  table="minyanim"
                  id={row.minyan.id}
                  field="label"
                  value={row.minyan.label}
                  queryKey="minyanim"
                />
              </p>
              {details(row) && (
                <p className="truncate text-xs text-muted-foreground">{details(row)}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * Grid of tiles with the time as the dominant element.
 *
 * Suited to a category with a handful of minyanim, and to a wide screen in the
 * lobby, where each tile can be read from across the room. Falls to two
 * columns on a phone so the times stay large.
 */
export function CardsLayout({ rows, prayerTabs }: LayoutProps) {
  const nextIndex = useNextIndex(rows);

  return (
    <div
      className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4"
      data-testid="prayer-cards"
    >
      {rows.map((row, index) => {
        const isNext = index === nextIndex;
        return (
          <article
            key={row.minyan.id}
            className={`flex min-w-0 flex-col rounded-xl border p-3 transition-shadow ${
              isNext
                ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/30"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-primary">
                {prayerLabel(prayerTabs, row.minyan.prayer)}
              </span>
              {isNext && (
                <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-bold text-primary-foreground">
                  הבא
                </span>
              )}
            </div>
            <span
              className={`mt-1 font-display text-3xl font-semibold tabular-nums ${
                isNext ? "text-primary" : ""
              }`}
            >
              {row.time}
            </span>
            <p className="mt-1 truncate text-sm font-medium">
              <InlineEdit
                table="minyanim"
                id={row.minyan.id}
                field="label"
                value={row.minyan.label}
                queryKey="minyanim"
              />
            </p>
            {details(row) && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{details(row)}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
