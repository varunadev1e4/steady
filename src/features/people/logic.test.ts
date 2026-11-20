import { describe, expect, it } from 'vitest';
import { daysOverdue, nextBirthday, reachOutList, upcomingBirthdays } from './logic';

const person = (over: Record<string, unknown> = {}) => ({
  id: 'p',
  contact_every_days: 14,
  last_contacted_on: null as string | null,
  created_at: '2026-01-01T10:00:00Z',
  archived_at: null as string | null,
  birthday_month: null as number | null,
  birthday_day: null as number | null,
  ...over,
});

describe('reach out', () => {
  it('measures overdue days from the last contact, or from when they were added', () => {
    expect(daysOverdue(person({ last_contacted_on: '2026-03-01' }), '2026-03-20')).toBe(5);
    expect(daysOverdue(person(), '2026-01-10')).toBe(-5);
    expect(daysOverdue(person({ contact_every_days: null }), '2026-03-01')).toBe(-Infinity);
  });

  it('lists only due people, most overdue first, skipping archived', () => {
    const list = reachOutList(
      [
        person({ id: 'a', last_contacted_on: '2026-03-10' }), // 0 overdue (due today)
        person({ id: 'b', last_contacted_on: '2026-02-01' }), // 33
        person({ id: 'c', last_contacted_on: '2026-03-20' }), // not due
        person({ id: 'd', last_contacted_on: '2026-01-01', archived_at: '2026-02-01' }),
      ],
      '2026-03-24',
    );
    expect(list.map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('birthdays', () => {
  it('rolls over to next year once passed', () => {
    expect(nextBirthday(3, 1, '2026-03-02')).toBe('2027-03-01');
    expect(nextBirthday(3, 2, '2026-03-02')).toBe('2026-03-02');
  });

  it('handles 29 February in non-leap years', () => {
    expect(nextBirthday(2, 29, '2026-01-10')).toBe('2026-02-28');
    expect(nextBirthday(2, 29, '2027-03-01')).toBe('2028-02-29');
  });

  it('lists birthdays in the next 30 days, soonest first, across the year end', () => {
    const list = upcomingBirthdays(
      [
        person({ id: 'a', birthday_month: 1, birthday_day: 5 }),
        person({ id: 'b', birthday_month: 12, birthday_day: 28 }),
        person({ id: 'c', birthday_month: 6, birthday_day: 1 }),
      ],
      '2026-12-20',
    );
    expect(list.map((p) => [p.id, p.inDays])).toEqual([
      ['b', 8],
      ['a', 16],
    ]);
  });
});
