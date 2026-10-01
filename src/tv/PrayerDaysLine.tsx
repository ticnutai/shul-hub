import type { BoardPrayerDay } from "./useBoardData";

/**
 * Under a prayer frame's title when the board shows the week: the days it
 * turns through, the one on now marked - so whoever stands in front of the
 * board (or the gabbai who just chose it) sees at once that another day is
 * coming, instead of waiting a whole turn to find out.
 */
export function PrayerDaysLine({ days, index }: { days: BoardPrayerDay[]; index: number }) {
  if (days.length < 2) return null;
  return (
    <div className="tv-days-line" aria-label="ימי השבוע בתורם">
      {days.map((d, i) => (
        <span key={d.key} className={i === index ? "is-on" : undefined}>
          {d.isToday ? "היום" : d.title}
        </span>
      ))}
    </div>
  );
}
