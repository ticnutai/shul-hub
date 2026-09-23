import { useContext, useMemo, type CSSProperties } from "react";
import { ClockContext } from "./clockContext";
import { HDate } from "@hebcal/core";
import type { Announcement, Shiur } from "@community/lib/data";
import type { ResolvedMinyan } from "@community/lib/minyan-time";
import { formatTime, type Zmanim } from "@community/lib/zmanim";
import type { ClockStyle } from "./config";
import { useBoardEdit } from "./boardEdit";
import { useFitRows } from "./useFitRows";
import { amudYomi, dafYomi, seasonalPrayers, weeklyParasha } from "./learning";
import { AnnouncementCard, ZmanimPanel } from "./TvSlides";
import { jerusalemMinutes, shiurMinutes, type BoardSlide } from "./useBoardData";

/**
 * The two screen layouts beside the one-slide-at-a-time board (see
 * ScreenLayout in config.ts):
 *
 *   DashboardStage  everything at once: prayer times on the right; the clock,
 *                   and one announcement at a time in the middle; zmanim and
 *                   today's lessons on the left.
 *   SplitSide       a fixed column - the next minyan and the zmanim - beside
 *                   the rotating slides.
 *
 * Both are built from the same slides buildSlides produces, so what is shown,
 * hidden or renamed in the editor applies here too.
 */

/* --------------------------------------------------------------- clock -- */

/**
 * An analog clock in the theme's colours. It moves once a second with the
 * board's own clock - no CSS animation, so an idle board stays still between
 * ticks (see the CPU notes in tv.css).
 */
export function AnalogClock({ now, seconds = true }: { now: Date; seconds?: boolean }) {
  const s = now.getSeconds();
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  const hand = (deg: number, length: number, width: number, cls: string) => (
    <line
      className={cls}
      x1={0}
      y1={length * 0.16}
      x2={0}
      y2={-length}
      strokeWidth={width}
      strokeLinecap="round"
      transform={`rotate(${deg})`}
    />
  );
  return (
    <svg
      className="tv-analog"
      viewBox="-100 -100 200 200"
      role="img"
      aria-label={`השעה ${formatTime(now)}`}
    >
      {/* Two circles, not one mixed fill - see .tv-analog-face in tv.css. */}
      <circle className="tv-analog-face" r={96} />
      <circle className="tv-analog-tint" r={96} />
      <circle className="tv-analog-rim" r={96} fill="none" />
      {Array.from({ length: 60 }, (_, i) => (
        <line
          key={i}
          className={i % 5 === 0 ? "tv-analog-tick is-hour" : "tv-analog-tick"}
          x1={0}
          y1={i % 5 === 0 ? -86 : -89}
          x2={0}
          y2={-93}
          transform={`rotate(${i * 6})`}
        />
      ))}
      {[12, 3, 6, 9].map((n) => {
        const a = (n / 12) * Math.PI * 2;
        return (
          <text
            key={n}
            className="tv-analog-num"
            x={Math.sin(a) * 70}
            y={-Math.cos(a) * 70}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {n}
          </text>
        );
      })}
      {hand(h * 30, 50, 7, "tv-analog-hour")}
      {hand(m * 6, 74, 4.5, "tv-analog-minute")}
      {seconds && hand(s * 6, 80, 1.8, "tv-analog-second")}
      <circle className="tv-analog-pin" r={5} />
    </svg>
  );
}

function LiveClockFace({ style }: { style: ClockStyle }) {
  return <ClockFace now={useContext(ClockContext)} style={style} />;
}

/** The header / dashboard clock in the admin's style: digits, dial, or both. */
export function ClockFace({
  now,
  style,
  className = "",
}: {
  now: Date;
  style: ClockStyle;
  className?: string;
}) {
  return (
    <div className={`tv-clockface is-${style} ${className}`}>
      {style !== "digital" && <AnalogClock now={now} />}
      {style !== "analog" && <div className="tv-clock-time">{formatTime(now)}</div>}
    </div>
  );
}

/* ----------------------------------------------------------- dashboard -- */

type PrayerSlide = Extract<BoardSlide, { kind: "prayer" }>;

/**
 * The key a whole prayer panel is known by: the category it shows.
 * The slide carries an id of its own ("prayer:<category>"); what is hidden,
 * and what prayerSchedules filters on, is the category.
 */
