import { HolyEndMinutesContext } from "./holyEnd";
import { useBriefly } from "@/hooks/useBriefly";
import { IllustratedStage } from "./TvIllustrated";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HDate } from "@hebcal/core";
import { DAYS_HE } from "@community/lib/data";
import { jerusalemWeekday } from "@community/lib/minyan-time";
import { formatTime, type Zmanim } from "@community/lib/zmanim";
import type { Settings } from "@community/lib/data";
import { CORNER_SHAPE, logoCut, type TvConfig } from "./config";
import { layerVars } from "./layerCss";
import { MedallionStage } from "./TvMedallion";
import { BoardEditContext, makeBoardEdit, useBoardEdit } from "./boardEdit";
import { dafYomi, weeklyParasha } from "./learning";
import { backdropUrl } from "./backdrops";
import { getTheme, themeStyle } from "./themes";
import { SlideView } from "./TvSlides";
import { ClockFace, DashboardStage, DashboardStrip, SplitSide } from "./TvLayouts";
import { ClockContext } from "./clockContext";
import { TvShapes } from "./TvShapes";
import { holyOccasionOn, type BoardData, type BoardSlide } from "./useBoardData";
import { checkClock } from "./clock";
import { OccasionCard } from "./OccasionCard";
import { occasionPagesNow } from "./occasions";
import { zmanimFor } from "@community/lib/minyan-time";
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
  // The synagogue's setting, shared with the website; the board's own copy only as a fallback.
  const holyEndMinutes = data.settings?.shabbat_end_minutes ?? config.shabbat.endMinutesAfterSunset;
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
        skin: config.skin,
        customThemes: config.customThemes,
        overrides: config.themeOverrides,
        font: config.font,
        textScale: config.textScale,
        backgroundImage: backdropUrl(config.backgroundImage),
        backgroundGradient: config.backgroundGradient,
        backgroundDim: config.backgroundDim,
      }),
    [
      config.theme,
      config.skin,
      config.customThemes,
      config.themeOverrides,
      config.font,
      config.textScale,
      config.backgroundImage,
      config.backgroundGradient,
      config.backgroundDim,
    ],
  );
  // The admin's own corner settings, when they overrule the skin.
  const frame = useMemo(() => {
    const { shape, top, bottom } = config.frame;
    const vars: Record<string, string> = {};
    if (shape !== "auto") vars["--frame-shape"] = CORNER_SHAPE[shape];
    if (top !== null) vars["--frame-top"] = `calc(var(--u) * ${top})`;
    if (bottom !== null) vars["--frame-bottom"] = `calc(var(--u) * ${bottom})`;
    // A radius can only show on a panel that is not cut to a silhouette, so
    // asking for one drops the skin's clip path (see tv.css).
    let classes =
      (shape !== "auto" ? " has-frame-shape" : "") +
      (shape === "arch" ? " has-frame-arch" : "") +
      (top !== null || bottom !== null ? " has-frame-radius" : "");

    // The air around the panels, when the admin sets it instead of the layout.
    for (const [edge, value] of Object.entries(config.spacing)) {
      if (value === null) continue;
      vars[`--space-${edge}`] = `calc(var(--u) * ${value})`;
      classes += ` has-space-${edge}`;
    }
    // Set as an inline variable so it beats whatever a skin chose, and left
    // out entirely when the admin has not asked - which is how the skin keeps
    // its own answer.
    if (config.tracking !== null) vars["--tv-tracking"] = `${config.tracking}em`;
    // The background's adjustments and every frame's dress (layers.ts).
    const layers = layerVars(config.backgroundTune, config.frameStyle);
    return { vars: { ...vars, ...layers.vars }, classes: classes + layers.classes };
  }, [config.frame, config.spacing, config.tracking, config.backgroundTune, config.frameStyle]);
  const tint = config.backgroundTune.tint;

  // An occasion's card on the whole board: drawn over it, like a picture.
  const occasionStage = slide?.kind === "occasion" ? slide : null;
  // On Shabbat and festivals the screen already shows its times: no countdowns or pop-ups.
  const shabbatNowOn = holyOccasionOn(slides);
  // A line along the bottom of the ordinary screens, for the occasion that asked for one.
  const zmanimOn = useCallback((d: Date) => zmanimFor(d, data.settings), [data.settings]);
  const minuteKey = Math.floor(now.getTime() / 60_000);
  const bannerPage = useMemo(() => {
    if (!checkClock(now).trusted) return null;
    const { pages } = occasionPagesNow(config, data.settings, now, zmanimOn);
    return pages.find((p) => [p.main, ...p.with].some((a) => a.occasion.banner)) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, data.settings, minuteKey, zmanimOn]);
  const endMinutes = data.settings?.shabbat_end_minutes ?? config.shabbat.endMinutesAfterSunset;
  /**
   * A board built in the composer: the composer decides which screens and
   * what is on them, and the layout decides how each one is drawn.
   *
   * The first version of this made the layout choice "step aside" for a
   * composed board, which treated the painted board and the full board as
   * rival arrangements of content. They are looks. And stepping aside meant
   * switching them off: a gabbai who had saved screens and then moved the
   * painted board's sliders - brightness, hue, stone, frames - saw nothing
   * change on the preview or on the wall, because nothing was drawing them.
   * Reported from תורה ואהבתה.
   *
   * The merged looks read their content from a slide list, so they are handed
   * the content of the screen that is up now rather than the list of screens.
   * A screen with nothing those looks have a place for - only the daf yomi,
   * say - is drawn as an ordinary composed screen instead of as an empty
   * painting.
   */
  const composed = slide?.kind === "composed" ? slide : null;
  // An occasion's screen with blocks beside its card is drawn as a composed screen.
  const occasionScreen = Boolean(composed?.parts.some((p) => p.slide?.kind === "occasion"));
  /**
   * The bars of the screen up now: the composer's "שם בית הכנסת", "שעון" and
   * "שורת הפרשה והנרות" switches. Saved on every screen from the start and
   * read by nothing, so turning them off changed nothing anywhere. A board
   * with no screens, and an occasion's own screens, keep all three.
   */
  const bars = useMemo(() => {
    const on = (b: string) => !composed || occasionScreen || composed.screen.blocks.some((x) => x.block === b);
    return { header: on("header"), clock: on("clock"), footer: on("footer"), logo: on("logo") };
  }, [composed, occasionScreen]);
  const screenSlides = composed
    ? composed.parts.flatMap((p) => (p.slide ? [p.slide] : []))
    : slides;
  const mergedLook =
    config.screenLayout === "illustrated" || config.screenLayout === "dashboard" || config.screenLayout === "medallion";
  // The medallion draws any screen - what it has frames of its own for, and a
  // frame for anything else ticked; the painted board and the full board only
  // a screen with the prayers or the zmanim on it.
  const screenFitsLook =
    !composed ||
    (!occasionScreen &&
      (config.screenLayout === "medallion" || composed.parts.some((p) => p.block === "prayers" || p.block === "zmanim")));
  // An occasion's screen always takes the whole stage, whatever the layout.
  const layout = occasionStage
    ? "rotate"
    : composed && !(mergedLook && screenFitsLook)
      ? "rotate"
      : config.screenLayout;
  const dashboard = layout === "dashboard";
  // A painted board draws its own header, clock and bottom line.
  const illustrated = layout === "illustrated";
  // The medallion draws its own header too: the clock, the day and the date are its frames.
  const medallion = layout === "medallion";
  const ownHeader = illustrated || medallion;
  const alert = shabbatNowOn ? null : currentZmanAlert(now, zmanim, config.alerts, jerusalemWeekday(now) === 5);

  return (
    <HolyEndMinutesContext.Provider value={holyEndMinutes}>
    <BoardEditContext.Provider value={edit}>
    <div className={`tv-frame${className ? ` ${className}` : ""}`}>
      <div
        className={`tv-root is-layout-${layout} is-skin-${config.skin}${
          // A light board is a different contrast problem from a dark one,
          // and some things that read on navy vanish on parchment.
          getTheme(config.theme, config.customThemes).light ? " is-light" : ""
        }${config.backgroundImage ? " has-bg-image" : ""}${
          config.backgroundGradient ? " has-bg-gradient" : ""
        }${frame.classes}`}
        style={{ ...style, ...frame.vars }}
        {...edit.attr("board.background")}
      >
        <div className="tv-bg" aria-hidden style={{ transform: DRIFT[cycle % DRIFT.length] }}>
          {/* A colour over the background that keeps its light and shade. */}
          {tint && (
            <div className="tv-bg-tint" style={{ background: tint, opacity: config.backgroundTune.tintStrength }} />
          )}
        </div>
        <TvShapes />
        {!ownHeader && (bars.header || bars.clock || (bars.logo && config.logos.length > 0)) && (
          <TvHeader
            settings={data.settings}
            now={now}
            config={config}
            clock={!dashboard && bars.clock}
            brand={bars.header}
            logos={bars.logo}
          />
        )}

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
          ) : illustrated ? (
            <IllustratedStage
              illustration={config.illustration}
              customIllustrations={config.customIllustrations}
              look={config.illustratedStyle}
              slides={screenSlides}
              now={minuteNow}
              zmanim={zmanim}
              settings={data.settings}
              shabbatEndMinutes={holyEndMinutes}
            />
          ) : medallion ? (
            <MedallionStage
              slides={screenSlides}
              parts={composed?.parts}
              now={minuteNow}
              zmanim={zmanim}
              settings={data.settings}
              shabbatEndMinutes={holyEndMinutes}
              rowsPerFrame={config.illustratedStyle.rows}
              bars={bars}
              logos={bars.logo ? config.logos.map((l) => ({ id: l.id, name: l.name, src: logoCut(l, getTheme(config.theme, config.customThemes).light) })) : []}
            />
          ) : dashboard ? (
            <ClockContext.Provider value={now}>
              <MemoDashboard slides={screenSlides} now={minuteNow} zmanim={zmanim} index={index} clockStyle={config.clockStyle} countdown={config.countdown.enabled} />
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

        {!dashboard && !ownHeader && config.ticker.enabled && config.ticker.text.trim() && (
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
          {edit.hidden("footer.dots") || !bars.footer || occasionStage || dashboard || ownHeader ? (
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

          {!edit.hidden("footer.status") && bars.footer && <SyncStatus data={data} now={now} />}
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

        {/*
          An occasion on the whole board, or its line along the bottom of an
          ordinary screen. Drawn here rather than by the app, so the admin's
          preview shows exactly what the wall will.
        */}
        {occasionStage ? (
          <OccasionCard
            page={occasionStage.page}
            mode="stage"
            now={now}
            settings={occasionStage.settings}
            endMinutes={occasionStage.endMinutes}
            zmanimFor={zmanimOn}
            schedules={occasionStage.schedules}
          />
        ) : (
          bannerPage &&
          !occasionScreen && (
            <OccasionCard
              page={bannerPage}
              mode="banner"
              now={now}
              settings={data.settings}
              endMinutes={endMinutes}
              zmanimFor={zmanimOn}
            />
          )
        )}

        {pauseChip && <div className="tv-paused">{pauseChip === "paused" ? "⏸ מושהה" : "▶ ממשיך"}</div>}
        {overlay}
      </div>
    </div>
    </BoardEditContext.Provider>
    </HolyEndMinutesContext.Provider>
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

function TvHeader({
  settings,
  now,
  config,
  clock = true,
  brand = true,
  logos = true,
}: {
  settings: Settings | null;
  now: Date;
  config: TvConfig;
  clock?: boolean;
  /** The name, the logos, the date and the ribbon; off leaves only the clock. */
  brand?: boolean;
  /** The board's own logos (config.logos), by the screen's "לוגואים" switch. */
  logos?: boolean;
}) {
  // Which cut of a logo to use. A board can be parchment or navy,
  // and a wordmark that reads on one is invisible on the other.
  const light = getTheme(config.theme, config.customThemes).light;
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
      {(brand || logos) && (
      <div className="tv-header-brand">
        {logos && !edit.hidden("header.sponsor") && config.logos.length > 0 && (
          <span className="tv-logos" {...edit.attr("header.sponsor")}>
            {config.logos.map((l) => (
              <img key={l.id} className="tv-sponsor" src={logoCut(l, light)} alt={l.name} decoding="async" />
            ))}
          </span>
        )}
        {brand && !edit.hidden("header.logo") && (
          <img
            className="tv-logo"
            src={karovimLogo}
            alt="קרובים - להיות קרוב זה יהודי"
            decoding="async"
            {...edit.attr("header.logo")}
          />
        )}
        {brand && (
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
        )}
      </div>
      )}
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
  // A minute after each change, then off the wall: the congregation reads the
  // times, not the connection. The control centre still sees the real state.
  const fresh = useBriefly(live ? "live" : status);
  const edit = useBoardEdit();
  if (!fresh) return null;
  let label: string;
  if (live) label = "מעודכן";
  else if (status === "connecting") label = "מתחבר…";
  else label = lastSyncedAt ? `מציג מידע מ־${describeAge(now.getTime() - lastSyncedAt.getTime())}` : "אין חיבור";
  return (
    <div className="tv-status" {...edit.attr("footer.status")}>
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

