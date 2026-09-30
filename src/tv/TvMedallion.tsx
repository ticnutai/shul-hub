import type { Settings } from "@community/lib/data";
import type { ResolvedMinyan } from "@community/lib/minyan-time";
import { formatTime, ZMAN_LABELS, type Zmanim } from "@community/lib/zmanim";
import { useBoardEdit } from "./boardEdit";
import { frameZmanim, useBoardDay } from "./boardDay";
import { useHolyEndMinutes } from "./holyEnd";
import { rowWindow, todaysRows } from "./illustrated";
import { jerusalemMinutes, type BoardSlide } from "./useBoardData";
import { useShrinkToFit } from "./useShrinkToFit";

/**
 * The "medallion" layout: the arrangement the painted boards had - a clock
 * in a medallion between two plaques (the weekday and the Hebrew date), the
 * day's prayers and zmanim in two large frames, and a strip along the bottom
 * with the name, the parasha and candle lighting - drawn from the ordinary
 * parts of the board instead of a picture.
 *
 * Every frame here is an ordinary frame: the style, the corners, a frame's
 * own background and inks, the text areas all apply, and the background is
 * whatever background the board has. That is the point of it - the painted
 * boards were one picture each, and nothing on them could be changed apart.
 */
export function MedallionStage({
  slides,
  now,
  zmanim,
  settings,
  shabbatEndMinutes,
  rowsPerFrame,
}: {
  slides: BoardSlide[];
  /** Minute precision. */
  now: Date;
  zmanim: Zmanim;
  settings: Settings | null;
  shabbatEndMinutes: number;
  /** How many minyanim a frame shows before it scrolls to the current ones. */
  rowsPerFrame: number;
}) {
  const edit = useBoardEdit();
  const day = useBoardDay(now, settings, shabbatEndMinutes);
  const title = edit.text("header.title", settings?.name ?? "בית הכנסת");
  const titleShown = !edit.hidden("header.title");
  const rest = [day.parasha, day.candle ? `הדלקת נרות ${formatTime(day.candle)}` : null].filter(Boolean);

  const prayers = <PrayersFrame rows={todaysRows(slides)} now={now} max={rowsPerFrame} />;
  const zmanimFrame = <ZmanimFrame zmanim={zmanim} now={now} max={rowsPerFrame} />;
  const flipped = edit.flipped("prayer");

  return (
    <section className="tv-slide tv-med" aria-label={title}>
      <div className="tv-med-top">
        {!edit.hidden("header.weekday") && (
          <div className="tv-panel tv-med-plaque" {...edit.frame("date", "header.weekday")}>
            <span>{day.weekday}</span>
          </div>
        )}
        {!edit.hidden("header.clock") && (
          <div className="tv-panel tv-med-clock" {...edit.frame("clock", "header.clock")}>
            <span>{formatTime(now)}</span>
          </div>
        )}
        {!edit.hidden("header.date") && (
          <div className="tv-panel tv-med-plaque" {...edit.frame("date", "header.date")}>
            <span>{day.hebrew}</span>
          </div>
        )}
      </div>
      <div className="tv-med-main">
        {flipped ? zmanimFrame : prayers}
        {flipped ? prayers : zmanimFrame}
      </div>
      {(titleShown || rest.length > 0) && (
        <div className="tv-panel tv-med-strip" {...edit.frame("strip")}>
          <p>
            {titleShown && <span {...edit.attr("header.title")}>{title}</span>}
            {rest.map((t, i) => `${titleShown || i > 0 ? " · " : ""}${t}`).join("")}
          </p>
        </div>
      )}
    </section>
  );
}

function PrayersFrame({ rows, now, max }: { rows: ResolvedMinyan[]; now: Date; max: number }) {
  const edit = useBoardEdit();
  const nowMin = jerusalemMinutes(now);
  const next = rows.findIndex((r) => r.minutes >= nowMin && !r.cancelled);
  const [from, to] = rowWindow(rows.length, next, max);
  const fit = useShrinkToFit<HTMLUListElement>(`${from}:${to}:${rows.length}`);
  return (
    <div className="tv-panel tv-med-list" {...edit.frame("prayers")}>
      <h3 className="tv-panel-title" {...edit.attr("dash.prayers")}>
        {edit.text("dash.prayers", "תפילות היום")}
      </h3>
      {rows.length === 0 ? (
        <p className="tv-med-empty">לא הוגדרו מניינים להיום</p>
      ) : (
        <ul ref={fit}>
          {rows.slice(from, to).map((r, i) => (
            <li
              key={r.minyan.id}
              className={`tv-med-row${from + i === next ? " is-next" : ""}${r.cancelled ? " is-cancelled" : ""}`}
              {...edit.attr(`minyan:${r.minyan.id}`)}
            >
              <span className="tv-med-name" {...edit.attr(`minyan:${r.minyan.id}:label`)}>
                {r.minyan.label}
                {r.cancelled && <small> · מבוטל היום</small>}
                {r.overridden && !r.cancelled && <small> · היום בלבד</small>}
              </span>
              <span className="tv-med-time">{r.time}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ZmanimFrame({ zmanim, now, max }: { zmanim: Zmanim; now: Date; max: number }) {
  const edit = useBoardEdit();
  const { special, shown } = frameZmanim(now, zmanim, useHolyEndMinutes(), edit.hidden, max);
  const fit = useShrinkToFit<HTMLUListElement>(`${special.length}:${shown.join()}`);
  return (
    <div className="tv-panel tv-med-list" {...edit.frame("zmanim", "panel.zmanim")}>
      <h3 className="tv-panel-title" {...edit.attr("dash.zmanim")}>
        {edit.text("dash.zmanim", "זמני היום")}
      </h3>
      <ul ref={fit}>
        {special.map((r) => (
          <li key={`special-${r.key}`} className="tv-med-row is-special">
            <span className="tv-med-name">{r.label}</span>
            <span className="tv-med-time">{formatTime(r.time)}</span>
          </li>
        ))}
        {shown.map((e) => (
          <li key={e} className="tv-med-row" {...edit.attr(`zman.${e}`)}>
            <span className="tv-med-name">{edit.text(`zman.${e}`, ZMAN_LABELS[e])}</span>
            <span className="tv-med-time">{formatTime(zmanim[e])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
