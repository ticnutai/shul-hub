import { useEffect, useRef } from "react";

import { createBreaker } from "./watchdog";

/**
 * Lays a list of times out to fill the panel it was given.
 *
 * The panel's height is not the list's business: a column of the board
 * stretches its panels to fill it (`.tv-dash-col > .tv-panel { flex: 1 1 0 }`),
 * so hiding one panel makes the one beside it taller. What the list has to
 * do is use that height.
 *
 * It used to split into two columns whenever there were more than seven
 * rows, which is a guess about the height rather than a measurement of it.
 * With סליחות taken off the board after Yom Kippur, the prayer times got a
 * column to themselves and still sat in two cramped columns at the top
 * with a third of the panel empty underneath.
 *
 * So it is measured. One column is tried first, because one column reads
 * better - the times run straight down in order, and מנחה follows שחרית
 * rather than starting again on the other side. Two columns are what
 * happens when one will not fit, not the first choice. Whatever room is
 * left over is given back to the rows as breathing space, up to a limit:
 * nine times spread evenly down a tall panel should look deliberate, not
 * abandoned.
 *
 * The panel's height does not depend on this - the column decides it -
 * so measuring cannot set itself off again. The breaker is there anyway,
 * because that reasoning is exactly what was wrong the last time a
 * measurement on this board ran away with the processor.
 */
const BURST = 40;
const BURST_MS = 5_000;

export function useFitRows<T extends HTMLElement>(count: number) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const list = ref.current;
    if (!list) return;

    const breaker = createBreaker({
      name: "פריסת לוח הזמנים",
      limit: BURST,
      windowMs: BURST_MS,
      onTrip: () => observer.disconnect(),
    });

    const measure = () => {
      // Start from the layout we would rather have, every time, so that a
      // panel that has just grown can go back to one column.
      list.classList.remove("is-two-col");
      list.style.removeProperty("--row-extra");

      let perColumn = count;
      if (list.scrollHeight > list.clientHeight + 1) {
        list.classList.add("is-two-col");
        perColumn = Math.ceil(count / 2);
      }

      // Whatever is left over after the rows have been placed is shared out
      // between them. This is the part that matters when a panel grows:
      // fourteen times still need two columns, but they should run down the
      // whole panel rather than bunching at the top with a third of it
      // empty underneath.
      //
      // The rows are added up rather than read off scrollHeight, because
      // scrollHeight is never smaller than the box it is in - it answers
      // "how far past the edge does this go", and the question here is the
      // opposite one. With grid-auto-flow: column the first perColumn rows
      // are the first column, which is the tallest.
      const rows = Array.from(list.querySelectorAll<HTMLElement>(".tv-dash-row"));
      const column = rows.slice(0, perColumn).reduce((h, r) => h + r.offsetHeight, 0);
      const slack = list.clientHeight - column;
      if (slack > 2 && perColumn > 0) {
        list.style.setProperty("--row-extra", `${Math.floor(slack / perColumn)}px`);
      }
    };

    let measuring = false;
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
    // Hebrew type arrives after the first paint on a cold TV, and the rows
    // are a different height once it does.
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
    observer.observe(list);
    return () => observer.disconnect();
  }, [count]);

  return ref;
}
