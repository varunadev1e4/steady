import { describe, expect, it } from 'vitest';
import { ageOn, defaultDueDate, estimateCalories, pathWeight, smoothedWeight, suggestedProtein, trackStatus, weightPlan } from './weight';

describe('weightPlan', () => {
  it('10 kg by mid-May from late November is a steady, safe pace', () => {
    const p = weightPlan({ startKg: 100, targetKg: 90, startDay: '2026-11-20', dueDay: '2027-05-13', currentKg: 100, today: '2026-11-20' });
    expect(p.daysLeft).toBe(174);
    expect(p.neededPerWeek).toBeCloseTo(0.4, 1);
    expect(p.pace).toBe('steady');
  });

  it('flags paces above 1 kg a week', () => {
    expect(weightPlan({ startKg: 100, targetKg: 90, startDay: '2027-04-01', dueDay: '2027-05-13', currentKg: 100, today: '2027-04-01' }).pace).toBe('too_fast');
  });

  it('recognises reaching the goal and passing the date', () => {
    expect(weightPlan({ startKg: 100, targetKg: 90, startDay: '2026-11-20', dueDay: '2027-05-13', currentKg: 89.8, today: '2027-03-01' }).pace).toBe('done');
    expect(weightPlan({ startKg: 100, targetKg: 90, startDay: '2026-11-20', dueDay: '2027-05-13', currentKg: 93, today: '2027-05-20' }).pace).toBe('past_due');
  });
});

describe('path and status', () => {
  it('interpolates the goal path linearly and clamps at the ends', () => {
    expect(pathWeight(100, 90, '2027-01-01', '2027-01-11', '2027-01-06')).toBe(95);
    expect(pathWeight(100, 90, '2027-01-01', '2027-01-11', '2026-12-01')).toBe(100);
    expect(pathWeight(100, 90, '2027-01-01', '2027-01-11', '2027-02-01')).toBe(90);
  });

  it('smooths recent weigh-ins and tolerates half a kilo either way', () => {
    const s = smoothedWeight([{ day: '2027-01-10', kg: 96 }, { day: '2027-01-14', kg: 95 }, { day: '2026-12-01', kg: 99 }], '2027-01-15');
    expect(s).toBe(95.5);
    expect(trackStatus(95.5, 95.2)).toBe('on_track');
    expect(trackStatus(94.5, 95.2)).toBe('ahead');
    expect(trackStatus(96, 95.2)).toBe('behind');
    expect(trackStatus(null, 95)).toBe('no_data');
  });

  it('falls back to the latest weigh-in when none are recent', () => {
    expect(smoothedWeight([{ day: '2026-10-01', kg: 101 }, { day: '2026-11-01', kg: 100 }], '2027-01-15')).toBe(100);
  });
});

describe('dates', () => {
  it('uses the next birthday, skipping one that is under 4 weeks away', () => {
    expect(defaultDueDate('1994-05-13', '2026-11-20')).toBe('2027-05-13');
    expect(defaultDueDate('1994-05-13', '2027-05-01')).toBe('2028-05-13');
    expect(defaultDueDate(null, '2026-11-20')).toBeNull();
  });

  it('computes age on a date', () => {
    expect(ageOn('1994-05-13', '2026-11-20')).toBe(32);
    expect(ageOn('1994-05-13', '2027-05-12')).toBe(32);
    expect(ageOn('1994-05-13', '2027-05-13')).toBe(33);
  });
});

describe('estimateCalories (Mifflin–St Jeor)', () => {
  it('computes resting and maintenance energy', () => {
    const e = estimateCalories({ sex: 'male', age: 32, heightCm: 175, weightKg: 100, activity: 'sedentary', neededPerWeek: 0.4 });
    expect(e.bmr).toBe(1939); // 1000 + 1093.75 − 160 + 5
    expect(e.maintenance).toBe(2327);
    expect(e.target).toBe(1900); // 2327 − 440, rounded to 50
    expect(e.perWeek).toBeCloseTo(0.39, 2);
    expect(e.floored).toBe(false);
  });

  it('never goes below 1,200 kcal (women) or 1,500 kcal (men)', () => {
    const e = estimateCalories({ sex: 'female', age: 30, heightCm: 155, weightKg: 60, activity: 'sedentary', neededPerWeek: 1 });
    expect(e.target).toBe(1200);
    expect(e.floored).toBe(true);
    expect(estimateCalories({ sex: 'male', age: 40, heightCm: 165, weightKg: 70, activity: 'sedentary', neededPerWeek: 1 }).target).toBe(1500);
  });

  it('caps the deficit at 750 kcal a day', () => {
    const e = estimateCalories({ sex: 'male', age: 32, heightCm: 180, weightKg: 140, activity: 'active', neededPerWeek: 2 });
    expect(e.maintenance - e.target).toBeLessThanOrEqual(775);
  });

  it('suggests protein from goal weight', () => {
    expect(suggestedProtein(90)).toBe(110);
  });
});
