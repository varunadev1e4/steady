import { describe, expect, it } from 'vitest';
import { PLANS, STRENGTH, STRENGTH_LIBRARY, STRENGTH_PHASES, WALKING, YOGA, phaseForWeek } from './content';
import { formatDuration, isPlannedDay, planProgress, sessionsBetween, timedMinutes } from './logic';

describe('plan content', () => {
  it('has one entry per week for every plan', () => {
    for (const p of PLANS) {
      expect(p.weeks.map((w) => w.week)).toEqual(Array.from({ length: p.weeksTotal }, (_, i) => i + 1));
    }
  });

  it('walking steps add up to each week’s stated minutes', () => {
    for (const w of WALKING.weeks) expect(timedMinutes(w.steps)).toBe(w.minutes);
  });

  it('walking builds gradually and reaches 150 minutes a week by week 8', () => {
    const weekly = WALKING.weeks.map((w) => w.minutes * w.sessions);
    for (let i = 1; i < weekly.length; i++) {
      expect(weekly[i]).toBeGreaterThanOrEqual(weekly[i - 1]);
      // Never more than ~30% more than the week before.
      expect(weekly[i]).toBeLessThanOrEqual(Math.ceil(weekly[i - 1] * 1.3));
    }
    expect(weekly[7]).toBe(150);
    expect(weekly[0]).toBe(50);
  });

  it('strength targets only use exercises from the plan library, with sane ranges', () => {
    const names = new Set<string>(STRENGTH_LIBRARY.map((e) => e.name));
    for (const phase of STRENGTH_PHASES) {
      for (const t of phase.targets) {
        expect(names.has(t.name)).toBe(true);
        expect(t.rep_min).toBeLessThanOrEqual(t.rep_max);
        expect(t.target_sets).toBeGreaterThanOrEqual(1);
        expect(t.target_sets).toBeLessThanOrEqual(3);
      }
    }
  });

  it('strength phases cover every week in order', () => {
    expect(STRENGTH_PHASES.flatMap((p) => p.weeks)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(phaseForWeek(5)).toBe(STRENGTH_PHASES[2]);
    expect(STRENGTH.weeks[0].steps.some((s) => s.name === 'Chair sit-to-stand')).toBe(true);
  });

  it('yoga sessions match their stated length within a minute', () => {
    for (const w of YOGA.weeks) expect(Math.abs(timedMinutes(w.steps) - w.minutes)).toBeLessThanOrEqual(1);
  });

  it('every step explains how to do it', () => {
    for (const p of PLANS) for (const w of p.weeks) for (const s of w.steps) {
      expect(s.cues.length).toBeGreaterThan(0);
      expect(s.seconds != null || s.reps != null).toBe(true);
    }
  });
});

describe('planProgress', () => {
  it('counts plan weeks from the start date', () => {
    expect(planProgress('2026-03-01', '2026-03-01', 12)).toMatchObject({ week: 1, from: '2026-03-01', to: '2026-03-07' });
    expect(planProgress('2026-03-01', '2026-03-08', 12)).toMatchObject({ week: 2, from: '2026-03-08' });
  });

  it('handles a future start and a finished plan', () => {
    expect(planProgress('2026-03-10', '2026-03-01', 8)).toMatchObject({ week: 1, notStarted: true });
    expect(planProgress('2026-01-01', '2026-03-31', 8)).toMatchObject({ week: 8, finished: true });
  });
});

describe('sessions and days', () => {
  it('counts distinct days inside the window', () => {
    expect(sessionsBetween(['2026-03-01', '2026-03-01', '2026-03-03', '2026-03-09'], '2026-03-01', '2026-03-07')).toBe(2);
  });

  it('checks planned weekdays', () => {
    expect(isPlannedDay([1, 3, 5], '2026-03-02')).toBe(true); // Monday
    expect(isPlannedDay([1, 3, 5], '2026-03-03')).toBe(false);
  });

  it('formats durations', () => {
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(0)).toBe('0:00');
  });
});
