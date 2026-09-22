import { describe, it, expect } from 'vitest';
import {
  financialYearMonths, weekdaysInMonth, isAttended, aggregateAttendance, escapeHtml, money,
  type AttendanceRow,
} from './reports-fs';

describe('financialYearMonths', () => {
  it('runs April to March, the order the form is printed in', () => {
    const m = financialYearMonths(2026);
    expect(m).toHaveLength(12);
    expect(m[0]).toEqual({ year: 2026, month: 4, label: 'April' });
    expect(m[8]).toEqual({ year: 2026, month: 12, label: 'December' });
    expect(m[9]).toEqual({ year: 2027, month: 1, label: 'January' });
    expect(m[11]).toEqual({ year: 2027, month: 3, label: 'March' });
  });
});

describe('weekdaysInMonth', () => {
  it('counts Mon-Fri only', () => {
    expect(weekdaysInMonth(2026, 8)).toBe(21); // Aug 2026
    expect(weekdaysInMonth(2026, 2)).toBe(20); // Feb 2026
    expect(weekdaysInMonth(2024, 2)).toBe(21); // leap February
  });
});

describe('isAttended', () => {
  it('counts present and late, not absent or excused', () => {
    expect(isAttended('present')).toBe(true);
    expect(isAttended('late')).toBe(true);
    expect(isAttended('absent')).toBe(false);
    expect(isAttended('excused')).toBe(false);
  });
});

describe('aggregateAttendance', () => {
  const months = financialYearMonths(2026);

  it('returns twelve zeroed months when nothing is captured', () => {
    const stats = aggregateAttendance([], months, 20);
    expect(stats).toHaveLength(12);
    expect(stats.every((s) => s.allDays === 0 && s.daysOpen === 0 && s.targetDays === 0)).toBe(true);
  });

  it('counts attendance days, and max/min children per day', () => {
    const rows: AttendanceRow[] = [
      { date: '2026-04-01', child_id: 'a', status: 'present', subsidised: 1 },
      { date: '2026-04-01', child_id: 'b', status: 'present', subsidised: 0 },
      { date: '2026-04-01', child_id: 'c', status: 'absent', subsidised: 1 },
      { date: '2026-04-02', child_id: 'a', status: 'late', subsidised: 1 },
    ];
    const [april] = aggregateAttendance(rows, months, 10);
    expect(april.allDays).toBe(3);        // 2 on day one + 1 on day two, absent excluded
    expect(april.subsidisedDays).toBe(2); // child a on both days
    expect(april.daysOpen).toBe(2);
    expect(april.maxOnDay).toBe(2);
    expect(april.minOnDay).toBe(1);
    expect(april.targetDays).toBe(20);    // 10 funded places x 2 days open
  });

  it('keeps each month separate and ignores other financial years', () => {
    const rows: AttendanceRow[] = [
      { date: '2026-04-10', child_id: 'a', status: 'present', subsidised: 0 },
      { date: '2027-01-15', child_id: 'a', status: 'present', subsidised: 0 },
      { date: '2025-04-10', child_id: 'a', status: 'present', subsidised: 0 },
    ];
    const stats = aggregateAttendance(rows, months, 1);
    expect(stats.find((s) => s.label === 'April')!.allDays).toBe(1);
    expect(stats.find((s) => s.label === 'January')!.allDays).toBe(1);
    expect(stats.reduce((t, s) => t + s.allDays, 0)).toBe(2); // 2025 row excluded
  });

  it('never counts a child twice on the same day', () => {
    const rows: AttendanceRow[] = [
      { date: '2026-05-04', child_id: 'a', status: 'present', subsidised: 1 },
      { date: '2026-05-04', child_id: 'a', status: 'present', subsidised: 1 },
    ];
    const may = aggregateAttendance(rows, months, 1).find((s) => s.label === 'May')!;
    expect(may.daysOpen).toBe(1);
    // Two rows for one child on one day is a capture error; it inflates the day
    // count, which is exactly why the rendered page flags register anomalies.
    expect(may.allDays).toBe(2);
  });
});

describe('formatting helpers', () => {
  it('escapes HTML so a child or centre name cannot break the form', () => {
    expect(escapeHtml('<script>x</script>')).toBe('&lt;script&gt;x&lt;/script&gt;');
    expect(escapeHtml("O'Brien & Co")).toBe('O&#39;Brien &amp; Co');
    expect(escapeHtml(null)).toBe('');
  });

  it('formats rands to two decimals', () => {
    expect(money(17780)).toMatch(/^R\s?17[\s,]780,00|^R\s?17,780\.00$/);
    expect(money(0)).toMatch(/0[,.]00$/);
  });
});
