import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mouse / touch controls for the board when it runs in a browser
 * (/admin/tv-board) rather than on the TV. The TV has only the remote, so
 * none of this is rendered there.
 *
 *   - The bar appears on any mouse move or touch and hides after 3 s, taking
 *     the cursor with it, so an idle screen shows only the board.
 *   - A horizontal swipe changes slide. The board is Hebrew, so the swipe
 *     direction follows a right-to-left book: dragging to the right moves on.
 *   - The keyboard shortcuts of the remote (arrows, space, 0-9, Esc) keep
 *     working, handled by TvApp.
 */

const HIDE_AFTER_MS = 3000;
const SWIPE_MIN_PX = 60;

export function WebControls({
  paused,
  themeName,
  exitHref,
  onPrev,
  onNext,
  onPause,
  onTheme,
  onHelp,
}: {
  paused: boolean;
  themeName: string;
  exitHref?: string;
  onPrev: () => void;
  onNext: () => void;
  onPause: () => void;
  onTheme: () => void;
  onHelp: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(() => typeof document !== "undefined" && !!document.fullscreenElement);
  const barRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  const wake = useCallback(() => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), HIDE_AFTER_MS);
  }, []);

  useEffect(() => {
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(hideTimer.current);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [wake]);

  // Hide the cursor together with the bar.
  useEffect(() => {
    const frame = barRef.current?.closest<HTMLElement>(".tv-frame");
    frame?.classList.toggle("is-idle", !visible);
    return () => frame?.classList.remove("is-idle");
  }, [visible]);

  // Swipe between slides.
  const next = useRef(onNext);
  const prev = useRef(onPrev);
  next.current = onNext;
  prev.current = onPrev;
  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      start = t ? { x: t.clientX, y: t.clientY } : null;
    };
    const up = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      start = null;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx > 0) next.current();
      else prev.current();
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchend", up, { passive: true });
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchend", up);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div ref={barRef} className={`tv-web-bar${visible ? "" : " is-hidden"}`} role="toolbar" aria-label="שליטה בלוח">
      {exitHref && (
        <a className="tv-web-btn" href={exitHref}>
          ✕ יציאה
        </a>
      )}
      <button type="button" className="tv-web-btn" onClick={onPrev} aria-label="השקופית הקודמת">
        ▶ הקודמת
      </button>
      <button type="button" className="tv-web-btn is-main" onClick={onPause}>
        {paused ? "▶ המשך" : "⏸ עצירה"}
      </button>
      <button type="button" className="tv-web-btn" onClick={onNext} aria-label="השקופית הבאה">
        הבאה ◀
      </button>
      <button type="button" className="tv-web-btn" onClick={onTheme} title="החלפת ערכת נושא (במסך הזה בלבד)">
        🎨 {themeName}
      </button>
      <button type="button" className="tv-web-btn" onClick={toggleFullscreen}>
        {fullscreen ? "⤡ יציאה ממסך מלא" : "⤢ מסך מלא"}
      </button>
      <button type="button" className="tv-web-btn" onClick={onHelp} aria-label="קיצורי מקלדת">
        ?
      </button>
    </div>
  );
}
