import type { IllustrationId } from "./config";

/**
 * The painted boards of the "illustrated" layout: one picture each, with the
 * places where the day's times are written into it.
 *
 * The pictures and their frames come from the tablets editor's template
 * gallery (digital-prayer-canvas, TemplateBoard.tsx), so a board chosen there
 * looks the same here - but here every word in the frames is live: the clock,
 * the Hebrew date, today's minyanim with their exceptions, the zmanim, the
 * parasha and candle lighting.
 *
 * Boxes are [x1, y1, x2, y2] in percent of the picture (1920×1088). The
 * colours belong to the picture, not to the theme: gold ink on parchment is
 * part of the painting, and a theme meant for a flat board would fight it.
 * No image imports here, so tests and the config can read this file.
 */

export type Box = [number, number, number, number];

export interface Illustration {
  id: IllustrationId;
  name: string;
  hint: string;
  /** Text on the parchment. */
  ink: string;
  /** Titles and times. */
  accent: string;
  /** The clock's figures, on whatever the clock sits on. */
  clockInk: string;
  boxes: {
    clock: Box;
    plaqueR: Box;
    plaqueL: Box;
    panelR: Box;
    panelL: Box;
    barR?: Box;
    barL?: Box;
  };
  /** Carved wood: the name across the top and a Shabbat panel in the middle. */
  centrePanel?: boolean;
}

export const ILLUSTRATION_DEFS: Illustration[] = [
  {
    id: "curtain",
    name: "וילון כחול וזהב",
    hint: "פרוכת קטיפה, מסגרות זהב ושעון במדליון",
    ink: "#1f2d5c",
    accent: "#8a5a12",
    clockInk: "#ffffff",
    boxes: {
      clock: [44, 5, 56, 26],
      plaqueR: [62, 10, 88, 25],
      plaqueL: [12, 10, 38, 25],
      panelR: [54, 34, 97, 84],
      panelL: [4, 34, 46, 84],
      barR: [57, 90, 93, 95],
      barL: [7, 90, 43, 95],
    },
  },
  {
    id: "stone",
    name: "לוחות הברית מאבן",
    hint: "שני לוחות מקושתים על קיר אבן",
    ink: "#3a2a12",
    accent: "#8a5d12",
    clockInk: "#3a2a12",
    boxes: {
      clock: [45, 3, 55, 20],
      plaqueR: [61, 4, 92, 15],
      plaqueL: [8, 4, 40, 15],
      panelR: [53, 30, 84, 88],
      panelL: [16, 30, 47, 88],
    },
  },
  {
    id: "wood",
    name: "מסגרת עץ מעוטרת",
    hint: "עץ מגולף, שמיים ופינת שבת באמצע",
    ink: "#2b1d0c",
    accent: "#7a3e10",
    clockInk: "#2b1d0c",
    boxes: {
      clock: [8, 10, 24, 21],
      plaqueR: [70, 10, 92, 21],
      plaqueL: [30, 10, 70, 21],
      panelR: [72, 27, 93, 88],
      panelL: [7, 27, 28, 88],
      barR: [48, 30, 68, 70],
    },
    centrePanel: true,
  },
  {
    id: "modern",
    name: "מודרני נקי",
    hint: "כהה ונקי עם פסי זהב",
    ink: "#f3f5f8",
    accent: "#e6c27a",
    clockInk: "#f3f1ea",
    boxes: {
      clock: [43, 4, 57, 27],
      plaqueR: [61, 17, 90, 25],
      plaqueL: [10, 17, 39, 25],
      panelR: [53, 32, 90, 80],
      panelL: [10, 32, 47, 80],
      barL: [10, 86, 90, 91],
    },
  },
];

export function illustrationDef(id: IllustrationId): Illustration {
  return ILLUSTRATION_DEFS.find((d) => d.id === id) ?? ILLUSTRATION_DEFS[0];
}

/** How many rows a painted frame holds and still reads from the back of the hall. */
export const ILLUSTRATED_ROWS = 7;

/**
 * Which of today's rows a painted frame shows, as [start, end).
 *
 * A frame drawn for five lines cannot take fourteen minyanim, and shrinking
 * the type until they fit makes all of them unreadable. So when there are
 * more rows than room, the frame shows the ones that matter now: from the one
 * just gone (a latecomer looks for it) through the next ones. Before the
 * first minyan that is the start of the day; after the last, the end of it.
 */
export function rowWindow(count: number, nextIndex: number, max = ILLUSTRATED_ROWS): [number, number] {
  if (count <= max) return [0, count];
  const anchor = nextIndex < 0 ? count : nextIndex;
  const start = Math.min(Math.max(0, anchor - 1), count - max);
  return [start, start + max];
}
