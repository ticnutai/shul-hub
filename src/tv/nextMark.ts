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
  /**
   * What is over faded: true or false as chosen; absent - faded beside a
   * mark, not with none (as it always was). Its own setting, apart from the
   * mark: a list can fade what is over and mark nothing.
   */
  dimPast?: boolean;
  /** How much of what is over is still seen, 0.15-0.9 (absent: 0.55). */
  pastOpacity?: number;
  /** How solid the mark is, 0.05-1 (absent: the shape's own - a soft fill, a full line). */
  alpha?: number;
  /** Its colour's saturation, 0 (grey) - 2 (twice as vivid); absent: as chosen. */
  saturation?: number;
}

/** Each shape's own solidity, when none was chosen: a fill is soft, a line is full. */
export const SHAPE_ALPHA: Record<NextShape, number> = { fill: 0.28, frame: 1, bar: 1, badge: 1, dot: 1, none: 1 };
export const markAlpha = (m: NextMark) => m.alpha ?? SHAPE_ALPHA[m.shape];

/** Whether what is over is faded on a list with this mark. */
export const fadesPast = (m: NextMark) => m.dimPast ?? m.shape !== 'none';
export const DEFAULT_PAST_OPACITY = 0.55;
export const pastOpacity = (m: NextMark) => m.pastOpacity ?? DEFAULT_PAST_OPACITY;

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
    ...(typeof o.dimPast === 'boolean' ? { dimPast: o.dimPast } : {}),
    ...(typeof o.pastOpacity === 'number' && Number.isFinite(o.pastOpacity) ? { pastOpacity: Math.round(Math.min(0.9, Math.max(0.15, o.pastOpacity)) * 100) / 100 } : {}),
    ...(typeof o.alpha === 'number' && Number.isFinite(o.alpha) ? { alpha: Math.round(Math.min(1, Math.max(0.05, o.alpha)) * 100) / 100 } : {}),
    ...(typeof o.saturation === 'number' && Number.isFinite(o.saturation) && o.saturation !== 1 ? { saturation: Math.round(Math.min(2, Math.max(0, o.saturation)) * 100) / 100 } : {}),
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

/** A colour made more or less vivid: its saturation times `by` (1 - as it is). */
export function saturate(hex: string, by = 1): string {
  if (by === 1) return hex;
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let hue = 0, sat = 0;
  if (d) {
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue /= 6;
  }
  sat = Math.min(1, sat * by);
  const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
  const ch = (t: number) => {
    t = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${ch(hue + 1 / 3)}${ch(hue)}${ch(hue - 1 / 3)}`;
}

/** The mark's colour, as vivid as chosen. */
export const markColour = (mark: NextMark, textColour: string) => saturate(mark.color ?? textColour, mark.saturation ?? 1);

/** The marked row's own look, by its shape - in its colour and its solidity. */
export function nextRowStyle(mark: NextMark, textColour: string): CSSProperties {
  const c = markColour(mark, textColour), a = markAlpha(mark);
  switch (mark.shape) {
    case 'fill': return { background: tint(c, a), borderRadius: '0.8cqh', boxShadow: `0 0 0 0.25cqh ${tint(c, Math.min(1, a * 2))}`, paddingInline: '0.8cqw' };
    case 'frame': return { boxShadow: `inset 0 0 0 0.35cqh ${tint(c, a)}`, borderRadius: '0.8cqh', paddingInline: '0.8cqw' };
    case 'bar': return { boxShadow: `inset -0.6cqw 0 0 ${tint(c, a)}`, paddingInline: '1.2cqw 0.4cqw', background: tint(c, a * 0.12) };
    default: return {};
  }
}
