import { useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { OverflowContext } from "./overflowContext";

/**
 * Content that does not fit its frame, scrolled rather than cut.
 *
 * Every frame on a board has a fixed size, and a day with many minyanim, a
 * week of shiurim, a long notice is taller than the frame. Until now it was
 * cut: the medallion showed a window of rows around the next minyan and hid
 * the rest; a cell of a screen cut whatever ran past its edge. With the
 * board's "גלילה" on (config.overflow), a frame whose content does not fit
 * moves it instead, slowly, so that everything passes in front of the hall:
 *
 *   pause  stands at the top, scrolls down, stands at the bottom, and comes
 *          back to the top with a fade - every line is still for a while
 *   loop   one endless curtain: the list runs up without stopping, and its
 *          beginning follows its end
 *
 * A frame whose content fits does not move at all, and keeps exactly the
 * layout it had: the track is at least the frame's height, so a list that
 * spreads its rows over the frame still does.
 *
 * Moved by a CSS animation on transform, measured once per change of size:
 * nothing runs per frame in JavaScript, which the slow TV boxes would feel.
 */
/** How far it moves per second, as a share of the board's height. */
const SPEED = { slow: 0.028, normal: 0.05 } as const;
/** In pause mode: the share of each round spent moving (the rest stands still at the ends). */
const MOVING = 0.64;
/** The gap between the end of the list and its beginning in loop mode, as a share of the frame. */
const LOOP_GAP = 0.18;

export function AutoScroll({
  children,
  className = "",
  enabled = true,
}: {
  children: ReactNode;
  className?: string;
  /**
   * Off for content laid out to fill its frame rather than listed (the daf
   * yomi's cards, a slideshow): given its natural height it collapses, and
   * there is nothing below to scroll to.
   */
  enabled?: boolean;
}) {
  const ctx = useContext(OverflowContext);
  const { speed, still } = ctx;
  const mode = enabled ? ctx.mode : "off";
  const view = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState<{ dist: number; dur: number; gap: number } | null>(null);

  useLayoutEffect(() => {
    if (mode === "off") return;
    const box = view.current;
    const content = first.current;
    if (!box || !content) return;
    const measure = () => {
      const room = box.clientHeight;
      const need = content.offsetHeight;
      const board = box.closest(".tv-root")?.clientHeight || window.innerHeight || 1080;
      const perSecond = Math.max(8, board * SPEED[speed]);
      if (room <= 0 || need <= room + 2) return setMotion(null);
      if (mode === "loop") {
        const gap = Math.round(room * LOOP_GAP);
        const dist = need + gap;
        setMotion({ dist, dur: dist / perSecond, gap });
      } else {
        const dist = need - room;
        setMotion({ dist, dur: Math.max(6, dist / perSecond / MOVING), gap: 0 });
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    // Size, not content, is observed: the animation moves the track, which changes no size.
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(content);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [mode, speed]);

  if (mode === "off") return <>{children}</>;
  const moving = motion !== null;
  const style = moving
    ? ({ "--as-dist": `${motion.dist}px`, "--as-dur": `${motion.dur.toFixed(1)}s`, "--as-gap": `${motion.gap}px` } as CSSProperties)
    : undefined;
  return (
    <div ref={view} className={`tv-autoscroll ${className}`} data-scrolling={moving ? mode : undefined}>
      <div
        className={`tv-autoscroll-track${moving ? ` is-${mode}` : ""}${still ? " is-still" : ""}`}
        style={style}
      >
        <div ref={first} className="tv-autoscroll-copy">
          {children}
        </div>
        {/* The curtain's second copy, which brings the beginning in after the end. */}
        {moving && mode === "loop" && (
          <div className="tv-autoscroll-copy is-echo" aria-hidden>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
