import { describe, expect, it } from 'vitest';
import {
  addDaysISO,
  formatISODate,
  greetingFor,
  isValidTimeZone,
  parseISODate,
  todayISO,
  toISODate,
} from './dates';

describe('todayISO', () => {
  // 20:00 UTC on 1 March 2026
  const instant = new Date('2026-03-01T20:00:00Z');

  it('rolls over to the next day east of UTC', () => {
    expect(todayISO('Asia/Kolkata', instant)).toBe('2026-03-02'); // 01:30 on 2 March
  });

  it('stays on the same day west of UTC', () => {
    expect(todayISO('America/Los_Angeles', instant)).toBe('2026-03-01'); // 12:00 on 1 March
  });

  it('handles the exact local midnight boundary', () => {
    // 18:30 UTC is exactly 00:00 in India (UTC+5:30)
    expect(todayISO('Asia/Kolkata', new Date('2026-03-01T18:29:59Z'))).toBe('2026-03-01');
    expect(todayISO('Asia/Kolkata', new Date('2026-03-01T18:30:00Z'))).toBe('2026-03-02');
  });

  it('is correct across a daylight-saving change', () => {
    // US clocks spring forward at 02:00 on 8 March 2026.
    expect(todayISO('America/New_York', new Date('2026-03-08T04:59:00Z'))).toBe('2026-03-07');
    expect(todayISO('America/New_York', new Date('2026-03-08T05:00:00Z'))).toBe('2026-03-08');
  });
});

describe('greetingFor', () => {
  it('uses the local hour of the chosen time zone', () => {
    const instant = new Date('2026-06-01T03:00:00Z');
    expect(greetingFor('Asia/Kolkata', instant)).toBe('Good morning'); // 08:30
    expect(greetingFor('America/Los_Angeles', instant)).toBe('Good evening'); // 20:00
    expect(greetingFor('UTC', instant)).toBe('Hello'); // 03:00
    expect(greetingFor('Asia/Tokyo', instant)).toBe('Good afternoon'); // 12:00
  });
});

describe('ISO date helpers', () => {
  it('round-trips without shifting the day', () => {
    expect(toISODate(parseISODate('2026-11-20'))).toBe('2026-11-20');
  });

  it('adds days across month and year ends', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('formats with the user patterns', () => {
    expect(formatISODate('2026-11-20', 'd MMM yyyy')).toBe('20 Nov 2026');
    expect(formatISODate('2026-11-20', 'MM/dd/yyyy')).toBe('11/20/2026');
  });

  it('rejects invalid dates', () => {
    expect(() => parseISODate('2026-02-30')).toThrow();
    expect(() => parseISODate('nope')).toThrow();
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects junk', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});
