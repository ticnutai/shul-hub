import type { Settings } from "@community/lib/data";
import type { ResolvedMinyan } from "@community/lib/minyan-time";
import { formatTime, ZMAN_LABELS, type Zmanim } from "@community/lib/zmanim";
import { useBoardEdit } from "./boardEdit";
import { frameZmanim, useBoardDay } from "./boardDay";
import { useHolyEndMinutes } from "./holyEnd";
import { rowWindow, todaysRows } from "./illustrated";
import { composedRows, jerusalemMinutes, type BoardSlide, type ComposedPart } from "./useBoardData";
import { SlideView } from "./TvSlides";
import { AutoScroll } from "./AutoScroll";
import { SCROLLING_BLOCKS, useScrolls } from "./overflowContext";
import { Fragment, type ReactNode } from "react";
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
  parts,
  now,
  zmanim,
  settings,
  shabbatEndMinutes,
  rowsPerFrame,
  bars = { header: true, clock: true, footer: true },
  logos = [],
}: {
  slides: BoardSlide[];
  /**
   * The screen up now, on a board built of screens: exactly what is ticked
   * on it. The prayers and the zmanim stand in the medallion's own frames;
   * anything else ticked (announcements, shiurim, the daf...) gets a frame
   * of its own beside them, in the same style. Without this the medallion
   * drew the prayers and the zmanim whatever the screen said, so every
   * screen of a board looked the same. Absent: a board with no screens,
   * which shows both, as it always did.
   */
  parts?: ComposedPart[];
  /** Minute precision. */
  now: Date;
  zmanim: Zmanim;
  settings: Settings | null;
  shabbatEndMinutes: number;
  /** How many minyanim a frame shows before it scrolls to the current ones. */
  rowsPerFrame: number;
  /** The screen's bars: the day and date plaques, the clock, the strip below. */
  bars?: { header: boolean; clock: boolean; footer: boolean };
  /** The board's logos, each in the cut for this board, when the screen shows them. */
  logos?: { id: string; name: string; src: string }[];
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
      {logos.length > 0 && !edit.hidden("header.sponsor") && (
        <div className="tv-med-logos" {...edit.attr("header.sponsor")}>
          {logos.map((l) => (
            <img key={l.id} src={l.src} alt={l.name} decoding="async" />
          ))}
        </div>
      )}
      {(bars.header || bars.clock) && (
      <div className="tv-med-top">
        {bars.header && !edit.hidden("header.weekday") && (
          <div className="tv-panel tv-med-plaque is-weekday" {...edit.frame("date", "header.weekday")}>
            <span>{day.weekday}</span>
          </div>
        )}
        {bars.clock && !edit.hidden("header.clock") && (
          <div className="tv-panel tv-med-clock" {...edit.frame("clock", "header.clock")}>
            <span>{formatTime(now)}</span>
          </div>
        )}
        {bars.header && !edit.hidden("header.date") && (
          <div className="tv-panel tv-med-plaque is-date" {...edit.frame("date", "header.date")}>
            <span>{day.hebrew}</span>
          </div>
        )}
      </div>
      )}
      {parts ? (
        <ScreenFrames parts={parts} prayers={prayers} zmanim={zmanimFrame} now={now} dayZmanim={zmanim} />
      ) : (
        <div className="tv-med-main">
          {flipped ? zmanimFrame : prayers}
          {flipped ? prayers : zmanimFrame}
        </div>
      )}
      {bars.footer && (titleShown || rest.length > 0) && (
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

/**
 * The body of one screen, as the composer arranged it (the same `place()`
 * rule as everywhere): the prayers and the zmanim in the medallion's frames,
 * every other block in a frame of its own. A day split over several prayer
 * pages is still one prayers frame here - it scrolls to the current minyanim.
 */
function ScreenFrames({
  parts,
  prayers,
  zmanim,
  now,
  dayZmanim,
}: {
  parts: ComposedPart[];
  prayers: ReactNode;
  zmanim: ReactNode;
  now: Date;
  dayZmanim: Zmanim;
}) {
  let prayersShown = false;
  const rows = composedRows(parts)
    .map((row) =>
      row.flatMap((part, i) => {
        if (part.block === "prayers") {
          if (prayersShown) return [];
          prayersShown = true;
          return [<Fragment key={`p${i}`}>{prayers}</Fragment>];
        }
        if (part.block === "zmanim") return [<Fragment key={`z${i}`}>{zmanim}</Fragment>];
        if (!part.slide) return [];
        return [
          <div key={`${part.block}${i}`} className="tv-panel tv-med-cell" data-block={part.block}>
            <AutoScroll enabled={SCROLLING_BLOCKS.includes(part.block)}>
              <SlideView slide={part.slide} now={now} zmanim={dayZmanim} paused={false} />
            </AutoScroll>
          </div>,
        ];
      }),
    )
    .filter((row) => row.length > 0);
  return (
    <div className={`tv-med-rows${rows.length > 1 ? " is-many" : ""}`}>
      {rows.map((row, i) => (
        <div key={i} className="tv-med-row-of" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
          {row}
        </div>
      ))}
    </div>
  );
}

function PrayersFrame({ rows, now, max }: { rows: ResolvedMinyan[]; now: Date; max: number }) {
  const edit = useBoardEdit();
  const nowMin = jerusalemMinutes(now);
  const next = rows.findIndex((r) => r.minutes >= nowMin && !r.cancelled);
  // Scrolling, every minyan of the day passes; otherwise a window around the next.
  const scrolls = useScrolls();
  const [from, to] = scrolls ? [0, rows.length] : rowWindow(rows.length, next, max);
  const fit = useShrinkToFit<HTMLUListElement>(`${from}:${to}:${rows.length}`);
  return (
    <div className="tv-panel tv-med-list" {...edit.frame("prayers")}>
      <h3 className="tv-panel-title" {...edit.attr("dash.prayers")}>
        {edit.text("dash.prayers", "תפילות היום")}
      </h3>
      {rows.length === 0 ? (
        <p className="tv-med-empty">לא הוגדרו מניינים להיום</p>
      ) : (
        <AutoScroll>
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
        </AutoScroll>
      )}
    </div>
  );
}

function ZmanimFrame({ zmanim, now, max }: { zmanim: Zmanim; now: Date; max: number }) {
  const edit = useBoardEdit();
  const scrolls = useScrolls();
  const { special, shown } = frameZmanim(now, zmanim, useHolyEndMinutes(), edit.hidden, scrolls ? 99 : max);
  const fit = useShrinkToFit<HTMLUListElement>(`${special.length}:${shown.join()}`);
  return (
    <div className="tv-panel tv-med-list" {...edit.frame("zmanim", "panel.zmanim")}>
      <h3 className="tv-panel-title" {...edit.attr("dash.zmanim")}>
        {edit.text("dash.zmanim", "זמני היום")}
      </h3>
      <AutoScroll>
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
      </AutoScroll>
    </div>
  );
}
