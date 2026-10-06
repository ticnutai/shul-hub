import {useDeadlines, DeadlineCard} from './DeadlineContext';
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useHolyEndMinutes } from "./holyEnd";
import type { Settings } from "@community/lib/data";
import type { ResolvedMinyan } from "@community/lib/minyan-time";
import { formatTime, ZMAN_LABELS, type Zmanim } from "@community/lib/zmanim";
import { useBoardEdit } from "./boardEdit";
import { frameZmanim, useBoardDay } from "./boardDay";
import { illustratedLayers } from "./illustratedAdjust";
import type { IllustratedStyle } from "./config";
import { illustrationDef, rowWindow, type Box, type CustomIllustration, type Illustration } from "./illustrated";
import { minyanNow, type BoardSlide } from "./useBoardData";
import { useShownPrayerDay, type ShownPrayerDay } from "./useDayCycle";
import { PrayerDaysLine } from "./PrayerDaysLine";
import { ILLUSTRATION_PICTURES } from "./illustrationPictures";
import type { FrameId, FrameLook } from "./frameLooks";
import { fillCss } from "./layerCss";

/**
 * The "illustrated" layout: a painted board - curtain and gold frames, stone
 * tablets, carved wood - with today's times written into its frames. What the
 * frames hold is the same data every other layout shows (see illustrated.ts
 * for the pictures and why they keep their own colours).
 */

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

/** Row type size: a narrow frame (the carved wood's side panels) gets smaller type, not clipped names. */
const rowSize = (b: Box) => `calc(${b[2] - b[0] < 25 ? 1.55 : 1.95}cqw * var(--ill-k, 1))`;

