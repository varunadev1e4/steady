import { describe, expect, it } from 'vitest';
import { todayISO } from '@/utils/dates';
import {
  canToggle,
  computeStreaks,
  consistency,
  isDueToday,
  monthStatuses,
  type HabitRules,
} from './streaks';

const daily = (over: Partial<HabitRules> = {}): HabitRules => ({
  frequency: 'daily',
  weekdays: [],
  times_per_week: null,
  grace_enabled: false,
  start_date: '2026-03-01',
  ...over,
});

const range = (from: number, to: number, month = '2026-03') =>
  Array.from({ length: to - from + 1 }, (_, i) => `${month}-${String(from + i).padStart(2, '0')}`);

describe('daily streaks', () => {
  it('counts consecutive days ending today', () => {
    expect(computeStreaks(daily(), range(1, 10), '2026-03-10', 1)).toMatchObject({ current: 10, best: 10 });
  });

  it('does not break because today is not done yet', () => {
    expect(computeStreaks(daily(), range(1, 9), '2026-03-10', 1).current).toBe(9);
  });

  it('breaks after a missed day without grace', () => {
    const done = [...range(1, 5), ...range(7, 9)];
    expect(computeStreaks(daily(), done, '2026-03-10', 1)).toMatchObject({ current: 3, best: 5 });
  });

  it('forgives one missed day with grace, without counting it', () => {
    const done = [...range(1, 5), ...range(7, 9)];
    expect(computeStreaks(daily({ grace_enabled: true }), done, '2026-03-10', 1)).toMatchObject({
      current: 8,
      best: 8,
    });
  });

  it('only forgives once every 7 days', () => {
    // misses on the 4th and 7th: second miss is within 7 days of the first
    const done = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05', '2026-03-06', '2026-03-08', '2026-03-09'];
    expect(computeStreaks(daily({ grace_enabled: true }), done, '2026-03-09', 1).current).toBe(2);
  });

  it('two missed days in a row break the streak even with grace', () => {
    const done = [...range(1, 5), ...range(8, 9)];
    expect(computeStreaks(daily({ grace_enabled: true }), done, '2026-03-09', 1).current).toBe(2);
  });

  it('grace does not invent a streak from nothing', () => {
    expect(computeStreaks(daily({ grace_enabled: true }), [], '2026-03-05', 1).current).toBe(0);
  });

  it('counts backfilled completions, even before the start date', () => {
    const habit = daily({ start_date: '2026-03-08' });
    const done = range(1, 10);
    expect(computeStreaks(habit, done, '2026-03-10', 1)).toMatchObject({ current: 10, best: 10 });
  });

  it('returns zero for a habit that starts in the future', () => {
    expect(computeStreaks(daily({ start_date: '2026-04-01' }), [], '2026-03-10', 1)).toMatchObject({
      current: 0,
      best: 0,
    });
  });
});

describe('specific-weekday habits', () => {
  // Mon/Wed/Fri. March 2026: 2nd is a Monday.
  const mwf = daily({ frequency: 'weekdays', weekdays: [1, 3, 5] });

  it('ignores days that are not scheduled', () => {
    const done = ['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-09'];
    expect(computeStreaks(mwf, done, '2026-03-10', 1).current).toBe(4); // Tue 10th not due
  });

  it('breaks on a missed scheduled day', () => {
    const done = ['2026-03-02', '2026-03-06', '2026-03-09'];
    expect(computeStreaks(mwf, done, '2026-03-10', 1)).toMatchObject({ current: 2, best: 2 });
  });
});