export const categoryKey = (slideId: string) => `cat:${slideId.replace(/^prayer:/, "")}`;

/**
 * How long until the next minyan.
 *
 * The question somebody crossing the hall actually has is not "when is
 * mincha" but "have I missed it", and a number that moves answers that
 * faster than a time they have to subtract from a clock. It reads from the
 * board's own second-by-second clock rather than a timer of its own, so an
 * idle board still ticks exactly once a second.
 *
 * Under an hour it drops the hours, because "07:12" on a wall is read as a
 * time of day and "12:40 דק׳" is not.
 */
function NextPrayerCountdown({ target }: { target: ResolvedMinyan }) {
  const now = useContext(ClockContext);
  const edit = useBoardEdit();
  const nowSec = jerusalemMinutes(now) * 60 + now.getSeconds();
  const left = Math.max(0, target.minutes * 60 - nowSec);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const sec = left % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <p className="tv-dash-countdown" {...edit.attr("dash.countdown")}>
      <span className="tv-dash-countdown-label">
        {edit.text("dash.countdown", "עד התפילה הבאה")}
      </span>
      <span className="tv-dash-countdown-value">
        {h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`}
      </span>
    </p>
  );
}

function PrayerPanel({
  schedule,
  now,
  titleKey,
  countdown = false,
}: {
  schedule: PrayerSlide;
  now: Date;
  titleKey: string | null;
  /** Off unless the admin switched it on; see TvConfig.countdown. */
  countdown?: boolean;
}) {
  const edit = useBoardEdit();
  const nowMin = jerusalemMinutes(now);
  // A minyan called off today is not the next minyan. Pointing "הבא" at one
  // is the single most misleading thing this panel could do.
  const nextIndex = schedule.rows.findIndex((r) => r.minutes >= nowMin && !r.cancelled);
  const title = titleKey ? edit.text(titleKey, "זמני התפילות") : schedule.title;
  const listRef = useFitRows<HTMLUListElement>(schedule.rows.length);
  return (
    <div className="tv-panel tv-dash-prayers" {...edit.attr(categoryKey(schedule.id))}>
      <h3 className="tv-panel-title" {...(titleKey ? edit.attr(titleKey) : {})}>
        {title}
        {titleKey && schedule.title && <small> · {schedule.title}</small>}
      </h3>
      {schedule.rows.length === 0 ? (
        <p className="tv-empty">לא הוגדרו מניינים להיום</p>
      ) : (
        <ul
          ref={listRef}
          // A first guess, so the board does not flash a wrong layout; the
          // measurement below corrects it before anyone could see it.
          className={`tv-dash-list${schedule.rows.length > 7 ? " is-two-col" : ""}`}
          style={{ "--rows": Math.ceil(schedule.rows.length / 2) } as CSSProperties}
        >
          {schedule.rows.map((r: ResolvedMinyan, i) => (
            <li
              key={r.minyan.id}
              className={`tv-dash-row${i === nextIndex ? " is-next" : ""}${
                nextIndex === -1 || i < nextIndex ? " is-past" : ""
              }${r.cancelled ? " is-cancelled" : ""}${r.overridden ? " is-today-only" : ""}`}
              {...edit.attr(`minyan:${r.minyan.id}`)}
            >
              <span className="tv-dash-name">
                <span {...edit.attr(`minyan:${r.minyan.id}:label`)}>{r.minyan.label}</span>
                {i === nextIndex && <span className="tv-badge">הבא</span>}
                {/* A one-day exception says so on the line itself. Somebody
                    who walks in at the usual time and finds nothing must be
                    able to see why from the doorway - an absence explains
                    nothing, and a changed time that looks permanent is worse. */}
                {r.cancelled && <span className="tv-badge is-warn">מבוטל היום</span>}
                {r.overridden && !r.cancelled && <span className="tv-badge is-warn">היום בלבד</span>}
                {r.note && <small className="tv-dash-sub">{r.note}</small>}
              </span>
              <span className="tv-dash-time">{r.time}</span>
            </li>
          ))}
        </ul>
      )}
      {countdown && nextIndex >= 0 && !edit.hidden("dash.countdown") && (
        <NextPrayerCountdown target={schedule.rows[nextIndex]} />
      )}
    </div>
  );
}

/**
 * The Amud Yomi shiur, which is the one whose page changes every day.
 *
 * Matched by name, because that is the only thing that says which shiur it
 * is - and deliberately so: rename it and the line simply stops appearing,
 * which is the right failure. Guessing at a shiur and printing the wrong
 * daf under it would be worse than printing nothing.
 */
const AMUD_SHIUR = /עמוד\s+ה?יומי/;

function ShiurimPanel({ items, now }: { items: Shiur[]; now: Date }) {
  const edit = useBoardEdit();
  const nowMin = jerusalemMinutes(now);
  const nextIndex = items.findIndex((s) => shiurMinutes(s.time_text) >= nowMin);
  // Recomputed once a day, not once a second: it is the date that moves it.
  const dayKey = now.toDateString();
  const amud = useMemo(() => amudYomi(new Date(dayKey)), [dayKey]);
  return (
    <div className="tv-panel tv-dash-shiurim">
      <h3 className="tv-panel-title" {...edit.attr("dash.shiurim")}>
        {edit.text("dash.shiurim", "שיעורים")}
      </h3>
      {items.length === 0 ? (
        <p className="tv-empty">אין שיעורים היום</p>
      ) : (
        <ul className="tv-dash-list">
          {items.slice(0, 6).map((s, i) => {
            const isAmud = AMUD_SHIUR.test(s.title ?? "");
            // "16:15 · חצי שעה" becomes "16:15": the length of the shiur is
            // the same every week, and the page is not.
            const when = isAmud ? (s.time_text ?? "").split("·")[0].trim() : s.time_text;
            return (
              <li
                key={s.id}
                className={`tv-dash-row${i === nextIndex ? " is-next" : ""}${
                  isAmud ? " is-amud" : ""
                }`}
                {...edit.attr(`shiur:${s.id}`)}
              >
                <span className="tv-dash-name">
                  <span {...edit.attr(`shiur:${s.id}:title`)}>{s.title}</span>
                  {s.teacher && <small className="tv-dash-sub">{s.teacher}</small>}
                </span>
                <span className="tv-dash-time">{when}</span>
                {isAmud && !edit.hidden("dash.amud") && (
                  <span className="tv-dash-amud" {...edit.attr("dash.amud")}>
                    {/* The page turns over by itself; anything in front of it
                        is the admin's, and there is nothing by default. */}
                    {[edit.text("dash.amud", "").trim(), amud.label].filter(Boolean).join(" ")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DashboardStage({
  slides,
  now,
  zmanim,
  index,
  clockStyle,
  countdown = false,
}: {
  slides: BoardSlide[];
  /** Minute precision - the panels. */
  now: Date;
  zmanim: Zmanim;
  /** The board's rotation counter: steps the featured announcement. */
  index: number;
  clockStyle: ClockStyle;
  /** Show a live count to the next minyan (TvConfig.countdown). */
  countdown?: boolean;
}) {
  const edit = useBoardEdit();
  const prayers = slides.filter((s): s is PrayerSlide => s.kind === "prayer").slice(0, 2);
  const announcements: Announcement[] = slides.flatMap((s) =>
    s.kind === "announcements" ? s.items : [],
  );
  const shiurim: Shiur[] = slides.flatMap((s) => (s.kind === "shiurim" ? s.items : []));
  const featured = announcements.length ? announcements[index % announcements.length] : null;
  const dayKey = now.toDateString();
  const hebrew = useMemo(() => new HDate(new Date(dayKey)).renderGematriya(true), [dayKey]);
  const gregorian = now.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // A column with nothing left in it is dropped, and the rest widen to fill
  // the board: hiding the last panel of a column must not leave a hole.
  const columns = [
    prayers.length === 0 ? (
      <div className="tv-panel tv-empty">לא הוגדרו מניינים להיום</div>
    ) : (
      prayers.map((p, i) => (
        <PrayerPanel
          key={p.id}
          schedule={p}
          now={now}
          titleKey={i === 0 ? "dash.prayers" : null}
          // Only under the first panel: one count, for the next minyan on the
          // board, not one per category.
          countdown={countdown && i === 0}
        />
      ))
    ),
    [!edit.hidden("dash.clock"), !edit.hidden("dash.announcement")].some(Boolean) ? "center" : null,
    [true, !edit.hidden("dash.shiurim")].some(Boolean) ? "right" : null,
  ];
  const shown = columns.filter(Boolean).length;

  return (
    <section className={`tv-slide tv-dash is-cols-${shown}`}>
      <div className="tv-dash-col">{columns[0]}</div>

      {columns[1] && <div className="tv-dash-col tv-dash-center">
        {!edit.hidden("dash.clock") && (
          <div className="tv-panel tv-dash-clock" {...edit.attr("dash.clock")}>
            <LiveClockFace style={clockStyle} />
            <div className="tv-clock-date">
              {hebrew} · {gregorian}
            </div>
          </div>
        )}
        {!edit.hidden("dash.announcement") && (
          <div className="tv-panel tv-dash-ann">
            <h3 className="tv-panel-title" {...edit.attr("dash.announcement")}>
              {edit.text("dash.announcement", "הודעות")}
              {announcements.length > 1 && (
                <small>
                  {" "}
                  · {(index % announcements.length) + 1}/{announcements.length}
                </small>
              )}
            </h3>
            {featured ? (
              <div key={featured.id} className="tv-dash-ann-body">
                <AnnouncementCard item={featured} />
              </div>
            ) : (
              <p className="tv-empty">אין הודעות כרגע</p>
            )}
          </div>
        )}
      </div>}

      {columns[2] && (
        <div className="tv-dash-col">
          <ZmanimPanel zmanim={zmanim} now={now} titleKey="dash.zmanim" />
          {!edit.hidden("dash.shiurim") && <ShiurimPanel items={shiurim} now={now} />}
        </div>
      )}
    </section>
  );
}

/** The dashboard's bottom line: parasha, daf yomi, the season's insertions, and the admin's ticker text. */
export function DashboardStrip({ now, extra }: { now: Date; extra?: string }) {
  const edit = useBoardEdit();
  const dayKey = now.toDateString();
  const parts = useMemo(() => {
    const d = new Date(dayKey);
    return {
      parasha: weeklyParasha(d),
      daf: dafYomi(d)?.label ?? null,
      seasonal: seasonalPrayers(d).text,
    };
  }, [dayKey]);
  if (edit.hidden("dash.strip")) return null;
  const items = [
    parts.parasha,
    parts.daf && `דף יומי: ${parts.daf}`,
    !edit.hidden("dash.seasonal") && parts.seasonal,
    extra?.trim(),
  ].filter(Boolean) as string[];
  return (
    <div className="tv-dash-strip" {...edit.attr("dash.strip")}>
      {items.map((t, i) => (
        <span key={i} {...(t === parts.seasonal ? edit.attr("dash.seasonal") : {})}>
          {t}
        </span>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- split -- */

export function SplitSide({
  slides,
  now,
  zmanim,
}: {
  slides: BoardSlide[];
  now: Date;
  zmanim: Zmanim;
}) {
  const edit = useBoardEdit();
  const nowMin = jerusalemMinutes(now);
  const rows = slides.filter((s): s is PrayerSlide => s.kind === "prayer").flatMap((s) => s.rows);
  const next =
    rows.filter((r) => r.minutes >= nowMin).sort((a, b) => a.minutes - b.minutes)[0] ?? null;
  const minutesLeft = next ? next.minutes - nowMin : 0;
  return (
    <aside className="tv-split-side">
      {!edit.hidden("split.next") && (
        <div className="tv-panel tv-split-next" {...edit.attr("split.next")}>
          <div className="tv-hero-kicker">{edit.text("split.next", "המניין הבא")}</div>
          {next ? (
            <>
              <div className="tv-split-next-name">{next.minyan.label}</div>
              <div className="tv-split-next-time">{next.time}</div>
              <div className="tv-hero-until">
                {minutesLeft <= 0
                  ? "עכשיו"
                  : minutesLeft < 60
                  ? `בעוד ${minutesLeft} דק׳`
                  : `בעוד ${Math.floor(minutesLeft / 60)}:${String(minutesLeft % 60).padStart(
                      2,
                      "0",
                    )} שע׳`}
              </div>
            </>
          ) : (
            <div className="tv-split-next-name">המניינים להיום הסתיימו</div>
          )}
        </div>
      )}
      <ZmanimPanel zmanim={zmanim} now={now} />
    </aside>
  );
}