function PrayerFrame({ d, shown, now, max }: { d: Illustration; shown: ShownPrayerDay; now: Date; max: number }) {
  const deadline=useDeadlines()[0];
  const edit = useBoardEdit();
  const { day } = shown;
  const mark = useMark();
  const b = d.boxes.panelR;
  const { rows } = day;
  const { next } = minyanNow(rows, now, day.isToday);
  const [from, to] = rowWindow(rows.length, next, max);
  if(deadline?.stage==='panel') return <At b={b}><DeadlineCard alert={deadline}/></At>;
  return (
    <At b={b} style={{ color: d.ink }}>
      <div className="tv-ill-list" style={{ "--ill-size": rowSize(b) } as CSSProperties}>
        <div className="tv-ill-title" style={{ color: d.accent }} {...mark("dash.prayers")}>
          {day.isToday ? edit.text("dash.prayers", "תפילות היום") : `תפילות ${day.title}`}
        </div>
        <PrayerDaysLine shown={shown} />
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

function ZmanimFrame({ d, zmanim, box, max, now }: { d: Illustration; zmanim: Zmanim; box: Box; max: number; now: Date }) {
  const deadlines=useDeadlines();
  const edit = useBoardEdit();
  const mark = useMark();
  // The day's own times (a fast's start and end, צאת החג) come first; the
  // ordinary zmanim give up their places to them.
  const { special, shown } = frameZmanim(now, zmanim, useHolyEndMinutes(), edit.hidden, max);
  return (
    <At b={box} style={{ color: d.ink }}>
      <div className="tv-ill-list" style={{ "--ill-size": rowSize(box) } as CSSProperties}>
        <div className="tv-ill-title" style={{ color: d.accent }} {...mark("dash.zmanim")}>
          {edit.text("dash.zmanim", "זמני היום")}
        </div>
        <ul>
          {special.map((r) => (
            <li key={`special-${r.key}`} className="is-special" style={{ fontWeight: 700 }}>
              <span className="tv-ill-name">{r.label}</span>
              <span className="tv-ill-time" style={{ color: d.accent }}>
                {formatTime(r.time)}
              </span>
            </li>
          ))}
          {shown.map((e) => (
            <li key={e} data-zman={e} className={deadlines.some(a=>a.event===e)?'tv-zman-warning':undefined} {...mark(`zman.${e}`)}>
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
  customIllustrations,
  look,
  slides,
  now,
  zmanim,
  settings,
  shabbatEndMinutes,
}: {
  illustration: string;
  customIllustrations: readonly CustomIllustration[];
  /** The admin's adjustments: type size, rows per frame, inks. */
  look: IllustratedStyle;
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
  const def = illustrationDef(illustration, customIllustrations);
  // The admin's inks, where set, over the picture's own.
  const d = {
    ...def,
    ink: look.ink ?? def.ink,
    accent: look.accent ?? def.accent,
    clockInk: look.clockInk ?? def.clockInk,
  };
  const picture = "image" in def ? def.image : ILLUSTRATION_PICTURES[def.id as keyof typeof ILLUSTRATION_PICTURES];
  const b = d.boxes;
  const layers = useMemo(() => illustratedLayers(b, look), [b, look]);
  // A frame dressed apart from the others (frameLooks.ts): its inks over the
  // board's, and its own background and line drawn over the painting.
  const inFrame = (id: FrameId) => {
    const own = edit.frameLook(id);
    return own ? { ...d, ink: own.text ?? d.ink, accent: own.accent ?? d.accent } : d;
  };
  const dressed: Array<{ id: FrameId; box: Box; look: FrameLook }> = (
    [
      ["prayers", b.panelR],
      ["zmanim", b.panelL],
      ["clock", b.clock],
    ] as Array<[FrameId, Box]>
  ).flatMap(([id, box]) => {
    const own = edit.frameLook(id);
    return own && (own.bg || own.line) ? [{ id, box, look: own }] : [];
  });
  const clockLook = edit.frameLook("clock");
  const day = useBoardDay(now, settings, shabbatEndMinutes);
  const weekday = day.weekday;
  /**
   * The name, and whether it is on the board at all.
   *
   * The painted board drew it unconditionally, so "הסתרה מהלוח" in the editor
   * put the key into `hidden`, the switch flipped, and the name stayed where
   * it was. The other layouts have honoured it all along; this one simply
   * never asked.
   */
  const titleShown = !edit.hidden("header.title");
  const title = edit.text("header.title", settings?.name ?? "בית הכנסת");
  const prayerDay = useShownPrayerDay(slides);
  const candleLine = day.candle ? `הדלקת נרות ${formatTime(day.candle)}` : "";

  return (
    <section
      className={`tv-slide tv-ill is-${d.id}`}
      style={{ color: d.ink, "--ill-k": look.scale } as CSSProperties}
      aria-label={title}
    >
      {/* The picture on a layer of its own, so its adjustments never touch the text. */}
      <div className="tv-ill-picture" style={{ backgroundImage: `url("${picture}")`, ...layers.picture }} />
      {layers.stone && <div className="tv-ill-stone" style={layers.stone} />}
      {layers.frames.map((f) => (
        <div key={f.key} className="tv-ill-frame" style={f.style} />
      ))}
      {dressed.map((f) => (
        <div
          key={`own-${f.id}`}
          className="tv-ill-frame"
          data-frame={f.id}
          style={{
            left: `${f.box[0]}%`,
            top: `${f.box[1]}%`,
            width: `${f.box[2] - f.box[0]}%`,
            height: `${f.box[3] - f.box[1]}%`,
            background: fillCss(f.look.bg, f.look.bgOpacity ?? 1) ?? undefined,
            border: f.look.line ? `${((f.look.lineWidth ?? 2) * 0.1).toFixed(2)}cqw solid ${f.look.line}` : undefined,
            borderRadius: "0.4cqw",
          }}
        />
      ))}
      <At b={b.clock}>
        <span className="tv-ill-clock" style={{ color: clockLook?.text ?? d.clockInk }}>
          {formatTime(now)}
        </span>
      </At>

      {d.centrePanel ? (
        <>
          <At b={b.plaqueL}>
            {titleShown && (
              <div className="tv-ill-name-big" {...mark("header.title")}>
                {title}
              </div>
            )}
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
          <ZmanimFrame d={inFrame("zmanim")} zmanim={zmanim} box={b.panelL} max={look.rows} now={now} />
          <PrayerFrame d={inFrame("prayers")} shown={prayerDay} now={now} max={look.rows} />
        </>
      ) : (
        <>
          <At b={b.plaqueR}>
            <span className="tv-ill-plaque">{weekday}</span>
          </At>
          <At b={b.plaqueL}>
            <span className="tv-ill-plaque">{day.hebrew}</span>
          </At>
          <PrayerFrame d={inFrame("prayers")} shown={prayerDay} now={now} max={look.rows} />
          <ZmanimFrame d={inFrame("zmanim")} zmanim={zmanim} box={b.panelL} max={look.rows} now={now} />
          {b.barR && (
            <At b={b.barR}>
              {titleShown && <span className="tv-ill-bar" {...mark("header.title")}>{title}</span>}
            </At>
          )}
          {b.barL && (
            <At b={b.barL}>
              <span className="tv-ill-bar">
                {b.barR ? (
                  [day.parasha, candleLine].filter(Boolean).join(" · ")
                ) : (
                  <>
                    {/*
                      The name is a separate span so it can be clicked and
                      edited, which on this picture it could not be. A board
                      with only one bar (the "modern" one, which two of the
                      four synagogues are using) put the name into the same
                      string as the parasha and the candle time, with no
                      marker on it at all - so in the editor it looked like
                      part of the board and answered nothing. Marking the
                      whole bar would be worse: clicking the parasha would
                      then open the name for editing.
                    */}
                    {titleShown && <span {...mark("header.title")}>{title}</span>}
                    {[day.parasha, candleLine].filter(Boolean).map((t) => ` · ${t}`).join("")}
                  </>
                )}
              </span>
            </At>
          )}
        </>
      )}
    </section>
  );
}
