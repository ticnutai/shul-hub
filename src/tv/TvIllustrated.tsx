import { useMemo, type CSSProperties, type ReactNode } from "react";
import { HDate } from "@hebcal/core";
import type { Settings } from "@community/lib/data";
import { jerusalemWeekday, zmanimFor, type ResolvedMinyan } from "@community/lib/minyan-time";
import { formatTime, ZMAN_LABELS, type Zmanim } from "@community/lib/zmanim";
import { SHOWN_ZMANIM, useBoardEdit } from "./boardEdit";
import type { IllustrationId } from "./config";
import { illustrationDef, rowWindow, type Box, type Illustration } from "./illustrated";
import { weeklyParasha } from "./learning";
import { nextCandleLighting } from "./shabbat";
import { jerusalemMinutes, type BoardSlide } from "./useBoardData";
import { ILLUSTRATION_PICTURES } from "./illustrationPictures";

/**
 * The "illustrated" layout: a painted board - curtain and gold frames, stone
 * tablets, carved wood - with today's times written into its frames. What the
 * frames hold is the same data every other layout shows (see illustrated.ts
 * for the pictures and why they keep their own colours).
 */

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
type PrayerSlide = Extract<BoardSlide, { kind: "prayer" }>;

function At({ b, children, style }: { b: Box; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="tv-ill-box"
      style={{ left: `${b[0]}%`, top: `${b[1]}%`, width: `${b[2] - b[0]}%`, height: `${b[3] - b[1]}%`, ...style }}
    >
      {children}
    </div>
  );
}

/**
 * Click-to-edit only. The styles saved for an element (a colour, an offset)
 * were set on the flat board; on a painting they would put gold ink on
 * gold or push a name off its plaque, so they stay with the other layouts.
 */
function useMark() {
  const edit = useBoardEdit();
  return (key: string) => {
    const a = edit.attr(key);
    return a["data-edit"] ? { "data-edit": a["data-edit"] } : {};
  };
}

/** What a full frame of zmanim gives up first, so dawn, sunrise and nightfall always stay. */
const ZMAN_DROP_ORDER = ["misheyakir", "mincha_gedola", "plag", "sof_zman_tefila", "candle", "chatzot"];
const ZMAN_ROWS = 7;

/** Row type size: a narrow frame (the carved wood's side panels) gets smaller type, not clipped names. */
const rowSize = (b: Box) => (b[2] - b[0] < 25 ? 1.55 : 1.95);

