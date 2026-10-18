import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BoundElement, ElementDataProvider, type ElementData } from './elementData';
import { newElement, normalizeElements, type BoardElement } from './elements';
import { inkOn, nextRow, normalizeNextMark, rowPast } from './nextMark';

/** A moment in Jerusalem, on a winter day (UTC+2). */
const at = (hhmm: string) => new Date(`2026-11-18T${hhmm}:00+02:00`);
const min = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

describe('הבא בתור', () => {
  it('the earliest row not yet over, its own minute included', () => {
    const times = ['06:30', '07:15', '13:30', '16:20'];
    expect(nextRow(times, min('05:00'))).toBe(0);
    expect(nextRow(times, min('07:15'))).toBe(1);
    // The moment the minyan's time is over, the next one.
    expect(nextRow(times, min('07:16'))).toBe(2);
    expect(nextRow(times, min('17:00'))).toBe(-1);
  });

  it('rows out of order (prayers of several categories), a minyan called off, a lesson without an hour', () => {
    expect(nextRow(['18:00', '13:30', 'בוטל', '17:00'], min('14:00'))).toBe(3);
    expect(nextRow(['בוטל', '19:00'], min('12:00'))).toBe(1);
    expect(nextRow(['אחרי ערבית', '20:30 · כל יום'], min('12:00'))).toBe(1);
    expect(rowPast('06:30', min('07:00'))).toBe(true);
    expect(rowPast('אחרי ערבית', min('23:00'))).toBe(false);
  });

  it("the label's letters read on its colour", () => {
    expect(inkOn('#3b2410')).toBe('#ffffff');
    expect(inkOn('#ffd76a')).toBe('#1b1b1b');
  });

  it('the mark is kept as saved, a bad one dropped', () => {
    expect(normalizeNextMark({ shape: 'bar', color: '#ff0000', dimPast: false })).toEqual({ shape: 'bar', color: '#ff0000', dimPast: false });
    expect(normalizeNextMark({ shape: 'spin' })).toBeUndefined();
    expect(normalizeNextMark({ shape: 'dot', color: 'red' })).toEqual({ shape: 'dot' });
    const [e] = normalizeElements([{ ...newElement('text'), id: 'p', binding: 'prayers', nextMark: { shape: 'frame', color: '#00ff00' } }]);
    expect(e.nextMark).toEqual({ shape: 'frame', color: '#00ff00' });
  });
});

const data = (now: Date): ElementData => ({
  now,
  prayers: [['שחרית', '06:30'], ['מנחה', '13:30'], ['ערבית', '18:00']],
  lessons: [['עמוד יומי · הרב', '07:15'], ['גמרא · הרב', '20:30']],
});
const part = (p: Partial<BoardElement>): BoardElement => ({ ...newElement('text'), id: 'x', binding: 'prayers', rowsPerPage: 6, ...p });
const show = (e: BoardElement, now: Date) =>
  render(<ElementDataProvider value={data(now)}><BoundElement element={e} /></ElementDataProvider>).container;

describe('הסימון על הלוח', () => {
  it('marks the next minyan, fades what is over, and moves on when its time is over', () => {
    let c = show(part({}), at('13:30'));
    let marked = c.querySelector('[data-next]');
    expect(marked?.textContent).toContain('מנחה');
    const rows = [...c.querySelectorAll<HTMLElement>('[data-content-binding="prayers"] > div')];
    expect(rows[0].style.opacity).toBe('0.55');
    expect(rows[2].style.opacity).toBe('');
    c = show(part({}), at('13:31'));
    marked = c.querySelectorAll('[data-next]')[0];
    expect(marked?.textContent).toContain('ערבית');
  });

  it('the next lesson; a badge, a dot; none at all', () => {
    expect(show(part({ binding: 'lessons', nextMark: { shape: 'badge' } }), at('08:00')).querySelector('[data-next]')?.textContent).toContain('גמרא');
    expect(show(part({ nextMark: { shape: 'badge' } }), at('05:00')).querySelector('[data-next-badge]')?.textContent).toBe('הבא');
    expect(show(part({ nextMark: { shape: 'dot', color: '#ff0000' } }), at('05:00')).querySelector('[data-next-dot]')).not.toBeNull();
    expect(show(part({ nextMark: { shape: 'none' } }), at('05:00')).querySelector('[data-next]')).toBeNull();
  });

  it('the mark in the colour chosen', () => {
    const row = show(part({ nextMark: { shape: 'frame', color: '#ff0000' } }), at('05:00')).querySelector<HTMLElement>('[data-next]');
    expect(row?.style.boxShadow).toMatch(/#ff0000|rgb\(255, 0, 0\)/);
  });
});
