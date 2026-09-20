import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HDate } from "@hebcal/core";
import { DAYS_HE } from "@community/lib/data";
import { jerusalemWeekday } from "@community/lib/minyan-time";
import { formatTime, type Zmanim } from "@community/lib/zmanim";
import type { Settings } from "@community/lib/data";
import type { TvConfig } from "./config";
import { BoardEditContext, makeBoardEdit, useBoardEdit } from "./boardEdit";
import { dafYomi, weeklyParasha } from "./learning";
import { themeStyle } from "./themes";
import { SlideView } from "./TvSlides";
import { ClockFace, DashboardStage, DashboardStrip, SplitSide } from "./TvLayouts";
import { ClockContext } from "./clockContext";
import { TvShapes } from "./TvShapes";
import type { BoardData, BoardSlide } from "./useBoardData";
import { currentZmanAlert, describeMinutes, formatCountdown } from "./zmanAlerts";
import karovimLogo from "./assets/karovim-logo.png";
import "./tv.css";

/**
 * The board, as a pure function of its props. It owns no timers and no data
 * fetching, which is what lets the admin site render the very same component
 * in a preview frame, driven either by its own controls or by the state a
 * real TV reports.
 */

export interface TvBoardProps {
  data: BoardData;
  config: TvConfig;
  now: Date;
  zmanim: Zmanim;
  slides: BoardSlide[];
  index: number;
  /** Increments on every slide start; moves the background (burn-in guard). */
  cycle: number;
  /** 0..1 through the current slide; updated with the once-a-second clock. */
  progress: number;
  paused: boolean;
  /** Admin editor: mark editable elements (data-edit) for click-to-edit. */
  editing?: boolean;
  /** Anything to layer on top: remote-control toasts, help, pairing code. */
  overlay?: ReactNode;
  className?: string;
}

/** Background positions stepped through, one per slide change (see tv.css). */
const DRIFT = [
  "translate3d(-4%, -3%, 0)",
  "translate3d(3%, 2%, 0)",
  "translate3d(-2%, 4%, 0)",
  "translate3d(4%, -2%, 0)",
  "translate3d(0%, 0%, 0)",
];