function PrayerFrame({ d, schedule, now }: { d: Illustration; schedule: PrayerSlide | undefined; now: Date }) {
  const edit = useBoardEdit();
  const mark = useMark();
  const b = d.boxes.panelR;
  const rows = schedule?.rows ?? [];
  const nowMin = jerusalemMinutes(now);
  const next = rows.findIndex((r) => r.minutes >= nowMin && !r.cancelled);
  const [from, to] = rowWindow(rows.length, next);
  return (
    <At b={b}>
      <div className="tv-ill-list" style={{ "--ill-size": `${rowSize(b)}cqw` } as CSSProperties}>
        <div className="tv-ill-title" style={{ color: d.accent }} {...mark("dash.prayers")}>
          {edit.text("dash.prayers", "תפילות היום")}
        </div>
        {rows.length === 0 ? (
          <p className="tv-ill-empty">לא הוגדרו מניינים להיום</p>
        ) : (
          <ul>
            {rows.slice(from, to).map((r: ResolvedMinyan, i) => (
              <li
                key={r.minyan.id}
                className={`${from + i === next ? "is-next" : ""}${r.cancelled ? " is-cancelled" : ""}`}
                {...mark(`minyan:${r.minyan.id}`)}
              >
                <span className="tv-ill-name">
                  {r.minyan.label}
                  {r.cancelled && <small> · מבוטל היום</small>}
                  {r.overridden && !r.cancelled && <small> · היום בלבד</small>}
                </span>
                <span className="tv-ill-time" style={{ color: d.accent }}>
                  {r.time}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </At>
  );
}

function ZmanimFrame({ d, zmanim, box }: { d: Illustration; zmanim: Zmanim; box: Box }) {
  const edit = useBoardEdit();
  const mark = useMark();
  let shown = SHOWN_ZMANIM.filter((e) => !edit.hidden(`zman.${e}`));
  for (const drop of ZMAN_DROP_ORDER) {
    if (shown.length <= ZMAN_ROWS) break;
    shown = shown.filter((e) => e !== drop);
  }
  shown = shown.slice(0, ZMAN_ROWS);
  return (
    <At b={box}>
      <div className="tv-ill-list" style={{ "--ill-size": `${rowSize(box)}cqw` } as CSSProperties}>
        <div className="tv-ill-title" style={{ color: d.accent }} {...mark("dash.zmanim")}>
          {edit.text("dash.zmanim", "זמני היום")}
        </div>
        <ul>
          {shown.map((e) => (
            <li key={e} {...mark(`zman.${e}`)}>
              <span className="tv-ill-name">{edit.text(`zman.${e}`, ZMAN_LABELS[e])}</span>
              <span className="tv-ill-time" style={{ color: d.accent }}>
                {formatTime(zmanim[e])}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </At>
  );
}

export function IllustratedStage({
  illustration,
  slides,
  now,
  zmanim,
  settings,
  shabbatEndMinutes,
}: {
  illustration: IllustrationId;
  slides: BoardSlide[];
  /** Minute precision. */
  now: Date;
  zmanim: Zmanim;
  settings: Settings | null;
  /** When Shabbat goes out, in minutes after sunset (TvConfig.shabbat). */
  shabbatEndMinutes: number;
}) {
  const edit = useBoardEdit();
  const mark = useMark();
  const d = illustrationDef(illustration);
  const b = d.boxes;
  const dayKey = now.toDateString();
  const day = useMemo(() => {
    const date = new Date(dayKey);
    const candle = nextCandleLighting(date, settings);
    const saturday = candle ? zmanimFor(new Date(candle.getTime() + 86_400_000), settings) : null;
    const out = saturday?.sunset ? new Date(saturday.sunset.getTime() + shabbatEndMinutes * 60_000) : null;
    return {
      hebrew: new HDate(date).renderGematriya(true),
      parasha: weeklyParasha(date),
      candle,
      out,
    };
  }, [dayKey, settings, shabbatEndMinutes]);
  const weekday = `יום ${WEEKDAYS[jerusalemWeekday(now)]}`;
  const title = edit.text("header.title", settings?.name ?? "בית הכנסת");
  const schedule = slides.find((s): s is PrayerSlide => s.kind === "prayer");
  const candleLine = day.candle ? `הדלקת נרות ${formatTime(day.candle)}` : "";

  return (
    <section
      className={`tv-slide tv-ill is-${d.id}`}
      style={{ backgroundImage: `url(${ILLUSTRATION_PICTURES[d.id]})`, color: d.ink }}
      aria-label={title}
    >
      <At b={b.clock}>
        <span className="tv-ill-clock" style={{ color: d.clockInk }}>
          {formatTime(now)}
        </span>
      </At>

      {d.centrePanel ? (
        <>
          <At b={b.plaqueL}>
            <div className="tv-ill-name-big" {...mark("header.title")}>
              {title}
            </div>
            {day.parasha && <div className="tv-ill-sub" style={{ color: d.accent }}>{day.parasha}</div>}
          </At>
          <At b={b.plaqueR}>
            <div className="tv-ill-day">{weekday}</div>
            <div className="tv-ill-sub" style={{ color: d.accent }}>{day.hebrew}</div>
          </At>
          {b.barR && (
            <At b={b.barR}>
              <div className="tv-ill-shabbat-title">שבת קודש{day.parasha ? ` ${day.parasha}` : ""}</div>
              {day.candle && <div className="tv-ill-shabbat-line">כניסת השבת {formatTime(day.candle)}</div>}
              {day.out && <div className="tv-ill-shabbat-line">יציאת השבת {formatTime(day.out)}</div>}
              <div className="tv-ill-shabbat-bless" style={{ color: d.accent }}>שבת שלום ומבורך</div>
            </At>
          )}
          <ZmanimFrame d={d} zmanim={zmanim} box={b.panelL} />
          <PrayerFrame d={d} schedule={schedule} now={now} />
        </>
      ) : (
        <>
          <At b={b.plaqueR}>
            <span className="tv-ill-plaque">{weekday}</span>
          </At>
          <At b={b.plaqueL}>
            <span className="tv-ill-plaque">{day.hebrew}</span>
          </At>
          <PrayerFrame d={d} schedule={schedule} now={now} />
          <ZmanimFrame d={d} zmanim={zmanim} box={b.panelL} />
          {b.barR && (
            <At b={b.barR}>
              <span className="tv-ill-bar" {...mark("header.title")}>{title}</span>
            </At>
          )}
          {b.barL && (
            <At b={b.barL}>
              <span className="tv-ill-bar">
                {b.barR
                  ? [day.parasha, candleLine].filter(Boolean).join(" · ")
                  : [title, day.parasha, candleLine].filter(Boolean).join(" · ")}
              </span>
            </At>
          )}
        </>
      )}
    </section>
  );
}
