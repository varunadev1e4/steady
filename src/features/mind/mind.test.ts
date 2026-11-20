import { describe, expect, it } from 'vitest';
import { ASSESSMENTS, needsSafetySupport, score, severity } from './assessments';
import { liftByCategory, topActivities } from './activities';
import { partOfDay, summarise } from './cravings';
import { bedMinutes, hoursBetween, regularity } from '@/features/sleep/logic';

describe('PHQ-9 and GAD-7', () => {
  it('have the standard number of items and maximum scores', () => {
    expect(ASSESSMENTS.phq9.items).toHaveLength(9);
    expect(ASSESSMENTS.gad7.items).toHaveLength(7);
    expect(ASSESSMENTS.phq9.max).toBe(27);
    expect(ASSESSMENTS.gad7.max).toBe(21);
  });

  it('uses the standard severity bands', () => {
    expect([0, 4, 5, 9, 10, 14, 15, 19, 20, 27].map((s) => severity('phq9', s))).toEqual([
      'Minimal', 'Minimal', 'Mild', 'Mild', 'Moderate', 'Moderate', 'Moderately severe', 'Moderately severe', 'Severe', 'Severe',
    ]);
    expect(severity('gad7', 15)).toBe('Severe');
    expect(severity('gad7', 14)).toBe('Moderate');
    expect(score([1, 2, 3])).toBe(6);
  });

  it('flags the self-harm question whenever it is answered above zero', () => {
    expect(needsSafetySupport('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 1])).toBe(true);
    expect(needsSafetySupport('phq9', [3, 3, 3, 3, 3, 3, 3, 3, 0])).toBe(false);
    expect(needsSafetySupport('gad7', [3, 3, 3, 3, 3, 3, 3])).toBe(false);
  });
});

describe('activities', () => {
  const a = (title: string, category: string, before: number, after: number, status = 'done') => ({ title, category, status, mood_before: before, mood_after: after });

  it('averages mood lift by category once there are enough ratings', () => {
    const items = [a('Walk', 'movement', 4, 6), a('Walk', 'movement', 5, 6), a('Stretch', 'movement', 3, 6), a('Call Mum', 'connection', 4, 7), a('Skipped', 'pleasure', 4, 9, 'skipped')];
    const stats = Object.fromEntries(liftByCategory(items).map((s) => [s.key, [s.n, s.lift]]));
    expect(stats).toEqual({ movement: [3, 2], connection: [1, null] });
  });

  it('ranks activities that lifted mood, ignoring one-offs and dips', () => {
    const items = [a('Walk', 'movement', 4, 6), a('walk', 'movement', 4, 7), a('Admin', 'achievement', 5, 4), a('Admin', 'achievement', 5, 4), a('Call', 'connection', 3, 8)];
    expect(topActivities(items).map((s) => [s.label, s.lift])).toEqual([['Walk', 2.5]]);
  });
});

describe('cravings', () => {
  it('buckets by part of day and summarises outcomes', () => {
    expect([6, 13, 20, 23, 2].map(partOfDay)).toEqual(['morning', 'afternoon', 'evening', 'night', 'night']);
    const s = summarise(
      [
        { trigger: 'stressed', logged_at: 'x21', outcome: 'passed' },
        { trigger: 'stressed', logged_at: 'x20', outcome: 'ate_more' },
        { trigger: 'bored', logged_at: 'x15', outcome: null },
      ],
      (iso) => Number(iso.slice(1)),
    );
    expect(s.byTrigger[0]).toEqual(['stressed', 2]);
    expect(s.byTime[0]).toEqual(['evening', 2]);
    expect(s.managedPercent).toBe(50);
  });
});

describe('sleep timing', () => {
  it('measures across midnight', () => {
    expect(hoursBetween('23:30', '07:00')).toBe(7.5);
    expect(hoursBetween('01:00', '08:15')).toBe(7.5); // 7h15 rounds to nearest half hour
    expect(bedMinutes('23:00')).toBeLessThan(bedMinutes('01:00'));
  });

  it('reports spread in minutes and a plain label', () => {
    const r = regularity([
      { bedtime: '23:00', wake_time: '07:00' },
      { bedtime: '23:30', wake_time: '07:00' },
      { bedtime: '00:00', wake_time: '07:30' },
    ]);
    expect(r.bedtimeSpread).toBe(24);
    expect(r.avgBedtime).toBe('23:30');
    expect(r.avgWake).toBe('07:10');
    expect(r.label).toBe('very regular');
    expect(regularity([{ bedtime: '22:00', wake_time: null }]).label).toBeNull();
  });
});