export function TvBoard({ data, config, now, zmanim, slides, index, cycle, progress, paused, overlay, className, editing = false }: TvBoardProps) {
  const edit = useMemo(() => makeBoardEdit(config, editing), [config, editing]);
  const pauseChip = usePauseChip(paused);
  const slide = slides[Math.min(index, slides.length - 1)];
  // Slide bodies only need minute precision; handing them the per-second
  // clock would re-render every panel every second on a weak TV CPU.
  const minuteStamp = Math.floor(now.getTime() / 60_000);
  const minuteNow = useMemo(() => new Date(minuteStamp * 60_000), [minuteStamp]);
  const style = useMemo(
    () =>
      themeStyle({
        theme: config.theme,
        customThemes: config.customThemes,
        overrides: config.themeOverrides,
        font: config.font,
        textScale: config.textScale,
        backgroundImage: config.backgroundImage,
        backgroundGradient: config.backgroundGradient,
        backgroundDim: config.backgroundDim,
      }),
    [
      config.theme,
      config.customThemes,
      config.themeOverrides,
      config.font,
      config.textScale,
      config.backgroundImage,
      config.backgroundGradient,
      config.backgroundDim,
    ],
  );
  // On Shabbat the screen already shows its times; no countdowns or pop-ups.
  const shabbat = slides[0]?.kind === "shabbat";
  // The Shabbat screen always takes the whole stage, whatever the layout.
  const layout = shabbat ? "rotate" : config.screenLayout;
  const dashboard = layout === "dashboard";
  const alert = shabbat ? null : currentZmanAlert(now, zmanim, config.alerts, jerusalemWeekday(now) === 5);

  return (
    <BoardEditContext.Provider value={edit}>
    <div className={`tv-frame${className ? ` ${className}` : ""}`}>
      <div
        className={`tv-root is-layout-${layout} is-skin-${config.skin}${config.backgroundImage ? " has-bg-image" : ""}${
          config.backgroundGradient ? " has-bg-gradient" : ""
        }`}
        style={style}
      >
        <div className="tv-bg" aria-hidden style={{ transform: DRIFT[cycle % DRIFT.length] }} />
        <TvShapes />
        <TvHeader settings={data.settings} now={now} config={config} clock={!dashboard} />

        <main className="tv-stage">
          {!data.anyLoaded ? (
            <div className="tv-centered">
              <div className="tv-centered-title">
                {data.sync.status === "offline" ? "אין חיבור לרשת" : "טוען נתונים…"}
              </div>
              <p className="tv-centered-note">
                {data.sync.status === "offline"
                  ? "המסך ינסה להתחבר שוב אוטומטית. ברגע שהחיבור יחזור, הנתונים יוצגו."
                  : "מתחבר לשרת בית הכנסת."}
              </p>
            </div>
          ) : dashboard ? (
            <ClockContext.Provider value={now}>
              <MemoDashboard slides={slides} now={minuteNow} zmanim={zmanim} index={index} clockStyle={config.clockStyle} />
            </ClockContext.Provider>
          ) : layout === "split" ? (
            <div className="tv-split">
              <SplitSide slides={slides} now={minuteNow} zmanim={zmanim} />
              <div className="tv-split-main">
                {slide && <MemoSlideView key={`${slide.id}#${cycle}`} slide={slide} now={minuteNow} zmanim={zmanim} paused={paused} />}
              </div>
            </div>
          ) : (
            slide && (
              <MemoSlideView key={`${slide.id}#${cycle}`} slide={slide} now={minuteNow} zmanim={zmanim} paused={paused} />
            )
          )}
        </main>

        {dashboard && <DashboardStrip now={minuteNow} extra={config.ticker.enabled ? config.ticker.text : ""} />}

        {!dashboard && config.ticker.enabled && config.ticker.text.trim() && (
          <div className="tv-ticker" {...edit.attr("ticker")}>
            <span
              className="tv-ticker-text"
              style={{ animationDuration: `${Math.max(18, config.ticker.text.length * 0.32)}s` }}
            >
              {config.ticker.text}
            </span>
          </div>
        )}

        <footer className="tv-footer">
          {edit.hidden("footer.dots") || shabbat || dashboard ? (
            <span />
          ) : (
            <div className="tv-footer-slides" {...edit.attr("footer.dots")}>
              <div className="tv-dots">
                {slides.map((s, i) => (
                  <span key={s.id + i} className={`tv-dot${i === index ? " is-active" : ""}`} />
                ))}
              </div>
              <div className="tv-progress">
                <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }} />
              </div>
            </div>
          )}

          {alert && !alert.popup && (
            <div className="tv-alert-chip">
              <span className="tv-alert-chip-icon">⏳</span>
              {alert.label} בעוד <b>{formatCountdown(alert.secondsLeft)}</b>
            </div>
          )}

          {!edit.hidden("footer.status") && <SyncStatus data={data} now={now} />}
        </footer>

        {alert?.popup && (
          <div className="tv-alert-backdrop">
            <div className="tv-alert-card" role="alert">
              <div className="tv-alert-icon">⏳</div>
              <div className="tv-alert-title">{alert.label}</div>
              <div className="tv-alert-countdown">{formatCountdown(alert.secondsLeft)}</div>
              <div className="tv-alert-sub">
                {describeMinutes(alert.secondsLeft)} · בשעה {formatTime(alert.at)}
              </div>
            </div>
          </div>
        )}

        {pauseChip && <div className="tv-paused">{pauseChip === "paused" ? "⏸ מושהה" : "▶ ממשיך"}</div>}
        {overlay}
      </div>
    </div>
    </BoardEditContext.Provider>
  );
}

const MemoSlideView = memo(SlideView);
const MemoDashboard = memo(DashboardStage);

/** How long the pause / resume icon stays up before it hides itself. */
const PAUSE_CHIP_MS = 3000;

