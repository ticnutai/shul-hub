import { describe, expect, it } from 'vitest';
import { shabbatInfo } from './elementContent';
import { zmanimFor } from '@community/lib/minyan-time';

const settings = { latitude: 32.0853, longitude: 34.8338, elevation: 40, candle_offset_minutes: 20, tzeit_offset_minutes: 20 } as never;
const on = (d: Date) => zmanimFor(d, settings);

describe('this Shabbat on the board', () => {
  it('on a Friday: the coming Shabbat - its parasha, haftarah, start, end and the Shema', () => {
    const s = shabbatInfo(new Date('2026-10-30T12:00:00+02:00'), on);
    expect(s.title).toBe('שבת קודש · פרשת וירא');
    const rows = Object.fromEntries(s.rows);
    expect(rows['פרשת השבוע']).toBe('וירא');
    expect(rows['הפטרה']).toMatch(/מלכים/);
    for (const k of ['כניסת השבת', 'יציאת השבת', 'סוף זמן ק״ש מג״א', 'סוף זמן ק״ש גר״א']) expect(rows[k], k).toMatch(/^\d{2}:\d{2}$/);
    // Lit before it went out, not after.
    expect(rows['כניסת השבת'] < rows['יציאת השבת']).toBe(true);
    console.log(JSON.stringify(s));
  });
  it('on Shabbat itself: today\'s', () => {
    expect(shabbatInfo(new Date('2026-10-31T10:00:00+02:00'), on).title).toBe('שבת קודש · פרשת וירא');
  });
});
