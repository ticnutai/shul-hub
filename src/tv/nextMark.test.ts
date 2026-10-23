import { describe, expect, it } from 'vitest';
import { DEFAULT_PAST_OPACITY, fadesPast, normalizeNextMark, pastOpacity } from './nextMark';

describe('what is over, apart from the mark', () => {
  it('fades beside a mark and not with none, unless chosen otherwise', () => {
    expect(fadesPast({ shape: 'fill' })).toBe(true);
    expect(fadesPast({ shape: 'none' })).toBe(false);
    // Chosen: with no mark at all it fades; beside one it does not.
    expect(fadesPast({ shape: 'none', dimPast: true })).toBe(true);
    expect(fadesPast({ shape: 'fill', dimPast: false })).toBe(false);
  });
  it('keeps how faded, within its bounds, and the choice through saving', () => {
    expect(pastOpacity({ shape: 'fill' })).toBe(DEFAULT_PAST_OPACITY);
    expect(normalizeNextMark({ shape: 'none', dimPast: true, pastOpacity: 0.3 })).toEqual({ shape: 'none', dimPast: true, pastOpacity: 0.3 });
    expect(normalizeNextMark({ shape: 'fill', pastOpacity: 5 })!.pastOpacity).toBe(0.9);
    expect(normalizeNextMark({ shape: 'fill', pastOpacity: 0 })!.pastOpacity).toBe(0.15);
    expect(normalizeNextMark({ shape: 'fill', dimPast: 'yes' })).toEqual({ shape: 'fill' });
  });
});
