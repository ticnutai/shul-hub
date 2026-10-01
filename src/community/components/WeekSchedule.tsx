import type { MinyanCategory } from "@community/lib/data";
import { minyanSubcategories } from "@community/lib/data";
import type { WeekDay } from "@community/lib/week-schedule";
import { DaySchedule } from "@community/components/DaySchedule";
import type { PrayerLayoutMode } from "@community/components/PrayerLayoutPicker";

/**
 * "כל השבוע" on the website: each day tab one after another, in the order the
 * gabbai chose (today on top, or the tabs' own order), each day drawn in the
 * same layout as its own tab. What is empty is not drawn.
 */
const dateLabel = (d: Date) =>
  new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "Asia/Jerusalem" }).format(d);

/** Which days a tab stands for, under its name. */
function daysOf(day: WeekDay): string | null {
  if (day.category.system_key === "weekday") return "ימים א׳–ה׳";
  if (day.category.system_key) return dateLabel(day.date);
  return null;
}

export function WeekSchedule({
  days,
  layoutFor,
}: {
  days: WeekDay[];
  layoutFor: (category: MinyanCategory) => PrayerLayoutMode;
}) {
  if (!days.length) {
    return <p className="card-elev mt-4 p-6 text-center text-muted-foreground">עדיין לא הוגדרו מניינים.</p>;
  }
  return (
    <div className="mt-2 space-y-8" data-testid="week-schedule">
      {days.map((day) => (
        <section
          key={day.category.id}
          data-week-day={day.category.system_key ?? day.category.id}
          data-today={day.isToday || undefined}
          className={day.isToday ? "rounded-xl border-2 border-gold/50 p-3 sm:p-4" : undefined}
        >
          <h3 className="flex flex-wrap items-baseline gap-2 text-lg font-semibold">
            {day.category.name}
            {day.isToday && (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">היום</span>
            )}
            {daysOf(day) && <span className="text-xs font-normal text-muted-foreground">{daysOf(day)}</span>}
          </h3>
          <DaySchedule
            rows={day.rows}
            prayerTabs={minyanSubcategories(day.category)}
            layout={layoutFor(day.category)}
            isToday={day.isToday}
          />
        </section>
      ))}
      <p className="text-[11px] text-muted-foreground">
        הזמנים הקבועים של כל יום. שינוי של יום אחד מופיע רק ביום שלו.
      </p>
    </div>
  );
}
