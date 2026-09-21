import { useEffect, useRef } from "react";

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
 * while the board sits still. The box is observed rather than the text,
 * because the text's size is what is being changed: observing that would
 * chase its own tail.
 */
const FLOOR = 0.6;
const STEP = 0.05;

export function useFitText<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.parentElement ?? el;

    const fit = () => {
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

    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [key]);

  return ref;
}
