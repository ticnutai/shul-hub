import { useState } from "react";
import { prayerLabel, type MinyanSubcategory } from "@community/lib/data";
import type { ResolvedMinyan } from "@community/lib/minyan-time";
import { InlineEdit } from "@community/components/InlineEdit";
import { CardsLayout, TimelineLayout } from "@community/components/PrayerScheduleLayouts";
import type { PrayerLayoutMode } from "@community/components/PrayerLayoutPicker";

/**
 * One day's minyanim on the website, in the layout the gabbai chose
 * ("איך יראו זמני התפילות" in the admin). The day tabs and "כל השבוע" both
 * draw a day with this, so a layout looks the same in either.
 */
export function DaySchedule({
  rows,
  prayerTabs,
  layout,
  isToday = true,
  empty = "עדיין לא הוגדרו מניינים ליום זה.",
}: {
  rows: ResolvedMinyan[];
  prayerTabs: MinyanSubcategory[];
  layout: PrayerLayoutMode;
  /** false for another day in "כל השבוע": nothing on it is "הבא" or over. */
  isToday?: boolean;
  empty?: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const hasTabs = layout === "tabs" && prayerTabs.length > 0;
  const prayer = prayerTabs.some((p) => p.id === picked) ? picked! : prayerTabs[0]?.id;
  const shown = hasTabs ? rows.filter(({ minyan }) => minyan.prayer === prayer) : rows;

  return (
    <>
      {hasTabs && (
        <div role="group" className="mt-3 flex gap-1 rounded-lg bg-secondary p-1" aria-label="סוג תפילה">
          {prayerTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPicked(item.id)}
              aria-pressed={prayer === item.id}
              className={
                "flex-1 rounded-md px-3 py-2 text-sm transition-colors " +
                (prayer === item.id
                  ? "bg-primary font-medium text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div className="card-elev mt-4 divide-y divide-border overflow-hidden" data-minyan-display-mode={layout}>
        {shown.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">{empty}</p>
        ) : layout === "timeline" ? (
          <TimelineLayout rows={rows} prayerTabs={prayerTabs} isToday={isToday} />
        ) : layout === "cards" ? (
          <CardsLayout rows={rows} prayerTabs={prayerTabs} isToday={isToday} />
        ) : layout === "table" ? (
          <TableDay rows={rows} prayerTabs={prayerTabs} />
        ) : layout === "list" ? (
          groupsOf(rows, prayerTabs).map((group) => (
            <div key={group.id}>
              {group.label && (
                <h3 className="bg-secondary px-4 py-2 text-base font-semibold text-primary">{group.label}</h3>
              )}
              <Rows rows={group.rows} />
            </div>
          ))
        ) : (
          <Rows rows={shown} />
        )}
      </div>
    </>
  );
}

/** The day's prayers in the tab's order; a minyan whose prayer the tab no longer lists is kept, last. */
function groupsOf(rows: ResolvedMinyan[], prayerTabs: MinyanSubcategory[]) {
  if (!prayerTabs.length) return [{ id: "all", label: "", rows }];
  const known = new Set(prayerTabs.map((p) => p.id));
  const groups = prayerTabs
    .map((p) => ({ id: p.id, label: p.label, rows: rows.filter((r) => r.minyan.prayer === p.id) }))
    .filter((g) => g.rows.length > 0);
  const rest = rows.filter((r) => !known.has(r.minyan.prayer));
  if (rest.length) groups.push({ id: "other", label: "עוד", rows: rest });
  return groups;
}

function Rows({ rows }: { rows: ResolvedMinyan[] }) {
  return (
    <div className="divide-y divide-border">
      {rows.map(({ minyan, time, source }) => (
        <div key={minyan.id} className="flex items-center gap-4 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              <InlineEdit table="minyanim" id={minyan.id} field="label" value={minyan.label} queryKey="minyanim" />
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {source}
              {minyan.room ? ` · ${minyan.room}` : ""}
              {minyan.note ? ` · ${minyan.note}` : ""}
            </p>
          </div>
          {/* The time is never broken across lines; the description gives way. */}
          <span className="shrink-0 whitespace-nowrap font-display text-2xl font-semibold tabular-nums text-primary">
            {minyan.time_mode === "fixed" ? (
              <InlineEdit
                table="minyanim"
                id={minyan.id}
                field="fixed_time"
                value={minyan.fixed_time ? minyan.fixed_time.slice(0, 5) : ""}
                as="time"
                display={time}
                queryKey="minyanim"
                inputClassName="text-2xl"
              />
            ) : (
              time
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function TableDay({ rows, prayerTabs }: { rows: ResolvedMinyan[]; prayerTabs: MinyanSubcategory[] }) {
  return (
    <>
      <div className="divide-y divide-border sm:hidden" data-testid="prayer-table-mobile">
        {rows.map(({ minyan, time, source }) => (
          <div key={minyan.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary">{prayerLabel(prayerTabs, minyan.prayer)}</p>
              <p className="truncate font-medium">
                <InlineEdit table="minyanim" id={minyan.id} field="label" value={minyan.label} queryKey="minyanim" />
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[minyan.room, minyan.note, source].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="whitespace-nowrap font-display text-2xl font-semibold tabular-nums text-primary">{time}</span>
          </div>
        ))}
      </div>
      <table className="hidden w-full table-fixed border-collapse text-right sm:table" data-testid="prayer-table-desktop">
        <thead className="bg-secondary text-sm text-muted-foreground">
          <tr>
            <th className="w-1/5 px-4 py-2 font-medium">תפילה</th>
            <th className="w-2/5 px-4 py-2 font-medium">מניין</th>
            <th className="w-1/4 px-4 py-2 font-medium">מיקום והערה</th>
            <th className="w-[15%] px-4 py-2 font-medium">שעה</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ minyan, time, source }) => (
            <tr key={minyan.id}>
              <td className="px-4 py-3 font-semibold text-primary">{prayerLabel(prayerTabs, minyan.prayer)}</td>
              <td className="truncate px-4 py-3 font-medium">
                <InlineEdit table="minyanim" id={minyan.id} field="label" value={minyan.label} queryKey="minyanim" />
              </td>
              <td className="truncate px-4 py-3 text-sm text-muted-foreground">
                {[minyan.room, minyan.note, source].filter(Boolean).join(" · ")}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-display text-xl font-semibold tabular-nums text-primary">{time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
