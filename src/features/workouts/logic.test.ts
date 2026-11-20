import { describe, expect, it } from 'vitest';
import {
  epley1RM,
  formatWeight,
  fromKg,
  overloadSuggestion,
  personalRecords,
  plannedTemplate,
  setsPerMuscle,
  toKg,
} from './logic';

describe('units', () => {
  it('round-trips pounds through kilograms', () => {
    expect(formatWeight(toKg(135, 'lb'), 'lb')).toBe('135');
    expect(formatWeight(toKg(62.5, 'kg'), 'kg')).toBe('62.5');
    expect(fromKg(100, 'lb')).toBeCloseTo(220.46, 2);
  });
});

describe('overloadSuggestion', () => {
  it('suggests adding weight when every set hit the top of the range', () => {
    const s = overloadSuggestion(
      [
        { weight_kg: 60, reps: 10 },
        { weight_kg: 60, reps: 10 },
        { weight_kg: 60, reps: 11 },
      ],
      10,
      2.5,
      'kg',
    );
    expect(s).toMatchObject({ kind: 'increase', weight_kg: 62.5 });
  });

  it('suggests repeating when any set fell short', () => {
    const s = overloadSuggestion(
      [
        { weight_kg: 60, reps: 10 },
        { weight_kg: 60, reps: 8 },
      ],
      10,
      2.5,
      'kg',
    );
    expect(s).toMatchObject({ kind: 'repeat', weight_kg: 60 });
  });

  it('uses the increment in pounds when the user works in pounds', () => {
    const s = overloadSuggestion([{ weight_kg: toKg(135, 'lb'), reps: 12 }], 12, 5, 'lb');
    expect(s.kind).toBe('increase');
    if (s.kind === 'increase') expect(formatWeight(s.weight_kg, 'lb')).toBe('140');
  });

  it('has nothing to say without history', () => {
    expect(overloadSuggestion([], 10, 2.5, 'kg')).toEqual({ kind: 'none' });
  });

  it('does not add weight to bodyweight movements', () => {
    expect(overloadSuggestion([{ weight_kg: 0, reps: 12 }], 12, 2.5, 'kg').kind).toBe('repeat');
  });
});

describe('epley1RM and personal records', () => {
  it('uses the Epley formula', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 2);
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(0, 5)).toBe(0);
  });

  it('finds the heaviest set and best estimated 1RM separately', () => {
    const pr = personalRecords([
      { day: '2026-01-01', weight_kg: 100, reps: 1 },
      { day: '2026-01-08', weight_kg: 90, reps: 8 }, // e1RM 114
      { day: '2026-01-15', weight_kg: 95, reps: 0 }, // failed set ignored
    ]);
    expect(pr.heaviest?.day).toBe('2026-01-01');
    expect(pr.best1RM?.day).toBe('2026-01-08');
    expect(pr.best1RM?.value_kg).toBeCloseTo(114, 0);
  });
});

describe('setsPerMuscle and plannedTemplate', () => {
  it('counts completed working sets only', () => {
    const muscles: Record<string, 'chest' | 'back'> = { a: 'chest', b: 'back' };
    const out = setsPerMuscle(
      [
        { exercise_id: 'a', completed: true, is_warmup: false },
        { exercise_id: 'a', completed: true, is_warmup: true },
        { exercise_id: 'a', completed: false, is_warmup: false },
        { exercise_id: 'b', completed: true, is_warmup: false },
      ],
      (id) => muscles[id],
    );
    expect(out).toEqual({ chest: 1, back: 1 });
  });

  it('picks the first active template planned for the weekday', () => {
    const t = [
      { id: 'x', weekdays: [1], archived_at: '2026-01-01', sort_order: 0 },
      { id: 'y', weekdays: [1, 4], archived_at: null, sort_order: 2 },
      { id: 'z', weekdays: [1], archived_at: null, sort_order: 1 },
    ];
    expect(plannedTemplate(t, 1)?.id).toBe('z');
    expect(plannedTemplate(t, 3)).toBeNull();
  });
});
