import { describe, expect, it } from 'vitest';
import { activeMinutesByDay, computeMilestones, goalProgress, type ActivityData } from './logic';

const empty: ActivityData = { cardio: [], workouts: [], checkIns: [], journalDays: [], latestWeightKg: null };
const walk = (day: string, min: number) => ({ day, duration_min: min, activity: 'Walk' });
const workout = (day: string, minutes: number | null) => ({
  day,
  started_at: `${day}T07:00:00Z`,
  ended_at: minutes == null ? null : new Date(Date.parse(`${day}T07:00:00Z`) + minutes * 60000).toISOString(),
});

describe('activeMinutesByDay', () => {
  it('adds cardio and finished workouts, capping very long workouts', () => {
    const m = activeMinutesByDay({ cardio: [walk('2026-03-02', 20)], workouts: [workout('2026-03-02', 40), workout('2026-03-03', null), workout('2026-03-04', 600)] });
    expect(m.get('2026-03-02')).toBe(60);
    expect(m.get('2026-03-03')).toBe(0);
    expect(m.get('2026-03-04')).toBe(180);
  });
});

describe('goalProgress', () => {
  const today = '2026-03-05'; // Thursday; Monday-start week begins 2 March

  it('weekly active minutes only counts this week', () => {
    const data = { ...empty, cardio: [walk('2026-03-01', 60), walk('2026-03-02', 30), walk('2026-03-04', 45)] };
    expect(goalProgress({ kind: 'weekly_activity_minutes', target: 150, start_value: null, current_value: null }, data, today, 1)).toEqual({ current: 75, percent: 50, reached: false });
  });

  it('longest walk uses the best single walk ever', () => {
    const data = { ...empty, cardio: [walk('2026-02-01', 22), walk('2026-03-01', 31), { day: '2026-03-02', duration_min: 60, activity: 'Cycle' }] };
    expect(goalProgress({ kind: 'longest_walk', target: 30, start_value: null, current_value: null }, data, today, 1)).toMatchObject({ current: 31, reached: true, percent: 100 });
  });

  it('weight progress works for losing and gaining', () => {
    const lose = goalProgress({ kind: 'weight', target: 90, start_value: 100, current_value: null }, { ...empty, latestWeightKg: 96 }, today, 1);
    expect(lose).toEqual({ current: 96, percent: 40, reached: false });
    const gain = goalProgress({ kind: 'weight', target: 60, start_value: 55, current_value: null }, { ...empty, latestWeightKg: 61 }, today, 1);
    expect(gain).toMatchObject({ reached: true, percent: 100 });
  });

  it('steps average uses the last 7 days with steps logged', () => {
    const data = { ...empty, checkIns: [{ day: '2026-03-05', mood: null, steps: 8000 }, { day: '2026-03-01', mood: null, steps: 4000 }, { day: '2026-02-20', mood: null, steps: 20000 }] };
    expect(goalProgress({ kind: 'steps_daily_avg', target: 7000, start_value: null, current_value: null }, data, today, 1).current).toBe(6000);
  });

  it('custom goals use the value entered by hand', () => {
    expect(goalProgress({ kind: 'custom', target: 10, start_value: null, current_value: 4 }, empty, today, 1)).toEqual({ current: 4, percent: 40, reached: false });
    expect(goalProgress({ kind: 'custom', target: 10, start_value: null, current_value: null }, empty, today, 1).current).toBeNull();
  });
});

describe('computeMilestones', () => {
  const get = (ms: ReturnType<typeof computeMilestones>, key: string) => ms.find((m) => m.key === key)!.achievedOn;

  it('dates the first 150-minute week at the day the total crossed 150', () => {
    const data = { ...empty, cardio: [walk('2026-03-02', 50), walk('2026-03-03', 50), walk('2026-03-05', 50), walk('2026-03-06', 50)] };
    const ms = computeMilestones(data, 1);
    expect(get(ms, 'week_150')).toBe('2026-03-05');
    expect(get(ms, 'first_move')).toBe('2026-03-02');
    expect(get(ms, 'walk_30')).toBe('2026-03-02');
  });

  it('needs seven consecutive check-in days', () => {
    const days = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11'];
    const ms = computeMilestones({ ...empty, checkIns: days.map((day) => ({ day, mood: 3, steps: null })) }, 1);
    expect(get(ms, 'checkin_7')).toBe('2026-03-11');
  });

  it('leaves unreached milestones empty', () => {
    const ms = computeMilestones(empty, 1);
    expect(ms.every((m) => m.achievedOn == null)).toBe(true);
    expect(ms).toHaveLength(7);
  });
});
