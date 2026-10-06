import { useEffect, useRef } from "react";

import { createBreaker } from "./watchdog";

/**
 * One line of live text - the synagogue's name, the date, this week's
 * parasha - shrunk until it fits across the box it stands in.
 *
 * A free element is a fixed box, and what lands in it is whatever the
 * synagogue is called: "אהל אברהם" or "בית הכנסת אושר של יהודי". Wrapped, a
 * long name ran into the panel below; on one line it is measured and stepped
 * down, to a floor of 45%, below which it is ended with an ellipsis.
 *
 * The same guards as useFitText (which fits a notice's height): the box is
 * observed, not the text; a report of the same size is ignored; and a breaker
 * switches the fitting off for that element if it ever runs at a rate no
 * honest change could need - a wall display cannot afford a loop.
 */
const FLOOR = 0.45;
const STEP = 0.05;

export function useFitLine<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const breaker = createBreaker({ name: "התאמת שורה לרוחב", limit: 40, windowMs: 5_000, onTrip: () => observer.disconnect() });
    let measuring = false;
    const measure = () => {
      el.style.setProperty("--fit", "1");
      let scale = 1;
      while (scale > FLOOR && el.scrollWidth - el.clientWidth > 1) {
        scale = Math.round((scale - STEP) * 100) / 100;
        el.style.setProperty("--fit", String(scale));
      }
    };
    const fit = () => {
      if (measuring || !breaker.allow()) return;
      measuring = true;
      try {
        measure();
      } finally {
        requestAnimationFrame(() => {
          measuring = false;
        });
      }
    };
    fit();
    void document.fonts?.ready.then(fit).catch(() => {});
    let lastSize = "";
    const observer = new ResizeObserver((entries) => {
      const size = entries.map((e) => `${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`).join("|");
      if (size === lastSize) return;
      lastSize = size;
      fit();
    });
    observer.observe(el.parentElement ?? el);
    return () => observer.disconnect();
  }, [key]);
  return ref;
}
