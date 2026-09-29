import { useEffect, useRef } from "react";

import { createBreaker } from "./watchdog";

/**
 * Makes a list fit the panel it stands in, by type size.
 *
 * The zmanim panel is a fixed part of the board and lists eight or nine
 * times. On the development screen they fitted with a line to spare; on the
 * box at אהל אברהם - the same 960×540, but the box's own fonts, taller by a
 * tenth - פלג המנחה sat on the frame and שקיעה and צאת הכוכבים hung under it,
 * outside the panel altogether. A fixed size is a guess about the screen.
 *
 * So it is measured: the list is tried at full size and, while its content is
 * taller than the room it was given, the type steps down, to a floor of 70% -
 * below that a time is not read from the back of the hall. The scale is set
 * as `--fit` on the list, and the rows multiply their size by it.
 *
 * The same guards as useFitText, for the same reason: the box is observed,
 * not the text, so shrinking the text cannot set the observer off; and a
 * breaker switches the fitting off outright past a rate no honest run needs.
 */
const FLOOR = 0.7;
const STEP = 0.04;
const BURST = 40;
const BURST_MS = 5_000;

export function useShrinkToFit<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const list = ref.current;
    if (!list) return;

    const breaker = createBreaker({
      name: "התאמת זמני היום למסגרת",
      limit: BURST,
      windowMs: BURST_MS,
      onTrip: () => observer.disconnect(),
    });

    let measuring = false;
    let lastHeight = -1;
    const measure = () => {
      list.style.setProperty("--fit", "1");
      let scale = 1;
      while (scale > FLOOR && list.scrollHeight > list.clientHeight + 1) {
        scale = Math.max(FLOOR, Math.round((scale - STEP) * 100) / 100);
        list.style.setProperty("--fit", String(scale));
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

    // An old WebView without ResizeObserver still gets one fitting.
    const observer =
      typeof ResizeObserver === "undefined"
        ? { observe: () => {}, disconnect: () => {} }
        : new ResizeObserver(() => {
            const h = list.clientHeight;
            if (h === lastHeight) return;
            lastHeight = h;
            fit();
          });
    observer.observe(list);
    fit();
    // Fonts arrive after the first layout, and change every line's height.
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [key]);

  return ref;
}