/**
 * The pause icon appears only when the state changes - "⏸ מושהה" on pause,
 * "▶ ממשיך" on resume - and hides after 3 s, so a paused board is not
 * covered by a permanent badge. (A board that loads already paused shows it
 * once, too.) The stopped progress bar still shows that it is paused.
 */
function usePauseChip(paused: boolean): "paused" | "resumed" | null {
  const [chip, setChip] = useState<"paused" | "resumed" | null>(null);
  const first = useRef(true);
  useEffect(() => {
    const initial = first.current;
    first.current = false;
    if (initial && !paused) return;
    setChip(paused ? "paused" : "resumed");
    const id = window.setTimeout(() => setChip(null), PAUSE_CHIP_MS);
    return () => window.clearTimeout(id);
  }, [paused]);
  return chip;
}

function TvHeader({ settings, now, config, clock = true }: { settings: Settings | null; now: Date; config: TvConfig; clock?: boolean }) {
  const dayKey = now.toDateString();
  const day = useMemo(() => {
    const d = new Date(dayKey);
    return {
      hebrew: new HDate(d).renderGematriya(true),
      parasha: weeklyParasha(d),
      daf: dafYomi(d)?.label ?? null,
    };
  }, [dayKey]);

  const gregorian = now.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
  const weekday = DAYS_HE[jerusalemWeekday(now)];
  const edit = useBoardEdit();
  const ribbon = [
    config.header.parasha && day.parasha && { key: "header.parasha", text: day.parasha },
    config.header.dafYomi && day.daf && { key: "header.daf", text: `דף יומי: ${day.daf}` },
  ].filter((r): r is { key: string; text: string } => Boolean(r));
  const title = edit.text("header.title", settings?.name ?? "בית הכנסת");
  const address = edit.text("header.address", settings?.address ?? "");
  const subtitle = [
    !edit.hidden("header.weekday") && weekday && { key: "header.weekday", text: `יום ${weekday}` },
    !edit.hidden("header.address") && address && { key: "header.address", text: address },
  ].filter((r): r is { key: string; text: string } => Boolean(r));

  return (
    <header className={`tv-header${edit.flipped("header") ? " is-flipped" : ""}`}>
      <div className="tv-header-brand">
        {!edit.hidden("header.logo") && (
          <img
            className="tv-logo"
            src={karovimLogo}
            alt="קרובים - להיות קרוב זה יהודי"
            decoding="async"
            {...edit.attr("header.logo")}
          />
        )}
        <div className="tv-header-main">
          {!edit.hidden("header.title") && (
            <h1 className="tv-title" {...edit.attr("header.title")}>
              {title}
            </h1>
          )}
          {subtitle.length > 0 && (
            <div className="tv-subtitle">
              {subtitle.map((p, i) => (
                <span key={p.key} {...edit.attr(p.key)}>
                  {i > 0 ? " · " : ""}
                  {p.text}
                </span>
              ))}
            </div>
          )}
          {ribbon.length > 0 && (
            <div className="tv-ribbon">
              {ribbon.map((r) => (
                <span key={r.key} {...edit.attr(r.key)}>
                  {r.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {clock && !edit.hidden("header.clock") && (
        <div className="tv-clock" {...edit.attr("header.clock")}>
          <ClockFace now={now} style={config.clockStyle} />
          {!edit.hidden("header.date") && (
            <div className="tv-clock-date" {...edit.attr("header.date")}>
              {day.hebrew} · {gregorian}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

function SyncStatus({ data, now }: { data: BoardData; now: Date }) {
  const { status, lastSyncedAt } = data.sync;
  const live = status === "live" && !data.stale;
  let label: string;
  if (live) label = "מעודכן";
  else if (status === "connecting") label = "מתחבר…";
  else label = lastSyncedAt ? `מציג מידע מ־${describeAge(now.getTime() - lastSyncedAt.getTime())}` : "אין חיבור";
  return (
    <div className="tv-status" {...useBoardEdit().attr("footer.status")}>
      <span className={`tv-status-dot${live ? "" : status === "connecting" ? " is-connecting" : " is-offline"}`} />
      <span>{label}</span>
    </div>
  );
}

function describeAge(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "הרגע";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}