describe('weekly-target habits', () => {
  const thrice = daily({ frequency: 'weekly', times_per_week: 3, start_date: '2026-03-02' });

  it('counts weeks that meet the target, with the current week pending', () => {
    // Weeks starting Mon 2, 9, 16; today is Wed 18th with 1 done this week.
    const done = ['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-16'];
    expect(computeStreaks(thrice, done, '2026-03-18', 1)).toMatchObject({ current: 2, best: 2, unit: 'week' });
  });

  it('includes the current week once the target is met', () => {
    const done = ['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-16', '2026-03-17', '2026-03-18'];
    // week of 9th missed → streak restarts
    expect(computeStreaks(thrice, done, '2026-03-18', 1)).toMatchObject({ current: 1, best: 1 });
  });

  it('forgives one missed week with grace', () => {
    const done = ['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-16', '2026-03-17', '2026-03-18'];
    expect(computeStreaks({ ...thrice, grace_enabled: true }, done, '2026-03-18', 1).current).toBe(2);
  });

  it('depends on the week start setting', () => {
    // Sun 1 Mar .. Sat 7 Mar is one Sunday-week; with Monday weeks the 1st falls in the previous week.
    const habit = daily({ frequency: 'weekly', times_per_week: 2, start_date: '2026-03-01' });
    const done = ['2026-03-01', '2026-03-02'];
    expect(computeStreaks(habit, done, '2026-03-08', 0).current).toBe(1);
    expect(computeStreaks(habit, done, '2026-03-08', 1).current).toBe(0);
  });

  it('stays on today’s list until the weekly target is met', () => {
    const done = new Set(['2026-03-16', '2026-03-17']);
    expect(isDueToday(thrice, done, '2026-03-18', 1)).toBe(true);
    done.add('2026-03-18');
    expect(isDueToday(thrice, done, '2026-03-18', 1)).toBe(true); // done today: still shown so it can be undone
    expect(isDueToday(thrice, done, '2026-03-19', 1)).toBe(false);
  });
});

describe('time zone boundaries', () => {
  it('the same instant can be a different "today", which changes the streak', () => {
    const instant = new Date('2026-03-10T20:00:00Z'); // 11 Mar 01:30 in India, 10 Mar in LA
    const done = range(1, 10);
    const india = todayISO('Asia/Kolkata', instant);
    const la = todayISO('America/Los_Angeles', instant);
    expect(computeStreaks(daily(), done, india, 1).current).toBe(10); // 11th pending
    expect(computeStreaks(daily(), done, la, 1).current).toBe(10);
    // A completion logged "today" in India lands on the 11th and extends the streak there.
    expect(computeStreaks(daily(), [...done, india], india, 1).current).toBe(11);
  });
});

describe('consistency', () => {
  it('ignores today until it is done and never counts the future', () => {
    const c = consistency(daily(), range(1, 4), '2026-03-01', '2026-03-31', '2026-03-05', 1);
    expect(c).toEqual({ done: 4, due: 4, percent: 100 });
  });

  it('reports null when nothing was due', () => {
    expect(consistency(daily({ start_date: '2026-04-01' }), [], '2026-03-01', '2026-03-31', '2026-03-31', 1).percent).toBeNull();
  });

  it('caps weekly habits at their target', () => {
    const habit = daily({ frequency: 'weekly', times_per_week: 2, start_date: '2026-03-02' });
    const c = consistency(habit, ['2026-03-02', '2026-03-03', '2026-03-04'], '2026-03-02', '2026-03-08', '2026-03-08', 1);
    expect(c).toEqual({ done: 2, due: 2, percent: 100 });
  });
});

describe('month grid and backfill', () => {
  it('labels each day', () => {
    const grid = monthStatuses(daily({ start_date: '2026-03-03' }), new Set(['2026-03-04']), '2026-03', '2026-03-06');
    const s = Object.fromEntries(grid.map((g) => [g.day, g.status]));
    expect(grid).toHaveLength(31);
    expect(s['2026-03-01']).toBe('before');
    expect(s['2026-03-03']).toBe('missed');
    expect(s['2026-03-04']).toBe('done');
    expect(s['2026-03-06']).toBe('pending');
    expect(s['2026-03-07']).toBe('future');
  });

  it('allows toggling today and the 13 days before it only', () => {
    expect(canToggle('2026-03-10', '2026-03-10')).toBe(true);
    expect(canToggle('2026-02-25', '2026-03-10')).toBe(true);
    expect(canToggle('2026-02-24', '2026-03-10')).toBe(false);
    expect(canToggle('2026-03-11', '2026-03-10')).toBe(false);
  });
});
