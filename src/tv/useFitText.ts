import { useEffect, useRef } from "react";

import { createBreaker } from "./watchdog";

/**
 * Shrinks a card's type until it fits the room the board gives it.
 *
 * A notice is whatever the gabbai wrote: three words or three paragraphs. The
 * box it lands in is a fixed part of the board, so a long one used to be cut
 * mid-sentence at the bottom - which on a wall display reads as a fault.
 *
 * What is measured is the notice itself: it clips its own overflow, so the
 * card around it never reports that anything is too long - only the notice
 * knows, by its content being taller than the box it was given. Against that,
 * the size steps down to a floor of 60%; below that it would be unreadable
 * from the back of the room, so what is left is ended on the last line that
 * fits, with an ellipsis, rather than sliced in half.
 *
 * The scale lands in `--fit` and the line count in `--clamp`; the card's CSS
 * multiplies its font sizes by the first and clamps by the second.
 *
 * It costs a handful of layout reads when the notice or the box changes -
 * every twenty seconds at most, when the board rotates - and nothing at all
 * while the board sits still.
 *
 * Measuring changes the very thing that is measured: the card around the
 * notice grows and shrinks with the type inside it, and an observer that
 * reacted to that would set itself off again, forever. So the box is
 * observed, not the text; a report of the same size as last time is ignored;
 * and while a measurement is running the observer is deaf. A wall display
 * cannot afford a loop that never settles.
 *
 * Those three guards are reasoning, and reasoning can be wrong - it was once,
 * and the TV ran hot for a week. So behind them sits a breaker that does not
 * reason: past a rate no honest run of this could need, the fitting switches
 * itself off for that card and says so. The notice keeps the size it had
 * reached; the board keeps its frame rate.
 */
const FLOOR = 0.6;
const STEP = 0.05;
/** A slide change costs a handful of runs; forty in five seconds is a spin. */
const BURST = 40;
const BURST_MS = 5_000;

export function useFitText<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.parentElement ?? el;

    const breaker = createBreaker({
      name: "התאמת גודל טקסט",
      limit: BURST,
      windowMs: BURST_MS,
      onTrip: () => observer.disconnect(),
    });

    let measuring = false;
    const fit = () => {
      if (measuring) return;
      // The card keeps whatever size it last reached, and is left alone.
      if (!breaker.allow()) return;
      measuring = true;
      try {
        measure();
      } finally {
        // Let the layout that this caused settle before listening again.
        requestAnimationFrame(() => {
          measuring = false;
        });
      }
    };

    const measure = () => {
      const body = el.querySelector<HTMLElement>(".tv-card-body") ?? el;
      // Measure the whole notice, not the part a line clamp leaves visible.
      el.style.setProperty("--clamp", "999");
      el.style.setProperty("--fit", "1");

      const spills = () => body.scrollHeight - body.clientHeight;

      let scale = 1;
      while (scale > FLOOR && spills() > 1) {
        scale = Math.round((scale - STEP) * 100) / 100;
        el.style.setProperty("--fit", String(scale));
      }

      const left = spills();
      if (left > 1) {
        const line = Number.parseFloat(getComputedStyle(body).lineHeight) || 1;
        el.style.setProperty("--clamp", String(Math.max(2, Math.floor(body.clientHeight / line))));
      } else {
        el.style.removeProperty("--clamp");
      }
    };

    fit();
    // Hebrew type arrives after the first paint on a cold TV; measure again.
    void document.fonts?.ready.then(fit).catch(() => {});

    let lastSize = "";
    const observer = new ResizeObserver((entries) => {
      const size = entries
        .map((e) => `${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`)
        .join("|");
      if (size === lastSize) return;
      lastSize = size;
      fit();
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [key]);

  return ref;
}
