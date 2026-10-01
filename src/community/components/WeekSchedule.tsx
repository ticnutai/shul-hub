import type { WeekDay } from "@community/lib/week-schedule";

/**
 * "כל השבוע" on the community page: each day tab one after another, its
 * prayers under it, and the minyanim of each prayer with their times. What
 * is empty is not drawn (week-schedule.ts already left it out).
 */
const dateLabel = (d: Date) =>
  new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "Asia/Jerusalem" }).format(d);

/** Which days a tab stands for, under its name. */
function daysOf(day: WeekDay): string | null {
  if (day.category.system_key === "weekday") return "ימים א׳–ה׳";
  if (day.category.system_key === "friday" || day.category.system_key === "shabbat") return dateLabel(day.date);
  return null;
}

export function WeekSchedule({ days }: { days: WeekDay[] }) {
  if (!days.length) {
    return <p className="p-6 text-center text-muted-foreground">עדיין לא הוגדרו מניינים.</p>;
  }
  return (
    <div className="divide-y divide-border" data-testid="week-schedule">
      {days.map((day) => (
        <section key={day.category.id} className="px-4 py-4" data-week-day={day.category.system_key ?? day.category.id}>
          <h3 className="flex items-baseline gap-2 text-lg font-semibold">
            {day.category.name}
            {daysOf(day) && <span className="text-xs font-normal text-muted-foreground">{daysOf(day)}</span>}
          </h3>
          <div className="mt-2 space-y-3">
            {day.groups.map((group) => (
              <div key={group.id}>
                {group.label && <p className="mb-1 text-xs font-semibold text-primary">{group.label}</p>}
                <ul className="space-y-1">
                  {group.rows.map(({ minyan, time, source }) => (
                    <li key={minyan.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{minyan.label}</span>
                        {[minyan.room, minyan.note, source].filter(Boolean).length > 0 && (
                          <span className="text-xs text-muted-foreground"> · {[minyan.room, minyan.note, source].filter(Boolean).join(" · ")}</span>
                        )}
                      </span>
                      {/* The time is never broken across lines; the description gives way. */}
                      <span className="shrink-0 whitespace-nowrap font-display text-xl font-semibold tabular-nums text-primary">{time}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="px-4 py-2 text-[11px] text-muted-foreground">
        הזמנים הקבועים של כל יום. שינוי של יום אחד מופיע בלשונית של אותו יום.
      </p>
    </div>
  );
}
