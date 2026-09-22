import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { useNow } from "@community/lib/realtime";
import { SLIDE_KIND_LABELS, type TvConfig } from "./config";
import { OUTAGE_REASON_LABELS, type DeviceLink } from "./device";
import { allThemes, getTheme } from "./themes";
import { TvBoard } from "./TvBoard";
import { applyRecordEdits } from "./records";
import { buildSlides, useBoardData, useDayZmanim } from "./useBoardData";
import { useDeviceLink, type TvCommand } from "./useDeviceLink";
import { setWatchdogReport, watchMainThread } from "./watchdog";
import { WebControls } from "./TvWebControls";

/**
 * The board as it runs on the TV: owns rotation, pause, the remote, and the
 * link to the admin's control center.
 *
 * Remote control (the WebView receives the D-pad as ordinary key events):
 *   ◀ / ▶      next / previous slide (RTL: left is forward)
 *   OK         pause / resume
 *   ▲ / ▼      next / previous colour theme (kept on this TV)
 *   0          back to the theme the admin chose
 *   1-9        jump to slide N
 *   Back/Menu  help card - Back is captured so the board cannot be exited by
 *              a stray press on a wall-mounted screen.
 */

const THEME_OVERRIDE_KEY = "shul-tv-theme-override";

function readOverride(): string | null {
  try {
    // Validated against the theme list (built-in + the admin's) where it is used.
    return localStorage.getItem(THEME_OVERRIDE_KEY) || null;
  } catch {
    return null;
  }
}

function writeOverride(v: string | null) {
  try {
    if (v) localStorage.setItem(THEME_OVERRIDE_KEY, v);
    else localStorage.removeItem(THEME_OVERRIDE_KEY);
  } catch {
    /* no storage: the override just won't survive a restart */
  }
}

/** Slide name for the remote's toast; the Shabbat screen is not a configurable slide. */
function kindLabel(kind: string | undefined): string {
  if (kind === "shabbat") return "שבת שלום";
  return (SLIDE_KIND_LABELS as Record<string, string>)[kind ?? ""] ?? "";
}

/** Hebrew names for the log, which the admin reads. */
const COMMAND_LABELS: Record<TvCommand["command"], string> = {
  pause: "עצירה",
  resume: "המשך",
  next: "שקופית הבאה",
  prev: "שקופית קודמת",
  goto: "מעבר לשקופית",
  reload: "טעינה מחדש",
  theme: "החלפת ערכת נושא",
  snapshot: "צילום מסך",
  message: "הודעה על המסך",
  identify: "זיהוי מסך",
};

interface Notice {
  kind: "message" | "identify";
  text: string;
  until: number;
}

export interface TvAppProps {
  /**
   * "device" (default): the Android TV app - registers as a screen, pairs,
   * obeys admin commands.
   * "web": the same board opened in a browser by an admin (/admin/tv-board):
   * follows the saved design but is not a screen, and gets mouse/touch
   * controls instead of the remote-only interface.
   */
  mode?: "device" | "web";
  /** Web mode: show this design instead of the saved one (the editor's unsaved draft). */
  configOverride?: TvConfig | null;
  /** Web mode: where the "exit" button leads. */
  exitHref?: string;
}

