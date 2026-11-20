import { describe, expect, it } from 'vitest';
import { gentleSummary } from './summary';

describe('gentleSummary', () => {
  it('matches the example from the brief', () => {
    expect(
      gentleSummary({ checkedIn: true, habits: { due: 5, done: 3 }, workout: 'planned', tasksDue: 2 }),
    ).toBe('3 of 5 habits done, no workout yet, 2 tasks due.');
  });

  it('celebrates quietly when everything is done', () => {
    expect(gentleSummary({ checkedIn: true, habits: { due: 1, done: 1 }, workout: 'done', tasksDue: 0 })).toBe(
      'All 1 habit done, workout done.',
    );
  });

  it('mentions a waiting check-in and rest days', () => {
    expect(gentleSummary({ checkedIn: false, habits: null, workout: 'rest', tasksDue: 1 })).toBe(
      'Check-in waiting, rest day, 1 task due.',
    );
  });

  it('has a calm default when there is nothing to report', () => {
    expect(gentleSummary({ checkedIn: null, habits: { due: 0, done: 0 }, workout: null, tasksDue: null })).toBe(
      'A fresh day. Start wherever feels easiest.',
    );
  });
});
