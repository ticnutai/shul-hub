import type { ShownPrayerDay } from "./useDayCycle";

/**
 * Under a prayer frame's title when the board shows the week: the days it
 * turns through, the one on now marked - so whoever stands in front of the
 * board (or the gabbai who just chose it) sees at once that another day is
 * coming, instead of waiting a whole turn to find out. In the editor's
 * preview each day is a button that shows it now.
 */
export function PrayerDaysLine({ shown }: { shown: ShownPrayerDay }) {
  const { days, index, pick } = shown;
  if (days.length < 2) return null;
  return (
    <div className="tv-days-line" aria-label="ימי השבוע בתורם">
      {days.map((d, i) => {
        const name = d.isToday ? "היום" : d.title;
        const on = i === index ? "is-on" : undefined;
        return pick ? (
          <button
            key={d.key}
            type="button"
            className={on}
            aria-pressed={i === index}
            title={`הצגת ${name} עכשיו (בתצוגה המקדימה בלבד)`}
            onClick={(e) => {
              // Not a click on the board for editing: only the day changes.
              e.stopPropagation();
              pick(i);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {name}
          </button>
        ) : (
          <span key={d.key} className={on}>
            {name}
          </span>
        );
      })}
    </div>
  );
}