export function TvApp({ mode = "device", configOverride = null, exitHref }: TvAppProps = {}) {
  const web = mode === "web";
  const rawData = useBoardData({ persist: true, live: true });
  // The editor's unsaved content edits (draft window only), shown as if saved.
  const data = useMemo(() => applyRecordEdits(rawData, configOverride?._records), [rawData, configOverride?._records]);
  const now = useNow(1000);
  const zmanim = useDayZmanim(now, data.settings);

  // Everything the heartbeat reports is read through this ref (filled below).
  const stateRef = useRef<Record<string, unknown>>({});
  const commandRef = useRef<(c: TvCommand, link: DeviceLink) => void>(() => {});
  const { status: device, link, config: adminConfig, configUpdatedAt } = useDeviceLink({
    getState: () => stateRef.current,
    onCommand: (c, l) => commandRef.current(c, l),
    device: !web,
  });

  // The board watches itself: anything that switches itself off - or any spin
  // no breaker caught - is said out loud in the admin's screen list, where a
  // screen that is quietly cooking itself would otherwise look perfectly fine.
  useEffect(() => {
    setWatchdogReport((level, kind, message, details) =>
      link.current?.log(level, kind, message, details),
    );
    const stop = watchMainThread();
    return () => {
      setWatchdogReport(null);
      stop();
    };
  }, [link]);

  // The remote's theme choice is kept on the TV. In a browser it lasts only
  // for the visit, so an admin never keeps seeing a stale local theme.
  const [themeOverride, setThemeOverride] = useState<string | null>(() => (web ? null : readOverride()));
  const baseConfig = configOverride ?? adminConfig;
  const themes = useMemo(() => allThemes(baseConfig.customThemes), [baseConfig.customThemes]);
  // When the admin picks a theme (saved, or in the editor's draft), it wins
  // over whatever the remote chose.
  const lastAdminTheme = useRef(baseConfig.theme);
  useEffect(() => {
    if (baseConfig.theme !== lastAdminTheme.current) {
      lastAdminTheme.current = baseConfig.theme;
      setThemeOverride(null);
      if (!web) writeOverride(null);
    }
  }, [baseConfig.theme, web]);

  const config = useMemo<TvConfig>(
    () =>
      // A remote choice the admin has since deleted is simply ignored.
      themeOverride && themes.some((t) => t.id === themeOverride)
        ? { ...baseConfig, theme: themeOverride, themeOverrides: {} }
        : baseConfig,
    [baseConfig, themeOverride, themes],
  );

  // Slides change at most once a minute (expiring notices, the day rolling
  // over); rebuilding them on every clock tick only re-rendered the board.
  const minuteStamp = Math.floor(now.getTime() / 60_000);
  const minuteNow = useMemo(() => new Date(minuteStamp * 60_000), [minuteStamp]);
  const slides = useMemo(() => buildSlides(data, config, minuteNow, zmanim), [data, config, minuteNow, zmanim]);

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  /** Bumped on every slide start; drives the background move (burn-in guard). */
  const [cycle, setCycle] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const found = slides.findIndex((s) => s.id === currentId);
  const index = found >= 0 ? found : 0;
  const slide = slides[index];

  // Rotation is one timeout per slide, not a ticking counter. A 250 ms state
  // tick re-rendered the whole board four times a second, which on the TV box
  // was a real share of the CPU for nothing but a progress bar.
  const startedAt = useRef(Date.now());
  const heldMs = useRef(0);
  const lastSlideId = useRef<string | undefined>(undefined);

  const live = useRef({ slides, index, paused });
  live.current = { slides, index, paused };

  const go = useCallback((delta: number) => {
    const { slides: s, index: i } = live.current;
    if (s.length === 0) return;
    heldMs.current = 0;
    setCurrentId(s[(i + delta + s.length) % s.length].id);
    setCycle((c) => c + 1);
  }, []);

  const goTo = useCallback((target: number | string) => {
    const s = live.current.slides;
    const n = typeof target === "number" ? target : s.findIndex((x) => x.id === target || x.kind === target);
    if (n < 0 || n >= s.length) return false;
    heldMs.current = 0;
    setCurrentId(s[n].id);
    setCycle((c) => c + 1);
    return true;
  }, []);

  const setPausedTo = useCallback((next: boolean) => {
    const wasPaused = live.current.paused;
    if (next === wasPaused) return;
    // Freeze the elapsed time now, so resuming continues rather than restarts.
    if (next) heldMs.current = Date.now() - startedAt.current;
    setPaused(next);
  }, []);

  const slideId = slide?.id;
  const slideSeconds = slide?.seconds ?? 20;
  const rotating = slides.length > 1;
  useEffect(() => {
    if (slideId !== lastSlideId.current) {
      // A different slide (advanced, or the old one vanished from the data).
      heldMs.current = 0;
      lastSlideId.current = slideId;
    }
    startedAt.current = Date.now() - heldMs.current;
    if (paused || !rotating) return;
    const id = window.setTimeout(() => go(1), Math.max(0, slideSeconds * 1000 - heldMs.current));
    return () => window.clearTimeout(id);
  }, [slideId, slideSeconds, paused, rotating, cycle, go]);

  const flash = useCallback((text: string) => setToast(text), []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), Math.max(0, notice.until - Date.now()));
    return () => window.clearTimeout(id);
  }, [notice]);

  const applyTheme = useCallback(
    (id: string | null) => {
      setThemeOverride(id);
      if (!web) writeOverride(id);
      flash(`ערכת נושא: ${getTheme(id ?? baseConfig.theme, themes).name}${id ? "" : " (של המנהל)"}`);
    },
    [baseConfig.theme, themes, flash, web],
  );

  const cycleTheme = useCallback(
    (delta: number) => {
      const currentIdx = themes.findIndex((t) => t.id === config.theme);
      applyTheme(themes[(currentIdx + delta + themes.length) % themes.length].id);
    },
    [config.theme, themes, applyTheme],
  );

  // ------------------------------------------------ state for the admin --
  stateRef.current = {
    slideId: slide?.id ?? null,
    slideKind: slide?.kind ?? null,
    slideIndex: index,
    slideCount: slides.length,
    slideSeconds,
    slideStartedAt: paused ? null : startedAt.current,
    elapsedMs: paused ? heldMs.current : Date.now() - startedAt.current,
    slideIds: slides.map((s) => s.id),
    paused,
    theme: config.theme,
    themeOverride,
    cycle,
    configUpdatedAt,
    realtime: data.sync.status,
    stale: data.stale,
    version: __APP_VERSION__,
    uptimeSec: Math.round(performance.now() / 1000),
    screen: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
  };

  // Push state immediately when what the admin mirrors changes.
  useEffect(() => {
    link.current?.reportNow();
  }, [slideId, paused, config.theme, cycle, link]);

  // ------------------------------------------------------ admin commands --
  commandRef.current = (cmd, l) => {
    const p = cmd.payload ?? {};
    switch (cmd.command) {
      case "pause":
        setPausedTo(true);
        break;
      case "resume":
        setPausedTo(false);
        break;
      case "next":
        go(1);
        break;
      case "prev":
        go(-1);
        break;
      case "goto":
        goTo(typeof p.index === "number" ? p.index : String(p.slideId ?? p.kind ?? ""));
        break;
      case "theme": {
        const id = typeof p.theme === "string" && themes.some((t) => t.id === p.theme) ? p.theme : null;
        applyTheme(id);
        break;
      }
      case "message":
        setNotice({
          kind: "message",
          text: String(p.text ?? "").slice(0, 400),
          until: Date.now() + Math.min(600, Math.max(5, Number(p.seconds) || 30)) * 1000,
        });
        break;
      case "identify":
        setNotice({ kind: "identify", text: device?.name || "מסך", until: Date.now() + 12_000 });
        break;
      case "snapshot":
        void captureSnapshot(l);
        break;
      case "reload":
        l.log("info", "command", "טעינה מחדש לפי בקשת המנהל");
        window.setTimeout(() => window.location.reload(), 500);
        return;
    }
    l.log("info", "command", `פקודה מהמנהל: ${COMMAND_LABELS[cmd.command] ?? cmd.command}`, { command: cmd.command, payload: p });
    l.reportNow();
  };

  // ---------------------------------------------------------------- keys --
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // In a browser the control bar has real buttons and a link: Enter /
      // Space on them must press them, not pause the board.
      // Arrows and the other shortcuts keep working with a button focused.
      if ((e.key === "Enter" || e.key === " ") && e.target instanceof Element && e.target.closest("button, a, input, textarea, select"))
        return;
      const { slides: s, index: i, paused: p } = live.current;
      switch (e.key) {
        case "ArrowLeft":
          go(1);
          flash(kindLabel(s[(i + 1) % s.length]?.kind));
          break;
        case "ArrowRight":
          go(-1);
          flash(kindLabel(s[(i - 1 + s.length) % s.length]?.kind));
          break;
        case "Enter":
        case " ":
          // The board shows the pause / resume icon itself, for 3 seconds.
          setPausedTo(!p);
          break;
        case "ArrowUp":
          cycleTheme(1);
          break;
        case "ArrowDown":
          cycleTheme(-1);
          break;
        case "0":
          applyTheme(null);
          break;
        case "Escape":
        case "ContextMenu":
        case "m":
          setHelp((h) => !h);
          break;
        default:
          if (/^[1-9]$/.test(e.key)) goTo(Number(e.key) - 1);
          else return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, goTo, setPausedTo, cycleTheme, applyTheme, flash]);

  // Another app opened on the TV (YouTube, input switch...) or back to the
  // board: recorded so the disconnect report gives the real reason.
  useEffect(() => {
    if (web || !Capacitor.isNativePlatform()) return;
    const handle = CapApp.addListener("appStateChange", ({ isActive }) => link.current?.setForeground(isActive));
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [web, link]);

  /**
   * Android Back. The board is signage, so a stray press must not drop the
   * congregation onto the TV home screen - but it must still be possible to
   * leave for another app. So: Back closes the help card if it is open,
   * otherwise the first press asks and the second one (within 3 s) exits.
   */
  const exitArmed = useRef(0);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapApp.addListener("backButton", () => {
      setHelp((open) => {
        if (open) {
          exitArmed.current = 0;
          return false;
        }
        if (Date.now() < exitArmed.current) void CapApp.exitApp();
        else {
          exitArmed.current = Date.now() + 3000;
          flash("לחצו שוב על ׳חזור׳ ליציאה · לעזרה: כפתור התפריט");
        }
        return false;
      });
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [flash]);

  // Re-evaluated on the once-a-second clock render; the bar steps with it.
  const elapsedMs = paused ? heldMs.current : now.getTime() - startedAt.current;
  const progress = slideSeconds > 0 ? elapsedMs / (slideSeconds * 1000) : 0;

  // The footer reflects the heartbeat as well as the realtime socket. In a
  // simulated server outage the socket stayed up while every request failed,
  // and the board kept saying "מעודכן" for three minutes.
  const deviceOffline = device?.online === false;
  const boardData = useMemo(
    () => (deviceOffline && data.sync.status === "live" ? { ...data, sync: { ...data.sync, status: "offline" as const } } : data),
    [data, deviceOffline],
  );

  return (
    <TvBoard
      data={boardData}
      config={config}
      now={now}
      zmanim={zmanim}
      slides={slides}
      index={index}
      cycle={cycle}
      progress={progress}
      paused={paused}
      overlay={
        <>
          {toast && <div className="tv-toast">{toast}</div>}

          {device && !device.approved && device.pairingCode && (
            <div className="tv-pairing">
              <span className="tv-pairing-label">קוד צימוד</span>
              <span className="tv-pairing-code">
                {device.pairingCode.slice(0, 3)} {device.pairingCode.slice(3)}
              </span>
              <span className="tv-pairing-hint">באתר: ניהול ← לוח תצוגה ← צימוד מסך</span>
            </div>
          )}

          {notice && (
            <div className="tv-alert-backdrop">
              <div className={`tv-notice is-${notice.kind}`}>
                {notice.kind === "identify" ? (
                  <>
                    <div className="tv-notice-kicker">זיהוי מסך</div>
                    <div className="tv-notice-title">{notice.text}</div>
                  </>
                ) : (
                  <div className="tv-notice-text">{notice.text}</div>
                )}
              </div>
            </div>
          )}

          {web && (
            <WebControls
              paused={paused}
              themeName={getTheme(config.theme, themes).name}
              exitHref={exitHref}
              onPrev={() => go(-1)}
              onNext={() => go(1)}
              onPause={() => setPausedTo(!paused)}
              onTheme={() => cycleTheme(1)}
              onHelp={() => setHelp((h) => !h)}
            />
          )}

          {help && (
            <div className="tv-help" onClick={() => setHelp(false)}>
              <div className="tv-help-card">
                <h2>{web ? "קיצורי מקלדת" : "שליטה בשלט"}</h2>
                <dl>
                  <dt>◀ ▶</dt>
                  <dd>שקופית הבאה / הקודמת</dd>
                  <dt>{web ? "רווח" : "OK"}</dt>
                  <dd>עצירה / המשך</dd>
                  <dt>▲ ▼</dt>
                  <dd>החלפת ערכת נושא</dd>
                  <dt>0</dt>
                  <dd>חזרה לערכת הנושא של המנהל</dd>
                  <dt>1–9</dt>
                  <dd>מעבר ישיר לשקופית</dd>
                  <dt>{web ? "Esc" : "תפריט"}</dt>
                  <dd>פתיחה וסגירה של החלון הזה</dd>
                  {!web && (
                    <>
                      <dt>חזור</dt>
                      <dd>לחיצה כפולה: יציאה מהלוח לאפליקציות אחרות</dd>
                    </>
                  )}
                </dl>
                <p className="tv-help-foot">
                  {web ? (
                    "תצוגה בדפדפן (לא נספרת כמסך)"
                  ) : (
                    <>
                      {device?.name ? `${device.name} · ` : ""}
                      {device?.approved ? "מצומד" : "לא מצומד"} ·{" "}
                      {device?.online ? "מחובר" : device?.outageReason ? OUTAGE_REASON_LABELS[device.outageReason] : "מתחבר…"}
                    </>
                  )}
                  <br />
                  ערכת נושא: {getTheme(config.theme, themes).name}
                  {themeOverride ? " (נבחרה בשלט)" : ""} · גרסה {__APP_VERSION__}
                </p>
              </div>
            </div>
          )}
        </>
      }
    />
  );
}

/**
 * Renders the board to a JPEG and uploads it. Loaded on demand: html-to-image
 * is only needed when the admin asks for a picture.
 */
async function captureSnapshot(link: DeviceLink) {
  const node = document.querySelector<HTMLElement>(".tv-frame");
  if (!node) return;
  try {
    const { toJpeg } = await import("html-to-image");
    // Full screen resolution (1920x1080 on a DPR-2 box), so the admin sees
    // what the room sees. The server accepts up to 900 KB of data URL; a busy
    // slide at 0.85 is ~300-500 KB, and a lighter retry covers the rare
    // photo-heavy one.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    let image = await toJpeg(node, { quality: 0.85, pixelRatio, cacheBust: false });
    if (image.length > 880_000) image = await toJpeg(node, { quality: 0.6, pixelRatio, cacheBust: false });
    await link.putSnapshot(image);
    link.log("info", "snapshot", "צילום מסך נשלח", { bytes: image.length });
  } catch (error) {
    link.log("error", "snapshot", `צילום מסך נכשל: ${error instanceof Error ? error.message : String(error)}`);
  }
}
