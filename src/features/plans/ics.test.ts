import { describe, expect, it } from 'vitest';
import { WALKING, STRENGTH } from './content';
import { buildPlanIcs, buildRecurringIcs, escapeText, foldLine } from './ics';

const enrollment = { id: 'enr-1', start_date: '2026-03-02', weekdays: [1, 3, 5] }; // Mon/Wed/Fri, starting Monday

describe('buildPlanIcs', () => {
  it('creates one event per planned day across the whole plan', () => {
    const { ics, events } = buildPlanIcs({ plan: WALKING, enrollment, time: '07:30', alarmMinutes: 10, from: '2026-03-02', origin: 'https://x.app', now: new Date('2026-03-01T00:00:00Z') });
    expect(events).toBe(12 * 3);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(36);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    // First session: Monday 2 March, 07:30–07:40 (week 1 is 10 minutes).
    expect(ics).toContain('DTSTART:20260302T073000');
    expect(ics).toContain('DTEND:20260302T074000');
    expect(ics).toContain('SUMMARY:10-min walk (Steady\\, week 1)');
    expect(ics).toContain('TRIGGER:-PT10M');
    expect(ics).toContain('UID:enr-1-20260302@steady');
  });

  it('skips sessions before the from date and can omit alerts', () => {
    const { ics, events } = buildPlanIcs({ plan: STRENGTH, enrollment: { ...enrollment, weekdays: [2, 5] }, time: '18:00', alarmMinutes: null, from: '2026-04-20', origin: 'https://x.app' });
    // Strength is 8 weeks (2 Mar – 26 Apr); Tue/Fri from 20 Apr leaves 21 and 24 April.
    expect(events).toBe(2);
    expect(ics).not.toContain('VALARM');
  });

  it('rolls an evening session past midnight onto the next day', () => {
    const { ics } = buildPlanIcs({ plan: WALKING, enrollment: { ...enrollment, start_date: '2026-03-02' }, time: '23:55', alarmMinutes: null, from: '2026-03-02', origin: 'https://x.app' });
    expect(ics).toContain('DTEND:20260303T000500');
  });

  it('keeps every physical line within 75 octets', () => {
    const { ics } = buildPlanIcs({ plan: WALKING, enrollment, time: '07:00', alarmMinutes: 0, from: '2026-03-02', origin: 'https://a-very-long-domain-name-for-testing-folding.example.com' });
    const enc = new TextEncoder();
    for (const line of ics.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe('buildRecurringIcs', () => {
  it('builds daily and weekly repeating events with an end date', () => {
    const ics = buildRecurringIcs('Steady reminders', [
      { uid: 'med-1-0800', title: 'Take medicine', description: 'With food', startDay: '2026-11-21', time: '08:00', durationMin: 5, weekdays: [], until: null, alarmMinutes: 0 },
      { uid: 'weigh', title: 'Weigh-in', description: 'Morning, before breakfast', startDay: '2026-11-22', time: '07:30', durationMin: 5, weekdays: [0], until: '2027-05-13', alarmMinutes: null },
    ]);
    expect(ics).toContain('RRULE:FREQ=DAILY\r\n');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU;UNTIL=20270513T235959');
    expect(ics).toContain('DTSTART:20261121T080000');
    expect(ics).toContain('TRIGGER:-PT0M');
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(1);
  });
});

describe('text helpers', () => {
  it('escapes special characters', () => {
    expect(escapeText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
  });

  it('folds long lines with a leading space and leaves short ones alone', () => {
    expect(foldLine('short')).toBe('short');
    const folded = foldLine('X'.repeat(160));
    expect(folded.split('\r\n ').join('')).toBe('X'.repeat(160));
    expect(folded.split('\r\n')[0]).toHaveLength(75);
  });
});
