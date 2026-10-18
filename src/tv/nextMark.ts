import type { CSSProperties } from 'react';

/**
 * "הבא בתור" on a list of the board: the minyan, the lesson or the time of the
 * day that comes next is marked, and the moment its time is over the mark moves
 * to the one after it - all day, by itself. Its look is the part's own: a
 * shape and a colour, chosen in the text bar (ElementTextTools).
 */
export const NEXT_SHAPES = ['fill', 'frame', 'bar', 'badge', 'dot', 'none'] as const;
export type NextShape = (typeof NEXT_SHAPES)[number];

export const NEXT_SHAPE_NAMES: Record<NextShape, string> = {
  fill: 'רקע מודגש',
  frame: 'מסגרת',
  bar: 'פס בצד',
  badge: 'תווית "הבא"',
  dot: 'נקודה מהבהבת',
  none: 'בלי סימון',
};

export interface NextMark {
  shape: NextShape;
  /** Absent: the part's own text colour. */
  color?: string;
  /** What is over is a little faded (absent: yes). */
  dimPast?: boolean;
}

/** The lists that have times, and so a "next". */
export const MARKED_BINDINGS = ['prayers', 'lessons', 'zmanim'] as const;
export const marksNext = (binding: string | undefined) => (MARKED_BINDINGS as readonly string[]).includes(binding ?? '');

/** A part with no mark of its own: a highlighted row, in the part's colour, the past faded. */
export const DEFAULT_NEXT_MARK: NextMark = { shape: 'fill' };

export function normalizeNextMark(v: unknown): NextMark | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (!NEXT_SHAPES.includes(o.shape as NextShape)) return undefined;
  return {
    shape: o.shape as NextShape,
    ...(typeof o.color === 'string' && /^#[\da-f]{3,8}$/i.test(o.color) ? { color: o.color } : {}),
    ...(o.dimPast === false ? { dimPast: false } : {}),
  };
}

/** The first "HH:MM" of a row's time, in minutes; none (a minyan called off, no time) - not a candidate. */
export function rowMinutes(time: string): number | null {
  if (time.includes('בוטל')) return null;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Which row is next: the earliest whose time has not passed yet (its own
 * minute still counts - a minyan at 18:00 is "הבא" until 18:01). The rows need
 * not be in order: the day's prayers come from several categories. -1: the
 * day's are all over.
 */
export function nextRow(times: string[], nowMinutes: number): number {
  let best = -1, bestMin = Infinity;
  times.forEach((t, i) => {
    const m = rowMinutes(t);
    if (m !== null && m >= nowMinutes && m < bestMin) { best = i; bestMin = m; }
  });
  return best;
}

/** Whether a row's time is over (rows with no time are never "over"). */
export function rowPast(time: string, nowMinutes: number): boolean {
  const m = rowMinutes(time);
  return m !== null && m < nowMinutes;
}

/** A colour with a share of see-through, from "#rgb" or "#rrggbb". */
export function tint(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
  h = h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Letters that read on a colour: dark on a light one, light on a dark one. */
export function inkOn(hex: string): string {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#1b1b1b' : '#ffffff';
}

/** The marked row's own look, by its shape. */
export function nextRowStyle(mark: NextMark, textColour: string): CSSProperties {
  const c = mark.color ?? textColour;
  switch (mark.shape) {
    case 'fill': return { background: tint(c, 0.28), borderRadius: '0.8cqh', boxShadow: `0 0 0 0.25cqh ${tint(c, 0.55)}`, paddingInline: '0.8cqw' };
    case 'frame': return { boxShadow: `inset 0 0 0 0.35cqh ${c}`, borderRadius: '0.8cqh', paddingInline: '0.8cqw' };
    case 'bar': return { boxShadow: `inset -0.6cqw 0 0 ${c}`, paddingInline: '1.2cqw 0.4cqw', background: tint(c, 0.12) };
    default: return {};
  }
}
