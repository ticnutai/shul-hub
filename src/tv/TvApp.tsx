import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { useNow } from "@community/lib/realtime";
import { DEFAULT_TV_CONFIG, SLIDE_KIND_LABELS, type TvConfig } from "./config";
import { getTheme, TV_THEMES, type TvThemeId } from "./themes";
import { TvBoard } from "./TvBoard";
import { buildSlides, useBoardData, useDayZmanim } from "./useBoardData";

/**
 * The board as it runs on the TV: owns rotation, pause, and the remote.
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

function readOverride(): TvThemeId | null {
  try {
    const v = localStorage.getItem(THEME_OVERRIDE_KEY);
    return TV_THEMES.some((t) => t.id === v) ? (v as TvThemeId) : null;
  } catch {
    return null;
  }
}

function writeOverride(v: TvThemeId | null) {
  try {
    if (v) localStorage.setItem(THEME_OVERRIDE_KEY, v);
    else localStorage.removeItem(THEME_OVERRIDE_KEY);
  } catch {
    /* no storage: the override just won't survive a restart */
  }
}

export function TvApp({ config: adminConfig = DEFAULT_TV_CONFIG }: { config?: TvConfig }) {
  const data = useBoardData({ persist: true, live: true });
  const now = useNow(1000);
  const zmanim = useDayZmanim(now, data.settings);

  const [themeOverride, setThemeOverride] = useState<TvThemeId | null>(readOverride);
  const config = useMemo<TvConfig>(
    () => (themeOverride ? { ...adminConfig, theme: themeOverride, themeOverrides: {} } : adminConfig),
    [adminConfig, themeOverride],
  );

  // Slides change at most once a minute (expiring notices, the day rolling
  // over); rebuilding them on every clock tick only re-rendered the board.
  const minuteStamp = Math.floor(now.getTime() / 60_000);
  const minuteNow = useMemo(() => new Date(minuteStamp * 60_000), [minuteStamp]);
  const slides = useMemo(() => buildSlides(data, config, minuteNow, zmanim), [data, config, minuteNow, zmanim]);

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  /** Bumped on every slide start; restarts the CSS progress bar. */
  const [cycle, setCycle] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [help, setHelp] = useState(false);

  const found = slides.findIndex((s) => s.id === currentId);
  const index = found >= 0 ? found : 0;
  const slide = slides[index];

  // Rotation is one timeout per slide, not a ticking counter. A 250 ms state
  // tick re-rendered the whole board four times a second, which on the TV box
  // was a real share of the CPU for nothing but a progress bar (now pure CSS).
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

  const goTo = useCallback((n: number) => {
    const s = live.current.slides;
    if (n < 0 || n >= s.length) return;
    heldMs.current = 0;
    setCurrentId(s[n].id);
    setCycle((c) => c + 1);
  }, []);

  const togglePause = useCallback(() => {
    const wasPaused = live.current.paused;
    // Freeze the elapsed time now, so resuming continues rather than restarts.
    if (!wasPaused) heldMs.current = Date.now() - startedAt.current;
    setPaused(!wasPaused);
    return wasPaused;
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

  const cycleTheme = useCallback(
    (delta: number) => {
      const currentIdx = TV_THEMES.findIndex((t) => t.id === config.theme);
      const next = TV_THEMES[(currentIdx + delta + TV_THEMES.length) % TV_THEMES.length];
      setThemeOverride(next.id);
      writeOverride(next.id);
      flash(`ערכת נושא: ${next.name}`);
    },
    [config.theme, flash],
  );

  // Remote / keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { slides: s, index: i } = live.current;
      switch (e.key) {
        case "ArrowLeft":
          go(1);
          flash(`${SLIDE_KIND_LABELS[s[(i + 1) % s.length]?.kind] ?? ""}`);
          break;
        case "ArrowRight":
          go(-1);
          flash(`${SLIDE_KIND_LABELS[s[(i - 1 + s.length) % s.length]?.kind] ?? ""}`);
          break;
        case "Enter":
        case " ":
          flash(togglePause() ? "▶ ממשיך" : "⏸ מושהה");
          break;
        case "ArrowUp":
          cycleTheme(1);
          break;
        case "ArrowDown":
          cycleTheme(-1);
          break;
        case "0":
          setThemeOverride(null);
          writeOverride(null);
          flash(`ערכת נושא: ${getTheme(adminConfig.theme).name} (של המנהל)`);
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
  }, [go, goTo, togglePause, cycleTheme, flash, adminConfig.theme]);

  // Android Back: open the help card instead of leaving the board.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapApp.addListener("backButton", () => setHelp((h) => !h));
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);

  // Re-evaluated on the once-a-second clock render; the bar steps with it.
  const elapsedMs = paused ? heldMs.current : now.getTime() - startedAt.current;
  const progress = slideSeconds > 0 ? elapsedMs / (slideSeconds * 1000) : 0;

  return (
    <TvBoard
      data={data}
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
          {help && (
            <div className="tv-help" onClick={() => setHelp(false)}>
              <div className="tv-help-card">
                <h2>שליטה בשלט</h2>
                <dl>
                  <dt>◀ ▶</dt>
                  <dd>שקופית הבאה / הקודמת</dd>
                  <dt>OK</dt>
                  <dd>עצירה / המשך</dd>
                  <dt>▲ ▼</dt>
                  <dd>החלפת ערכת נושא</dd>
                  <dt>0</dt>
                  <dd>חזרה לערכת הנושא של המנהל</dd>
                  <dt>1–9</dt>
                  <dd>מעבר ישיר לשקופית</dd>
                  <dt>חזור</dt>
                  <dd>סגירת החלון</dd>
                </dl>
                <p className="tv-help-foot">
                  ערכת נושא: {getTheme(config.theme).name}
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
